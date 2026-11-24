import { syncBoundConnectors } from './geometry';
import type {
  CanvasElement,
  ProjectDocument,
  SearchResultItem,
  Slide,
  SymbolDefinition,
  TemplateDefinition,
} from '../types/studio';

export function createId(prefix = 'el'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

export function cloneElement(el: CanvasElement, offset = 20): CanvasElement {
  return {
    ...el,
    id: createId(el.type),
    x: el.x + offset,
    y: el.y + offset,
    seed: createSeed(),
    points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
    symbolPaths: el.symbolPaths ? [...el.symbolPaths] : undefined,
    reactions: el.reactions ? el.reactions.map((r) => ({ ...r })) : undefined,
    startBinding: null,
    endBinding: null,
  };
}

export function getActiveElements(project: ProjectDocument): CanvasElement[] {
  if (project.mode === 'whiteboard') {
    return project.boardElements;
  }
  const slide = project.slides.find((s) => s.id === project.activeSlideId) ?? project.slides[0];
  return slide ? slide.elements : [];
}

export function setActiveElements(
  project: ProjectDocument,
  elements: CanvasElement[]
): ProjectDocument {
  const synced = syncBoundConnectors(elements);
  if (project.mode === 'whiteboard') {
    return {
      ...project,
      updatedAt: Date.now(),
      boardElements: synced,
    };
  }
  return {
    ...project,
    updatedAt: Date.now(),
    slides: project.slides.map((s) =>
      s.id === project.activeSlideId ? { ...s, elements: synced } : s
    ),
  };
}

export function addSlideToProject(
  project: ProjectDocument,
  background = '#FFFFFF'
): ProjectDocument {
  const newSlide: Slide = {
    id: createId('slide'),
    title: `Slide ${project.slides.length + 1}`,
    background,
    elements: [],
    notes: '',
    transition: 'fade',
  };
  const activeIdx = project.slides.findIndex((s) => s.id === project.activeSlideId);
  const insertAt = activeIdx >= 0 ? activeIdx + 1 : project.slides.length;
  const slides = [...project.slides];
  slides.splice(insertAt, 0, newSlide);
  return {
    ...project,
    updatedAt: Date.now(),
    slides,
    activeSlideId: newSlide.id,
  };
}

export function duplicateSlideInProject(
  project: ProjectDocument,
  slideId: string
): ProjectDocument {
  const idx = project.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return project;
  const source = project.slides[idx];
  const idMap = new Map<string, string>();
  const clonedElements = source.elements.map((el) => {
    const nextId = createId(el.type);
    idMap.set(el.id, nextId);
    return {
      ...el,
      id: nextId,
      seed: createSeed(),
      points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
      symbolPaths: el.symbolPaths ? [...el.symbolPaths] : undefined,
      reactions: el.reactions ? el.reactions.map((r) => ({ ...r })) : undefined,
    };
  });

  // Remap connector bindings inside duplicated slide
  const remapped = clonedElements.map((el) => ({
    ...el,
    startBinding: el.startBinding && idMap.has(el.startBinding.elementId)
      ? { ...el.startBinding, elementId: idMap.get(el.startBinding.elementId)! }
      : null,
    endBinding: el.endBinding && idMap.has(el.endBinding.elementId)
      ? { ...el.endBinding, elementId: idMap.get(el.endBinding.elementId)! }
      : null,
  }));

  const copy: Slide = {
    ...source,
    id: createId('slide'),
    title: `${source.title} (Copy)`,
    elements: remapped,
  };
  const slides = [...project.slides];
  slides.splice(idx + 1, 0, copy);
  return {
    ...project,
    updatedAt: Date.now(),
    slides,
    activeSlideId: copy.id,
  };
}

export function deleteSlideFromProject(
  project: ProjectDocument,
  slideId: string
): ProjectDocument {
  if (project.slides.length <= 1) return project;
  const idx = project.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return project;
  const slides = project.slides.filter((s) => s.id !== slideId);
  const nextActive =
    project.activeSlideId === slideId
      ? slides[Math.min(idx, slides.length - 1)].id
      : project.activeSlideId;
  return {
    ...project,
    updatedAt: Date.now(),
    slides,
    activeSlideId: nextActive,
  };
}

export function reorderSlidesInProject(
  project: ProjectDocument,
  fromIndex: number,
  toIndex: number
): ProjectDocument {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= project.slides.length ||
    toIndex >= project.slides.length ||
    fromIndex === toIndex
  ) {
    return project;
  }
  const slides = [...project.slides];
  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved);
  return {
    ...project,
    updatedAt: Date.now(),
    slides,
  };
}

export function reorderElementZ(
  elements: CanvasElement[],
  selectedIds: Set<string>,
  direction: 'forward' | 'backward' | 'front' | 'back'
): CanvasElement[] {
  if (selectedIds.size === 0) return elements;
  const next = [...elements];

  if (direction === 'front') {
    const rest = next.filter((e) => !selectedIds.has(e.id));
    const sel = next.filter((e) => selectedIds.has(e.id));
    return [...rest, ...sel];
  }
  if (direction === 'back') {
    const sel = next.filter((e) => selectedIds.has(e.id));
    const rest = next.filter((e) => !selectedIds.has(e.id));
    return [...sel, ...rest];
  }
  if (direction === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) {
      if (selectedIds.has(next[i].id) && !selectedIds.has(next[i + 1].id)) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
    return next;
  }
  for (let i = 1; i < next.length; i++) {
    if (selectedIds.has(next[i].id) && !selectedIds.has(next[i - 1].id)) {
      [next[i], next[i - 1]] = [next[i - 1], next[i]];
    }
  }
  return next;
}

export function groupSelectedElements(
  elements: CanvasElement[],
  selectedIds: Set<string>
): CanvasElement[] {
  if (selectedIds.size < 2) return elements;
  const groupId = createId('grp');
  return elements.map((el) => (selectedIds.has(el.id) ? { ...el, groupId } : el));
}

export function ungroupSelectedElements(
  elements: CanvasElement[],
  selectedIds: Set<string>
): CanvasElement[] {
  const groupIds = new Set<string>();
  for (const el of elements) {
    if (selectedIds.has(el.id) && el.groupId) {
      groupIds.add(el.groupId);
    }
  }
  if (groupIds.size === 0) return elements;
  return elements.map((el) =>
    el.groupId && groupIds.has(el.groupId) ? { ...el, groupId: null } : el
  );
}

export function convertBoardFramesToSlides(project: ProjectDocument): ProjectDocument {
  const frames = project.boardElements.filter((e) => e.type === 'frame');
  if (frames.length === 0) {
    return {
      ...project,
      mode: 'presentation',
      updatedAt: Date.now(),
    };
  }

  const newSlides: Slide[] = frames.map((frame, index) => {
    const inside = project.boardElements.filter(
      (el) =>
        el.id !== frame.id &&
        el.x >= frame.x - 20 &&
        el.y >= frame.y - 20 &&
        el.x + Math.max(0, el.width) <= frame.x + frame.width + 20 &&
        el.y + Math.max(0, el.height) <= frame.y + frame.height + 20
    );
    const normalized = inside.map((el) => ({
      ...el,
      id: createId(el.type),
      x: el.x - frame.x,
      y: el.y - frame.y,
    }));
    return {
      id: createId('slide'),
      title: frame.text || frame.name || `Frame ${index + 1}`,
      background:
        frame.fillColor && frame.fillColor !== 'transparent' ? frame.fillColor : '#FFFFFF',
      elements: normalized,
      notes: '',
      transition: 'fade',
    };
  });

  return {
    ...project,
    mode: 'presentation',
    slides: newSlides,
    activeSlideId: newSlides[0].id,
    updatedAt: Date.now(),
  };
}

export interface HistoryStack {
  past: ProjectDocument[];
  future: ProjectDocument[];
}

export function createHistoryStack(): HistoryStack {
  return { past: [], future: [] };
}

export function pushHistory(
  stack: HistoryStack,
  snapshot: ProjectDocument,
  maxLength = 60
): HistoryStack {
  const past = [...stack.past, snapshot];
  if (past.length > maxLength) {
    past.shift();
  }
  return { past, future: [] };
}

export function undoHistory(
  stack: HistoryStack,
  current: ProjectDocument
): { stack: HistoryStack; project: ProjectDocument } | null {
  if (stack.past.length === 0) return null;
  const previous = stack.past[stack.past.length - 1];
  return {
    stack: {
      past: stack.past.slice(0, -1),
      future: [current, ...stack.future],
    },
    project: previous,
  };
}

export function redoHistory(
  stack: HistoryStack,
  current: ProjectDocument
): { stack: HistoryStack; project: ProjectDocument } | null {
  if (stack.future.length === 0) return null;
  const next = stack.future[0];
  return {
    stack: {
      past: [...stack.past, current],
      future: stack.future.slice(1),
    },
    project: next,
  };
}

export function searchProjectAndSymbols(
  query: string,
  project: ProjectDocument,
  symbols: SymbolDefinition[],
  templates: TemplateDefinition[]
): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  const results: SearchResultItem[] = [];

  // Search symbols first
  for (const sym of symbols) {
    if (
      !q ||
      sym.name.toLowerCase().includes(q) ||
      sym.category.toLowerCase().includes(q) ||
      sym.tags.some((t) => t.toLowerCase().includes(q))
    ) {
      results.push({
        id: `sym_${sym.id}`,
        kind: 'symbol',
        title: sym.name,
        subtitle: `Symbol · ${sym.category}`,
        targetId: sym.id,
      });
    }
  }

  // Search slides
  for (let i = 0; i < project.slides.length; i++) {
    const s = project.slides[i];
    if (!q || s.title.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q)) {
      results.push({
        id: `slide_${s.id}`,
        kind: 'slide',
        title: s.title,
        subtitle: `Slide ${i + 1} · ${s.elements.length} objects`,
        targetId: s.id,
        slideId: s.id,
      });
    }
    for (const el of s.elements) {
      const label = (el.text || el.name || el.type).trim();
      if (q && label.toLowerCase().includes(q)) {
        results.push({
          id: `el_${s.id}_${el.id}`,
          kind: 'element',
          title: label.slice(0, 48),
          subtitle: `${el.type} on ${s.title}`,
          targetId: el.id,
          slideId: s.id,
        });
      }
    }
  }

  // Search whiteboard elements
  for (const el of project.boardElements) {
    const label = (el.text || el.name || el.type).trim();
    if (q && label.toLowerCase().includes(q)) {
      results.push({
        id: `board_${el.id}`,
        kind: 'element',
        title: label.slice(0, 48),
        subtitle: `${el.type} on Whiteboard`,
        targetId: el.id,
      });
    }
  }

  // Search templates
  for (const tpl of templates) {
    if (
      !q ||
      tpl.title.toLowerCase().includes(q) ||
      tpl.category.toLowerCase().includes(q) ||
      tpl.subtitle.toLowerCase().includes(q)
    ) {
      results.push({
        id: `tpl_${tpl.id}`,
        kind: 'template',
        title: tpl.title,
        subtitle: `${tpl.mode === 'presentation' ? 'Presentation' : 'Whiteboard'} Template · ${tpl.category}`,
        targetId: tpl.id,
      });
    }
  }

  return results.slice(0, 40);
}

export function serializeProject(project: ProjectDocument): string {
  return JSON.stringify(
    {
      format: 'sketchdeck-studio-v1',
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2
  );
}

export function parseImportedProject(rawJson: string): ProjectDocument {
  const parsed = JSON.parse(rawJson);
  const candidate: ProjectDocument = parsed?.project ? parsed.project : parsed;
  if (
    !candidate ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.slides) ||
    !Array.isArray(candidate.boardElements)
  ) {
    throw new Error('Invalid SketchDeck project file.');
  }
  return {
    ...candidate,
    id: createId('proj'),
    updatedAt: Date.now(),
  };
}
