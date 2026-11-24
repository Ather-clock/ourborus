import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Hand,
  MousePointer2,
  PenTool,
  Plus,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import {
  computeSmartGuides,
  elementsIntersectMarquee,
  findNearestPort,
  getAnchorPorts,
  getElementBounds,
  getHandlePositions,
  getSelectionBounds,
  getSlideDimensions,
  hitTestElement,
  hitTestElements,
  hitTestHandle,
  isLinearElement,
  snapToGrid,
  syncBoundConnectors,
} from '../engine/geometry';
import { createId, createSeed } from '../engine/scene';
import type {
  AspectRatio,
  CanvasElement,
  ElementBinding,
  GridSettings,
  Point,
  ProjectMode,
  ResizeHandle,
  SmartGuide,
  ToolType,
  ViewportState,
} from '../types/studio';
import { CanvasElementView } from './CanvasElementView';

interface CanvasViewportProps {
  mode: ProjectMode;
  aspectRatio: AspectRatio;
  background: string;
  elements: CanvasElement[];
  selectedIds: Set<string>;
  activeTool: ToolType;
  viewport: ViewportState;
  grid: GridSettings;
  brushColor: string;
  brushWidth: number;
  onChangeTool: (tool: ToolType) => void;
  onChangeViewport: (vp: ViewportState) => void;
  onSelectIds: (ids: Set<string>) => void;
  onCommitElements: (next: CanvasElement[], pushUndo?: boolean) => void;
  onPreviewElements: (next: CanvasElement[]) => void;
  onMindMapBranch: (parent: CanvasElement, dir: 'top' | 'right' | 'bottom' | 'left') => void;
  onToggleReaction: (id: string, label: string) => void;
}

type InteractionState =
  | { kind: 'idle' }
  | { kind: 'pan'; startClient: Point; startVp: ViewportState }
  | { kind: 'marquee'; startWorld: Point; currentWorld: Point }
  | {
      kind: 'drag';
      startWorld: Point;
      initialElements: CanvasElement[];
      movingIds: Set<string>;
    }
  | {
      kind: 'resize';
      handle: ResizeHandle;
      startWorld: Point;
      initialBounds: NonNullable<ReturnType<typeof getSelectionBounds>>;
      initialElements: CanvasElement[];
    }
  | {
      kind: 'rotate';
      center: Point;
      startAngle: number;
      initialElements: CanvasElement[];
    }
  | {
      kind: 'draw_shape';
      elementId: string;
      startWorld: Point;
      initialElements: CanvasElement[];
      startBinding: ElementBinding | null;
    }
  | {
      kind: 'draw_freehand';
      elementId: string;
      initialElements: CanvasElement[];
    };

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  mode,
  aspectRatio,
  background,
  elements,
  selectedIds,
  activeTool,
  viewport,
  grid,
  brushColor,
  brushWidth,
  onChangeTool,
  onChangeViewport,
  onSelectIds,
  onCommitElements,
  onPreviewElements,
  onMindMapBranch,
  onToggleReaction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ kind: 'idle' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const [hoverPort, setHoverPort] = useState<Point | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  const slideDims = useMemo(() => getSlideDimensions(aspectRatio), [aspectRatio]);
  const onChangeViewportRef = useRef(onChangeViewport);
  onChangeViewportRef.current = onChangeViewport;

  // Center presentation slide on mount / mode / aspectRatio change
  const centerPresentation = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 64;
    const scaleX = (rect.width - pad * 2) / slideDims.width;
    const scaleY = (rect.height - pad * 2) / slideDims.height;
    const zoom = Math.max(0.35, Math.min(1.25, Math.min(scaleX, scaleY)));
    const x = (rect.width - slideDims.width * zoom) / 2;
    const y = (rect.height - slideDims.height * zoom) / 2;
    onChangeViewportRef.current({ x, y, zoom });
  }, [slideDims.width, slideDims.height]);

  useEffect(() => {
    if (mode === 'presentation') {
      centerPresentation();
    }
  }, [mode, aspectRatio, centerPresentation]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editingId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [editingId]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const selectedElements = useMemo(
    () => elements.filter((e) => selectedIds.has(e.id)),
    [elements, selectedIds]
  );
  const selectionBounds = useMemo(
    () => getSelectionBounds(selectedElements),
    [selectedElements]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editingId) {
      setEditingId(null);
    }

    const world = clientToWorld(e.clientX, e.clientY);

    // Pan with Hand tool, Spacebar, or Middle Mouse button
    if (activeTool === 'hand' || spacePressed || e.button === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setInteraction({
        kind: 'pan',
        startClient: { x: e.clientX, y: e.clientY },
        startVp: viewport,
      });
      return;
    }

    if (e.button !== 0) return;

    // Eraser tool
    if (activeTool === 'eraser') {
      const hit = hitTestElements(elements, world, 10 / viewport.zoom);
      if (hit && !hit.locked) {
        onCommitElements(
          elements.filter((el) => el.id !== hit.id),
          true
        );
      }
      return;
    }

    // Freehand Pen / Highlighter
    if (activeTool === 'freedraw' || activeTool === 'highlighter') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const id = createId('draw');
      const newStroke: CanvasElement = {
        id,
        type: 'freedraw',
        x: world.x,
        y: world.y,
        width: 4,
        height: 4,
        angle: 0,
        opacity: activeTool === 'highlighter' ? 0.45 : 1,
        strokeColor: activeTool === 'highlighter' ? '#FACC15' : brushColor,
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: brushWidth,
        strokeStyle: 'solid',
        roughness: 0,
        cornerRadius: 0,
        seed: createSeed(),
        isHighlighter: activeTool === 'highlighter',
        points: [{ x: 0, y: 0 }],
      };
      const next = [...elements, newStroke];
      onPreviewElements(next);
      setInteraction({
        kind: 'draw_freehand',
        elementId: id,
        initialElements: elements,
      });
      return;
    }

    // Select tool
    if (activeTool === 'select') {
      // Check resize/rotate handle first
      if (selectionBounds && selectedElements.every((el) => !el.locked)) {
        const handle = hitTestHandle(selectionBounds, world, viewport.zoom);
        if (handle === 'rotate') {
          e.currentTarget.setPointerCapture(e.pointerId);
          const angle = Math.atan2(
            world.y - selectionBounds.cy,
            world.x - selectionBounds.cx
          );
          setInteraction({
            kind: 'rotate',
            center: { x: selectionBounds.cx, y: selectionBounds.cy },
            startAngle: angle,
            initialElements: elements,
          });
          return;
        }
        if (handle) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setInteraction({
            kind: 'resize',
            handle,
            startWorld: world,
            initialBounds: selectionBounds,
            initialElements: elements,
          });
          return;
        }
      }

      const hit = hitTestElements(elements, world, 8 / viewport.zoom);
      if (hit) {
        let nextSelected = new Set(selectedIds);
        if (e.shiftKey) {
          if (nextSelected.has(hit.id)) nextSelected.delete(hit.id);
          else nextSelected.add(hit.id);
        } else if (!nextSelected.has(hit.id)) {
          nextSelected = new Set([hit.id]);
        }

        // Expand group selection
        const groupIds = new Set<string>();
        elements.forEach((el) => {
          if (nextSelected.has(el.id) && el.groupId) groupIds.add(el.groupId);
        });
        if (groupIds.size > 0) {
          elements.forEach((el) => {
            if (el.groupId && groupIds.has(el.groupId)) nextSelected.add(el.id);
          });
        }

        onSelectIds(nextSelected);

        const movableIds = new Set(
          elements.filter((el) => nextSelected.has(el.id) && !el.locked).map((el) => el.id)
        );
        if (movableIds.size > 0) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setInteraction({
            kind: 'drag',
            startWorld: world,
            initialElements: elements,
            movingIds: movableIds,
          });
        }
        return;
      }

      // Start marquee selection
      if (!e.shiftKey) {
        onSelectIds(new Set());
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      setInteraction({
        kind: 'marquee',
        startWorld: world,
        currentWorld: world,
      });
      return;
    }

    // Text tool click -> immediate editable text box
    if (activeTool === 'text') {
      const id = createId('text');
      const snappedX = snapToGrid(world.x, grid.size, grid.snap);
      const snappedY = snapToGrid(world.y, grid.size, grid.snap);
      const newText: CanvasElement = {
        id,
        type: 'text',
        x: snappedX,
        y: snappedY,
        width: 240,
        height: 48,
        angle: 0,
        opacity: 1,
        strokeColor: 'transparent',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        cornerRadius: 0,
        seed: createSeed(),
        text: 'Type here...',
        fontFamily: 'sketch',
        fontSize: 24,
        textAlign: 'left',
        textColor: '#0F172A',
      };
      onCommitElements([...elements, newText], true);
      onSelectIds(new Set([id]));
      onChangeTool('select');
      setEditingId(id);
      return;
    }

    // Shape / Sticky / Frame / Arrow / Line creation by dragging
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = createId(activeTool);
    const snappedX = snapToGrid(world.x, grid.size, grid.snap);
    const snappedY = snapToGrid(world.y, grid.size, grid.snap);

    let startBinding: ElementBinding | null = null;
    let startPt = { x: snappedX, y: snappedY };
    if (activeTool === 'arrow' || activeTool === 'line') {
      const nearest = findNearestPort(elements, world);
      if (nearest) {
        startBinding = { elementId: nearest.element.id, port: nearest.port };
        startPt = nearest.point;
      }
    }

    const isSticky = activeTool === 'sticky';
    const isFrame = activeTool === 'frame';
    const isArrowOrLine = activeTool === 'arrow' || activeTool === 'line';

    const newEl: CanvasElement = {
      id,
      type: activeTool as CanvasElement['type'],
      x: startPt.x,
      y: startPt.y,
      width: 4,
      height: 4,
      angle: 0,
      opacity: 1,
      strokeColor: isSticky ? '#CA8A04' : isFrame ? '#94A3B8' : '#0F172A',
      fillColor: isSticky
        ? '#FEF08A'
        : isFrame
          ? 'rgba(255,255,255,0.65)'
          : isArrowOrLine
            ? 'transparent'
            : '#DBEAFE',
      fillStyle: isSticky ? 'solid' : isFrame ? 'solid' : isArrowOrLine ? 'none' : 'hachure',
      strokeWidth: isFrame ? 1.5 : 2,
      strokeStyle: isFrame ? 'dashed' : 'solid',
      roughness: isFrame ? 0 : 1.2,
      cornerRadius: 0,
      seed: createSeed(),
      fontFamily: 'sketch',
      fontSize: 22,
      textAlign: 'center',
      textColor: '#0F172A',
      text: isSticky ? 'Sticky note' : isFrame ? 'Section Frame' : undefined,
      points: isArrowOrLine ? [{ x: 0, y: 0 }, { x: 4, y: 4 }] : undefined,
      startBinding,
      endBinding: null,
      endArrowhead: activeTool === 'arrow' ? 'arrow' : 'none',
      curveType: 'straight',
    };

    onPreviewElements([...elements, newEl]);
    setInteraction({
      kind: 'draw_shape',
      elementId: id,
      startWorld: startPt,
      initialElements: elements,
      startBinding,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const world = clientToWorld(e.clientX, e.clientY);

    if (interaction.kind === 'idle') {
      if (activeTool === 'arrow' || activeTool === 'line') {
        const nearest = findNearestPort(elements, world);
        setHoverPort(nearest ? nearest.point : null);
      } else if (hoverPort) {
        setHoverPort(null);
      }
      return;
    }

    if (interaction.kind === 'pan') {
      const dx = e.clientX - interaction.startClient.x;
      const dy = e.clientY - interaction.startClient.y;
      onChangeViewport({
        ...interaction.startVp,
        x: interaction.startVp.x + dx,
        y: interaction.startVp.y + dy,
      });
      return;
    }

    if (interaction.kind === 'marquee') {
      setInteraction({ ...interaction, currentWorld: world });
      return;
    }

    if (interaction.kind === 'draw_freehand') {
      const updated = elements.map((el) => {
        if (el.id !== interaction.elementId) return el;
        const pts = el.points || [];
        const rel = { x: world.x - el.x, y: world.y - el.y };
        const last = pts[pts.length - 1];
        if (last && Math.hypot(rel.x - last.x, rel.y - last.y) < 2) return el;
        return { ...el, points: [...pts, rel] };
      });
      onPreviewElements(updated);
      return;
    }

    if (interaction.kind === 'draw_shape') {
      const snappedEnd = {
        x: snapToGrid(world.x, grid.size, grid.snap),
        y: snapToGrid(world.y, grid.size, grid.snap),
      };
      const targetEl = elements.find((el) => el.id === interaction.elementId);
      if (!targetEl) return;

      if (targetEl.type === 'arrow' || targetEl.type === 'line') {
        const nearest = findNearestPort(
          interaction.initialElements,
          world,
          new Set([interaction.elementId])
        );
        setHoverPort(nearest ? nearest.point : null);
        const endPt = nearest ? nearest.point : snappedEnd;
        const dx = endPt.x - interaction.startWorld.x;
        const dy = endPt.y - interaction.startWorld.y;
        const updated = elements.map((el) =>
          el.id === interaction.elementId
            ? {
                ...el,
                width: dx,
                height: dy,
                points: [
                  { x: 0, y: 0 },
                  { x: dx, y: dy },
                ],
                endBinding: nearest
                  ? { elementId: nearest.element.id, port: nearest.port }
                  : null,
              }
            : el
        );
        onPreviewElements(updated);
      } else {
        const x = Math.min(interaction.startWorld.x, snappedEnd.x);
        const y = Math.min(interaction.startWorld.y, snappedEnd.y);
        const w = Math.max(8, Math.abs(snappedEnd.x - interaction.startWorld.x));
        const h = Math.max(8, Math.abs(snappedEnd.y - interaction.startWorld.y));
        const updated = elements.map((el) =>
          el.id === interaction.elementId ? { ...el, x, y, width: w, height: h } : el
        );
        onPreviewElements(updated);
      }
      return;
    }

    if (interaction.kind === 'drag') {
      let dx = world.x - interaction.startWorld.x;
      let dy = world.y - interaction.startWorld.y;

      if (grid.snap) {
        dx = snapToGrid(dx, grid.size, true);
        dy = snapToGrid(dy, grid.size, true);
      }

      const movingInit = interaction.initialElements.filter((el) =>
        interaction.movingIds.has(el.id)
      );
      const others = interaction.initialElements.filter(
        (el) => !interaction.movingIds.has(el.id) && el.type !== 'frame'
      );
      const movingBounds = getSelectionBounds(movingInit);
      if (movingBounds) {
        const shiftedBounds = {
          ...movingBounds,
          x: movingBounds.x + dx,
          y: movingBounds.y + dy,
          minX: movingBounds.minX + dx,
          minY: movingBounds.minY + dy,
          maxX: movingBounds.maxX + dx,
          maxY: movingBounds.maxY + dy,
          cx: movingBounds.cx + dx,
          cy: movingBounds.cy + dy,
        };
        const snapRes = computeSmartGuides(shiftedBounds, others, 6 / viewport.zoom);
        dx += snapRes.dx;
        dy += snapRes.dy;
        setSmartGuides(snapRes.guides);
      }

      const moved = interaction.initialElements.map((el) =>
        interaction.movingIds.has(el.id)
          ? { ...el, x: el.x + dx, y: el.y + dy }
          : el
      );
      onPreviewElements(syncBoundConnectors(moved));
      return;
    }

    if (interaction.kind === 'resize') {
      const { initialBounds, handle, startWorld, initialElements } = interaction;
      const dx = world.x - startWorld.x;
      const dy = world.y - startWorld.y;

      let newMinX = initialBounds.minX;
      let newMinY = initialBounds.minY;
      let newMaxX = initialBounds.maxX;
      let newMaxY = initialBounds.maxY;

      if (handle.includes('w')) newMinX = Math.min(initialBounds.maxX - 16, initialBounds.minX + dx);
      if (handle.includes('e')) newMaxX = Math.max(initialBounds.minX + 16, initialBounds.maxX + dx);
      if (handle.includes('n')) newMinY = Math.min(initialBounds.maxY - 16, initialBounds.minY + dy);
      if (handle.includes('s')) newMaxY = Math.max(initialBounds.minY + 16, initialBounds.maxY + dy);

      const newW = Math.max(16, newMaxX - newMinX);
      const newH = Math.max(16, newMaxY - newMinY);
      const scaleX = newW / Math.max(1, initialBounds.width);
      const scaleY = newH / Math.max(1, initialBounds.height);

      const resized = initialElements.map((el) => {
        if (!selectedIds.has(el.id)) return el;
        const b = getElementBounds(el);
        const relX = (b.minX - initialBounds.minX) * scaleX;
        const relY = (b.minY - initialBounds.minY) * scaleY;
        const nextW = Math.max(8, b.width * scaleX);
        const nextH = Math.max(8, b.height * scaleY);
        if (isLinearElement(el) && el.points) {
          return {
            ...el,
            x: newMinX + (el.x - initialBounds.minX) * scaleX,
            y: newMinY + (el.y - initialBounds.minY) * scaleY,
            width: nextW,
            height: nextH,
            points: el.points.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY })),
          };
        }
        return {
          ...el,
          x: newMinX + relX,
          y: newMinY + relY,
          width: nextW,
          height: nextH,
        };
      });
      onPreviewElements(syncBoundConnectors(resized));
      return;
    }

    if (interaction.kind === 'rotate') {
      const currentAngle = Math.atan2(
        world.y - interaction.center.y,
        world.x - interaction.center.x
      );
      const deltaDeg = ((currentAngle - interaction.startAngle) * 180) / Math.PI;
      const rotated = interaction.initialElements.map((el) =>
        selectedIds.has(el.id)
          ? { ...el, angle: Math.round((el.angle + deltaDeg) % 360) }
          : el
      );
      onPreviewElements(rotated);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interaction.kind === 'idle') return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setSmartGuides([]);
    setHoverPort(null);

    if (interaction.kind === 'marquee') {
      const x = Math.min(interaction.startWorld.x, interaction.currentWorld.x);
      const y = Math.min(interaction.startWorld.y, interaction.currentWorld.y);
      const width = Math.abs(interaction.currentWorld.x - interaction.startWorld.x);
      const height = Math.abs(interaction.currentWorld.y - interaction.startWorld.y);
      if (width > 4 || height > 4) {
        const hits = elements.filter(
          (el) => el.type !== 'frame' && elementsIntersectMarquee(el, { x, y, width, height })
        );
        onSelectIds(new Set(hits.map((h) => h.id)));
      }
      setInteraction({ kind: 'idle' });
      return;
    }

    if (interaction.kind === 'draw_shape') {
      const created = elements.find((el) => el.id === interaction.elementId);
      if (created) {
        // If user merely clicked without dragging, give shape a comfortable default size
        if (
          !isLinearElement(created) &&
          Math.abs(created.width) < 16 &&
          Math.abs(created.height) < 16
        ) {
          const defW = created.type === 'frame' ? 480 : created.type === 'sticky' ? 200 : 180;
          const defH = created.type === 'frame' ? 320 : created.type === 'sticky' ? 160 : 110;
          const finalized = elements.map((el) =>
            el.id === created.id
              ? { ...el, width: defW, height: defH }
              : el
          );
          onCommitElements(finalized, true);
        } else if (
          isLinearElement(created) &&
          Math.hypot(created.width, created.height) < 12
        ) {
          const finalized = elements.map((el) =>
            el.id === created.id
              ? {
                  ...el,
                  width: 140,
                  height: 0,
                  points: [
                    { x: 0, y: 0 },
                    { x: 140, y: 0 },
                  ],
                }
              : el
          );
          onCommitElements(finalized, true);
        } else {
          onCommitElements(elements, true);
        }
        onSelectIds(new Set([created.id]));
        onChangeTool('select');
      }
      setInteraction({ kind: 'idle' });
      return;
    }

    if (
      interaction.kind === 'draw_freehand' ||
      interaction.kind === 'drag' ||
      interaction.kind === 'resize' ||
      interaction.kind === 'rotate'
    ) {
      onCommitElements(elements, true);
    }

    setInteraction({ kind: 'idle' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || mode === 'whiteboard') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const nextZoom = Math.max(0.2, Math.min(3, viewport.zoom * zoomFactor));
        const worldX = (mouseX - viewport.x) / viewport.zoom;
        const worldY = (mouseY - viewport.y) / viewport.zoom;
        onChangeViewport({
          zoom: nextZoom,
          x: mouseX - worldX * nextZoom,
          y: mouseY - worldY * nextZoom,
        });
      } else {
        onChangeViewport({
          ...viewport,
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    }
  };

  const gridBgStyle = useMemo<React.CSSProperties>(() => {
    if (!grid.enabled || grid.type === 'none') return {};
    const step = Math.max(10, grid.size * viewport.zoom);
    const pos = `${viewport.x}px ${viewport.y}px`;
    if (grid.type === 'dots') {
      return {
        backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.45) 1.25px, transparent 1.25px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: pos,
      };
    }
    return {
      backgroundImage: `linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.16) 1px, transparent 1px)`,
      backgroundSize: `${step}px ${step}px`,
      backgroundPosition: pos,
    };
  }, [grid, viewport]);

  const singleSelected =
    selectedElements.length === 1 && !isLinearElement(selectedElements[0]) && selectedElements[0].type !== 'frame'
      ? selectedElements[0]
      : null;

  const quickTools: { id: ToolType; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'hand', label: 'Pan', shortcut: 'H', icon: <Hand className="w-4 h-4" /> },
    { id: 'frame', label: 'Frame', shortcut: 'F', icon: <Frame className="w-4 h-4" /> },
    { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: <Square className="w-4 h-4" /> },
    { id: 'diamond', label: 'Diamond', shortcut: 'D', icon: <Diamond className="w-4 h-4" /> },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle className="w-4 h-4" /> },
    { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'freedraw', label: 'Pen', shortcut: 'P', icon: <PenTool className="w-4 h-4" /> },
    { id: 'sticky', label: 'Sticky Note', shortcut: 'S', icon: <StickyNote className="w-4 h-4" /> },
    { id: 'text', label: 'Text', shortcut: 'T', icon: <Type className="w-4 h-4" /> },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: <Eraser className="w-4 h-4" /> },
  ];

  // Minimap bounds for whiteboard
  const minimapData = useMemo(() => {
    if (mode !== 'whiteboard' || elements.length === 0) return null;
    const b = getSelectionBounds(elements);
    if (!b) return null;
    const pad = 120;
    return {
      minX: b.minX - pad,
      minY: b.minY - pad,
      width: Math.max(600, b.width + pad * 2),
      height: Math.max(400, b.height + pad * 2),
    };
  }, [mode, elements]);

  return (
    <div
      ref={containerRef}
      data-testid="studio-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={`relative flex-1 h-full overflow-hidden select-none ${
        activeTool === 'hand' || spacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'select'
            ? 'cursor-default'
            : 'cursor-crosshair'
      }`}
      style={{
        backgroundColor: mode === 'whiteboard' ? background : '#EEF1F6',
        ...(mode === 'whiteboard' ? gridBgStyle : {}),
      }}
    >
      {/* Transformed World Layer */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Presentation Slide Artboard */}
        {mode === 'presentation' && (
          <div
            data-testid="slide-artboard"
            className="relative shadow-lg border border-slate-300/80"
            style={{
              width: slideDims.width,
              height: slideDims.height,
              backgroundColor: background || '#FFFFFF',
              ...(grid.enabled && grid.type !== 'none'
                ? {
                    backgroundImage:
                      grid.type === 'dots'
                        ? 'radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)'
                        : 'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
                    backgroundSize: `${grid.size}px ${grid.size}px`,
                  }
                : {}),
            }}
          />
        )}

        {/* Scene Elements */}
        {elements.map((el) => (
          <CanvasElementView
            key={el.id}
            element={el}
            isSelected={selectedIds.has(el.id)}
            isEditing={editingId === el.id}
            onStartEdit={(id) => setEditingId(id)}
            onChangeText={(id, text) => {
              onPreviewElements(
                elements.map((item) => (item.id === id ? { ...item, text } : item))
              );
            }}
            onEndEdit={() => {
              setEditingId(null);
              onCommitElements(elements, true);
            }}
            onToggleReaction={onToggleReaction}
          />
        ))}

        {/* Smart Alignment Guides */}
        {smartGuides.length > 0 && (
          <svg className="absolute top-0 left-0 overflow-visible pointer-events-none z-30">
            {smartGuides.map((g, idx) =>
              g.axis === 'x' ? (
                <line
                  key={idx}
                  x1={g.position}
                  y1={g.start}
                  x2={g.position}
                  y2={g.end}
                  stroke="#2563EB"
                  strokeWidth={1.5 / viewport.zoom}
                  strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
                />
              ) : (
                <line
                  key={idx}
                  x1={g.start}
                  y1={g.position}
                  x2={g.end}
                  y2={g.position}
                  stroke="#2563EB"
                  strokeWidth={1.5 / viewport.zoom}
                  strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
                />
              )
            )}
          </svg>
        )}

        {/* Connector Port Hover Indicator */}
        {hoverPort && (
          <div
            className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 border-2 border-white shadow pointer-events-none z-40"
            style={{ left: hoverPort.x, top: hoverPort.y }}
          />
        )}

        {/* Selection Bounding Box + Resize/Rotate Handles */}
        {selectionBounds && !editingId && (
          <div
            className="absolute pointer-events-none z-30"
            style={{
              left: selectionBounds.minX,
              top: selectionBounds.minY,
              width: selectionBounds.width,
              height: selectionBounds.height,
              border: `${1.5 / viewport.zoom}px solid #2563EB`,
            }}
          >
            {(() => {
              const handles = getHandlePositions(selectionBounds);
              const size = 9 / viewport.zoom;
              const keys: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
              return (
                <>
                  {keys.map((k) => {
                    const hp = handles[k];
                    return (
                      <div
                        key={k}
                        className="absolute bg-white border border-blue-600 rounded-[2px]"
                        style={{
                          width: size,
                          height: size,
                          left: hp.x - selectionBounds.minX - size / 2,
                          top: hp.y - selectionBounds.minY - size / 2,
                        }}
                      />
                    );
                  })}
                  {/* Rotation stem & knob */}
                  <div
                    className="absolute bg-blue-600"
                    style={{
                      width: 1.5 / viewport.zoom,
                      height: 24 / viewport.zoom,
                      left: selectionBounds.width / 2 - 0.75 / viewport.zoom,
                      top: -24 / viewport.zoom,
                    }}
                  />
                  <div
                    className="absolute bg-white border-2 border-blue-600 rounded-full"
                    style={{
                      width: size * 1.15,
                      height: size * 1.15,
                      left: selectionBounds.width / 2 - (size * 1.15) / 2,
                      top: -28 / viewport.zoom - (size * 1.15) / 2,
                    }}
                  />
                </>
              );
            })()}

            {/* Miro-style Mind-Map Quick Branch Handles */}
            {singleSelected && !singleSelected.locked && (
              <>
                {(['top', 'right', 'bottom', 'left'] as const).map((dir) => {
                  const ports = getAnchorPorts(singleSelected);
                  const pt = ports[dir];
                  const offset = 22 / viewport.zoom;
                  const dx = dir === 'right' ? offset : dir === 'left' ? -offset : 0;
                  const dy = dir === 'bottom' ? offset : dir === 'top' ? -offset : 0;
                  return (
                    <button
                      key={dir}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMindMapBranch(singleSelected, dir);
                      }}
                      title={`Branch ${dir}`}
                      aria-label={`Branch mind map ${dir}`}
                      className="pointer-events-auto absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow flex items-center justify-center transition-transform hover:scale-110"
                      style={{
                        left: pt.x - selectionBounds.minX + dx,
                        top: pt.y - selectionBounds.minY + dy,
                        transform: `translate(-50%, -50%) scale(${1 / Math.max(0.65, viewport.zoom)})`,
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Marquee Box */}
        {interaction.kind === 'marquee' && (
          <div
            className="absolute border border-blue-600 bg-blue-500/10 pointer-events-none z-40"
            style={{
              left: Math.min(interaction.startWorld.x, interaction.currentWorld.x),
              top: Math.min(interaction.startWorld.y, interaction.currentWorld.y),
              width: Math.abs(interaction.currentWorld.x - interaction.startWorld.x),
              height: Math.abs(interaction.currentWorld.y - interaction.startWorld.y),
            }}
          />
        )}
      </div>

      {/* Floating Quick-Tool Dock (Excalidraw + Miro style) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-sm px-2 py-1.5 flex items-center gap-1 z-30"
      >
        {quickTools.map((tool) => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onChangeTool(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
              aria-label={`${tool.label} tool`}
              aria-pressed={active}
              className={`relative p-2 rounded-lg transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tool.icon}
            </button>
          );
        })}
      </div>

      {/* Whiteboard Minimap */}
      {mode === 'whiteboard' && minimapData && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 w-44 h-28 bg-white/95 border border-slate-200 rounded-lg shadow-sm overflow-hidden p-1.5 z-30"
          aria-label="Whiteboard minimap"
        >
          <svg
            viewBox={`${minimapData.minX} ${minimapData.minY} ${minimapData.width} ${minimapData.height}`}
            className="w-full h-full"
          >
            {elements.map((el) => {
              const b = getElementBounds(el);
              return (
                <rect
                  key={el.id}
                  x={b.minX}
                  y={b.minY}
                  width={Math.max(12, b.width)}
                  height={Math.max(12, b.height)}
                  fill={el.type === 'frame' ? 'none' : el.fillColor === 'transparent' ? '#CBD5E1' : el.fillColor}
                  stroke="#64748B"
                  strokeWidth={8}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
