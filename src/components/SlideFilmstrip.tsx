import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import type { AspectRatio, Slide } from '../types/studio';
import { SceneThumbnail } from './SceneThumbnail';

interface SlideFilmstripProps {
  slides: Slide[];
  activeSlideId: string;
  aspectRatio: AspectRatio;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onReorderSlide: (fromIdx: number, toIdx: number) => void;
  onUpdateNotes: (slideId: string, notes: string) => void;
}

export const SlideFilmstrip: React.FC<SlideFilmstripProps> = ({
  slides,
  activeSlideId,
  aspectRatio,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onReorderSlide,
  onUpdateNotes,
}) => {
  const [notesOpen, setNotesOpen] = useState(false);
  const activeIndex = slides.findIndex((s) => s.id === activeSlideId);
  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <div className="shrink-0 bg-white border-t border-slate-200 z-20">
      {/* Collapsible Speaker Notes Drawer */}
      {notesOpen && activeSlide && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="speaker-notes-input"
              className="text-xs font-medium text-slate-600"
            >
              Speaker Notes — {activeSlide.title}
            </label>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <textarea
            id="speaker-notes-input"
            value={activeSlide.notes}
            onChange={(e) => onUpdateNotes(activeSlide.id, e.target.value)}
            placeholder="Write talking points for this slide..."
            rows={2}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      )}

      {/* Slide Filmstrip Bar */}
      <div className="px-4 py-2.5 flex items-center gap-3 overflow-x-auto studio-scroll">
        {slides.map((slide, idx) => {
          const isActive = slide.id === activeSlideId;
          return (
            <div
              key={slide.id}
              className={`group relative shrink-0 rounded-lg border-2 transition-colors ${
                isActive
                  ? 'border-blue-600 bg-blue-50/40'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSlide(slide.id)}
                aria-label={`Select slide ${idx + 1}: ${slide.title}`}
                className="block w-32 h-[72px] rounded-md overflow-hidden"
              >
                <SceneThumbnail
                  elements={slide.elements}
                  background={slide.background}
                  aspectRatio={aspectRatio}
                />
              </button>

              <div className="px-1.5 py-1 flex items-center justify-between gap-1 bg-white/95 border-t border-slate-100 rounded-b-md">
                <span className="text-[11px] font-mono tabular-nums text-slate-600">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => onReorderSlide(idx, idx - 1)}
                      aria-label={`Move slide ${idx + 1} left`}
                      className="p-0.5 text-slate-500 hover:text-slate-900 rounded"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}
                  {idx < slides.length - 1 && (
                    <button
                      type="button"
                      onClick={() => onReorderSlide(idx, idx + 1)}
                      aria-label={`Move slide ${idx + 1} right`}
                      className="p-0.5 text-slate-500 hover:text-slate-900 rounded"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDuplicateSlide(slide.id)}
                    aria-label={`Duplicate slide ${idx + 1}`}
                    className="p-0.5 text-slate-500 hover:text-slate-900 rounded"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteSlide(slide.id)}
                      aria-label={`Delete slide ${idx + 1}`}
                      className="p-0.5 text-slate-500 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddSlide}
          aria-label="Add new slide"
          className="shrink-0 w-24 h-[94px] rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 text-slate-500 hover:text-blue-700 flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-medium">Add Slide</span>
        </button>

        <div className="ml-auto pl-4 shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
              notesOpen
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
            {notesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
