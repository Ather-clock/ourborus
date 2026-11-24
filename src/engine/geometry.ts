import type {
  AspectRatio,
  BoundingBox,
  CanvasElement,
  ElementBinding,
  Point,
  PortSide,
  ResizeHandle,
  SmartGuide,
} from '../types/studio';

export function getSlideDimensions(ratio: AspectRatio): { width: number; height: number } {
  switch (ratio) {
    case '4:3':
      return { width: 960, height: 720 };
    case '1:1':
      return { width: 800, height: 800 };
    case '16:9':
    default:
      return { width: 960, height: 540 };
  }
}

export function isLinearElement(el: CanvasElement): boolean {
  return el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw';
}

export function getElementBounds(el: CanvasElement): BoundingBox {
  if (isLinearElement(el) && el.points && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of el.points) {
      const px = el.x + pt.x;
      const py = el.y + pt.y;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const width = Math.max(4, maxX - minX);
    const height = Math.max(4, maxY - minY);
    return {
      x: minX,
      y: minY,
      width,
      height,
      minX,
      minY,
      maxX: minX + width,
      maxY: minY + height,
      cx: minX + width / 2,
      cy: minY + height / 2,
    };
  }

  const x = el.width >= 0 ? el.x : el.x + el.width;
  const y = el.height >= 0 ? el.y : el.y + el.height;
  const width = Math.abs(el.width);
  const height = Math.abs(el.height);
  return {
    x,
    y,
    width,
    height,
    minX: x,
    minY: y,
    maxX: x + width,
    maxY: y + height,
    cx: x + width / 2,
    cy: y + height / 2,
  };
}

export function getSelectionBounds(elements: CanvasElement[]): BoundingBox | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    x: minX,
    y: minY,
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
}

export function rotatePoint(pt: Point, center: Point, angleDeg: number): Point {
  if (!angleDeg) return pt;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function hitTestElement(
  el: CanvasElement,
  point: Point,
  tolerance = 8
): boolean {
  if (el.hidden) return false;
  const bounds = getElementBounds(el);
  const localPt = rotatePoint(point, { x: bounds.cx, y: bounds.cy }, -el.angle);

  if (isLinearElement(el) && el.points && el.points.length > 0) {
    const absPoints = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    if (absPoints.length === 1) {
      return Math.hypot(localPt.x - absPoints[0].x, localPt.y - absPoints[0].y) <= tolerance;
    }
    const hitTol = Math.max(tolerance, (el.strokeWidth || 2) + 6);
    for (let i = 0; i < absPoints.length - 1; i++) {
      if (distanceToSegment(localPt, absPoints[i], absPoints[i + 1]) <= hitTol) {
        return true;
      }
    }
    return false;
  }

  // Frame: only hit border or title bar unless clicking inside when empty?
  // Allow clicking anywhere inside frame header (top 36px) or border (12px) so elements inside are easily selectable
  if (el.type === 'frame') {
    const insideOuter =
      localPt.x >= bounds.minX - tolerance &&
      localPt.x <= bounds.maxX + tolerance &&
      localPt.y >= bounds.minY - 32 &&
      localPt.y <= bounds.maxY + tolerance;
    if (!insideOuter) return false;
    const inHeader = localPt.y <= bounds.minY + 28;
    const nearEdge =
      localPt.x <= bounds.minX + 12 ||
      localPt.x >= bounds.maxX - 12 ||
      localPt.y >= bounds.maxY - 12;
    return inHeader || nearEdge;
  }

  if (el.type === 'ellipse') {
    const rx = Math.max(1, bounds.width / 2) + tolerance;
    const ry = Math.max(1, bounds.height / 2) + tolerance;
    const nx = (localPt.x - bounds.cx) / rx;
    const ny = (localPt.y - bounds.cy) / ry;
    return nx * nx + ny * ny <= 1;
  }

  if (el.type === 'diamond') {
    const rx = Math.max(1, bounds.width / 2) + tolerance;
    const ry = Math.max(1, bounds.height / 2) + tolerance;
    const nx = Math.abs(localPt.x - bounds.cx) / rx;
    const ny = Math.abs(localPt.y - bounds.cy) / ry;
    return nx + ny <= 1;
  }

  return (
    localPt.x >= bounds.minX - tolerance &&
    localPt.x <= bounds.maxX + tolerance &&
    localPt.y >= bounds.minY - tolerance &&
    localPt.y <= bounds.maxY + tolerance
  );
}

export function hitTestElements(
  elements: CanvasElement[],
  point: Point,
  tolerance = 8
): CanvasElement | null {
  // Search top-to-bottom (last element in array is highest z-index)
  // Prefer non-frame elements over frame elements
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type !== 'frame' && hitTestElement(el, point, tolerance)) {
      return el;
    }
  }
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'frame' && hitTestElement(el, point, tolerance)) {
      return el;
    }
  }
  return null;
}

export function getHandlePositions(bounds: BoundingBox): Record<ResizeHandle, Point> {
  return {
    nw: { x: bounds.minX, y: bounds.minY },
    n: { x: bounds.cx, y: bounds.minY },
    ne: { x: bounds.maxX, y: bounds.minY },
    e: { x: bounds.maxX, y: bounds.cy },
    se: { x: bounds.maxX, y: bounds.maxY },
    s: { x: bounds.cx, y: bounds.maxY },
    sw: { x: bounds.minX, y: bounds.maxY },
    w: { x: bounds.minX, y: bounds.cy },
    rotate: { x: bounds.cx, y: bounds.minY - 28 },
  };
}

export function hitTestHandle(
  bounds: BoundingBox,
  point: Point,
  zoom = 1
): ResizeHandle | null {
  const handles = getHandlePositions(bounds);
  const threshold = 10 / zoom;
  const order: ResizeHandle[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  for (const key of order) {
    const hp = handles[key];
    if (Math.hypot(point.x - hp.x, point.y - hp.y) <= threshold) {
      return key;
    }
  }
  return null;
}

export function getAnchorPorts(el: CanvasElement): Record<PortSide, Point> {
  const b = getElementBounds(el);
  const center = { x: b.cx, y: b.cy };
  return {
    top: rotatePoint({ x: b.cx, y: b.minY }, center, el.angle),
    right: rotatePoint({ x: b.maxX, y: b.cy }, center, el.angle),
    bottom: rotatePoint({ x: b.cx, y: b.maxY }, center, el.angle),
    left: rotatePoint({ x: b.minX, y: b.cy }, center, el.angle),
    center,
  };
}

export function findNearestPort(
  elements: CanvasElement[],
  point: Point,
  excludeIds: Set<string> = new Set(),
  maxDistance = 24
): { element: CanvasElement; port: PortSide; point: Point } | null {
  let best: { element: CanvasElement; port: PortSide; point: Point; dist: number } | null = null;
  const portOrder: PortSide[] = ['top', 'right', 'bottom', 'left'];

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (excludeIds.has(el.id) || el.hidden || isLinearElement(el) || el.type === 'frame') {
      continue;
    }
    const ports = getAnchorPorts(el);
    for (const side of portOrder) {
      const p = ports[side];
      const dist = Math.hypot(point.x - p.x, point.y - p.y);
      if (dist <= maxDistance && (!best || dist < best.dist)) {
        best = { element: el, port: side, point: p, dist };
      }
    }
    // Also snap to nearest edge port if pointer is inside the shape
    if (!best && hitTestElement(el, point, 4)) {
      let closestSide: PortSide = 'right';
      let closestDist = Infinity;
      for (const side of portOrder) {
        const d = Math.hypot(point.x - ports[side].x, point.y - ports[side].y);
        if (d < closestDist) {
          closestDist = d;
          closestSide = side;
        }
      }
      best = { element: el, port: closestSide, point: ports[closestSide], dist: 0 };
    }
  }

  return best ? { element: best.element, port: best.port, point: best.point } : null;
}

export function resolveBindingPoint(
  binding: ElementBinding | null | undefined,
  elements: CanvasElement[]
): Point | null {
  if (!binding) return null;
  const target = elements.find((e) => e.id === binding.elementId);
  if (!target) return null;
  const ports = getAnchorPorts(target);
  return ports[binding.port] ?? ports.center;
}

export function syncBoundConnectors(elements: CanvasElement[]): CanvasElement[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let changed = false;

  const updated = elements.map((el) => {
    if ((el.type !== 'arrow' && el.type !== 'line') || !el.points || el.points.length < 2) {
      return el;
    }
    if (!el.startBinding && !el.endBinding) return el;

    const startTarget = el.startBinding ? byId.get(el.startBinding.elementId) : null;
    const endTarget = el.endBinding ? byId.get(el.endBinding.elementId) : null;

    const currentStart = { x: el.x + el.points[0].x, y: el.y + el.points[0].y };
    const currentEnd = {
      x: el.x + el.points[el.points.length - 1].x,
      y: el.y + el.points[el.points.length - 1].y,
    };

    const nextStart =
      startTarget && el.startBinding
        ? getAnchorPorts(startTarget)[el.startBinding.port]
        : currentStart;
    const nextEnd =
      endTarget && el.endBinding
        ? getAnchorPorts(endTarget)[el.endBinding.port]
        : currentEnd;

    if (
      Math.abs(nextStart.x - currentStart.x) < 0.01 &&
      Math.abs(nextStart.y - currentStart.y) < 0.01 &&
      Math.abs(nextEnd.x - currentEnd.x) < 0.01 &&
      Math.abs(nextEnd.y - currentEnd.y) < 0.01
    ) {
      return el;
    }

    changed = true;
    const dx = nextEnd.x - nextStart.x;
    const dy = nextEnd.y - nextStart.y;
    return {
      ...el,
      x: nextStart.x,
      y: nextStart.y,
      width: dx,
      height: dy,
      points: [
        { x: 0, y: 0 },
        { x: dx, y: dy },
      ],
    };
  });

  return changed ? updated : elements;
}

export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 1) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function computeSmartGuides(
  movingBounds: BoundingBox,
  otherElements: CanvasElement[],
  threshold = 6
): { dx: number; dy: number; guides: SmartGuide[] } {
  let bestDx: number | null = null;
  let bestDy: number | null = null;
  let bestAbsDx = threshold + 1;
  let bestAbsDy = threshold + 1;

  const movingX = [movingBounds.minX, movingBounds.cx, movingBounds.maxX];
  const movingY = [movingBounds.minY, movingBounds.cy, movingBounds.maxY];

  const xMatches: { pos: number; targetB: BoundingBox }[] = [];
  const yMatches: { pos: number; targetB: BoundingBox }[] = [];

  for (const el of otherElements) {
    if (el.hidden) continue;
    const b = getElementBounds(el);
    const targetX = [b.minX, b.cx, b.maxX];
    const targetY = [b.minY, b.cy, b.maxY];

    for (const mx of movingX) {
      for (const tx of targetX) {
        const diff = tx - mx;
        const absDiff = Math.abs(diff);
        if (absDiff <= threshold && absDiff < bestAbsDx) {
          bestAbsDx = absDiff;
          bestDx = diff;
        }
        if (absDiff <= threshold) {
          xMatches.push({ pos: tx, targetB: b });
        }
      }
    }

    for (const my of movingY) {
      for (const ty of targetY) {
        const diff = ty - my;
        const absDiff = Math.abs(diff);
        if (absDiff <= threshold && absDiff < bestAbsDy) {
          bestAbsDy = absDiff;
          bestDy = diff;
        }
        if (absDiff <= threshold) {
          yMatches.push({ pos: ty, targetB: b });
        }
      }
    }
  }

  const dx = bestDx ?? 0;
  const dy = bestDy ?? 0;
  const snappedX = [movingBounds.minX + dx, movingBounds.cx + dx, movingBounds.maxX + dx];
  const snappedY = [movingBounds.minY + dy, movingBounds.cy + dy, movingBounds.maxY + dy];

  const guides: SmartGuide[] = [];
  const seenX = new Set<number>();
  const seenY = new Set<number>();

  if (bestDx !== null) {
    for (const m of xMatches) {
      if (snappedX.some((sx) => Math.abs(sx - m.pos) < 0.5) && !seenX.has(m.pos)) {
        seenX.add(m.pos);
        guides.push({
          axis: 'x',
          position: m.pos,
          start: Math.min(movingBounds.minY + dy, m.targetB.minY) - 16,
          end: Math.max(movingBounds.maxY + dy, m.targetB.maxY) + 16,
        });
      }
    }
  }

  if (bestDy !== null) {
    for (const m of yMatches) {
      if (snappedY.some((sy) => Math.abs(sy - m.pos) < 0.5) && !seenY.has(m.pos)) {
        seenY.add(m.pos);
        guides.push({
          axis: 'y',
          position: m.pos,
          start: Math.min(movingBounds.minX + dx, m.targetB.minX) - 16,
          end: Math.max(movingBounds.maxX + dx, m.targetB.maxX) + 16,
        });
      }
    }
  }

  return { dx, dy, guides };
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function alignElements(
  elements: CanvasElement[],
  selectedIds: Set<string>,
  mode: AlignMode
): CanvasElement[] {
  const selected = elements.filter((e) => selectedIds.has(e.id) && !e.locked);
  if (selected.length < 2) return elements;
  const total = getSelectionBounds(selected);
  if (!total) return elements;

  const updated = elements.map((el) => {
    if (!selectedIds.has(el.id) || el.locked) return el;
    const b = getElementBounds(el);
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = total.minX - b.minX;
        break;
      case 'center':
        dx = total.cx - b.cx;
        break;
      case 'right':
        dx = total.maxX - b.maxX;
        break;
      case 'top':
        dy = total.minY - b.minY;
        break;
      case 'middle':
        dy = total.cy - b.cy;
        break;
      case 'bottom':
        dy = total.maxY - b.maxY;
        break;
    }
    return { ...el, x: el.x + dx, y: el.y + dy };
  });

  return syncBoundConnectors(updated);
}

export function distributeElements(
  elements: CanvasElement[],
  selectedIds: Set<string>,
  axis: 'horizontal' | 'vertical'
): CanvasElement[] {
  const selected = elements.filter((e) => selectedIds.has(e.id) && !e.locked);
  if (selected.length < 3) return elements;

  const withBounds = selected
    .map((el) => ({ el, bounds: getElementBounds(el) }))
    .sort((a, b) =>
      axis === 'horizontal' ? a.bounds.cx - b.bounds.cx : a.bounds.cy - b.bounds.cy
    );

  const first = withBounds[0].bounds;
  const last = withBounds[withBounds.length - 1].bounds;
  const totalSpan =
    axis === 'horizontal' ? last.maxX - first.minX : last.maxY - first.minY;
  const sumSizes = withBounds.reduce(
    (sum, item) => sum + (axis === 'horizontal' ? item.bounds.width : item.bounds.height),
    0
  );
  const gap = (totalSpan - sumSizes) / (withBounds.length - 1);

  const offsets = new Map<string, { dx: number; dy: number }>();
  let cursor = axis === 'horizontal' ? first.minX : first.minY;
  for (const item of withBounds) {
    if (axis === 'horizontal') {
      offsets.set(item.el.id, { dx: cursor - item.bounds.minX, dy: 0 });
      cursor += item.bounds.width + gap;
    } else {
      offsets.set(item.el.id, { dx: 0, dy: cursor - item.bounds.minY });
      cursor += item.bounds.height + gap;
    }
  }

  const updated = elements.map((el) => {
    const off = offsets.get(el.id);
    if (!off) return el;
    return { ...el, x: el.x + off.dx, y: el.y + off.dy };
  });

  return syncBoundConnectors(updated);
}

export function computeMindMapBranch(
  parent: CanvasElement,
  direction: 'right' | 'bottom' | 'left' | 'top'
): { nodeRect: { x: number; y: number; width: number; height: number }; fromPort: PortSide; toPort: PortSide } {
  const b = getElementBounds(parent);
  const w = Math.max(150, Math.min(220, b.width));
  const h = Math.max(76, Math.min(130, b.height));
  const gap = 80;

  switch (direction) {
    case 'right':
      return {
        nodeRect: { x: b.maxX + gap, y: b.cy - h / 2, width: w, height: h },
        fromPort: 'right',
        toPort: 'left',
      };
    case 'left':
      return {
        nodeRect: { x: b.minX - gap - w, y: b.cy - h / 2, width: w, height: h },
        fromPort: 'left',
        toPort: 'right',
      };
    case 'bottom':
      return {
        nodeRect: { x: b.cx - w / 2, y: b.maxY + gap, width: w, height: h },
        fromPort: 'bottom',
        toPort: 'top',
      };
    case 'top':
      return {
        nodeRect: { x: b.cx - w / 2, y: b.minY - gap - h, width: w, height: h },
        fromPort: 'top',
        toPort: 'bottom',
      };
  }
}

export function elementsIntersectMarquee(
  el: CanvasElement,
  marquee: { x: number; y: number; width: number; height: number }
): boolean {
  if (el.hidden) return false;
  const b = getElementBounds(el);
  return !(
    b.maxX < marquee.x ||
    b.minX > marquee.x + marquee.width ||
    b.maxY < marquee.y ||
    b.minY > marquee.y + marquee.height
  );
}
