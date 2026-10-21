import type { Unit, Weekday } from '../types';

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export const KG_PER_LB = 0.45359237;

/** Gewichte werden intern immer in kg gespeichert */
export function toDisplayWeight(kg: number | null | undefined, unit: Unit): number | null {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return null;
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 10) / 10;
}

export function fromDisplayWeight(value: number | null, unit: Unit): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const kg = unit === 'kg' ? value : value * KG_PER_LB;
  return Math.round(kg * 1000) / 1000;
}

export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  const v = toDisplayWeight(kg, unit);
  if (v === null) return '–';
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${unit}`;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  return new Date(iso).toLocaleDateString('de-DE', opts);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Wochentag im Format 0 = Montag … 6 = Sonntag */
export function weekdayOf(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

/** Montag 00:00 der Woche des Datums */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekdayOf(d));
  return d;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:|idb:)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
