/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { HomeHub } from './components/HomeHub';
import { StudioEditor } from './components/StudioEditor';
import { createBlankProject, TEMPLATE_GALLERY } from './data/templates';
import {
  deleteProjectById,
  loadCustomSymbols,
  loadProjects,
  saveProject,
} from './services/storage';
import type { CustomSymbol, ProjectDocument, ProjectMode } from './types/studio';

export default function App() {
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [customSymbols, setCustomSymbols] = useState<CustomSymbol[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSymbols = useCallback(async () => {
    const syms = await loadCustomSymbols();
    setCustomSymbols(syms);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [loadedProjects, loadedSymbols] = await Promise.all([
        loadProjects(),
        loadCustomSymbols(),
      ]);
      if (!mounted) return;
      setProjects(loadedProjects);
      setCustomSymbols(loadedSymbols);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' && loadedProjects.length > 0) {
        setActiveProject(loadedProjects[0]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleProjectSaved = useCallback((saved: ProjectDocument) => {
    setProjects((prev) => {
      const others = prev.filter((p) => p.id !== saved.id);
      return [saved, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const handleCreateBlank = async (mode: ProjectMode) => {
    const doc = createBlankProject(mode);
    await saveProject(doc);
    handleProjectSaved(doc);
    setActiveProject(doc);
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    const tpl = TEMPLATE_GALLERY.find((t) => t.id === templateId);
    if (!tpl) return;
    const doc = tpl.createProject();
    await saveProject(doc);
    handleProjectSaved(doc);
    setActiveProject(doc);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProjectById(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null);
    }
  };

  const handleImportProject = async (doc: ProjectDocument) => {
    await saveProject(doc);
    handleProjectSaved(doc);
    setActiveProject(doc);
  };

  if (activeProject) {
    return (
      <StudioEditor
        initialProject={activeProject}
        customSymbols={customSymbols}
        onRefreshCustomSymbols={refreshSymbols}
        onBackHome={async () => {
          const latest = await loadProjects();
          setProjects(latest);
          setActiveProject(null);
        }}
        onProjectSaved={handleProjectSaved}
        onCreateFromTemplate={handleCreateFromTemplate}
      />
    );
  }

  return (
    <HomeHub
      projects={projects}
      loading={loading}
      onOpenProject={(proj) => setActiveProject(proj)}
      onCreateBlank={handleCreateBlank}
      onCreateFromTemplate={handleCreateFromTemplate}
      onDeleteProject={handleDeleteProject}
      onImportProject={handleImportProject}
    />
  );
}
