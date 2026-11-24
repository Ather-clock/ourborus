import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Eye,
  EyeOff,
  Frame,
  Hexagon,
  Highlighter,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  MessageSquare,
  Minus,
  PenTool,
  Search,
  Shapes,
  Sparkles,
  Square,
  Star,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  Unlock,
  Upload,
} from 'lucide-react';
import { SYMBOL_LIBRARY } from '../data/symbols';
import { STOCK_MEDIA, TEMPLATE_GALLERY } from '../data/templates';
import type {
  CanvasElement,
  CustomSymbol,
  ProjectDocument,
  SymbolDefinition,
  ToolType,
} from '../types/studio';

export type DrawerTab =
  | 'templates'
  | 'shapes'
  | 'symbols'
  | 'text'
  | 'draw'
  | 'media'
  | 'layers';

interface LeftDrawerProps {
  activeTab: DrawerTab | null;
  onSelectTab: (tab: DrawerTab | null) => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onInsertShape: (
    type: CanvasElement['type'],
    overrides?: Partial<CanvasElement>
  ) => void;
  onInsertSymbol: (symbol: SymbolDefinition) => void;
  onInsertCustomSymbol: (custom: CustomSymbol) => void;
  onDeleteCustomSymbol: (id: string) => void;
  onInsertImage: (url: string, name: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onApplySlideLayout: (layout: 'title' | 'split' | 'matrix' | 'flow' | 'callout') => void;
  customSymbols: CustomSymbol[];
  elements: CanvasElement[];
  selectedIds: Set<string>;
  onSelectElementFromLayer: (id: string) => void;
  onToggleLockLayer: (id: string) => void;
  onToggleHideLayer: (id: string) => void;
  brushColor: string;
  onChangeBrushColor: (color: string) => void;
  brushWidth: number;
  onChangeBrushWidth: (w: number) => void;
  projectMode: ProjectDocument['mode'];
}

const STICKY_COLORS = [
  { name: 'Butter Yellow', fill: '#FEF08A', stroke: '#CA8A04' },
  { name: 'Sky Blue', fill: '#DBEAFE', stroke: '#2563EB' },
  { name: 'Mint Green', fill: '#DCFCE7', stroke: '#16A34A' },
  { name: 'Rose Pink', fill: '#FCE7F3', stroke: '#DB2777' },
  { name: 'Soft Lilac', fill: '#F3E8FF', stroke: '#7C3AED' },
];

const BRUSH_COLORS = [
  '#0F172A',
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#D97706',
  '#7C3AED',
  '#DB2777',
];

export const LeftDrawer: React.FC<LeftDrawerProps> = ({
  activeTab,
  onSelectTab,
  activeTool,
  onSelectTool,
  onInsertShape,
  onInsertSymbol,
  onInsertCustomSymbol,
  onDeleteCustomSymbol,
  onInsertImage,
  onApplyTemplate,
  onApplySlideLayout,
  customSymbols,
  elements,
  selectedIds,
  onSelectElementFromLayer,
  onToggleLockLayer,
  onToggleHideLayer,
  brushColor,
  onChangeBrushColor,
  brushWidth,
  onChangeBrushWidth,
  projectMode,
}) => {
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolCategory, setSymbolCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    return SYMBOL_LIBRARY.filter((s) => {
      const catMatch = symbolCategory === 'all' || s.category === symbolCategory;
      const qMatch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));
      return catMatch && qMatch;
    });
  }, [symbolQuery, symbolCategory]);

  const filteredCustomSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (symbolCategory !== 'all' && symbolCategory !== 'custom') return [];
    return customSymbols.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [customSymbols, symbolQuery, symbolCategory]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onInsertImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const navItems: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="w-5 h-5" /> },
    { id: 'shapes', label: 'Shapes', icon: <Shapes className="w-5 h-5" /> },
    { id: 'symbols', label: 'Symbols', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-5 h-5" /> },
    { id: 'draw', label: 'Draw', icon: <PenTool className="w-5 h-5" /> },
    { id: 'media', label: 'Media', icon: <ImageIcon className="w-5 h-5" /> },
    { id: 'layers', label: 'Layers', icon: <Layers className="w-5 h-5" /> },
  ];

  return (
    <aside className="flex h-full shrink-0 bg-white border-r border-slate-200 z-20">
      {/* Narrow Activity Rail */}
      <nav
        aria-label="Studio tools"
        className="w-[68px] flex flex-col items-center py-3 gap-1.5 border-r border-slate-200 bg-slate-50/70"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(isActive ? null : item.id)}
              aria-pressed={isActive}
              className={`w-14 py-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Expandable Drawer Content */}
      {activeTab && (
        <div className="w-[276px] h-full flex flex-col bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 capitalize">
              {activeTab === 'symbols' ? 'Symbols & Search' : activeTab}
            </h2>
            <button
              type="button"
              onClick={() => onSelectTab(null)}
              className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100"
              aria-label="Close panel"
            >
              Hide
            </button>
          </div>

          <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
            {/* TEMPLATES TAB */}
            {activeTab === 'templates' && (
              <>
                {projectMode === 'presentation' && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-slate-500">
                      Quick Slide Layouts
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'title', label: 'Cover Hero' },
                        { id: 'split', label: 'Split Visual' },
                        { id: 'matrix', label: '3 Sticky Matrix' },
                        { id: 'flow', label: 'Diagram Flow' },
                        { id: 'callout', label: 'Big Callout' },
                      ].map((lay) => (
                        <button
                          key={lay.id}
                          type="button"
                          onClick={() =>
                            onApplySlideLayout(
                              lay.id as 'title' | 'split' | 'matrix' | 'flow' | 'callout'
                            )
                          }
                          className="p-2.5 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                        >
                          <div className="h-8 mb-1.5 rounded bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                            <span className="text-[10px] font-mono text-slate-400">
                              16:9
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-800 truncate">
                            {lay.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500">
                    Full Starter Templates
                  </p>
                  <div className="space-y-2">
                    {TEMPLATE_GALLERY.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => onApplyTemplate(tpl.id)}
                        className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="text-xs font-semibold text-slate-900">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {tpl.subtitle}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* SHAPES & MIRO STICKIES TAB */}
            {activeTab === 'shapes' && (
              <>
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500">
                    Hand-Drawn Shapes
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'rect' as const, label: 'Box', icon: <Square className="w-5 h-5" /> },
                      { type: 'ellipse' as const, label: 'Circle', icon: <Circle className="w-5 h-5" /> },
                      { type: 'diamond' as const, label: 'Diamond', icon: <Diamond className="w-5 h-5" /> },
                      { type: 'triangle' as const, label: 'Triangle', icon: <Triangle className="w-5 h-5" /> },
                      { type: 'star' as const, label: 'Star', icon: <Star className="w-5 h-5" /> },
                      { type: 'hexagon' as const, label: 'Hexagon', icon: <Hexagon className="w-5 h-5" /> },
                      { type: 'callout' as const, label: 'Callout', icon: <MessageSquare className="w-5 h-5" /> },
                      { type: 'frame' as const, label: 'Frame', icon: <Frame className="w-5 h-5" /> },
                    ].map((s) => (
                      <button
                        key={s.type}
                        type="button"
                        onClick={() => onInsertShape(s.type)}
                        className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 flex flex-col items-center gap-1 text-slate-700 transition-colors"
                      >
                        {s.icon}
                        <span className="text-[11px] font-medium">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500">
                    Smart Connectors
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectTool('arrow')}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium transition-colors ${
                        activeTool === 'arrow'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Arrow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('line')}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium transition-colors ${
                        activeTool === 'line'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                      <span>Line</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onInsertShape('arrow', {
                          curveType: 'curved',
                          width: 160,
                          height: 40,
                          points: [
                            { x: 0, y: 0 },
                            { x: 160, y: 40 },
                          ],
                        })
                      }
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 text-xs font-medium text-slate-700 text-left"
                    >
                      Curved Arrow
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onInsertShape('arrow', {
                          curveType: 'elbow',
                          width: 160,
                          height: 80,
                          points: [
                            { x: 0, y: 0 },
                            { x: 160, y: 80 },
                          ],
                        })
                      }
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 text-xs font-medium text-slate-700 text-left"
                    >
                      Elbow Connector
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500">
                    Miro Sticky Notes
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {STICKY_COLORS.map((swatch) => (
                      <button
                        key={swatch.name}
                        type="button"
                        title={`Add ${swatch.name} sticky note`}
                        aria-label={`Add ${swatch.name} sticky note`}
                        onClick={() =>
                          onInsertShape('sticky', {
                            fillColor: swatch.fill,
                            strokeColor: swatch.stroke,
                            text: 'New idea...',
                          })
                        }
                        className="h-10 rounded-md border flex items-center justify-center hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: swatch.fill,
                          borderColor: swatch.stroke,
                        }}
                      >
                        <StickyNote className="w-4 h-4 text-slate-700" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* SYMBOLS & SEARCH TAB */}
            {activeTab === 'symbols' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={symbolQuery}
                    onChange={(e) => setSymbolQuery(e.target.value)}
                    placeholder="Search symbols, cloud, UI..."
                    aria-label="Search symbols"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'flowchart', label: 'Flow' },
                    { id: 'cloud', label: 'Cloud' },
                    { id: 'wireframe', label: 'UI' },
                    { id: 'miro', label: 'Miro' },
                    { id: 'accents', label: 'Accents' },
                    ...(customSymbols.length > 0 ? [{ id: 'custom', label: 'Saved' }] : []),
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSymbolCategory(cat.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                        symbolCategory === cat.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {filteredCustomSymbols.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-slate-500">
                      Saved Custom Symbols
                    </p>
                    <div className="space-y-1.5">
                      {filteredCustomSymbols.map((cs) => (
                        <div
                          key={cs.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 hover:border-blue-400"
                        >
                          <button
                            type="button"
                            onClick={() => onInsertCustomSymbol(cs)}
                            className="flex-1 text-left text-xs font-medium text-slate-800 truncate"
                          >
                            {cs.name} ({cs.elements.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCustomSymbol(cs.id)}
                            aria-label={`Delete ${cs.name}`}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {filteredSymbols.map((sym) => (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => onInsertSymbol(sym)}
                      title={sym.name}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 flex flex-col items-center gap-1.5 transition-colors"
                    >
                      <svg
                        viewBox={`0 0 ${sym.viewBox} ${sym.viewBox}`}
                        className="w-8 h-8"
                        aria-hidden="true"
                      >
                        {sym.paths.map((d, i) => (
                          <path
                            key={i}
                            d={d}
                            fill={sym.defaultFill || 'none'}
                            stroke={sym.defaultStroke || '#0F172A'}
                            strokeWidth={2.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </svg>
                      <span className="text-[10px] font-medium text-slate-700 leading-tight text-center line-clamp-2">
                        {sym.name}
                      </span>
                    </button>
                  ))}
                </div>

                {filteredSymbols.length === 0 && filteredCustomSymbols.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No symbols match "{symbolQuery}".
                  </p>
                )}
              </div>
            )}

            {/* TEXT TAB */}
            {activeTab === 'text' && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-500">
                  Typography Presets
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onInsertShape('text', {
                      text: 'Presentation Headline',
                      fontFamily: 'sans',
                      fontSize: 38,
                      fontWeight: 'bold',
                      width: 440,
                      height: 68,
                      strokeColor: 'transparent',
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="text-lg font-bold text-slate-900 font-display">
                    Add a heading
                  </div>
                  <div className="text-[11px] text-slate-500">Plus Jakarta Sans · 38px</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInsertShape('text', {
                      text: 'Editorial Serif Title',
                      fontFamily: 'serif',
                      fontSize: 34,
                      fontWeight: 'bold',
                      width: 400,
                      height: 64,
                      strokeColor: 'transparent',
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="text-lg font-bold text-slate-900 font-[Playfair_Display,serif]">
                    Editorial serif
                  </div>
                  <div className="text-[11px] text-slate-500">Playfair Display · 34px</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInsertShape('text', {
                      text: 'Handwritten whiteboard note',
                      fontFamily: 'sketch',
                      fontSize: 28,
                      width: 320,
                      height: 56,
                      strokeColor: 'transparent',
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="text-xl text-slate-900 font-[Caveat,cursive]">
                    Handwritten sketch note
                  </div>
                  <div className="text-[11px] text-slate-500">Caveat Sketch · 28px</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInsertShape('text', {
                      text: 'Supporting body paragraph text goes here.',
                      fontFamily: 'sans',
                      fontSize: 16,
                      width: 360,
                      height: 54,
                      textAlign: 'left',
                      textColor: '#475569',
                      strokeColor: 'transparent',
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="text-sm text-slate-700">Body paragraph copy</div>
                  <div className="text-[11px] text-slate-500">DM Sans · 16px</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInsertShape('text', {
                      text: 'SECTION TAG · 01',
                      fontFamily: 'mono',
                      fontSize: 13,
                      fontWeight: 'bold',
                      width: 220,
                      height: 36,
                      textColor: '#2563EB',
                      strokeColor: 'transparent',
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="text-xs font-mono font-semibold text-blue-600">
                    MONOSPACE LABEL
                  </div>
                  <div className="text-[11px] text-slate-500">JetBrains Mono · 13px</div>
                </button>
              </div>
            )}

            {/* DRAW & BRUSH TAB */}
            {activeTab === 'draw' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Drawing Tools</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectTool('freedraw')}
                      className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 text-xs font-medium ${
                        activeTool === 'freedraw'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <PenTool className="w-4 h-4" />
                      <span>Pen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('highlighter')}
                      className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 text-xs font-medium ${
                        activeTool === 'highlighter'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <Highlighter className="w-4 h-4" />
                      <span>Marker</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('eraser')}
                      className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 text-xs font-medium ${
                        activeTool === 'eraser'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <Eraser className="w-4 h-4" />
                      <span>Eraser</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Ink Color</span>
                    <span className="text-[11px] font-mono text-slate-500">{brushColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BRUSH_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Ink color ${c}`}
                        onClick={() => onChangeBrushColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          brushColor === c ? 'border-blue-600 scale-110' : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => onChangeBrushColor(e.target.value)}
                      aria-label="Custom ink color"
                      className="w-7 h-7 rounded cursor-pointer border border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Stroke Weight</span>
                    <span className="text-xs font-mono tabular-nums text-slate-700">
                      {brushWidth}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={brushWidth}
                    onChange={(e) => onChangeBrushWidth(Number(e.target.value))}
                    aria-label="Brush stroke weight"
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            )}

            {/* MEDIA & UPLOADS TAB */}
            {activeTab === 'media' && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">
                    Studio Stock Graphics
                  </p>
                  <div className="space-y-2.5">
                    {STOCK_MEDIA.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onInsertImage(item.url, item.title)}
                        className="w-full rounded-lg border border-slate-200 hover:border-blue-400 overflow-hidden text-left transition-colors group"
                      >
                        <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="px-2.5 py-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* LAYERS TAB */}
            {activeTab === 'layers' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  Scene Layers ({elements.length})
                </p>
                {elements.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No elements on this canvas yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {[...elements].reverse().map((el) => {
                      const active = selectedIds.has(el.id);
                      const label = (el.text || el.name || el.imageName || el.type).slice(0, 26);
                      return (
                        <div
                          key={el.id}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                            active
                              ? 'border-blue-400 bg-blue-50/70 text-blue-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectElementFromLayer(el.id)}
                            className="flex-1 text-left truncate font-medium"
                          >
                            {label}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleHideLayer(el.id)}
                            aria-label={el.hidden ? `Show ${label}` : `Hide ${label}`}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          >
                            {el.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleLockLayer(el.id)}
                            aria-label={el.locked ? `Unlock ${label}` : `Lock ${label}`}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          >
                            {el.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
