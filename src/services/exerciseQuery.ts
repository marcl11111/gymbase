import type { Difficulty, Equipment, Exercise, ExerciseType, MuscleGroup } from '../types';
import { DIFFICULTY_LABEL, EQUIPMENT_LABEL, MUSCLE_LABEL, PATTERN_LABEL, TYPE_LABEL } from '../data/labels';
import { normalize } from '../utils';

export interface ExerciseFilter {
  query: string;
  muscles: MuscleGroup[];
  equipment: Equipment[];
  difficulty: Difficulty[];
  types: ExerciseType[];
}

export const EMPTY_FILTER: ExerciseFilter = { query: '', muscles: [], equipment: [], difficulty: [], types: [] };

export function isFilterActive(f: ExerciseFilter): boolean {
  return !!f.query.trim() || f.muscles.length > 0 || f.equipment.length > 0 || f.difficulty.length > 0 || f.types.length > 0;
}

function haystack(e: Exercise): string {
  const text = [
    e.name,
      MUSCLE_LABEL[e.primaryMuscle],
      ...e.secondaryMuscles.map((m) => MUSCLE_LABEL[m]),
      EQUIPMENT_LABEL[e.equipment],
      PATTERN_LABEL[e.pattern],
      TYPE_LABEL[e.type],
      DIFFICULTY_LABEL[e.difficulty],
    ].join(' ');
  // Beide Schreibweisen zulassen: „gesaess“ und „gesass“ finden „Gesäß“
  return `${normalize(text)} ${normalize(text.replace(/[äÄ]/g, 'a').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u'))}`;
}

/**
 * Suche + Filter. Innerhalb einer Filterkategorie gilt ODER, zwischen den Kategorien UND.
 * Muskelfilter berücksichtigt primäre und sekundäre Muskeln; primäre Treffer werden zuerst sortiert.
 */
export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const terms = normalize(f.query.trim()).split(/\s+/).filter(Boolean);
  const res = list.filter((e) => {
    if (f.muscles.length && !f.muscles.includes(e.primaryMuscle) && !e.secondaryMuscles.some((m) => f.muscles.includes(m))) return false;
    if (f.equipment.length && !f.equipment.includes(e.equipment)) return false;
    if (f.difficulty.length && !f.difficulty.includes(e.difficulty)) return false;
    if (f.types.length && !f.types.includes(e.type)) return false;
    if (terms.length) {
      const h = haystack(e);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });
  const score = (e: Exercise) => {
    let s = 0;
    if (f.muscles.length && f.muscles.includes(e.primaryMuscle)) s -= 10;
    if (terms.length && normalize(e.name).startsWith(terms[0])) s -= 5;
    return s;
  };
  return res
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.e);
}

const DIFF_RANK: Record<Difficulty, number> = { anfaenger: 0, fortgeschritten: 1, experte: 2 };

export interface AlternativeOptions {
  equipment?: Equipment[];
  limit?: number;
}

/**
 * Alternativen-Finder. Bewertet Zielmuskulatur, Bewegungsmuster, Schwierigkeitsgrad und
 * (optional) verfügbares Equipment. Liefert ähnliche – nicht biomechanisch identische – Übungen.
 */
export function findAlternatives(target: Exercise, all: Exercise[], opts: AlternativeOptions = {}): { exercise: Exercise; score: number; reasons: string[] }[] {
  const limit = opts.limit ?? 6;
  return all
    .filter((e) => e.id !== target.id)
    .filter((e) => !opts.equipment || opts.equipment.length === 0 || opts.equipment.includes(e.equipment))
    .map((e, i) => {
      let score = 0;
      const reasons: string[] = [];
      if (e.primaryMuscle === target.primaryMuscle) {
        score += 4;
        reasons.push(`Gleiche Zielmuskulatur (${MUSCLE_LABEL[e.primaryMuscle]})`);
      } else if (target.secondaryMuscles.includes(e.primaryMuscle) || e.secondaryMuscles.includes(target.primaryMuscle)) {
        score += 1;
      }
      if (e.pattern === target.pattern) {
        score += 3;
        reasons.push(`Ähnliches Bewegungsmuster (${PATTERN_LABEL[e.pattern]})`);
      }
      const shared = e.secondaryMuscles.filter((m) => target.secondaryMuscles.includes(m)).length;
      score += shared * 0.3;
      score -= Math.abs(DIFF_RANK[e.difficulty] - DIFF_RANK[target.difficulty]) * 0.6;
      if (e.equipment !== target.equipment) reasons.push(`Anderes Gerät: ${EQUIPMENT_LABEL[e.equipment]}`);
      return { exercise: e, score, reasons, i };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(({ exercise, score, reasons }) => ({ exercise, score, reasons }));
}
