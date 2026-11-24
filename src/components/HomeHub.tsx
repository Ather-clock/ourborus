import React, { useMemo, useRef, useState } from 'react';
import { FolderOpen, Plus, Presentation, Search, Trash2, Upload, Workflow } from 'lucide-react';
import { TEMPLATE_GALLERY } from '../data/templates';
import { parseImportedProject } from '../engine/scene';
import type { ProjectDocument, ProjectMode } from '../types/studio';
import { SceneThumbnail } from './SceneThumbnail';

interface HomeHubProps {
  projects: ProjectDocument[];
  loading: boolean;
  onOpenProject: (project: ProjectDocument) => void;
  onCreateBlank: (mode: ProjectMode) => void;
  onCreateFromTemplate: (templateId: string) => void;
  onDeleteProject: (id: string) => void;
  onImportProject: (project: ProjectDocument) => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  projects,
  loading,
  onOpenProject,
  onCreateBlank,
  onCreateFromTemplate,
  onDeleteProject,
  onImportProject,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | ProjectMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const modeMatch = filterMode === 'all' || p.mode === filterMode;
      const qMatch = !q || p.title.toLowerCase().includes(q);
      return modeMatch && qMatch;
    });
  }, [projects, filterMode, searchQuery]);

  const templatePreviews = useMemo(
    () =>
      TEMPLATE_GALLERY.map((tpl) => ({
        tpl,
        doc: tpl.createProject(),
      })),
    []
  );

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseImportedProject(text);
      onImportProject(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to import JSON file.');
    } finally {
      e.target.value = '';
    }
  };

  const formatUpdated = (ts: number) => {
    const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            SketchDeck Studio
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Projects
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('presentation')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Presentations
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('whiteboard')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Whiteboards
            </button>
            <a
              href="#templates"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Templates
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onCreateBlank('presentation')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Presentation</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
        {/* Hero Workspace Launcher */}
        <section className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-display text-balance">
              Presentations and infinite whiteboards, sketched your way.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Design multi-slide decks, map systems on an infinite rough-ink canvas, search 40+
              architecture and wireframe symbols, and export directly to PNG, SVG, PDF, or JSON.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onCreateBlank('presentation')}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Presentation className="w-4 h-4" />
              <span>Blank Presentation</span>
            </button>
            <button
              type="button"
              onClick={() => onCreateBlank('whiteboard')}
              className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 text-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Workflow className="w-4 h-4 text-blue-600" />
              <span>Infinite Whiteboard</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Import JSON</span>
            </button>
          </div>
        </section>

        {importError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {importError}
          </div>
        )}

        {/* Recent Local Projects */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">
                Your Workspace
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved automatically in browser storage
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter projects..."
                  aria-label="Filter projects"
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'presentation', label: 'Presentations' },
                    { id: 'whiteboard', label: 'Whiteboards' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      filterMode === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-60 rounded-xl bg-white border border-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                No matching designs yet
              </div>
              <p className="text-xs text-slate-500">
                Create a new presentation deck or infinite whiteboard above, or pick a template below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const isBoard = project.mode === 'whiteboard';
                const firstSlide = project.slides[0];
                const previewEls = isBoard
                  ? project.boardElements
                  : firstSlide?.elements || [];
                const previewBg = isBoard
                  ? project.boardBackground
                  : firstSlide?.background || '#FFFFFF';

                return (
                  <div
                    key={project.id}
                    className="group bg-white border border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden transition-colors flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProject(project)}
                      aria-label={`Open ${project.title}`}
                      className="block aspect-[16/9] w-full bg-slate-50 border-b border-slate-200 overflow-hidden text-left"
                    >
                      <SceneThumbnail
                        elements={previewEls}
                        background={previewBg}
                        aspectRatio={project.aspectRatio}
                        isBoard={isBoard}
                      />
                    </button>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenProject(project)}
                        className="text-left min-w-0 flex-1"
                      >
                        <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {project.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                          <span>{isBoard ? 'Whiteboard' : 'Presentation'}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {isBoard
                              ? `${project.boardElements.length} objects`
                              : `${project.slides.length} slides`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatUpdated(project.updatedAt)}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteProject(project.id)}
                        aria-label={`Delete ${project.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Starter Templates */}
        <section id="templates" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-display">
              Starter Templates
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch a pre-built Canva-style slide deck or Miro/Excalidraw diagram board
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {templatePreviews.map(({ tpl, doc }) => {
              const isBoard = tpl.mode === 'whiteboard';
              const els = isBoard ? doc.boardElements : doc.slides[0]?.elements || [];
              const bg = isBoard ? doc.boardBackground : doc.slides[0]?.background || '#FFFFFF';
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onCreateFromTemplate(tpl.id)}
                  className="group bg-white border border-slate-200 hover:border-blue-500 rounded-xl overflow-hidden text-left transition-colors flex flex-col"
                >
                  <div className="aspect-[16/9] w-full border-b border-slate-200 bg-slate-50 overflow-hidden">
                    <SceneThumbnail
                      elements={els}
                      background={bg}
                      aspectRatio={tpl.aspectRatio}
                      isBoard={isBoard}
                    />
                  </div>
                  <div className="p-3.5">
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                      {tpl.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{tpl.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
