/**
 * IndexedDB-Speicher für eigene Übungsbilder.
 * Bilder werden vor dem Speichern verkleinert (max. 1200 px, JPEG), um die
 * Browser-Speichergrenzen zu schonen. Referenzierung im Datenmodell: `idb:<key>`.
 */
const DB_NAME = 'gymbase-images';
const STORE = 'images';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const isIdbRef = (url: string | null | undefined): url is string => !!url && url.startsWith('idb:');

export async function putImage(key: string, blob: Blob): Promise<string> {
  await tx('readwrite', (s) => s.put(blob, key));
  return `idb:${key}`;
}

export async function getImage(ref: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>('readonly', (s) => s.get(ref.replace(/^idb:/, '')) as IDBRequest<Blob | undefined>);
}

export async function deleteImage(ref: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(ref.replace(/^idb:/, '')));
}

export async function listImageKeys(): Promise<string[]> {
  return tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String));
}

export async function clearImages(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}

/** Bild verkleinern und als JPEG-Blob zurückgeben */
export async function downscaleImage(file: Blob, maxSize = 1200, quality = 0.85): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* ignorieren */
  }
  return null;
}
