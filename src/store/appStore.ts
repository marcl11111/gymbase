/**
 * Zentrale Datenhaltung (UI-unabhängig). Externer Store + useSyncExternalStore.
 * Jede Änderung wird sofort versioniert in localStorage geschrieben.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type {
  AppData,
  Exercise,
  ExerciseCollection,
  PlanDay,
  PlanExercise,
  SessionExercise,
  UserSettings,
  WorkoutPlan,
  WorkoutSession,
} from '../types';
import { BUILTIN_EXERCISES } from '../data/exercises';
import { clearData, emptyData, loadData, saveData } from '../services/storage';
import { clearImages } from '../services/imageStore';
import { uid } from '../utils';

type Listener = () => void;

let state: AppData;
let loadWarning: string | null = null;
let saveFailed = false;
const listeners = new Set<Listener>();

function init() {
  if (state) return;
  const r = loadData();
  state = r.data;
  loadWarning = r.warning;
}
init();

export function getState(): AppData {
  return state;
}

export function consumeLoadWarning(): string | null {
  const w = loadWarning;
  loadWarning = null;
  return w;
}

export function didSaveFail(): boolean {
  return saveFailed;
}

export function setState(updater: (s: AppData) => AppData): void {
  const next = updater(state);
  if (next === state) return;
  state = next;
  saveFailed = !saveData(state);
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Für Tests: Zustand direkt setzen */
export function __resetForTests(data: AppData = emptyData()): void {
  state = data;
  listeners.forEach((l) => l());
}

export function useApp<T>(selector: (s: AppData) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ---------- Übungen ----------

const builtinMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

export function allExercises(s: AppData = state): Exercise[] {
  return [...BUILTIN_EXERCISES, ...s.customExercises];
}

export function findExercise(id: string, s: AppData = state): Exercise | undefined {
  return builtinMap.get(id) ?? s.customExercises.find((e) => e.id === id);
}

export function useExercises(): Exercise[] {
  const custom = useApp((s) => s.customExercises);
  return useMemo(() => [...BUILTIN_EXERCISES, ...custom], [custom]);
}

export function useExercise(id: string | undefined): Exercise | undefined {
  const custom = useApp((s) => s.customExercises);
  return useMemo(() => (id ? builtinMap.get(id) ?? custom.find((e) => e.id === id) : undefined), [id, custom]);
}

export function upsertCustomExercise(ex: Exercise): void {
  setState((s) => {
    const exists = s.customExercises.some((e) => e.id === ex.id);
    return {
      ...s,
      customExercises: exists ? s.customExercises.map((e) => (e.id === ex.id ? { ...ex, isCustom: true } : e)) : [...s.customExercises, { ...ex, isCustom: true }],
    };
  });
}

/** Löscht eine eigene Übung. Pläne verlieren den Eintrag; dokumentierte Einheiten bleiben unverändert (Snapshot). */
export function deleteCustomExercise(id: string): void {
  setState((s) => ({
    ...s,
    customExercises: s.customExercises.filter((e) => e.id !== id),
    favorites: s.favorites.filter((f) => f !== id),
    collections: s.collections.map((c) => ({ ...c, exerciseIds: c.exerciseIds.filter((x) => x !== id) })),
    plans: s.plans.map((p) => ({ ...p, days: p.days.map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.exerciseId !== id) })) })),
  }));
}

export function newCustomExerciseId(): string {
  return uid('custom-');
}

// ---------- Favoriten ----------

export function toggleFavorite(id: string): boolean {
  let added = false;
  setState((s) => {
    added = !s.favorites.includes(id);
    return { ...s, favorites: added ? [...s.favorites, id] : s.favorites.filter((f) => f !== id) };
  });
  return added;
}

// ---------- Sammlungen ----------

export function createCollection(name: string, description = ''): ExerciseCollection {
  const c: ExerciseCollection = { id: uid('col-'), name: name.trim(), description, exerciseIds: [], createdAt: new Date().toISOString() };
  setState((s) => ({ ...s, collections: [...s.collections, c] }));
  return c;
}

export function updateCollection(id: string, patch: Partial<Omit<ExerciseCollection, 'id'>>): void {
  setState((s) => ({ ...s, collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function deleteCollection(id: string): void {
  setState((s) => ({ ...s, collections: s.collections.filter((c) => c.id !== id) }));
}

/** @returns false, wenn die Übung bereits enthalten war */
export function addToCollection(collectionId: string, exerciseId: string): boolean {
  let added = false;
  setState((s) => ({
    ...s,
    collections: s.collections.map((c) => {
      if (c.id !== collectionId || c.exerciseIds.includes(exerciseId)) return c;
      added = true;
      return { ...c, exerciseIds: [...c.exerciseIds, exerciseId] };
    }),
  }));
  return added;
}

export function removeFromCollection(collectionId: string, exerciseId: string): void {
  setState((s) => ({
    ...s,
    collections: s.collections.map((c) => (c.id === collectionId ? { ...c, exerciseIds: c.exerciseIds.filter((x) => x !== exerciseId) } : c)),
  }));
}

// ---------- Trainingspläne ----------

export function newPlan(name = 'Neuer Trainingsplan'): WorkoutPlan {
  const now = new Date().toISOString();
  return {
    id: uid('plan-'),
    name,
    description: '',
    goal: null,
    days: [{ id: uid('day-'), name: 'Tag 1', weekday: null, muscles: [], exercises: [] }],
    notes: '',
    createdAt: now,
    updatedAt: now,
    generated: null,
  };
}

export function newDay(index: number): PlanDay {
  return { id: uid('day-'), name: `Tag ${index + 1}`, weekday: null, muscles: [], exercises: [] };
}

export function makePlanExercise(ex: Exercise, settings: UserSettings = state.settings): PlanExercise {
  const r = ex.recommended;
  const useDefaults = ex.repUnit === 'wdh' || !ex.repUnit;
  return {
    uid: uid('pe-'),
    exerciseId: ex.id,
    sets: r.sets || settings.defaultSets,
    repsMin: useDefaults && !r.repsMin ? settings.defaultRepsMin : r.repsMin,
    repsMax: useDefaults && !r.repsMax ? settings.defaultRepsMax : r.repsMax,
    restSec: r.restSec || settings.defaultRestSec,
    targetWeight: null,
    notes: '',
  };
}

export function savePlan(plan: WorkoutPlan): void {
  const p = { ...plan, updatedAt: new Date().toISOString() };
  setState((s) => {
    const exists = s.plans.some((x) => x.id === p.id);
    return {
      ...s,
      plans: exists ? s.plans.map((x) => (x.id === p.id ? p : x)) : [...s.plans, p],
      activePlanId: s.activePlanId ?? p.id,
    };
  });
}

export function deletePlan(id: string): void {
  setState((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id), activePlanId: s.activePlanId === id ? null : s.activePlanId }));
}

export function duplicatePlan(id: string): WorkoutPlan | null {
  const src = state.plans.find((p) => p.id === id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: WorkoutPlan = {
    ...src,
    id: uid('plan-'),
    name: `${src.name} (Kopie)`,
    createdAt: now,
    updatedAt: now,
    days: src.days.map((d) => ({ ...d, id: uid('day-'), exercises: d.exercises.map((e) => ({ ...e, uid: uid('pe-') })) })),
  };
  setState((s) => ({ ...s, plans: [...s.plans, copy] }));
  return copy;
}

export function setActivePlan(id: string | null): void {
  setState((s) => ({ ...s, activePlanId: id }));
}

export type AddToPlanResult = 'added' | 'duplicate' | 'missing';

/** Fügt eine Übung einem gespeicherten Plan hinzu. Duplikate innerhalb desselben Tages werden verhindert. */
export function addExerciseToPlanDay(planId: string, dayId: string, exerciseId: string, allowDuplicate = false): AddToPlanResult {
  const ex = findExercise(exerciseId);
  const plan = state.plans.find((p) => p.id === planId);
  const day = plan?.days.find((d) => d.id === dayId);
  if (!ex || !plan || !day) return 'missing';
  if (!allowDuplicate && day.exercises.some((e) => e.exerciseId === exerciseId)) return 'duplicate';
  savePlan({ ...plan, days: plan.days.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, makePlanExercise(ex)] } : d)) });
  return 'added';
}

// ---------- Trainingseinheiten ----------

export function buildSessionFromDay(plan: WorkoutPlan | null, day: PlanDay | null): WorkoutSession {
  const exercises: SessionExercise[] = (day?.exercises ?? [])
    .map((pe) => {
      const ex = findExercise(pe.exerciseId);
      if (!ex) return null;
      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        primaryMuscle: ex.primaryMuscle,
        restSec: pe.restSec,
        notes: pe.notes,
        sets: Array.from({ length: pe.sets }, () => ({
          targetRepsMin: pe.repsMin,
          targetRepsMax: pe.repsMax,
          targetWeight: pe.targetWeight,
          reps: null,
          weight: pe.targetWeight,
          done: false,
        })),
      } as SessionExercise;
    })
    .filter((x): x is SessionExercise => x !== null);
  return {
    id: uid('ses-'),
    planId: plan?.id ?? null,
    planName: plan?.name ?? 'Freies Training',
    dayId: day?.id ?? null,
    dayName: day?.name ?? '',
    startedAt: new Date().toISOString(),
    endedAt: null,
    pausedMs: 0,
    pausedAt: null,
    exercises,
    currentIndex: 0,
    notes: '',
    status: 'aktiv',
    unit: 'kg',
  };
}

export function startSession(session: WorkoutSession): void {
  setState((s) => ({ ...s, activeSession: session }));
}

export function updateActiveSession(updater: (s: WorkoutSession) => WorkoutSession): void {
  setState((s) => (s.activeSession ? { ...s, activeSession: updater(s.activeSession) } : s));
}

export function finishActiveSession(): WorkoutSession | null {
  const a = state.activeSession;
  if (!a) return null;
  const now = new Date();
  const pausedExtra = a.pausedAt ? now.getTime() - Date.parse(a.pausedAt) : 0;
  const done: WorkoutSession = { ...a, status: 'abgeschlossen', endedAt: now.toISOString(), pausedAt: null, pausedMs: a.pausedMs + pausedExtra };
  setState((s) => ({ ...s, activeSession: null, sessions: [...s.sessions, done] }));
  return done;
}

export function discardActiveSession(): void {
  setState((s) => ({ ...s, activeSession: null }));
}

export function deleteSession(id: string): void {
  setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
}

// ---------- Einstellungen & Daten ----------

export function updateSettings(patch: Partial<UserSettings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replaceAllData(data: AppData): void {
  setState(() => data);
}

export async function resetAllData(): Promise<void> {
  clearData();
  try {
    await clearImages();
  } catch {
    /* ignorieren */
  }
  setState(() => emptyData());
}
