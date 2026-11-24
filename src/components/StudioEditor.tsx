import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Play,
  Presentation,
  Redo2,
  Search,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SYMBOL_LIBRARY } from '../data/symbols';
import { TEMPLATE_GALLERY } from '../data/templates';
import {
  alignElements,
  computeMindMapBranch,
  distributeElements,
  getAnchorPorts,
  getSelectionBounds,
  getSlideDimensions,
  syncBoundConnectors,
  type AlignMode,
} from '../engine/geometry';
import {
  addSlideToProject,
  cloneElement,
  convertBoardFramesToSlides,
  createHistoryStack,
  createId,
  createSeed,
  deleteSlideFromProject,
  duplicateSlideInProject,
  getActiveElements,
  groupSelectedElements,
  pushHistory,
  redoHistory,
  reorderElementZ,
  reorderSlidesInProject,
  setActiveElements,
  undoHistory,
  ungroupSelectedElements,
} from '../engine/scene';
import { deleteCustomSymbol, saveCustomSymbol, saveProject } from '../services/storage';
import type {
  AspectRatio,
  CanvasElement,
  CustomSymbol,
  GridSettings,
  ProjectDocument,
  ProjectMode,
  SearchResultItem,
  SlideTransition,
  SymbolDefinition,
  ToolType,
  ViewportState,
} from '../types/studio';
import { CanvasViewport } from './CanvasViewport';
import { ExportModal } from './ExportModal';
import { LeftDrawer, type DrawerTab } from './LeftDrawer';
import { PresenterModal } from './PresenterModal';
import { RightInspector } from './RightInspector';
import { SearchModal } from './SearchModal';
import { SlideFilmstrip } from './SlideFilmstrip';

interface StudioEditorProps {
  initialProject: ProjectDocument;
  customSymbols: CustomSymbol[];
  onRefreshCustomSymbols: () => void;
  onBackHome: () => void;
  onProjectSaved: (project: ProjectDocument) => void;
  onCreateFromTemplate: (templateId: string) => void;
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  initialProject,
  customSymbols,
  onRefreshCustomSymbols,
  onBackHome,
  onProjectSaved,
  onCreateFromTemplate,
}) => {
  const [project, setProject] = useState<ProjectDocument>(initialProject);
  const [history, setHistory] = useState(() => createHistoryStack());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [drawerTab, setDrawerTab] = useState<DrawerTab | null>('symbols');
  const [brushColor, setBrushColor] = useState('#0F172A');
  const [brushWidth, setBrushWidth] = useState(3);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number>(initialProject.updatedAt || Date.now());
  const lastSavedProjectRef = useRef<ProjectDocument>(initialProject);

  // Sync if initialProject changes (e.g. from template switch)
  useEffect(() => {
    setProject(initialProject);
    lastSavedProjectRef.current = initialProject;
    setLastSavedAt(initialProject.updatedAt || Date.now());
    setSaveStatus('saved');
    setHistory(createHistoryStack());
    setSelectedIds(new Set());
  }, [initialProject.id]);

  // Debounced auto-save to IndexedDB/localStorage
  useEffect(() => {
    if (project === lastSavedProjectRef.current) return;
    let cancelled = false;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void saveProject(project)
        .then(() => {
          if (cancelled) return;
          lastSavedProjectRef.current = project;
          setLastSavedAt(Date.now());
          setSaveStatus('saved');
          onProjectSaved(project);
        })
        .catch(() => {
          if (!cancelled) setSaveStatus('error');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project, onProjectSaved]);

  const activeElements = useMemo(() => getActiveElements(project), [project]);
  const activeSlide = useMemo(
    () => project.slides.find((s) => s.id === project.activeSlideId) ?? project.slides[0],
    [project]
  );

  const selectedElements = useMemo(
    () => activeElements.filter((el) => selectedIds.has(el.id)),
    [activeElements, selectedIds]
  );

  const commitProject = useCallback(
    (updater: (prev: ProjectDocument) => ProjectDocument, recordUndo = true) => {
      setProject((prev) => {
        if (recordUndo) {
          setHistory((h) => pushHistory(h, prev));
        }
        return updater(prev);
      });
    },
    []
  );

  const handleCommitElements = useCallback(
    (nextElements: CanvasElement[], pushUndo = true) => {
      commitProject((prev) => setActiveElements(prev, nextElements), pushUndo);
    },
    [commitProject]
  );

  const handlePreviewElements = useCallback((nextElements: CanvasElement[]) => {
    setProject((prev) => setActiveElements(prev, nextElements));
  }, []);

  const handleChangeViewport = useCallback((vp: ViewportState) => {
    setProject((prev) => ({ ...prev, viewport: vp }));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      const res = undoHistory(h, project);
      if (!res) return h;
      setProject(res.project);
      setSelectedIds(new Set());
      return res.stack;
    });
  }, [project]);

  const handleRedo = useCallback(() => {
    setHistory((h) => {
      const res = redoHistory(h, project);
      if (!res) return h;
      setProject(res.project);
      setSelectedIds(new Set());
      return res.stack;
    });
  }, [project]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const remaining = activeElements.filter(
      (el) => !selectedIds.has(el.id) || el.locked
    );
    handleCommitElements(remaining, true);
    setSelectedIds(new Set());
  }, [activeElements, selectedIds, handleCommitElements]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const clones = activeElements
      .filter((el) => selectedIds.has(el.id))
      .map((el) => cloneElement(el, 24));
    handleCommitElements([...activeElements, ...clones], true);
    setSelectedIds(new Set(clones.map((c) => c.id)));
  }, [activeElements, selectedIds, handleCommitElements]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }

      if (isTyping) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // Single-letter tool shortcuts
      const key = e.key.toLowerCase();
      const map: Record<string, ToolType> = {
        v: 'select',
        h: 'hand',
        f: 'frame',
        r: 'rect',
        d: 'diamond',
        o: 'ellipse',
        a: 'arrow',
        p: 'freedraw',
        s: 'sticky',
        t: 'text',
        e: 'eraser',
      };
      if (!e.metaKey && !e.ctrlKey && !e.altKey && map[key]) {
        setActiveTool(map[key]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleDuplicateSelected, handleDeleteSelected, selectedIds]);

  const getViewportCenter = useCallback(() => {
    if (project.mode === 'presentation') {
      const dims = getSlideDimensions(project.aspectRatio);
      return { x: dims.width / 2, y: dims.height / 2 };
    }
    const vw = typeof window !== 'undefined' ? window.innerWidth - 500 : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight - 160 : 500;
    return {
      x: (vw / 2 - project.viewport.x) / project.viewport.zoom,
      y: (vh / 2 - project.viewport.y) / project.viewport.zoom,
    };
  }, [project]);

  const handleInsertShape = useCallback(
    (type: CanvasElement['type'], overrides: Partial<CanvasElement> = {}) => {
      const center = getViewportCenter();
      const w = overrides.width ?? (type === 'frame' ? 460 : type === 'sticky' ? 200 : 180);
      const h = overrides.height ?? (type === 'frame' ? 320 : type === 'sticky' ? 160 : 110);
      const isSticky = type === 'sticky';
      const newEl: CanvasElement = {
        id: createId(type),
        type,
        x: Math.round(center.x - w / 2),
        y: Math.round(center.y - h / 2),
        width: w,
        height: h,
        angle: 0,
        opacity: 1,
        strokeColor: isSticky ? '#CA8A04' : type === 'frame' ? '#94A3B8' : '#0F172A',
        fillColor: isSticky ? '#FEF08A' : type === 'frame' ? 'rgba(255,255,255,0.7)' : '#DBEAFE',
        fillStyle: isSticky || type === 'frame' ? 'solid' : 'hachure',
        strokeWidth: 2,
        strokeStyle: type === 'frame' ? 'dashed' : 'solid',
        roughness: type === 'frame' ? 0 : 1.2,
        cornerRadius: 0,
        seed: createSeed(),
        fontFamily: 'sketch',
        fontSize: 22,
        textAlign: 'center',
        textColor: '#0F172A',
        ...overrides,
      };
      handleCommitElements([...activeElements, newEl], true);
      setSelectedIds(new Set([newEl.id]));
      setActiveTool('select');
    },
    [getViewportCenter, activeElements, handleCommitElements]
  );

  const handleInsertSymbol = useCallback(
    (sym: SymbolDefinition) => {
      const center = getViewportCenter();
      const size = 96;
      const newEl: CanvasElement = {
        id: createId('sym'),
        type: 'symbol',
        name: sym.name,
        x: Math.round(center.x - size / 2),
        y: Math.round(center.y - size / 2),
        width: size,
        height: size,
        angle: 0,
        opacity: 1,
        strokeColor: sym.defaultStroke || '#0F172A',
        fillColor: sym.defaultFill || 'none',
        fillStyle: 'solid',
        strokeWidth: 2.2,
        strokeStyle: 'solid',
        roughness: 0.6,
        cornerRadius: 0,
        seed: createSeed(),
        symbolId: sym.id,
        symbolPaths: sym.paths,
        symbolViewBox: sym.viewBox,
        text: sym.name,
        fontFamily: 'sans',
        fontSize: 13,
        textAlign: 'center',
        textColor: '#334155',
      };
      handleCommitElements([...activeElements, newEl], true);
      setSelectedIds(new Set([newEl.id]));
      setActiveTool('select');
    },
    [getViewportCenter, activeElements, handleCommitElements]
  );

  const handleInsertCustomSymbol = useCallback(
    (custom: CustomSymbol) => {
      const center = getViewportCenter();
      const b = getSelectionBounds(custom.elements);
      const ox = b ? center.x - b.cx : center.x;
      const oy = b ? center.y - b.cy : center.y;
      const grp = createId('grp');
      const clones = custom.elements.map((el) => ({
        ...cloneElement(el, 0),
        x: el.x + ox,
        y: el.y + oy,
        groupId: custom.elements.length > 1 ? grp : null,
      }));
      handleCommitElements([...activeElements, ...clones], true);
      setSelectedIds(new Set(clones.map((c) => c.id)));
      setActiveTool('select');
    },
    [getViewportCenter, activeElements, handleCommitElements]
  );

  const handleInsertImage = useCallback(
    (url: string, name: string) => {
      const center = getViewportCenter();
      const w = 360;
      const h = 240;
      const newEl: CanvasElement = {
        id: createId('img'),
        type: 'image',
        name,
        imageName: name,
        imageUrl: url,
        x: Math.round(center.x - w / 2),
        y: Math.round(center.y - h / 2),
        width: w,
        height: h,
        angle: 0,
        opacity: 1,
        strokeColor: '#0F172A',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 0,
        strokeStyle: 'solid',
        roughness: 0,
        cornerRadius: 10,
        seed: createSeed(),
      };
      handleCommitElements([...activeElements, newEl], true);
      setSelectedIds(new Set([newEl.id]));
      setActiveTool('select');
    },
    [getViewportCenter, activeElements, handleCommitElements]
  );

  const handleApplySlideLayout = useCallback(
    (layout: 'title' | 'split' | 'matrix' | 'flow' | 'callout') => {
      const dims = getSlideDimensions(project.aspectRatio);
      const base = {
        angle: 0,
        opacity: 1,
        strokeWidth: 2,
        strokeStyle: 'solid' as const,
        roughness: 1.2,
        cornerRadius: 0,
        fontFamily: 'sketch' as const,
        fontSize: 22,
        textAlign: 'center' as const,
        textColor: '#0F172A',
      };
      let next: CanvasElement[] = [];

      if (layout === 'title') {
        next = [
          {
            ...base,
            id: createId('text'),
            type: 'text',
            x: 80,
            y: 160,
            width: dims.width - 160,
            height: 90,
            strokeColor: 'transparent',
            fillColor: 'transparent',
            fillStyle: 'none',
            seed: createSeed(),
            text: 'Presentation Title Here',
            fontFamily: 'sans',
            fontSize: 44,
            fontWeight: 'bold',
          },
          {
            ...base,
            id: createId('text'),
            type: 'text',
            x: 160,
            y: 270,
            width: dims.width - 320,
            height: 60,
            strokeColor: 'transparent',
            fillColor: 'transparent',
            fillStyle: 'none',
            seed: createSeed(),
            text: 'Subtitle or concise executive takeaway',
            fontFamily: 'sans',
            fontSize: 20,
            textColor: '#475569',
          },
        ];
      } else if (layout === 'split') {
        next = [
          {
            ...base,
            id: createId('rect'),
            type: 'rect',
            x: 60,
            y: 60,
            width: 400,
            height: dims.height - 120,
            strokeColor: '#0F172A',
            fillColor: '#DBEAFE',
            fillStyle: 'hachure',
            seed: createSeed(),
            text: 'Visual / Diagram',
          },
          {
            ...base,
            id: createId('text'),
            type: 'text',
            x: 500,
            y: 110,
            width: 390,
            height: 70,
            strokeColor: 'transparent',
            fillColor: 'transparent',
            fillStyle: 'none',
            seed: createSeed(),
            text: 'Key Insight Headline',
            fontFamily: 'sans',
            fontSize: 32,
            fontWeight: 'bold',
            textAlign: 'left',
          },
          {
            ...base,
            id: createId('text'),
            type: 'text',
            x: 500,
            y: 200,
            width: 390,
            height: 180,
            strokeColor: 'transparent',
            fillColor: 'transparent',
            fillStyle: 'none',
            seed: createSeed(),
            text: 'Double-click to edit talking points, metrics, or architectural notes.',
            fontFamily: 'sans',
            fontSize: 17,
            textAlign: 'left',
            textColor: '#475569',
          },
        ];
      } else if (layout === 'matrix') {
        next = [
          {
            ...base,
            id: createId('text'),
            type: 'text',
            x: 64,
            y: 44,
            width: 500,
            height: 52,
            strokeColor: 'transparent',
            fillColor: 'transparent',
            fillStyle: 'none',
            seed: createSeed(),
            text: 'Three Core Pillars',
            fontFamily: 'sans',
            fontSize: 32,
            fontWeight: 'bold',
            textAlign: 'left',
          },
          {
            ...base,
            id: createId('sticky'),
            type: 'sticky',
            x: 68,
            y: 140,
            width: 240,
            height: 220,
            strokeColor: '#CA8A04',
            fillColor: '#FEF08A',
            fillStyle: 'solid',
            seed: createSeed(),
            text: 'Column 1\nDiscover',
          },
          {
            ...base,
            id: createId('sticky'),
            type: 'sticky',
            x: 360,
            y: 140,
            width: 240,
            height: 220,
            strokeColor: '#2563EB',
            fillColor: '#DBEAFE',
            fillStyle: 'solid',
            seed: createSeed(),
            text: 'Column 2\nSketch',
          },
          {
            ...base,
            id: createId('sticky'),
            type: 'sticky',
            x: 652,
            y: 140,
            width: 240,
            height: 220,
            strokeColor: '#16A34A',
            fillColor: '#DCFCE7',
            fillStyle: 'solid',
            seed: createSeed(),
            text: 'Column 3\nDeliver',
          },
        ];
      } else if (layout === 'flow') {
        const n1: CanvasElement = {
          ...base,
          id: createId('rect'),
          type: 'rect',
          x: 90,
          y: 210,
          width: 190,
          height: 110,
          strokeColor: '#0F172A',
          fillColor: '#DBEAFE',
          fillStyle: 'hachure',
          seed: createSeed(),
          text: 'Step 1',
        };
        const n2: CanvasElement = {
          ...base,
          id: createId('diamond'),
          type: 'diamond',
          x: 385,
          y: 195,
          width: 190,
          height: 140,
          strokeColor: '#D97706',
          fillColor: '#FEF3C7',
          fillStyle: 'hachure',
          seed: createSeed(),
          text: 'Review',
        };
        const n3: CanvasElement = {
          ...base,
          id: createId('ellipse'),
          type: 'ellipse',
          x: 680,
          y: 210,
          width: 190,
          height: 110,
          strokeColor: '#16A34A',
          fillColor: '#DCFCE7',
          fillStyle: 'hachure',
          seed: createSeed(),
          text: 'Launch',
        };
        const a1: CanvasElement = {
          ...base,
          id: createId('arrow'),
          type: 'arrow',
          x: 280,
          y: 265,
          width: 105,
          height: 0,
          strokeColor: '#0F172A',
          fillColor: 'transparent',
          fillStyle: 'none',
          seed: createSeed(),
          points: [
            { x: 0, y: 0 },
            { x: 105, y: 0 },
          ],
          startBinding: { elementId: n1.id, port: 'right' },
          endBinding: { elementId: n2.id, port: 'left' },
          endArrowhead: 'arrow',
        };
        const a2: CanvasElement = {
          ...base,
          id: createId('arrow'),
          type: 'arrow',
          x: 575,
          y: 265,
          width: 105,
          height: 0,
          strokeColor: '#0F172A',
          fillColor: 'transparent',
          fillStyle: 'none',
          seed: createSeed(),
          points: [
            { x: 0, y: 0 },
            { x: 105, y: 0 },
          ],
          startBinding: { elementId: n2.id, port: 'right' },
          endBinding: { elementId: n3.id, port: 'left' },
          endArrowhead: 'arrow',
        };
        next = [n1, n2, n3, a1, a2];
      } else {
        next = [
          {
            ...base,
            id: createId('callout'),
            type: 'callout',
            x: 130,
            y: 120,
            width: 700,
            height: 280,
            strokeColor: '#2563EB',
            fillColor: '#EFF6FF',
            fillStyle: 'hachure',
            seed: createSeed(),
            text: '"Simplicity is about subtracting the obvious and adding the meaningful."',
            fontSize: 30,
          },
        ];
      }

      handleCommitElements(next, true);
      setSelectedIds(new Set());
    },
    [project.aspectRatio, handleCommitElements]
  );

  const handleMindMapBranch = useCallback(
    (parent: CanvasElement, dir: 'top' | 'right' | 'bottom' | 'left') => {
      const { nodeRect, fromPort, toPort } = computeMindMapBranch(parent, dir);
      const child: CanvasElement = {
        id: createId(parent.type === 'sticky' ? 'sticky' : 'rect'),
        type: parent.type === 'sticky' ? 'sticky' : 'rect',
        x: nodeRect.x,
        y: nodeRect.y,
        width: nodeRect.width,
        height: nodeRect.height,
        angle: 0,
        opacity: 1,
        strokeColor: parent.strokeColor || '#2563EB',
        fillColor: parent.type === 'sticky' ? '#DBEAFE' : parent.fillColor || '#EFF6FF',
        fillStyle: parent.type === 'sticky' ? 'solid' : 'hachure',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1.2,
        cornerRadius: 0,
        seed: createSeed(),
        text: 'Branch idea',
        fontFamily: 'sketch',
        fontSize: 20,
        textAlign: 'center',
        textColor: '#0F172A',
      };

      const startPt = getAnchorPorts(parent)[fromPort];
      const endPt = getAnchorPorts(child)[toPort];
      const arrow: CanvasElement = {
        id: createId('arrow'),
        type: 'arrow',
        x: startPt.x,
        y: startPt.y,
        width: endPt.x - startPt.x,
        height: endPt.y - startPt.y,
        angle: 0,
        opacity: 1,
        strokeColor: '#0F172A',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1.2,
        cornerRadius: 0,
        seed: createSeed(),
        points: [
          { x: 0, y: 0 },
          { x: endPt.x - startPt.x, y: endPt.y - startPt.y },
        ],
        startBinding: { elementId: parent.id, port: fromPort },
        endBinding: { elementId: child.id, port: toPort },
        endArrowhead: 'arrow',
        curveType: 'curved',
      };

      handleCommitElements([...activeElements, child, arrow], true);
      setSelectedIds(new Set([child.id]));
    },
    [activeElements, handleCommitElements]
  );

  const handleSaveAsSymbol = useCallback(async () => {
    if (selectedElements.length === 0) return;
    const label =
      selectedElements[0].text?.slice(0, 20) ||
      selectedElements[0].name ||
      `Symbol ${customSymbols.length + 1}`;
    const custom: CustomSymbol = {
      id: createId('csym'),
      name: label,
      category: 'custom',
      tags: ['saved', 'custom'],
      elements: selectedElements.map((el) => ({ ...el })),
      createdAt: Date.now(),
    };
    await saveCustomSymbol(custom);
    onRefreshCustomSymbols();
    setDrawerTab('symbols');
  }, [selectedElements, customSymbols.length, onRefreshCustomSymbols]);

  const handleModeSwitch = (targetMode: ProjectMode) => {
    if (targetMode === project.mode) return;
    commitProject((prev) => {
      if (targetMode === 'presentation') {
        return convertBoardFramesToSlides(prev);
      }
      // Switching from Presentation to Whiteboard: if board is empty, mirror active slide elements into board
      if (prev.boardElements.length === 0) {
        const slide = prev.slides.find((s) => s.id === prev.activeSlideId) ?? prev.slides[0];
        const dims = getSlideDimensions(prev.aspectRatio);
        const frame: CanvasElement = {
          id: createId('frame'),
          type: 'frame',
          name: slide?.title || 'Slide Frame',
          text: slide?.title || 'Slide 1',
          x: 80,
          y: 80,
          width: dims.width,
          height: dims.height,
          angle: 0,
          opacity: 1,
          strokeColor: '#94A3B8',
          fillColor: slide?.background || '#FFFFFF',
          fillStyle: 'solid',
          strokeWidth: 1.5,
          strokeStyle: 'dashed',
          roughness: 0,
          cornerRadius: 8,
          seed: createSeed(),
        };
        const shifted = (slide?.elements || []).map((el) => ({
          ...el,
          id: createId(el.type),
          x: el.x + 80,
          y: el.y + 80,
        }));
        return {
          ...prev,
          mode: 'whiteboard',
          boardElements: [frame, ...shifted],
          viewport: { x: 40, y: 20, zoom: 0.85 },
          updatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        mode: 'whiteboard',
        updatedAt: Date.now(),
      };
    });
    setSelectedIds(new Set());
  };

  const handleSearchResult = (item: SearchResultItem) => {
    if (item.kind === 'symbol') {
      const sym = SYMBOL_LIBRARY.find((s) => s.id === item.targetId);
      if (sym) handleInsertSymbol(sym);
      return;
    }
    if (item.kind === 'template') {
      onCreateFromTemplate(item.targetId);
      return;
    }
    if (item.kind === 'slide' && item.slideId) {
      commitProject((prev) => ({ ...prev, mode: 'presentation', activeSlideId: item.slideId! }), false);
      return;
    }
    if (item.kind === 'element') {
      if (item.slideId) {
        commitProject((prev) => ({ ...prev, mode: 'presentation', activeSlideId: item.slideId! }), false);
      } else {
        commitProject((prev) => ({ ...prev, mode: 'whiteboard' }), false);
      }
      setSelectedIds(new Set([item.targetId]));
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8F9FB] overflow-hidden">
      {/* Studio Top Bar */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackHome}
            aria-label="Back to Home Hub"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={project.title}
            onChange={(e) =>
              commitProject((prev) => ({ ...prev, title: e.target.value }), false)
            }
            aria-label="Project title"
            className="text-sm font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-md px-2 py-1 outline-none min-w-[140px] max-w-[240px] truncate"
          />

          <div className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Seamless Presentation <-> Whiteboard Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => handleModeSwitch('presentation')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                project.mode === 'presentation'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Presentation</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('whiteboard')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                project.mode === 'whiteboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Whiteboard</span>
            </button>
          </div>

          <div
            data-testid="save-status"
            aria-live="polite"
            className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap shrink-0 pl-1"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                <span className="text-slate-600 font-medium">Saving...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-red-600 font-medium">Save failed</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="tabular-nums">
                  Saved{' '}
                  {new Date(lastSavedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Center Undo/Redo & Search */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={history.past.length === 0}
            onClick={handleUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={history.future.length === 0}
            onClick={handleRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-35"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-xs text-slate-600 flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search</span>
            <kbd className="text-[10px] font-mono text-slate-400">Ctrl+K</kbd>
          </button>
        </div>

        {/* Right Zoom, Present & Export */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1 border border-slate-200 rounded-lg px-1.5 py-1 bg-white">
            <button
              type="button"
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  viewport: { ...p.viewport, zoom: Math.max(0.25, p.viewport.zoom - 0.1) },
                }))
              }
              aria-label="Zoom out"
              className="p-1 text-slate-600 hover:text-slate-900 rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  viewport: { ...p.viewport, zoom: 1 },
                }))
              }
              className="px-1.5 text-xs font-mono tabular-nums text-slate-700"
              title="Reset zoom to 100%"
            >
              {Math.round(project.viewport.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  viewport: { ...p.viewport, zoom: Math.min(2.5, p.viewport.zoom + 0.1) },
                }))
              }
              aria-label="Zoom in"
              className="p-1 text-slate-600 hover:text-slate-900 rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPresenterOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" />
            <span>Present</span>
          </button>

          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftDrawer
          activeTab={drawerTab}
          onSelectTab={setDrawerTab}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onInsertShape={handleInsertShape}
          onInsertSymbol={handleInsertSymbol}
          onInsertCustomSymbol={handleInsertCustomSymbol}
          onDeleteCustomSymbol={async (id) => {
            await deleteCustomSymbol(id);
            onRefreshCustomSymbols();
          }}
          onInsertImage={handleInsertImage}
          onApplyTemplate={(tplId) => onCreateFromTemplate(tplId)}
          onApplySlideLayout={handleApplySlideLayout}
          customSymbols={customSymbols}
          elements={activeElements}
          selectedIds={selectedIds}
          onSelectElementFromLayer={(id) => setSelectedIds(new Set([id]))}
          onToggleLockLayer={(id) =>
            handleCommitElements(
              activeElements.map((el) =>
                el.id === id ? { ...el, locked: !el.locked } : el
              ),
              true
            )
          }
          onToggleHideLayer={(id) =>
            handleCommitElements(
              activeElements.map((el) =>
                el.id === id ? { ...el, hidden: !el.hidden } : el
              ),
              true
            )
          }
          brushColor={brushColor}
          onChangeBrushColor={setBrushColor}
          brushWidth={brushWidth}
          onChangeBrushWidth={setBrushWidth}
          projectMode={project.mode}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <CanvasViewport
            mode={project.mode}
            aspectRatio={project.aspectRatio}
            background={
              project.mode === 'whiteboard'
                ? project.boardBackground
                : activeSlide?.background || '#FFFFFF'
            }
            elements={activeElements}
            selectedIds={selectedIds}
            activeTool={activeTool}
            viewport={project.viewport}
            grid={project.grid}
            brushColor={brushColor}
            brushWidth={brushWidth}
            onChangeTool={setActiveTool}
            onChangeViewport={handleChangeViewport}
            onSelectIds={setSelectedIds}
            onCommitElements={handleCommitElements}
            onPreviewElements={handlePreviewElements}
            onMindMapBranch={handleMindMapBranch}
            onToggleReaction={(id, label) => {
              const next = activeElements.map((el) => {
                if (el.id !== id) return el;
                const existing = el.reactions || [];
                const found = existing.find((r) => r.label === label);
                const reactions = found
                  ? existing.map((r) =>
                      r.label === label ? { ...r, count: r.count + 1 } : r
                    )
                  : [...existing, { label, count: 1 }];
                return { ...el, reactions };
              });
              handleCommitElements(next, true);
            }}
          />

          {project.mode === 'presentation' && (
            <SlideFilmstrip
              slides={project.slides}
              activeSlideId={project.activeSlideId}
              aspectRatio={project.aspectRatio}
              onSelectSlide={(id) => {
                setSelectedIds(new Set());
                commitProject((prev) => ({ ...prev, activeSlideId: id }), false);
              }}
              onAddSlide={() => {
                setSelectedIds(new Set());
                commitProject((prev) => addSlideToProject(prev), true);
              }}
              onDuplicateSlide={(id) => {
                setSelectedIds(new Set());
                commitProject((prev) => duplicateSlideInProject(prev, id), true);
              }}
              onDeleteSlide={(id) => {
                setSelectedIds(new Set());
                commitProject((prev) => deleteSlideFromProject(prev, id), true);
              }}
              onReorderSlide={(fromIdx, toIdx) =>
                commitProject((prev) => reorderSlidesInProject(prev, fromIdx, toIdx), true)
              }
              onUpdateNotes={(slideId, notes) =>
                commitProject(
                  (prev) => ({
                    ...prev,
                    slides: prev.slides.map((s) =>
                      s.id === slideId ? { ...s, notes } : s
                    ),
                  }),
                  false
                )
              }
            />
          )}
        </div>

        <RightInspector
          selectedElements={selectedElements}
          onUpdateSelected={(patch) => {
            const next = activeElements.map((el) =>
              selectedIds.has(el.id) ? { ...el, ...patch } : el
            );
            handleCommitElements(syncBoundConnectors(next), true);
          }}
          onAlign={(mode: AlignMode) =>
            handleCommitElements(alignElements(activeElements, selectedIds, mode), true)
          }
          onDistribute={(axis) =>
            handleCommitElements(distributeElements(activeElements, selectedIds, axis), true)
          }
          onReorderZ={(dir) =>
            handleCommitElements(reorderElementZ(activeElements, selectedIds, dir), true)
          }
          onGroup={() =>
            handleCommitElements(groupSelectedElements(activeElements, selectedIds), true)
          }
          onUngroup={() =>
            handleCommitElements(ungroupSelectedElements(activeElements, selectedIds), true)
          }
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onSaveAsSymbol={handleSaveAsSymbol}
          projectMode={project.mode}
          aspectRatio={project.aspectRatio}
          onChangeAspectRatio={(ratio: AspectRatio) =>
            commitProject((prev) => ({ ...prev, aspectRatio: ratio }), true)
          }
          canvasBackground={
            project.mode === 'whiteboard'
              ? project.boardBackground
              : activeSlide?.background || '#FFFFFF'
          }
          onChangeCanvasBackground={(bg) =>
            commitProject((prev) => {
              if (prev.mode === 'whiteboard') {
                return { ...prev, boardBackground: bg };
              }
              return {
                ...prev,
                slides: prev.slides.map((s) =>
                  s.id === prev.activeSlideId ? { ...s, background: bg } : s
                ),
              };
            }, true)
          }
          slideTransition={activeSlide?.transition || 'fade'}
          onChangeSlideTransition={(tr: SlideTransition) =>
            commitProject(
              (prev) => ({
                ...prev,
                slides: prev.slides.map((s) =>
                  s.id === prev.activeSlideId ? { ...s, transition: tr } : s
                ),
              }),
              true
            )
          }
          grid={project.grid}
          onChangeGrid={(patch: Partial<GridSettings>) =>
            commitProject((prev) => ({ ...prev, grid: { ...prev.grid, ...patch } }), false)
          }
        />
      </div>

      {presenterOpen && (
        <PresenterModal project={project} onClose={() => setPresenterOpen(false)} />
      )}
      {searchOpen && (
        <SearchModal
          project={project}
          onClose={() => setSearchOpen(false)}
          onSelectResult={handleSearchResult}
        />
      )}
      {exportOpen && (
        <ExportModal project={project} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
};
