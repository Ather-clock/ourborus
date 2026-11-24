import React, { useEffect, useMemo, useRef } from 'react';
import { getElementBounds, isLinearElement } from '../engine/geometry';
import { generateElementSvgOps } from '../engine/roughRenderer';
import type { CanvasElement } from '../types/studio';

interface CanvasElementViewProps {
  element: CanvasElement;
  isSelected: boolean;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onEndEdit: () => void;
  onToggleReaction?: (id: string, label: string) => void;
}

function getFontClass(family?: CanvasElement['fontFamily']): string {
  switch (family) {
    case 'sketch':
      return 'font-[Caveat,cursive] leading-tight';
    case 'serif':
      return 'font-[Playfair_Display,Georgia,serif] leading-snug';
    case 'mono':
      return 'font-[JetBrains_Mono,monospace] leading-snug';
    case 'sans':
    default:
      return 'font-[Plus_Jakarta_Sans,DM_Sans,sans-serif] leading-snug';
  }
}

export const CanvasElementView: React.FC<CanvasElementViewProps> = ({
  element,
  isSelected,
  isEditing,
  onStartEdit,
  onChangeText,
  onEndEdit,
  onToggleReaction,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const ops = useMemo(() => {
    if (element.type === 'image' || element.type === 'symbol' || element.type === 'text') {
      return [];
    }
    return generateElementSvgOps(element);
  }, [element]);

  if (element.hidden) return null;

  const bounds = getElementBounds(element);
  const linear = isLinearElement(element);
  const w = Math.max(4, Math.abs(element.width));
  const h = Math.max(4, Math.abs(element.height));

  // For linear elements, render inside a bounding box container so SVG paths sit accurately relative to element.x/y
  if (linear) {
    const pad = 28;
    const svgX = bounds.minX - element.x - pad;
    const svgY = bounds.minY - element.y - pad;
    const svgW = bounds.width + pad * 2;
    const svgH = bounds.height + pad * 2;

    return (
      <div
        data-element-id={element.id}
        className="absolute pointer-events-none select-none"
        style={{
          left: bounds.minX - pad,
          top: bounds.minY - pad,
          width: svgW,
          height: svgH,
          opacity: element.opacity ?? 1,
          transform: element.angle ? `rotate(${element.angle}deg)` : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`${svgX} ${svgY} ${svgW} ${svgH}`}
          className="overflow-visible"
        >
          {ops.map((op, i) => (
            <path
              key={i}
              d={op.d}
              stroke={op.stroke}
              strokeWidth={op.strokeWidth}
              fill={op.fill}
              strokeDasharray={op.strokeDasharray}
              strokeLinecap={op.strokeLinecap || 'round'}
              strokeLinejoin={op.strokeLinejoin || 'round'}
            />
          ))}
        </svg>

        {element.text && !isEditing && (
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/90 text-xs shadow-xs ${getFontClass(element.fontFamily)}`}
            style={{
              color: element.textColor || '#0F172A',
              fontSize: Math.max(12, Math.min(20, element.fontSize || 15)),
            }}
          >
            {element.text}
          </div>
        )}
      </div>
    );
  }

  const fontClass = getFontClass(element.fontFamily);
  const alignClass =
    element.textAlign === 'left'
      ? 'text-left items-start'
      : element.textAlign === 'right'
        ? 'text-right items-end'
        : 'text-center items-center';

  const supportsText =
    element.type !== 'image' && element.type !== 'freedraw';

  return (
    <div
      data-element-id={element.id}
      onDoubleClick={(e) => {
        if (supportsText && !element.locked) {
          e.stopPropagation();
          onStartEdit(element.id);
        }
      }}
      className={`absolute select-none ${isSelected ? 'z-10' : ''}`}
      style={{
        left: bounds.minX,
        top: bounds.minY,
        width: w,
        height: h,
        opacity: element.opacity ?? 1,
        transform: element.angle ? `rotate(${element.angle}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {/* Frame label bar above top edge */}
      {element.type === 'frame' && (
        <div className="absolute -top-7 left-0 flex items-center gap-2 pointer-events-auto">
          <span className="text-xs font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-0.5 rounded">
            {element.text || element.name || 'Frame'}
          </span>
        </div>
      )}

      {/* Image element */}
      {element.type === 'image' && (
        <div
          className="w-full h-full overflow-hidden bg-slate-100 flex items-center justify-center"
          style={{
            borderRadius: element.cornerRadius || 0,
            border:
              element.strokeColor && element.strokeColor !== 'transparent' && element.strokeWidth > 0
                ? `${element.strokeWidth}px ${element.strokeStyle === 'dashed' ? 'dashed' : element.strokeStyle === 'dotted' ? 'dotted' : 'solid'} ${element.strokeColor}`
                : undefined,
          }}
        >
          {element.imageUrl ? (
            <img
              src={element.imageUrl}
              alt={element.imageName || 'Canvas artwork'}
              referrerPolicy="no-referrer"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <span className="text-xs text-slate-400 px-2 text-center">
              {element.imageName || 'Image'}
            </span>
          )}
        </div>
      )}

      {/* Symbol vector element */}
      {element.type === 'symbol' && element.symbolPaths && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${element.symbolViewBox || 48} ${element.symbolViewBox || 48}`}
          className="w-full h-full overflow-visible pointer-events-none"
        >
          {element.symbolPaths.map((d, idx) => (
            <path
              key={idx}
              d={d}
              fill={element.fillColor === 'transparent' ? 'none' : element.fillColor}
              stroke={element.strokeColor || '#0F172A'}
              strokeWidth={Math.max(1.5, element.strokeWidth)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}

      {/* RoughJS SVG layer */}
      {ops.length > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-full overflow-visible pointer-events-none"
        >
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
        </svg>
      )}

      {/* Text & Sticky Note content overlay */}
      {supportsText && element.type !== 'frame' && (
        <div
          className={`absolute flex flex-col justify-center ${
            element.type === 'symbol'
              ? 'top-full -left-6 -right-6 mt-1.5 items-center text-center'
              : `inset-0 p-3 ${alignClass}`
          } ${isEditing ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={element.text || ''}
              onChange={(e) => onChangeText(element.id, e.target.value)}
              onBlur={onEndEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onEndEdit();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Edit element text"
              className={`w-full h-full resize-none bg-white/90 outline-2 outline-blue-500 rounded px-1.5 py-1 ${fontClass}`}
              style={{
                color: element.textColor || '#0F172A',
                fontSize: element.fontSize || 20,
                fontWeight: element.fontWeight || 'normal',
                fontStyle: element.fontStyle || 'normal',
                textAlign: element.textAlign || 'center',
              }}
            />
          ) : (
            element.text && (
              <div
                className={`w-full whitespace-pre-wrap break-words ${fontClass}`}
                style={{
                  color: element.textColor || '#0F172A',
                  fontSize: element.fontSize || 20,
                  fontWeight: element.fontWeight || 'normal',
                  fontStyle: element.fontStyle || 'normal',
                  textAlign: element.textAlign || 'center',
                }}
              >
                {element.text}
              </div>
            )
          )}
        </div>
      )}

      {/* Frame inline label editing */}
      {element.type === 'frame' && isEditing && (
        <input
          type="text"
          autoFocus
          value={element.text || ''}
          onChange={(e) => onChangeText(element.id, e.target.value)}
          onBlur={onEndEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') onEndEdit();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Edit frame title"
          className="absolute -top-8 left-0 text-xs font-semibold bg-white border border-blue-500 rounded px-2 py-0.5 outline-none"
        />
      )}

      {/* Miro-style Sticky Note reactions */}
      {element.type === 'sticky' && !isEditing && (
        <div className="absolute -bottom-3 left-2 flex items-center gap-1 pointer-events-auto">
          {(element.reactions || []).map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReaction?.(element.id, r.label);
              }}
              className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums bg-white border border-slate-200 rounded shadow-xs hover:bg-blue-50 hover:border-blue-300 text-slate-700"
              title="Vote on sticky note"
            >
              {r.label} {r.count}
            </button>
          ))}
          {isSelected && (!element.reactions || element.reactions.length === 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReaction?.(element.id, '+1');
              }}
              className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded shadow-xs hover:bg-blue-50 text-slate-600"
              title="Add +1 vote"
            >
              +1 Vote
            </button>
          )}
        </div>
      )}
    </div>
  );
};
