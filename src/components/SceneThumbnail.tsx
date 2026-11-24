import React, { useMemo } from 'react';
import { getElementBounds, getSelectionBounds, getSlideDimensions } from '../engine/geometry';
import { generateElementSvgOps } from '../engine/roughRenderer';
import type { AspectRatio, CanvasElement } from '../types/studio';

interface SceneThumbnailProps {
  elements: CanvasElement[];
  background: string;
  aspectRatio?: AspectRatio;
  isBoard?: boolean;
  className?: string;
}

export const SceneThumbnail: React.FC<SceneThumbnailProps> = ({
  elements,
  background,
  aspectRatio = '16:9',
  isBoard = false,
  className = '',
}) => {
  const { viewBox, width, height } = useMemo(() => {
    if (!isBoard) {
      const dims = getSlideDimensions(aspectRatio);
      return { viewBox: `0 0 ${dims.width} ${dims.height}`, width: dims.width, height: dims.height };
    }
    const b = getSelectionBounds(elements);
    if (!b) {
      return { viewBox: '0 0 960 540', width: 960, height: 540 };
    }
    const pad = 48;
    const vx = Math.floor(b.minX - pad);
    const vy = Math.floor(b.minY - pad);
    const vw = Math.max(320, Math.ceil(b.width + pad * 2));
    const vh = Math.max(180, Math.ceil(b.height + pad * 2));
    return { viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw, height: vh };
  }, [elements, aspectRatio, isBoard]);

  const renderedOps = useMemo(() => {
    return elements
      .filter((el) => !el.hidden)
      .map((el) => ({
        el,
        ops: el.type === 'image' || el.type === 'symbol' ? [] : generateElementSvgOps(el),
      }));
  }, [elements]);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full select-none ${className}`}
      style={{ backgroundColor: background || '#FFFFFF' }}
      aria-hidden="true"
    >
      {renderedOps.map(({ el, ops }) => {
        const b = getElementBounds(el);
        const transform = el.angle ? `rotate(${el.angle} ${b.cx} ${b.cy})` : undefined;

        return (
          <g key={el.id} opacity={el.opacity ?? 1} transform={transform}>
            {el.type === 'image' && el.imageUrl && (
              <image
                href={el.imageUrl}
                x={el.x}
                y={el.y}
                width={Math.abs(el.width)}
                height={Math.abs(el.height)}
                preserveAspectRatio="xMidYMid slice"
              />
            )}

            {el.type === 'symbol' && el.symbolPaths && (
              <g
                transform={`translate(${el.x}, ${el.y}) scale(${Math.abs(el.width) / (el.symbolViewBox || 48)}, ${Math.abs(el.height) / (el.symbolViewBox || 48)})`}
              >
                {el.symbolPaths.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill={el.fillColor === 'transparent' ? 'none' : el.fillColor}
                    stroke={el.strokeColor}
                    strokeWidth={Math.max(1.5, el.strokeWidth)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}

            {ops.length > 0 && (
              <g transform={`translate(${el.x}, ${el.y})`}>
                {ops.map((op, idx) => (
                  <path
                    key={idx}
                    d={op.d}
                    stroke={op.stroke}
                    strokeWidth={op.strokeWidth}
                    fill={op.fill}
                    strokeDasharray={op.strokeDasharray}
                    strokeLinecap={op.strokeLinecap || 'round'}
                    strokeLinejoin={op.strokeLinejoin || 'round'}
                  />
                ))}
              </g>
            )}

            {el.text && (() => {
              const fontSize = Math.max(11, el.fontSize || 18);
              const maxW = Math.max(80, Math.abs(el.width) - 24);
              const approxCharW = fontSize * 0.56;
              const maxChars = Math.max(8, Math.floor(maxW / approxCharW));
              const rawLines = el.text.split('\n');
              const wrapped: string[] = [];
              for (const raw of rawLines) {
                const words = raw.split(/\s+/);
                let line = '';
                for (const word of words) {
                  const candidate = line ? `${line} ${word}` : word;
                  if (candidate.length <= maxChars) {
                    line = candidate;
                  } else {
                    if (line) wrapped.push(line);
                    line = word;
                  }
                }
                if (line) wrapped.push(line);
              }
              const visibleLines = wrapped.slice(0, 4);
              const lineHeight = fontSize * 1.22;
              const textX =
                el.type === 'frame'
                  ? el.x + 4
                  : el.textAlign === 'left'
                    ? el.x + 12
                    : el.x + Math.abs(el.width) / 2;
              const baseY =
                el.type === 'frame'
                  ? el.y - 10
                  : el.type === 'symbol'
                    ? el.y + Math.abs(el.height) + fontSize * 0.9
                    : el.y + Math.abs(el.height) / 2 - ((visibleLines.length - 1) * lineHeight) / 2;

              return (
                <text
                  x={textX}
                  y={baseY}
                  fill={el.textColor || '#0F172A'}
                  fontSize={fontSize}
                  fontWeight={el.fontWeight || 'normal'}
                  fontFamily={
                    el.fontFamily === 'sketch'
                      ? 'Caveat, cursive'
                      : el.fontFamily === 'serif'
                        ? 'Playfair Display, serif'
                        : el.fontFamily === 'mono'
                          ? 'JetBrains Mono, monospace'
                          : 'Plus Jakarta Sans, sans-serif'
                  }
                  textAnchor={el.type === 'frame' || el.textAlign === 'left' ? 'start' : 'middle'}
                  dominantBaseline="middle"
                >
                  {visibleLines.map((ln, idx) => (
                    <tspan key={idx} x={textX} dy={idx === 0 ? 0 : lineHeight}>
                      {ln}
                    </tspan>
                  ))}
                </text>
              );
            })()}
          </g>
        );
      })}
      {elements.length === 0 && (
        <rect
          x={width * 0.15}
          y={height * 0.25}
          width={width * 0.7}
          height={height * 0.5}
          rx={8}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={2}
          strokeDasharray="6 6"
        />
      )}
    </svg>
  );
};
