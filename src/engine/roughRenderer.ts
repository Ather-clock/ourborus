import rough from 'roughjs';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import type { ArrowHeadType, CanvasElement, Point } from '../types/studio';

const generator = rough.generator();

export interface RenderedSvgOp {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  strokeDasharray?: string;
  strokeLinecap?: 'round' | 'butt' | 'square';
  strokeLinejoin?: 'round' | 'bevel' | 'miter';
}

function getDashArray(style: CanvasElement['strokeStyle'], width: number): string | undefined {
  if (style === 'dashed') return `${Math.max(6, width * 3)} ${Math.max(5, width * 2.5)}`;
  if (style === 'dotted') return `${Math.max(1.5, width)} ${Math.max(4, width * 2.5)}`;
  return undefined;
}

function buildRoughOptions(el: CanvasElement): RoughOptions {
  const fill = el.fillStyle === 'none' || el.fillColor === 'transparent' ? undefined : el.fillColor;
  const fillStyle =
    el.fillStyle === 'none'
      ? 'hachure'
      : el.fillStyle === 'solid'
        ? 'solid'
        : el.fillStyle === 'cross-hatch'
          ? 'cross-hatch'
          : el.fillStyle === 'zigzag'
            ? 'zigzag'
            : el.fillStyle === 'dots'
              ? 'dots'
              : 'hachure';

  return {
    seed: el.seed || 1,
    roughness: el.roughness ?? 1.2,
    bowing: el.roughness > 0 ? 1.1 : 0,
    stroke: el.strokeColor === 'transparent' ? 'none' : el.strokeColor,
    strokeWidth: Math.max(1, el.strokeWidth || 2),
    fill,
    fillStyle,
    fillWeight: Math.max(1, (el.strokeWidth || 2) * 0.65),
    hachureAngle: -41,
    hachureGap: Math.max(5, (el.strokeWidth || 2) * 3.5),
    disableMultiStroke: el.roughness === 0,
    strokeLineDash:
      el.strokeStyle === 'dashed'
        ? [8, 6]
        : el.strokeStyle === 'dotted'
          ? [2, 5]
          : undefined,
  };
}

function drawableToOps(drawable: ReturnType<typeof generator.rectangle>, el: CanvasElement): RenderedSvgOp[] {
  const paths = generator.toPaths(drawable);
  const dash = getDashArray(el.strokeStyle, el.strokeWidth);
  return paths.map((p) => ({
    d: p.d,
    stroke: p.stroke || 'none',
    strokeWidth: p.strokeWidth || el.strokeWidth || 2,
    fill: p.fill || 'none',
    strokeDasharray: p.stroke !== 'none' ? dash : undefined,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }));
}

export function getSvgPathFromStroke(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${(points[0].x + 0.5).toFixed(2)} ${(points[0].y + 0.5).toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}

function roundedRectSvgPath(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rad <= 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return [
    `M ${x + rad} ${y}`,
    `H ${x + w - rad}`,
    `Q ${x + w} ${y} ${x + w} ${y + rad}`,
    `V ${y + h - rad}`,
    `Q ${x + w} ${y + h} ${x + w - rad} ${y + h}`,
    `H ${x + rad}`,
    `Q ${x} ${y + h} ${x} ${y + h - rad}`,
    `V ${y + rad}`,
    `Q ${x} ${y} ${x + rad} ${y}`,
    'Z',
  ].join(' ');
}

function createStarVertices(w: number, h: number): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = outerRx * 0.42;
  const innerRy = outerRy * 0.42;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return pts;
}

function createHexagonVertices(w: number, h: number): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    pts.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return pts;
}

function buildArrowheadOp(
  tip: Point,
  from: Point,
  type: ArrowHeadType,
  strokeColor: string,
  strokeWidth: number
): RenderedSvgOp | null {
  if (type === 'none') return null;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const size = Math.max(10, strokeWidth * 4.2);

  if (type === 'dot') {
    const r = size * 0.35;
    const d = `M ${tip.x - r} ${tip.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
    return {
      d,
      stroke: strokeColor,
      strokeWidth,
      fill: strokeColor,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };
  }

  if (type === 'bar') {
    const perp = angle + Math.PI / 2;
    const half = size * 0.5;
    const p1x = tip.x + Math.cos(perp) * half;
    const p1y = tip.y + Math.sin(perp) * half;
    const p2x = tip.x - Math.cos(perp) * half;
    const p2y = tip.y - Math.sin(perp) * half;
    return {
      d: `M ${p1x.toFixed(2)} ${p1y.toFixed(2)} L ${p2x.toFixed(2)} ${p2y.toFixed(2)}`,
      stroke: strokeColor,
      strokeWidth,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };
  }

  if (type === 'diamond') {
    const back = size * 1.1;
    const side = size * 0.45;
    const midX = tip.x - Math.cos(angle) * (back * 0.5);
    const midY = tip.y - Math.sin(angle) * (back * 0.5);
    const tailX = tip.x - Math.cos(angle) * back;
    const tailY = tip.y - Math.sin(angle) * back;
    const perp = angle + Math.PI / 2;
    const p1x = midX + Math.cos(perp) * side;
    const p1y = midY + Math.sin(perp) * side;
    const p2x = midX - Math.cos(perp) * side;
    const p2y = midY - Math.sin(perp) * side;
    return {
      d: `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${p1x.toFixed(2)} ${p1y.toFixed(2)} L ${tailX.toFixed(2)} ${tailY.toFixed(2)} L ${p2x.toFixed(2)} ${p2y.toFixed(2)} Z`,
      stroke: strokeColor,
      strokeWidth,
      fill: strokeColor,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };
  }

  // Standard open hand-drawn arrow
  const spread = Math.PI / 6.5;
  const x1 = tip.x - Math.cos(angle - spread) * size;
  const y1 = tip.y - Math.sin(angle - spread) * size;
  const x2 = tip.x - Math.cos(angle + spread) * size;
  const y2 = tip.y - Math.sin(angle + spread) * size;
  return {
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    stroke: strokeColor,
    strokeWidth: Math.max(1.5, strokeWidth),
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function getConnectorCurvePoints(el: CanvasElement): Point[] {
  const pts = el.points && el.points.length >= 2 ? el.points : [{ x: 0, y: 0 }, { x: el.width, y: el.height }];
  const start = pts[0];
  const end = pts[pts.length - 1];

  if (el.curveType === 'elbow' && pts.length === 2) {
    const midX = (start.x + end.x) / 2;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  }

  if (el.curveType === 'curved' && pts.length === 2) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const cx = (start.x + end.x) / 2 - dy * 0.22;
    const cy = (start.y + end.y) / 2 + dx * 0.22;
    return [start, { x: cx, y: cy }, end];
  }

  return pts;
}

export function generateElementSvgOps(el: CanvasElement): RenderedSvgOp[] {
  const w = Math.max(4, Math.abs(el.width));
  const h = Math.max(4, Math.abs(el.height));
  const opts = buildRoughOptions(el);

  switch (el.type) {
    case 'rect': {
      if (el.cornerRadius > 0 && el.roughness === 0) {
        return [
          {
            d: roundedRectSvgPath(0, 0, w, h, el.cornerRadius),
            stroke: el.strokeColor === 'transparent' ? 'none' : el.strokeColor,
            strokeWidth: el.strokeWidth,
            fill: el.fillStyle === 'none' ? 'none' : el.fillColor,
            strokeDasharray: getDashArray(el.strokeStyle, el.strokeWidth),
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
        ];
      }
      if (el.cornerRadius > 0) {
        const d = roundedRectSvgPath(0, 0, w, h, el.cornerRadius);
        return drawableToOps(generator.path(d, opts), el);
      }
      return drawableToOps(generator.rectangle(0, 0, w, h, opts), el);
    }

    case 'ellipse': {
      return drawableToOps(generator.ellipse(w / 2, h / 2, w, h, opts), el);
    }

    case 'diamond': {
      const verts: [number, number][] = [
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ];
      return drawableToOps(generator.polygon(verts, opts), el);
    }

    case 'triangle': {
      const verts: [number, number][] = [
        [w / 2, 0],
        [w, h],
        [0, h],
      ];
      return drawableToOps(generator.polygon(verts, opts), el);
    }

    case 'star': {
      return drawableToOps(generator.polygon(createStarVertices(w, h), opts), el);
    }

    case 'hexagon': {
      return drawableToOps(generator.polygon(createHexagonVertices(w, h), opts), el);
    }

    case 'callout': {
      const tailH = Math.min(22, h * 0.25);
      const bodyH = h - tailH;
      const d = [
        `M 12 0`,
        `H ${w - 12}`,
        `Q ${w} 0 ${w} 12`,
        `V ${bodyH - 12}`,
        `Q ${w} ${bodyH} ${w - 12} ${bodyH}`,
        `H ${Math.min(w - 20, w * 0.42)}`,
        `L ${Math.max(16, w * 0.22)} ${h}`,
        `L ${Math.max(24, w * 0.28)} ${bodyH}`,
        `H 12`,
        `Q 0 ${bodyH} 0 ${bodyH - 12}`,
        `V 12`,
        `Q 0 0 12 0 Z`,
      ].join(' ');
      return drawableToOps(generator.path(d, opts), el);
    }

    case 'sticky': {
      // Sticky note with folded corner detail
      const fold = 18;
      const baseOps = drawableToOps(
        generator.polygon(
          [
            [0, 0],
            [w, 0],
            [w, h - fold],
            [w - fold, h],
            [0, h],
          ],
          {
            ...opts,
            fillStyle: el.fillStyle === 'none' ? 'solid' : opts.fillStyle,
            roughness: Math.min(1.4, el.roughness ?? 1.0),
          }
        ),
        el
      );
      baseOps.push({
        d: `M ${w - fold} ${h} L ${w - fold} ${h - fold} L ${w} ${h - fold}`,
        stroke: el.strokeColor === 'transparent' ? 'rgba(15,23,42,0.25)' : el.strokeColor,
        strokeWidth: 1.25,
        fill: 'rgba(15,23,42,0.06)',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      });
      return baseOps;
    }

    case 'frame': {
      return [
        {
          d: roundedRectSvgPath(0, 0, w, h, 8),
          stroke: el.strokeColor || '#94A3B8',
          strokeWidth: el.strokeWidth || 1.5,
          fill: el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : 'rgba(255,255,255,0.65)',
          strokeDasharray: el.strokeStyle === 'dashed' ? '6 5' : undefined,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
      ];
    }

    case 'freedraw': {
      const pts = el.points || [];
      return [
        {
          d: getSvgPathFromStroke(pts),
          stroke: el.strokeColor || '#0F172A',
          strokeWidth: el.isHighlighter ? Math.max(12, el.strokeWidth * 4) : el.strokeWidth || 3,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
      ];
    }

    case 'line':
    case 'arrow': {
      const pts = getConnectorCurvePoints(el);
      const ops: RenderedSvgOp[] = [];

      if (el.curveType === 'curved' && pts.length === 3) {
        const d = `M ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y}`;
        ops.push(...drawableToOps(generator.path(d, { ...opts, fill: undefined }), el));
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          ops.push(
            ...drawableToOps(
              generator.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, {
                ...opts,
                fill: undefined,
              }),
              el
            )
          );
        }
      }

      if (el.type === 'arrow' || el.endArrowhead !== 'none') {
        const endHead = el.endArrowhead ?? (el.type === 'arrow' ? 'arrow' : 'none');
        const fromPt = pts[pts.length - 2] ?? pts[0];
        const tipPt = pts[pts.length - 1];
        const headOp = buildArrowheadOp(tipPt, fromPt, endHead, el.strokeColor, el.strokeWidth);
        if (headOp) ops.push(headOp);
      }

      if (el.startArrowhead && el.startArrowhead !== 'none') {
        const fromPt = pts[1] ?? pts[pts.length - 1];
        const tipPt = pts[0];
        const headOp = buildArrowheadOp(
          tipPt,
          fromPt,
          el.startArrowhead,
          el.strokeColor,
          el.strokeWidth
        );
        if (headOp) ops.push(headOp);
      }

      return ops;
    }

    default:
      return [];
  }
}
