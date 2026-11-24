import React from 'react';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Bold,
  Copy,
  Group,
  Italic,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import type { AlignMode } from '../engine/geometry';
import type {
  ArrowCurveType,
  ArrowHeadType,
  AspectRatio,
  CanvasElement,
  FillStyle,
  FontFamily,
  GridSettings,
  ProjectMode,
  SlideTransition,
  StrokeStyle,
} from '../types/studio';

interface RightInspectorProps {
  selectedElements: CanvasElement[];
  onUpdateSelected: (patch: Partial<CanvasElement>) => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onReorderZ: (dir: 'forward' | 'backward' | 'front' | 'back') => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveAsSymbol: () => void;
  // Canvas / Slide defaults when nothing is selected
  projectMode: ProjectMode;
  aspectRatio: AspectRatio;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  canvasBackground: string;
  onChangeCanvasBackground: (bg: string) => void;
  slideTransition: SlideTransition;
  onChangeSlideTransition: (t: SlideTransition) => void;
  grid: GridSettings;
  onChangeGrid: (patch: Partial<GridSettings>) => void;
}

const STROKE_SWATCHES = ['#0F172A', '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#64748B'];
const FILL_SWATCHES = ['transparent', '#FFFFFF', '#DBEAFE', '#FEF08A', '#DCFCE7', '#FCE7F3', '#F3E8FF', '#F1F5F9'];
const BG_SWATCHES = ['#FFFFFF', '#FCFBF7', '#F8F9FB', '#EFF6FF', '#FEFCE8', '#0F172A'];

export const RightInspector: React.FC<RightInspectorProps> = ({
  selectedElements,
  onUpdateSelected,
  onAlign,
  onDistribute,
  onReorderZ,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onSaveAsSymbol,
  projectMode,
  aspectRatio,
  onChangeAspectRatio,
  canvasBackground,
  onChangeCanvasBackground,
  slideTransition,
  onChangeSlideTransition,
  grid,
  onChangeGrid,
}) => {
  const first = selectedElements[0];

  if (!first) {
    return (
      <aside className="w-[264px] shrink-0 h-full bg-white border-l border-slate-200 overflow-y-auto studio-scroll p-4 space-y-5 z-20">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {projectMode === 'presentation' ? 'Slide Properties' : 'Board Settings'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an element to edit its style
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-600">Canvas Background</span>
          <div className="flex flex-wrap gap-2">
            {BG_SWATCHES.map((bg) => (
              <button
                key={bg}
                type="button"
                aria-label={`Background ${bg}`}
                onClick={() => onChangeCanvasBackground(bg)}
                className={`w-7 h-7 rounded-md border-2 ${
                  canvasBackground === bg ? 'border-blue-600' : 'border-slate-200'
                }`}
                style={{ backgroundColor: bg }}
              />
            ))}
            <input
              type="color"
              value={canvasBackground}
              onChange={(e) => onChangeCanvasBackground(e.target.value)}
              aria-label="Custom canvas background"
              className="w-7 h-7 rounded cursor-pointer border border-slate-200"
            />
          </div>
        </div>

        {projectMode === 'presentation' && (
          <>
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600">Aspect Ratio</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['16:9', '4:3', '1:1'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onChangeAspectRatio(ratio)}
                    className={`py-1.5 text-xs font-mono rounded-md border ${
                      aspectRatio === ratio
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600">Slide Transition</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['none', 'fade', 'slide'] as SlideTransition[]).map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => onChangeSlideTransition(tr)}
                    className={`py-1.5 text-xs capitalize rounded-md border ${
                      slideTransition === tr
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-3 pt-2 border-t border-slate-200">
          <span className="text-xs font-medium text-slate-600">Grid &amp; Snapping</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['dots', 'lines', 'none'] as const).map((gt) => (
              <button
                key={gt}
                type="button"
                onClick={() => onChangeGrid({ type: gt, enabled: gt !== 'none' })}
                className={`py-1.5 text-xs capitalize rounded-md border ${
                  grid.type === gt
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {gt}
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Snap to grid</span>
            <input
              type="checkbox"
              checked={grid.snap}
              onChange={(e) => onChangeGrid({ snap: e.target.checked })}
              className="rounded accent-blue-600"
            />
          </label>
        </div>
      </aside>
    );
  }

  const isLinear = first.type === 'arrow' || first.type === 'line';
  const hasText = first.type !== 'image' && first.type !== 'freedraw';
  const isGrouped = selectedElements.some((e) => Boolean(e.groupId));

  return (
    <aside className="w-[264px] shrink-0 h-full bg-white border-l border-slate-200 overflow-y-auto studio-scroll p-4 space-y-4 z-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {selectedElements.length > 1
            ? `${selectedElements.length} Selected`
            : `${first.type.charAt(0).toUpperCase() + first.type.slice(1)} Style`}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateSelected({ locked: !first.locked })}
            title={first.locked ? 'Unlock' : 'Lock'}
            aria-label={first.locked ? 'Unlock selection' : 'Lock selection'}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            {first.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate selection"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            aria-label="Delete selection"
            className="p-1.5 rounded hover:bg-red-50 text-slate-600 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stroke Color */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-slate-600">Stroke</span>
        <div className="flex flex-wrap gap-1.5">
          {STROKE_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Stroke ${c}`}
              onClick={() => onUpdateSelected({ strokeColor: c })}
              className={`w-6 h-6 rounded border-2 ${
                first.strokeColor === c ? 'border-blue-600 scale-105' : 'border-slate-200'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={first.strokeColor === 'transparent' ? '#0F172A' : first.strokeColor}
            onChange={(e) => onUpdateSelected({ strokeColor: e.target.value })}
            aria-label="Custom stroke color"
            className="w-6 h-6 rounded cursor-pointer border border-slate-200"
          />
        </div>
      </div>

      {/* Fill Color & Excalidraw Pattern */}
      {!isLinear && first.type !== 'freedraw' && first.type !== 'text' && first.type !== 'image' && (
        <>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Fill Color</span>
            <div className="flex flex-wrap gap-1.5">
              {FILL_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Fill ${c}`}
                  onClick={() =>
                    onUpdateSelected({
                      fillColor: c,
                      fillStyle: c === 'transparent' ? 'none' : first.fillStyle === 'none' ? 'hachure' : first.fillStyle,
                    })
                  }
                  className={`w-6 h-6 rounded border-2 ${
                    first.fillColor === c ? 'border-blue-600 scale-105' : 'border-slate-200'
                  }`}
                  style={{
                    backgroundColor: c === 'transparent' ? '#FFFFFF' : c,
                    backgroundImage:
                      c === 'transparent'
                        ? 'linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)'
                        : undefined,
                  }}
                />
              ))}
              <input
                type="color"
                value={first.fillColor === 'transparent' ? '#DBEAFE' : first.fillColor}
                onChange={(e) =>
                  onUpdateSelected({
                    fillColor: e.target.value,
                    fillStyle: first.fillStyle === 'none' ? 'hachure' : first.fillStyle,
                  })
                }
                aria-label="Custom fill color"
                className="w-6 h-6 rounded cursor-pointer border border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Fill Pattern</span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'hachure', label: 'Hachure' },
                  { id: 'cross-hatch', label: 'Cross' },
                  { id: 'solid', label: 'Solid' },
                  { id: 'zigzag', label: 'Zigzag' },
                  { id: 'dots', label: 'Dots' },
                  { id: 'none', label: 'None' },
                ] as { id: FillStyle; label: string }[]
              ).map((fs) => (
                <button
                  key={fs.id}
                  type="button"
                  onClick={() => onUpdateSelected({ fillStyle: fs.id })}
                  className={`py-1 text-[11px] rounded border ${
                    first.fillStyle === fs.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sloppiness (Roughness) & Stroke Style */}
      {first.type !== 'text' && first.type !== 'image' && (
        <>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Sloppiness</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 0, label: 'Vector' },
                { val: 1.2, label: 'Rough' },
                { val: 2.4, label: 'Sketchy' },
              ].map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => onUpdateSelected({ roughness: r.val })}
                  className={`py-1 text-[11px] rounded border ${
                    Math.abs((first.roughness ?? 1.2) - r.val) < 0.3
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Stroke Style &amp; Width</span>
            <div className="grid grid-cols-3 gap-1">
              {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onUpdateSelected({ strokeStyle: st })}
                  className={`py-1 text-[11px] capitalize rounded border ${
                    first.strokeStyle === st
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={first.strokeWidth || 2}
              onChange={(e) => onUpdateSelected({ strokeWidth: Number(e.target.value) })}
              aria-label="Stroke width"
              className="w-full accent-blue-600"
            />
          </div>
        </>
      )}

      {/* Arrow / Connector options */}
      {isLinear && (
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <span className="text-xs font-medium text-slate-600">Connector Routing</span>
          <div className="grid grid-cols-3 gap-1">
            {(['straight', 'curved', 'elbow'] as ArrowCurveType[]).map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => onUpdateSelected({ curveType: ct })}
                className={`py-1 text-[11px] capitalize rounded border ${
                  (first.curveType || 'straight') === ct
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ct}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Start Tip</label>
              <select
                value={first.startArrowhead || 'none'}
                onChange={(e) =>
                  onUpdateSelected({ startArrowhead: e.target.value as ArrowHeadType })
                }
                aria-label="Start arrowhead"
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white"
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="dot">Dot</option>
                <option value="diamond">Diamond</option>
                <option value="bar">Bar</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">End Tip</label>
              <select
                value={first.endArrowhead ?? (first.type === 'arrow' ? 'arrow' : 'none')}
                onChange={(e) =>
                  onUpdateSelected({ endArrowhead: e.target.value as ArrowHeadType })
                }
                aria-label="End arrowhead"
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white"
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="dot">Dot</option>
                <option value="diamond">Diamond</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Typography */}
      {hasText && (
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <span className="text-xs font-medium text-slate-600">Typography</span>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'sketch', label: 'Sketch' },
                { id: 'sans', label: 'Sans' },
                { id: 'serif', label: 'Serif' },
                { id: 'mono', label: 'Mono' },
              ] as { id: FontFamily; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onUpdateSelected({ fontFamily: f.id })}
                className={`py-1 text-[11px] rounded border ${
                  (first.fontFamily || 'sketch') === f.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={10}
              max={96}
              value={first.fontSize || 20}
              onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) || 20 })}
              aria-label="Font size"
              className="w-16 text-xs font-mono tabular-nums border border-slate-200 rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() =>
                onUpdateSelected({
                  fontWeight: first.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              aria-label="Toggle bold"
              className={`p-1.5 rounded border ${
                first.fontWeight === 'bold'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSelected({
                  fontStyle: first.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              aria-label="Toggle italic"
              className={`p-1.5 rounded border ${
                first.fontStyle === 'italic'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <input
              type="color"
              value={first.textColor || '#0F172A'}
              onChange={(e) => onUpdateSelected({ textColor: e.target.value })}
              aria-label="Text color"
              className="w-7 h-7 rounded cursor-pointer border border-slate-200 ml-auto"
            />
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                { id: 'center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                { id: 'right', icon: <AlignRight className="w-3.5 h-3.5" /> },
              ] as const
            ).map((al) => (
              <button
                key={al.id}
                type="button"
                aria-label={`Align text ${al.id}`}
                onClick={() => onUpdateSelected({ textAlign: al.id })}
                className={`py-1.5 rounded border flex items-center justify-center ${
                  (first.textAlign || 'center') === al.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {al.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Opacity & Radius */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Opacity</span>
          <span className="font-mono tabular-nums text-slate-500">
            {Math.round((first.opacity ?? 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={first.opacity ?? 1}
          onChange={(e) => onUpdateSelected({ opacity: Number(e.target.value) })}
          aria-label="Opacity"
          className="w-full accent-blue-600"
        />

        {(first.type === 'rect' || first.type === 'image') && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Corner Radius</span>
              <span className="font-mono tabular-nums text-slate-500">
                {first.cornerRadius || 0}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              value={first.cornerRadius || 0}
              onChange={(e) => onUpdateSelected({ cornerRadius: Number(e.target.value) })}
              aria-label="Corner radius"
              className="w-full accent-blue-600"
            />
          </>
        )}
      </div>

      {/* Align & Layer Ordering */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        {selectedElements.length >= 2 && (
          <>
            <span className="text-xs font-medium text-slate-600">Align &amp; Distribute</span>
            <div className="grid grid-cols-6 gap-1">
              <button type="button" onClick={() => onAlign('left')} title="Align left" aria-label="Align left" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignStartVertical className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => onAlign('center')} title="Align center" aria-label="Align center" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => onAlign('right')} title="Align right" aria-label="Align right" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignEndVertical className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => onAlign('top')} title="Align top" aria-label="Align top" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => onAlign('middle')} title="Align middle" aria-label="Align middle" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => onAlign('bottom')} title="Align bottom" aria-label="Align bottom" className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 flex justify-center"><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
            </div>
            {selectedElements.length >= 3 && (
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => onDistribute('horizontal')} className="py-1 text-[11px] border border-slate-200 rounded hover:bg-slate-50">Distribute H</button>
                <button type="button" onClick={() => onDistribute('vertical')} className="py-1 text-[11px] border border-slate-200 rounded hover:bg-slate-50">Distribute V</button>
              </div>
            )}
          </>
        )}

        <span className="text-xs font-medium text-slate-600 block">Arrange &amp; Symbols</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onReorderZ('forward')}
            className="py-1.5 px-2 text-[11px] border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
          >
            <ArrowUp className="w-3 h-3" /> Forward
          </button>
          <button
            type="button"
            onClick={() => onReorderZ('backward')}
            className="py-1.5 px-2 text-[11px] border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
          >
            <ArrowDown className="w-3 h-3" /> Backward
          </button>
          {selectedElements.length >= 2 && (
            <button
              type="button"
              onClick={onGroup}
              className="py-1.5 px-2 text-[11px] border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
            >
              <Group className="w-3 h-3" /> Group
            </button>
          )}
          {isGrouped && (
            <button
              type="button"
              onClick={onUngroup}
              className="py-1.5 px-2 text-[11px] border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
            >
              <Ungroup className="w-3 h-3" /> Ungroup
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onSaveAsSymbol}
          className="w-full py-1.5 px-3 text-xs font-medium border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 text-slate-700 flex items-center justify-center gap-1.5"
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-blue-600" />
          <span>Save Selection as Symbol</span>
        </button>
      </div>
    </aside>
  );
};
