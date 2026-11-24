import React, { useState } from 'react';
import { Download, FileCode2, FileJson, FileText, Image as ImageIcon, X } from 'lucide-react';
import {
  exportCurrentViewAsPng,
  exportCurrentViewAsSvg,
  exportProjectAsJson,
  exportProjectAsPdf,
} from '../services/exporter';
import type { ProjectDocument } from '../types/studio';

interface ExportModalProps {
  project: ProjectDocument;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [scale, setScale] = useState<number>(2);
  const [includeBg, setIncludeBg] = useState<boolean>(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runExport = async (kind: 'png' | 'svg' | 'pdf' | 'json') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'png') {
        await exportCurrentViewAsPng(project, scale, includeBg);
      } else if (kind === 'svg') {
        exportCurrentViewAsSvg(project, includeBg);
      } else if (kind === 'pdf') {
        await exportProjectAsPdf(project);
      } else {
        exportProjectAsJson(project);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export design"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export Design</h2>
            <p className="text-xs text-slate-500 mt-0.5">{project.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBg}
                onChange={(e) => setIncludeBg(e.target.checked)}
                className="rounded accent-blue-600"
              />
              <span>Include background fill</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">PNG Scale</span>
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`px-2 py-0.5 text-xs font-mono rounded border ${
                    scale === s
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('png')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-blue-600 mb-2" />
              <div className="text-xs font-semibold text-slate-900">PNG Image</div>
              <div className="text-[11px] text-slate-500">
                {busy === 'png' ? 'Rendering...' : `High-DPI ${scale}x raster`}
              </div>
            </button>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('svg')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-colors"
            >
              <FileCode2 className="w-5 h-5 text-emerald-600 mb-2" />
              <div className="text-xs font-semibold text-slate-900">SVG Vector</div>
              <div className="text-[11px] text-slate-500">Scalable rough ink paths</div>
            </button>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('pdf')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-colors"
            >
              <FileText className="w-5 h-5 text-red-600 mb-2" />
              <div className="text-xs font-semibold text-slate-900">
                {project.mode === 'presentation' ? 'Multi-Slide PDF' : 'Board PDF'}
              </div>
              <div className="text-[11px] text-slate-500">
                {busy === 'pdf'
                  ? 'Building PDF...'
                  : project.mode === 'presentation'
                    ? `${project.slides.length} slides document`
                    : 'Print-ready document'}
              </div>
            </button>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('json')}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-colors"
            >
              <FileJson className="w-5 h-5 text-amber-600 mb-2" />
              <div className="text-xs font-semibold text-slate-900">JSON Scene</div>
              <div className="text-[11px] text-slate-500">Editable backup file</div>
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Saved directly to your device
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
