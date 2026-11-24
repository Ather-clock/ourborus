import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, LayoutTemplate, Search, Sparkles, Square, X } from 'lucide-react';
import { SYMBOL_LIBRARY } from '../data/symbols';
import { TEMPLATE_GALLERY } from '../data/templates';
import { searchProjectAndSymbols } from '../engine/scene';
import type { ProjectDocument, SearchResultItem } from '../types/studio';

interface SearchModalProps {
  project: ProjectDocument;
  onClose: () => void;
  onSelectResult: (item: SearchResultItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  project,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(
    () => searchProjectAndSymbols(query, project, SYMBOL_LIBRARY, TEMPLATE_GALLERY),
    [query, project]
  );

  const renderIcon = (kind: SearchResultItem['kind']) => {
    switch (kind) {
      case 'symbol':
        return <Sparkles className="w-4 h-4 text-blue-600" />;
      case 'slide':
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'template':
        return <LayoutTemplate className="w-4 h-4 text-amber-600" />;
      case 'element':
      default:
        return <Square className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center pt-20 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols, slides, canvas text, or templates..."
            aria-label="Search symbols, slides, and canvas elements"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto studio-scroll divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-500">
              No symbols, elements, or slides match "{query}".
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectResult(item);
                  onClose();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-blue-50/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  {renderIcon(item.kind)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                </div>
                <span className="text-[11px] font-medium text-blue-600 shrink-0">
                  {item.kind === 'symbol' ? 'Insert' : 'Open'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
