import { jsPDF } from 'jspdf';
import { getElementBounds, getSelectionBounds, getSlideDimensions } from '../engine/geometry';
import { generateElementSvgOps } from '../engine/roughRenderer';
import { serializeProject } from '../engine/scene';
import type { CanvasElement, ProjectDocument, Slide } from '../types/studio';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveFontFamilyCss(family?: CanvasElement['fontFamily']): string {
  switch (family) {
    case 'sketch':
      return "'Caveat', cursive";
    case 'serif':
      return "'Playfair Display', Georgia, serif";
    case 'mono':
      return "'JetBrains Mono', monospace";
    case 'sans':
    default:
      return "'Plus Jakarta Sans', 'DM Sans', sans-serif";
  }
}

function renderElementToSvgString(el: CanvasElement): string {
  if (el.hidden) return '';
  const bounds = getElementBounds(el);
  const cx = bounds.cx;
  const cy = bounds.cy;
  const transform = el.angle ? ` transform="rotate(${el.angle} ${cx} ${cy})"` : '';
  const opacity = el.opacity ?? 1;

  const parts: string[] = [`<g opacity="${opacity}"${transform}>`];

  if (el.type === 'image' && el.imageUrl) {
    const r = el.cornerRadius || 0;
    const clipId = `clip_${el.id}`;
    if (r > 0) {
      parts.push(
        `<defs><clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${Math.abs(el.width)}" height="${Math.abs(el.height)}" rx="${r}" ry="${r}" /></clipPath></defs>`
      );
    }
    parts.push(
      `<image href="${escapeXml(el.imageUrl)}" x="${el.x}" y="${el.y}" width="${Math.abs(el.width)}" height="${Math.abs(el.height)}" preserveAspectRatio="xMidYMid slice"${r > 0 ? ` clip-path="url(#${clipId})"` : ''} />`
    );
  } else if (el.type === 'symbol' && el.symbolPaths) {
    const vb = el.symbolViewBox || 48;
    const sx = Math.abs(el.width) / vb;
    const sy = Math.abs(el.height) / vb;
    parts.push(
      `<g transform="translate(${el.x}, ${el.y}) scale(${sx}, ${sy})">`
    );
    for (const d of el.symbolPaths) {
      parts.push(
        `<path d="${escapeXml(d)}" fill="${escapeXml(el.fillColor === 'transparent' ? 'none' : el.fillColor)}" stroke="${escapeXml(el.strokeColor)}" stroke-width="${Math.max(1.5, el.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" />`
      );
    }
    parts.push(`</g>`);
  } else {
    const ops = generateElementSvgOps(el);
    if (ops.length > 0) {
      parts.push(`<g transform="translate(${el.x}, ${el.y})">`);
      for (const op of ops) {
        parts.push(
          `<path d="${escapeXml(op.d)}" stroke="${escapeXml(op.stroke)}" stroke-width="${op.strokeWidth}" fill="${escapeXml(op.fill)}"${op.strokeDasharray ? ` stroke-dasharray="${op.strokeDasharray}"` : ''} stroke-linecap="${op.strokeLinecap || 'round'}" stroke-linejoin="${op.strokeLinejoin || 'round'}" />`
        );
      }
      parts.push(`</g>`);
    }
  }

  if (el.text && el.text.trim().length > 0) {
    const fontCss = resolveFontFamilyCss(el.fontFamily);
    const fontSize = el.fontSize || 20;
    const fill = el.textColor || '#0F172A';
    const maxW = Math.max(80, Math.abs(el.width) - 24);
    const approxCharW = fontSize * 0.56;
    const maxChars = Math.max(8, Math.floor(maxW / approxCharW));
    const lines: string[] = [];
    for (const raw of el.text.split('\n')) {
      const words = raw.split(/\s+/);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length <= maxChars) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
    }

    const lineHeight = fontSize * 1.25;
    const startY =
      el.type === 'frame'
        ? el.y - 10
        : el.type === 'symbol'
          ? el.y + Math.abs(el.height) + fontSize + 6
          : el.y + Math.abs(el.height) / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
    const anchor =
      el.textAlign === 'left' ? 'start' : el.textAlign === 'right' ? 'end' : 'middle';
    const textX =
      el.type === 'frame'
        ? el.x + 4
        : el.textAlign === 'left'
          ? el.x + 12
          : el.textAlign === 'right'
            ? el.x + Math.abs(el.width) - 12
            : el.x + Math.abs(el.width) / 2;

    parts.push(
      `<text x="${textX}" y="${startY}" fill="${escapeXml(fill)}" font-family="${escapeXml(fontCss)}" font-size="${fontSize}" font-weight="${el.fontWeight || 'normal'}" font-style="${el.fontStyle || 'normal'}" text-anchor="${el.type === 'frame' ? 'start' : anchor}">`
    );
    lines.forEach((line, i) => {
      parts.push(
        `<tspan x="${textX}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
      );
    });
    parts.push(`</text>`);
  }

  parts.push('</g>');
  return parts.join('\n');
}

export function buildSceneSvgString(
  elements: CanvasElement[],
  width: number,
  height: number,
  background: string,
  offsetX = 0,
  offsetY = 0
): string {
  const bgRect =
    background && background !== 'transparent'
      ? `<rect x="${offsetX}" y="${offsetY}" width="${width}" height="${height}" fill="${escapeXml(background)}" />`
      : '';
  const body = elements.map(renderElementToSvgString).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offsetX} ${offsetY} ${width} ${height}" width="${width}" height="${height}">\n${bgRect}\n${body}\n</svg>`;
}

export function buildSlideSvg(project: ProjectDocument, slide: Slide, includeBg = true): string {
  const { width, height } = getSlideDimensions(project.aspectRatio);
  return buildSceneSvgString(
    slide.elements,
    width,
    height,
    includeBg ? slide.background || '#FFFFFF' : 'transparent',
    0,
    0
  );
}

export function buildBoardSvg(project: ProjectDocument, includeBg = true): {
  svg: string;
  width: number;
  height: number;
} {
  const bounds = getSelectionBounds(project.boardElements);
  if (!bounds) {
    return {
      svg: buildSceneSvgString([], 1200, 800, includeBg ? project.boardBackground : 'transparent'),
      width: 1200,
      height: 800,
    };
  }
  const pad = 64;
  const x = Math.floor(bounds.minX - pad);
  const y = Math.floor(bounds.minY - pad);
  const w = Math.ceil(bounds.width + pad * 2);
  const h = Math.ceil(bounds.height + pad * 2);
  return {
    svg: buildSceneSvgString(
      project.boardElements,
      w,
      h,
      includeBg ? project.boardBackground : 'transparent',
      x,
      y
    ),
    width: w,
    height: h,
  };
}

async function svgToPngDataUrl(svgString: string, width: number, height: number, scale = 2): Promise<string> {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function triggerDownload(blobOrUrl: Blob | string, filename: string): void {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function exportProjectAsJson(project: ProjectDocument): void {
  const json = serializeProject(project);
  const safeName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sketchdeck';
  triggerDownload(new Blob([json], { type: 'application/json' }), `${safeName}.sketchdeck.json`);
}

export function exportCurrentViewAsSvg(project: ProjectDocument, includeBg = true): void {
  const safeName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sketchdeck';
  if (project.mode === 'whiteboard') {
    const { svg } = buildBoardSvg(project, includeBg);
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}-board.svg`);
    return;
  }
  const slide = project.slides.find((s) => s.id === project.activeSlideId) ?? project.slides[0];
  if (!slide) return;
  const svg = buildSlideSvg(project, slide, includeBg);
  triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}-slide.svg`);
}

export async function exportCurrentViewAsPng(
  project: ProjectDocument,
  scale = 2,
  includeBg = true
): Promise<void> {
  const safeName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sketchdeck';
  if (project.mode === 'whiteboard') {
    const { svg, width, height } = buildBoardSvg(project, includeBg);
    const dataUrl = await svgToPngDataUrl(svg, width, height, scale);
    triggerDownload(dataUrl, `${safeName}-board.png`);
    return;
  }
  const slide = project.slides.find((s) => s.id === project.activeSlideId) ?? project.slides[0];
  if (!slide) return;
  const { width, height } = getSlideDimensions(project.aspectRatio);
  const svg = buildSlideSvg(project, slide, includeBg);
  const dataUrl = await svgToPngDataUrl(svg, width, height, scale);
  triggerDownload(dataUrl, `${safeName}-${slide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
}

export async function exportProjectAsPdf(project: ProjectDocument): Promise<void> {
  const safeName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sketchdeck';

  if (project.mode === 'whiteboard') {
    const { svg, width, height } = buildBoardSvg(project, true);
    const dataUrl = await svgToPngDataUrl(svg, width, height, 2);
    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${safeName}-board.pdf`);
    return;
  }

  const { width, height } = getSlideDimensions(project.aspectRatio);
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });

  for (let i = 0; i < project.slides.length; i++) {
    const slide = project.slides[i];
    const svg = buildSlideSvg(project, slide, true);
    const dataUrl = await svgToPngDataUrl(svg, width, height, 2);
    if (i > 0) {
      pdf.addPage([width, height], width >= height ? 'landscape' : 'portrait');
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  }

  pdf.save(`${safeName}-deck.pdf`);
}
