import {
  createArchitectureBoardProject,
  createEditorialLookbookProject,
  createPitchDeckProject,
} from '../data/templates';
import type { CustomSymbol, ProjectDocument } from '../types/studio';

const DB_NAME = 'sketchdeck_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SYMBOLS = 'custom_symbols';
const LS_PROJECTS_KEY = 'sketchdeck_projects_v1';
const LS_SYMBOLS_KEY = 'sketchdeck_symbols_v1';
const LS_SEEDED_KEY = 'sketchdeck_seeded_v1';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SYMBOLS)) {
          db.createObjectStore(STORE_SYMBOLS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function seedInitialProjects(): ProjectDocument[] {
  return [
    createPitchDeckProject('Northstar Product Pitch'),
    createArchitectureBoardProject('System Architecture Whiteboard'),
    createEditorialLookbookProject('Studio Architecture Lookbook'),
  ];
}

export async function loadProjects(): Promise<ProjectDocument[]> {
  const db = await openDb();
  if (db) {
    try {
      const items = await new Promise<ProjectDocument[]>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly');
        const store = tx.objectStore(STORE_PROJECTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as ProjectDocument[]);
        req.onerror = () => reject(req.error);
      });
      if (items.length > 0) {
        return items.sort((a, b) => b.updatedAt - a.updatedAt);
      }
    } catch {
      // fall through to localStorage
    }
  }

  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectDocument[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
      }
    }
  } catch {
    // ignore
  }

  // First-time seed
  const alreadySeeded = typeof localStorage !== 'undefined' && localStorage.getItem(LS_SEEDED_KEY) === '1';
  if (alreadySeeded) {
    return [];
  }
  const seeded = seedInitialProjects();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LS_SEEDED_KEY, '1');
  }
  for (const proj of seeded) {
    await saveProject(proj);
  }
  return seeded;
}

export async function saveProject(project: ProjectDocument): Promise<void> {
  const updated = { ...project, updatedAt: Date.now() };
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).put(updated);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // fallback below
    }
  }

  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    const list: ProjectDocument[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((p) => p.id === updated.id);
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.unshift(updated);
    }
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors if IndexedDB succeeded
  }
}

export async function deleteProjectById(id: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    const list: ProjectDocument[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      LS_PROJECTS_KEY,
      JSON.stringify(list.filter((p) => p.id !== id))
    );
  } catch {
    // ignore
  }
}

export async function loadCustomSymbols(): Promise<CustomSymbol[]> {
  const db = await openDb();
  if (db) {
    try {
      const items = await new Promise<CustomSymbol[]>((resolve, reject) => {
        const tx = db.transaction(STORE_SYMBOLS, 'readonly');
        const req = tx.objectStore(STORE_SYMBOLS).getAll();
        req.onsuccess = () => resolve(req.result as CustomSymbol[]);
        req.onerror = () => reject(req.error);
      });
      if (items.length > 0) return items.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      // ignore
    }
  }
  try {
    const raw = localStorage.getItem(LS_SYMBOLS_KEY);
    return raw ? (JSON.parse(raw) as CustomSymbol[]) : [];
  } catch {
    return [];
  }
}

export async function saveCustomSymbol(symbol: CustomSymbol): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SYMBOLS, 'readwrite');
        tx.objectStore(STORE_SYMBOLS).put(symbol);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }
  try {
    const raw = localStorage.getItem(LS_SYMBOLS_KEY);
    const list: CustomSymbol[] = raw ? JSON.parse(raw) : [];
    const next = [symbol, ...list.filter((s) => s.id !== symbol.id)];
    localStorage.setItem(LS_SYMBOLS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function deleteCustomSymbol(id: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SYMBOLS, 'readwrite');
        tx.objectStore(STORE_SYMBOLS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }
  try {
    const raw = localStorage.getItem(LS_SYMBOLS_KEY);
    const list: CustomSymbol[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(LS_SYMBOLS_KEY, JSON.stringify(list.filter((s) => s.id !== id)));
  } catch {
    // ignore
  }
}
