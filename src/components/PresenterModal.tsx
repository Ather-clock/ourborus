import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Pointer, X } from 'lucide-react';
import { getSlideDimensions } from '../engine/geometry';
import type { ProjectDocument, Slide } from '../types/studio';
import { CanvasElementView } from './CanvasElementView';

interface PresenterModalProps {
  project: ProjectDocument;
  onClose: () => void;
}

export const PresenterModal: React.FC<PresenterModalProps> = ({ project, onClose }) => {
  // Build slides list: if in whiteboard mode, convert frames or show board as single slide
  const presentationSlides: Slide[] =
    project.mode === 'presentation'
      ? project.slides
      : (() => {
          const frames = project.boardElements.filter((e) => e.type === 'frame');
          if (frames.length === 0) {
            return [
              {
                id: 'board_present',
                title: project.title,
                background: project.boardBackground,
                elements: project.boardElements,
                notes: '',
                transition: 'fade',
              },
            ];
          }
          return frames.map((frame, i) => ({
            id: frame.id,
            title: frame.text || `Frame ${i + 1}`,
            background: frame.fillColor !== 'transparent' ? frame.fillColor : '#FFFFFF',
            notes: '',
            transition: 'fade',
            elements: project.boardElements
              .filter(
                (el) =>
                  el.id !== frame.id &&
                  el.x >= frame.x - 20 &&
                  el.y >= frame.y - 20 &&
                  el.x <= frame.x + frame.width + 20 &&
                  el.y <= frame.y + frame.height + 20
              )
              .map((el) => ({
                ...el,
                x: el.x - frame.x,
                y: el.y - frame.y,
              })),
          }));
        })();

  const initialIdx = Math.max(
    0,
    presentationSlides.findIndex((s) => s.id === project.activeSlideId)
  );
  const [index, setIndex] = useState(initialIdx);
  const [showNotes, setShowNotes] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);

  const dims = getSlideDimensions(project.aspectRatio);
  const currentSlide = presentationSlides[index] ?? presentationSlides[0];

  useEffect(() => {
    const updateScale = () => {
      const vw = window.innerWidth - 96;
      const vh = window.innerHeight - (showNotes ? 210 : 120);
      setScale(Math.max(0.25, Math.min(1.6, Math.min(vw / dims.width, vh / dims.height))));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [dims.width, dims.height, showNotes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIndex((i) => Math.min(presentationSlides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, presentationSlides.length]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentation viewer"
      onMouseMove={(e) => {
        if (laserOn) setLaserPos({ x: e.clientX, y: e.clientY });
      }}
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between ${
        laserOn ? 'cursor-none' : ''
      }`}
    >
      {/* Top Presenter Bar */}
      <div className="px-6 py-3 flex items-center justify-between text-slate-300 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">{project.title}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-xs text-slate-400">{currentSlide.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLaserOn((v) => !v);
              setLaserPos(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              laserOn
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Pointer className="w-3.5 h-3.5" />
            <span>Laser</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showNotes
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit presenter mode"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div
          key={currentSlide.id}
          className="relative shadow-2xl overflow-hidden rounded-sm transition-opacity duration-200"
          style={{
            width: dims.width * scale,
            height: dims.height * scale,
            backgroundColor: currentSlide.background || '#FFFFFF',
          }}
        >
          <div
            className="origin-top-left relative"
            style={{
              width: dims.width,
              height: dims.height,
              transform: `scale(${scale})`,
            }}
          >
            {currentSlide.elements.map((el) => (
              <CanvasElementView
                key={el.id}
                element={el}
                isSelected={false}
                isEditing={false}
                onStartEdit={() => {}}
                onChangeText={() => {}}
                onEndEdit={() => {}}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Speaker Notes Panel */}
      {showNotes && (
        <div className="mx-auto max-w-3xl w-full px-6 pb-2">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200">
            {currentSlide.notes || 'No speaker notes for this slide.'}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="px-6 py-3 flex items-center justify-center gap-4 border-t border-slate-800/80">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          aria-label="Previous slide"
          className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-35"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono tabular-nums text-slate-300">
          {index + 1} / {presentationSlides.length}
        </span>

        <button
          type="button"
          disabled={index === presentationSlides.length - 1}
          onClick={() => setIndex((i) => Math.min(presentationSlides.length - 1, i + 1))}
          aria-label="Next slide"
          className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-35"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Laser Pointer Overlay */}
      {laserOn && laserPos && (
        <div
          className="fixed w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_16px_4px_rgba(239,68,68,0.85)] pointer-events-none z-50"
          style={{ left: laserPos.x, top: laserPos.y }}
        />
      )}
    </div>
  );
};
