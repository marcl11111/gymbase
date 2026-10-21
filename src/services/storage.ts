/**
 * Versionierte lokale Speicherung.
 * - Alle persönlichen Daten liegen unter einem Schlüssel in localStorage (JSON, klein).
 * - Eigene Bilder liegen separat in IndexedDB (siehe imageStore.ts).
 * - Jede gelesene oder importierte Struktur wird validiert/bereinigt, damit fehlerhafte
 *   Daten nicht zum Absturz führen. Unbekannte Felder werden verworfen, ungültige
 *   Einträge übersprungen – nie stillschweigend der komplette Datenbestand.
 */
import type {
  AppData,
  Equipment,
  Exercise,
  ExerciseCollection,
  ExerciseInstructionStep,
  PlanDay,
  PlanExercise,
  SessionExercise,
  SetLog,
  UserSettings,
  WorkoutPlan,
  WorkoutSession,
} from '../types';
import { DIFFICULTIES, EQUIPMENT, EXERCISE_TYPES, MUSCLES, PATTERN_LABEL } from '../data/labels';

export const STORAGE_KEY = 'gymbase:data';
export const BACKUP_KEY = 'gymbase:backup';
export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  unit: 'kg',
  theme: 'dark',
  accent: 'brand',
  defaultRestSec: 90,
  preferredEquipment: [],
  defaultSets: 3,
  defaultRepsMin: 8,
  defaultRepsMax: 12,
  userName: '',
  reducedMotion: false,
};

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    customExercises: [],
    favorites: [],
    collections: [],
    plans: [],
    activePlanId: null,
    sessions: [],
    activeSession: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---------- kleine Validierungshelfer ----------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
const num = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown, fb = false): boolean => (typeof v === 'boolean' ? v : fb);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fb: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fb;
const strArr = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string');
const iso = (v: unknown, fb = new Date().toISOString()): string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fb;

export interface SanitizeReport {
  skipped: string[];
}

function sanitizeSettings(v: unknown): UserSettings {
  const o = isObj(v) ? v : {};
  const repsMin = Math.round(num(o.defaultRepsMin, DEFAULT_SETTINGS.defaultRepsMin));
  const repsMax = Math.round(num(o.defaultRepsMax, DEFAULT_SETTINGS.defaultRepsMax));
  return {
    unit: oneOf(o.unit, ['kg', 'lb'] as const, 'kg'),
    theme: oneOf(o.theme, ['dark', 'light'] as const, 'dark'),
    accent: oneOf(o.accent, ['brand', 'lime'] as const, 'brand'),
    defaultRestSec: Math.min(900, Math.max(0, Math.round(num(o.defaultRestSec, 90)))),
    preferredEquipment: strArr(o.preferredEquipment).filter((e): e is Equipment =>
      (EQUIPMENT as string[]).includes(e),
    ),
    defaultSets: Math.min(10, Math.max(1, Math.round(num(o.defaultSets, 3)))),
    defaultRepsMin: Math.min(100, Math.max(1, repsMin)),
    defaultRepsMax: Math.min(100, Math.max(Math.max(1, repsMin), repsMax)),
    userName: str(o.userName).slice(0, 60),
    reducedMotion: bool(o.reducedMotion),
  };
}

function sanitizeStep(v: unknown, i: number): ExerciseInstructionStep | null {
  if (!isObj(v)) return null;
  return {
    stepNumber: Math.round(num(v.stepNumber, i + 1)),
    title: str(v.title, `Schritt ${i + 1}`),
    description: str(v.description),
    imageUrl: typeof v.imageUrl === 'string' && v.imageUrl ? v.imageUrl : null,
    altText: str(v.altText, str(v.title, `Schritt ${i + 1}`)),
  };
}

export function sanitizeExercise(v: unknown): Exercise | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string' || !v.name.trim()) return null;
  const rec = isObj(v.recommended) ? v.recommended : {};
  const repsMin = Math.max(1, Math.round(num(rec.repsMin, 8)));
  return {
    id: v.id,
    name: v.name.trim(),
    description: str(v.description),
    primaryMuscle: oneOf(v.primaryMuscle, MUSCLES, 'ganzkoerper'),
    secondaryMuscles: strArr(v.secondaryMuscles).filter((m) => (MUSCLES as string[]).includes(m)) as Exercise['secondaryMuscles'],
    equipment: oneOf(v.equipment, EQUIPMENT, 'sonstiges'),
    difficulty: oneOf(v.difficulty, DIFFICULTIES, 'anfaenger'),
    type: oneOf(v.type, EXERCISE_TYPES, 'grunduebung'),
    pattern: oneOf(v.pattern, Object.keys(PATTERN_LABEL) as Exercise['pattern'][], 'full_body'),
    instructions: strArr(v.instructions),
    techniqueTips: strArr(v.techniqueTips),
    commonMistakes: strArr(v.commonMistakes),
    safetyNotes: strArr(v.safetyNotes),
    recommended: {
      sets: Math.max(1, Math.round(num(rec.sets, 3))),
      repsMin,
      repsMax: Math.max(repsMin, Math.round(num(rec.repsMax, 12))),
      restSec: Math.max(0, Math.round(num(rec.restSec, 90))),
    },
    repUnit: oneOf(v.repUnit, ['wdh', 'sek', 'm'] as const, 'wdh'),
    imageUrl: typeof v.imageUrl === 'string' && v.imageUrl ? v.imageUrl : null,
    photoGuide: arr(v.photoGuide)
      .map(sanitizeStep)
      .filter((s): s is ExerciseInstructionStep => s !== null)
      .map((s, i) => ({ ...s, stepNumber: i + 1 })),
    alternatives: strArr(v.alternatives),
    isCustom: true,
  };
}

function sanitizeCollection(v: unknown): ExerciseCollection | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  return {
    id: v.id,
    name: v.name,
    description: str(v.description),
    exerciseIds: Array.from(new Set(strArr(v.exerciseIds))),
    createdAt: iso(v.createdAt),
  };
}

function sanitizePlanExercise(v: unknown): PlanExercise | null {
  if (!isObj(v) || typeof v.exerciseId !== 'string') return null;
  const repsMin = Math.max(1, Math.round(num(v.repsMin, 8)));
  return {
    uid: str(v.uid) || `pe${Math.random().toString(36).slice(2)}`,
    exerciseId: v.exerciseId,
    sets: Math.min(20, Math.max(1, Math.round(num(v.sets, 3)))),
    repsMin,
    repsMax: Math.max(repsMin, Math.round(num(v.repsMax, 12))),
    restSec: Math.max(0, Math.round(num(v.restSec, 90))),
    targetWeight: numOrNull(v.targetWeight),
    notes: str(v.notes),
  };
}

function sanitizeDay(v: unknown): PlanDay | null {
  if (!isObj(v) || typeof v.id !== 'string') return null;
  const wd = v.weekday;
  return {
    id: v.id,
    name: str(v.name, 'Trainingstag'),
    weekday: typeof wd === 'number' && wd >= 0 && wd <= 6 ? (Math.round(wd) as PlanDay['weekday']) : null,
    muscles: strArr(v.muscles).filter((m) => (MUSCLES as string[]).includes(m)) as PlanDay['muscles'],
    exercises: arr(v.exercises).map(sanitizePlanExercise).filter((x): x is PlanExercise => x !== null),
  };
}

function sanitizePlan(v: unknown): WorkoutPlan | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  return {
    id: v.id,
    name: v.name,
    description: str(v.description),
    goal: oneOf(v.goal, ['muskelaufbau', 'maximalkraft', 'fitness', 'grundlagen'] as const, 'muskelaufbau'),
    days: arr(v.days).map(sanitizeDay).filter((d): d is PlanDay => d !== null),
    notes: str(v.notes),
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
    generated: isObj(v.generated) ? (v.generated as unknown as WorkoutPlan['generated']) : null,
  };
}

function sanitizeSet(v: unknown): SetLog | null {
  if (!isObj(v)) return null;
  const reps = numOrNull(v.reps);
  const weight = numOrNull(v.weight);
  return {
    targetRepsMin: Math.max(0, Math.round(num(v.targetRepsMin, 0))),
    targetRepsMax: Math.max(0, Math.round(num(v.targetRepsMax, 0))),
    targetWeight: numOrNull(v.targetWeight),
    reps: reps === null ? null : Math.max(0, Math.round(reps)),
    weight: weight === null ? null : Math.max(0, weight),
    done: bool(v.done),
  };
}

function sanitizeSessionExercise(v: unknown): SessionExercise | null {
  if (!isObj(v) || typeof v.exerciseId !== 'string') return null;
  return {
    exerciseId: v.exerciseId,
    exerciseName: str(v.exerciseName, v.exerciseId),
    primaryMuscle: oneOf(v.primaryMuscle, MUSCLES, 'ganzkoerper'),
    restSec: Math.max(0, Math.round(num(v.restSec, 90))),
    notes: str(v.notes),
    sets: arr(v.sets).map(sanitizeSet).filter((s): s is SetLog => s !== null),
  };
}

export function sanitizeSession(v: unknown): WorkoutSession | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.startedAt !== 'string') return null;
  const exercises = arr(v.exercises)
    .map(sanitizeSessionExercise)
    .filter((x): x is SessionExercise => x !== null);
  return {
    id: v.id,
    planId: typeof v.planId === 'string' ? v.planId : null,
    planName: str(v.planName, 'Freies Training'),
    dayId: typeof v.dayId === 'string' ? v.dayId : null,
    dayName: str(v.dayName),
    startedAt: iso(v.startedAt),
    endedAt: typeof v.endedAt === 'string' ? iso(v.endedAt) : null,
    pausedMs: Math.max(0, num(v.pausedMs, 0)),
    pausedAt: typeof v.pausedAt === 'string' ? iso(v.pausedAt) : null,
    exercises,
    currentIndex: Math.min(Math.max(0, Math.round(num(v.currentIndex, 0))), Math.max(0, exercises.length - 1)),
    notes: str(v.notes),
    status: oneOf(v.status, ['aktiv', 'pausiert', 'abgeschlossen', 'abgebrochen'] as const, 'abgeschlossen'),
    unit: 'kg',
  };
}

function list<T>(v: unknown, fn: (x: unknown) => T | null, label: string, report: SanitizeReport): T[] {
  const out: T[] = [];
  arr(v).forEach((x, i) => {
    const r = fn(x);
    if (r) out.push(r);
    else report.skipped.push(`${label} #${i + 1}`);
  });
  return out;
}

/** Migrationen: Schlüssel = Ausgangsversion */
const MIGRATIONS: Record<number, (d: Obj) => Obj> = {
  // Beispiel für künftige Versionen:
  // 1: (d) => ({ ...d, version: 2, neuesFeld: [] }),
};

export function migrate(raw: Obj): Obj {
  let d = raw;
  let v = num(d.version, 1);
  while (v < DATA_VERSION && MIGRATIONS[v]) {
    d = MIGRATIONS[v](d);
    v = num(d.version, v + 1);
  }
  return d;
}

export function sanitizeAppData(raw: unknown): { data: AppData; report: SanitizeReport } {
  const report: SanitizeReport = { skipped: [] };
  if (!isObj(raw)) return { data: emptyData(), report: { skipped: ['Datenstruktur ungültig'] } };
  const d = migrate(raw);
  const customExercises = list(d.customExercises, sanitizeExercise, 'Eigene Übung', report);
  const plans = list(d.plans, sanitizePlan, 'Trainingsplan', report);
  const sessions = list(d.sessions, sanitizeSession, 'Trainingseinheit', report).filter(
    (s) => s.status === 'abgeschlossen' || s.status === 'abgebrochen',
  );
  const active = d.activeSession ? sanitizeSession(d.activeSession) : null;
  const activePlanId = typeof d.activePlanId === 'string' && plans.some((p) => p.id === d.activePlanId) ? d.activePlanId : null;
  return {
    data: {
      version: DATA_VERSION,
      customExercises,
      favorites: Array.from(new Set(strArr(d.favorites))),
      collections: list(d.collections, sanitizeCollection, 'Sammlung', report),
      plans,
      activePlanId,
      sessions,
      activeSession: active && (active.status === 'aktiv' || active.status === 'pausiert') ? active : null,
      settings: sanitizeSettings(d.settings),
    },
    report,
  };
}

// ---------- Persistenz ----------

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadData(): { data: AppData; warning: string | null } {
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return { data: emptyData(), warning: null };
  try {
    const parsed = JSON.parse(raw);
    const { data, report } = sanitizeAppData(parsed);
    if (isObj(parsed) && num(parsed.version, 1) > DATA_VERSION) {
      // Daten aus einer neueren App-Version: sicherheitshalber Kopie behalten
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch {
        /* ignorieren */
      }
      return { data, warning: 'Die gespeicherten Daten stammen aus einer neueren GymBase-Version. Eine Sicherungskopie wurde angelegt.' };
    }
    return {
      data,
      warning: report.skipped.length ? `${report.skipped.length} beschädigte Einträge wurden beim Laden übersprungen.` : null,
    };
  } catch {
    // Unlesbare Daten nicht löschen, sondern sichern
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* ignorieren */
    }
    return {
      data: emptyData(),
      warning: 'Gespeicherte Daten konnten nicht gelesen werden. Eine Sicherungskopie wurde unter „gymbase:backup“ abgelegt.',
    };
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorieren */
  }
}
