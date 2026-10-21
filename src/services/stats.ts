/**
 * Statistiken – ausschließlich aus gespeicherten, abgeschlossenen Trainingseinheiten berechnet.
 */
import type { SetLog, WorkoutSession } from '../types';
import { startOfWeek } from '../utils';

export const completedSets = (sets: SetLog[]) => sets.filter((s) => s.done && (s.reps ?? 0) > 0);

export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce(
    (sum, e) => sum + completedSets(e.sets).reduce((a, set) => a + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );
}

export function sessionSetCount(s: WorkoutSession): number {
  return s.exercises.reduce((sum, e) => sum + completedSets(e.sets).length, 0);
}

export function sessionDurationMs(s: WorkoutSession): number {
  if (!s.endedAt) return 0;
  return Math.max(0, Date.parse(s.endedAt) - Date.parse(s.startedAt) - s.pausedMs);
}

export const finishedSessions = (sessions: WorkoutSession[]) =>
  sessions.filter((s) => s.status === 'abgeschlossen').sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

/** Epley-Formel – nur Schätzung, sinnvoll bis ca. 12 Wiederholungen */
export function estimate1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: { value: number; reps: number; date: string } | null;
  maxReps: { value: number; weight: number; date: string } | null;
  est1RM: { value: number; date: string } | null;
  maxVolumeSet: { value: number; date: string } | null;
}

export function personalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  for (const s of finishedSessions(sessions)) {
    const date = s.endedAt ?? s.startedAt;
    for (const e of s.exercises) {
      let pr = map.get(e.exerciseId);
      if (!pr) {
        pr = { exerciseId: e.exerciseId, exerciseName: e.exerciseName, maxWeight: null, maxReps: null, est1RM: null, maxVolumeSet: null };
        map.set(e.exerciseId, pr);
      }
      pr.exerciseName = e.exerciseName;
      for (const set of completedSets(e.sets)) {
        const w = set.weight ?? 0;
        const r = set.reps ?? 0;
        if (w > 0 && (!pr.maxWeight || w > pr.maxWeight.value || (w === pr.maxWeight.value && r > pr.maxWeight.reps))) {
          pr.maxWeight = { value: w, reps: r, date };
        }
        if (!pr.maxReps || r > pr.maxReps.value || (r === pr.maxReps.value && w > pr.maxReps.weight)) {
          pr.maxReps = { value: r, weight: w, date };
        }
        const e1 = estimate1RM(w, r);
        if (e1 !== null && (!pr.est1RM || e1 > pr.est1RM.value)) pr.est1RM = { value: e1, date };
        const vol = w * r;
        if (vol > 0 && (!pr.maxVolumeSet || vol > pr.maxVolumeSet.value)) pr.maxVolumeSet = { value: vol, date };
      }
    }
  }
  return [...map.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'de'));
}

export interface NewRecord {
  exerciseId: string;
  exerciseName: string;
  kind: 'gewicht' | 'wiederholungen';
  value: number;
  previous: number | null;
}

/** Vergleicht eine (gerade beendete) Einheit mit allen früheren abgeschlossenen Einheiten */
export function detectNewRecords(session: WorkoutSession, history: WorkoutSession[]): NewRecord[] {
  const before = personalRecords(history.filter((h) => h.id !== session.id && Date.parse(h.startedAt) < Date.parse(session.startedAt)));
  const prev = new Map(before.map((p) => [p.exerciseId, p]));
  const out: NewRecord[] = [];
  for (const e of session.exercises) {
    const sets = completedSets(e.sets);
    if (!sets.length) continue;
    const maxW = Math.max(...sets.map((s) => s.weight ?? 0));
    const maxR = Math.max(...sets.map((s) => s.reps ?? 0));
    const p = prev.get(e.exerciseId);
    if (!p) continue; // Erste Durchführung zählt nicht als „neuer Rekord“
    if (maxW > 0 && maxW > (p.maxWeight?.value ?? 0)) {
      out.push({ exerciseId: e.exerciseId, exerciseName: e.exerciseName, kind: 'gewicht', value: maxW, previous: p.maxWeight?.value ?? null });
    } else if (maxR > (p.maxReps?.value ?? 0)) {
      out.push({ exerciseId: e.exerciseId, exerciseName: e.exerciseName, kind: 'wiederholungen', value: maxR, previous: p.maxReps?.value ?? null });
    }
  }
  return out;
}

export interface WeekBucket {
  weekStart: Date;
  label: string;
  sessions: number;
  volume: number;
}

export function weeklyBuckets(sessions: WorkoutSession[], weeks: number, now = new Date()): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(current);
    ws.setDate(ws.getDate() - i * 7);
    buckets.push({ weekStart: ws, label: ws.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), sessions: 0, volume: 0 });
  }
  for (const s of finishedSessions(sessions)) {
    const ws = startOfWeek(new Date(s.startedAt)).getTime();
    const b = buckets.find((x) => x.weekStart.getTime() === ws);
    if (b) {
      b.sessions += 1;
      b.volume += sessionVolume(s);
    }
  }
  return buckets;
}

export interface ExerciseProgressPoint {
  date: string;
  maxWeight: number;
  bestReps: number;
  est1RM: number | null;
  volume: number;
}

export function exerciseProgress(sessions: WorkoutSession[], exerciseId: string, from?: Date): ExerciseProgressPoint[] {
  const pts: ExerciseProgressPoint[] = [];
  for (const s of finishedSessions(sessions)) {
    if (from && Date.parse(s.startedAt) < from.getTime()) continue;
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const sets = completedSets(ex.sets);
    if (!sets.length) continue;
    const maxWeight = Math.max(...sets.map((x) => x.weight ?? 0));
    const bestReps = Math.max(...sets.map((x) => x.reps ?? 0));
    const e1s = sets.map((x) => estimate1RM(x.weight ?? 0, x.reps ?? 0)).filter((v): v is number => v !== null);
    pts.push({
      date: s.startedAt,
      maxWeight,
      bestReps,
      est1RM: e1s.length ? Math.max(...e1s) : null,
      volume: sets.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0),
    });
  }
  return pts;
}

/** Letzte dokumentierte Leistung einer Übung (für den Trainingsmodus) */
export function lastPerformance(sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string): { date: string; sets: SetLog[] } | null {
  const list = finishedSessions(sessions).filter((s) => s.id !== excludeSessionId).reverse();
  for (const s of list) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex && completedSets(ex.sets).length) return { date: s.startedAt, sets: completedSets(ex.sets) };
  }
  return null;
}

export function sessionsThisWeek(sessions: WorkoutSession[], now = new Date()): number {
  const ws = startOfWeek(now).getTime();
  return finishedSessions(sessions).filter((s) => Date.parse(s.startedAt) >= ws).length;
}

export function trainedExerciseIds(sessions: WorkoutSession[]): { id: string; name: string; count: number }[] {
  const m = new Map<string, { id: string; name: string; count: number }>();
  for (const s of finishedSessions(sessions)) {
    for (const e of s.exercises) {
      if (!completedSets(e.sets).length) continue;
      const cur = m.get(e.exerciseId) ?? { id: e.exerciseId, name: e.exerciseName, count: 0 };
      cur.count++;
      m.set(e.exerciseId, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}
