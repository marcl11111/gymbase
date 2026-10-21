import type { AppData } from '../types';
import { DATA_VERSION, sanitizeAppData } from './storage';
import { blobToDataUrl, dataUrlToBlob, getImage, isIdbRef, putImage } from './imageStore';

export interface ExportFile {
  app: 'GymBase';
  format: 1;
  dataVersion: number;
  exportedAt: string;
  data: AppData;
  images: Record<string, string>;
}

function collectImageRefs(data: AppData): string[] {
  const refs = new Set<string>();
  for (const e of data.customExercises) {
    if (isIdbRef(e.imageUrl)) refs.add(e.imageUrl);
    for (const s of e.photoGuide) if (isIdbRef(s.imageUrl)) refs.add(s.imageUrl);
  }
  return [...refs];
}

export async function buildExport(data: AppData): Promise<ExportFile> {
  const images: Record<string, string> = {};
  for (const ref of collectImageRefs(data)) {
    try {
      const blob = await getImage(ref);
      if (blob) images[ref] = await blobToDataUrl(blob);
    } catch {
      /* Bild nicht verfügbar – wird übersprungen */
    }
  }
  return { app: 'GymBase', format: 1, dataVersion: DATA_VERSION, exportedAt: new Date().toISOString(), data, images };
}

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedImport {
  data: AppData;
  images: Record<string, string>;
  summary: { exercises: number; collections: number; plans: number; sessions: number; favorites: number };
  skipped: string[];
}

/** Validiert eine Importdatei, ohne etwas zu speichern */
export function parseImport(text: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('Unbekanntes Dateiformat.');
  const r = raw as Record<string, unknown>;
  const payload = r.app === 'GymBase' && r.data ? r.data : raw;
  if (typeof payload !== 'object' || payload === null || !('settings' in payload || 'plans' in payload || 'sessions' in payload)) {
    throw new Error('Die Datei enthält keine GymBase-Daten.');
  }
  const { data, report } = sanitizeAppData(payload);
  const images: Record<string, string> = {};
  if (r.images && typeof r.images === 'object') {
    for (const [k, v] of Object.entries(r.images as Record<string, unknown>)) {
      if (isIdbRef(k) && typeof v === 'string' && v.startsWith('data:image/')) images[k] = v;
    }
  }
  return {
    data,
    images,
    summary: {
      exercises: data.customExercises.length,
      collections: data.collections.length,
      plans: data.plans.length,
      sessions: data.sessions.length,
      favorites: data.favorites.length,
    },
    skipped: report.skipped,
  };
}

export async function restoreImages(images: Record<string, string>): Promise<number> {
  let n = 0;
  for (const [ref, dataUrl] of Object.entries(images)) {
    try {
      await putImage(ref.replace(/^idb:/, ''), await dataUrlToBlob(dataUrl));
      n++;
    } catch {
      /* ignorieren */
    }
  }
  return n;
}

/** Zusammenführen: Bestehende Einträge bleiben, neue IDs werden ergänzt */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];
  return {
    ...current,
    customExercises: byId(current.customExercises, incoming.customExercises),
    collections: byId(current.collections, incoming.collections),
    plans: byId(current.plans, incoming.plans),
    sessions: byId(current.sessions, incoming.sessions),
    favorites: Array.from(new Set([...current.favorites, ...incoming.favorites])),
    activePlanId: current.activePlanId ?? incoming.activePlanId,
  };
}
