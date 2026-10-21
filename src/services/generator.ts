/**
 * Deterministischer Trainingsplan-Generator.
 *
 * Ablauf:
 *  1. validateInput()      – prüft Häufigkeit ↔ Wochentage, Muskelauswahl, Ausrüstung
 *  2. suggestSplit()       – schlägt eine Aufteilung der gewählten Muskelgruppen auf die Tage vor
 *  3. generatePlan()       – wählt pro Tag Übungen anhand fester, nachvollziehbarer Regeln
 *  4. regenerateDay()      – erzeugt einen einzelnen Tag neu (andere Tage bleiben unverändert)
 *
 * Gleiche Eingaben + gleicher Datenbestand ⇒ gleiches Ergebnis (kein Zufall).
 */
import type {
  Equipment,
  Exercise,
  Experience,
  GeneratorDayInput,
  GeneratorInput,
  GeneratorWarning,
  MuscleGroup,
  PlanDay,
  PlanExercise,
  TrainingGoal,
  Weekday,
  WorkoutPlan,
} from '../types';
import { EQUIPMENT_PRESET_MAP, GOAL_LABEL, MUSCLE_LABEL, TRAINABLE_MUSCLES, WEEKDAY_LABEL, WEEKDAY_SHORT } from '../data/labels';

// ---------- Konstanten ----------

const LARGE: MuscleGroup[] = ['quadrizeps', 'ruecken', 'brust', 'beinbeuger', 'gesaess', 'schultern'];
/** Reihenfolge innerhalb einer Einheit: große vor kleinen Muskelgruppen, Bauch zuletzt */
const ORDER: MuscleGroup[] = ['quadrizeps', 'beinbeuger', 'gesaess', 'ruecken', 'brust', 'schultern', 'trizeps', 'bizeps', 'unterarme', 'waden', 'bauch', 'ganzkoerper'];

const PUSH: MuscleGroup[] = ['brust', 'schultern', 'trizeps'];
const PULL: MuscleGroup[] = ['ruecken', 'bizeps', 'unterarme'];
const LEGS: MuscleGroup[] = ['quadrizeps', 'beinbeuger', 'gesaess', 'waden', 'bauch'];
const UPPER: MuscleGroup[] = ['brust', 'ruecken', 'schultern', 'bizeps', 'trizeps', 'unterarme'];
const LOWER: MuscleGroup[] = ['quadrizeps', 'beinbeuger', 'gesaess', 'waden', 'bauch'];

export const DURATIONS = [30, 45, 60, 75, 90] as const;

interface Template {
  name: string;
  muscles: MuscleGroup[];
}

export interface SplitSuggestion {
  splitName: string;
  explanation: string;
  days: GeneratorDayInput[];
  warnings: GeneratorWarning[];
}

export interface DayMeta {
  dayId: string;
  estimatedMin: number;
  variant: number;
}

export interface GeneratorResult {
  plan: WorkoutPlan;
  splitName: string;
  explanation: string;
  restDays: Weekday[];
  dayMeta: DayMeta[];
  warnings: GeneratorWarning[];
}

// ---------- Hilfen ----------

export function resolveEquipment(input: Pick<GeneratorInput, 'equipmentPreset' | 'equipment'>): Equipment[] {
  if (input.equipmentPreset === 'individuell') return input.equipment;
  return EQUIPMENT_PRESET_MAP[input.equipmentPreset];
}

const sortMuscles = (ms: MuscleGroup[]) => [...new Set(ms)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

function dayIdFor(index: number, weekday: Weekday | null): string {
  return `gen-d${index}-${weekday ?? 'x'}`;
}

// ---------- 1. Validierung ----------

export function validateInput(input: GeneratorInput): GeneratorWarning[] {
  const w: GeneratorWarning[] = [];
  if (input.weekdays.length !== input.frequency) {
    w.push({
      level: 'warn',
      message: `Du hast ${input.frequency} Trainingstage pro Woche gewählt, aber ${input.weekdays.length} Wochentag${input.weekdays.length === 1 ? '' : 'e'} markiert. Bitte passe die Auswahl an.`,
    });
  }
  if (input.muscles.length === 0) {
    w.push({ level: 'warn', message: 'Bitte wähle mindestens eine Muskelgruppe aus.' });
  } else if (input.muscles.length < 3) {
    w.push({
      level: 'info',
      message: `Es sind nur ${input.muscles.length} Muskelgruppe${input.muscles.length === 1 ? '' : 'n'} ausgewählt. Der Plan trainiert ausschließlich diese – weitere Gruppen werden nicht automatisch ergänzt.`,
    });
  }
  if (resolveEquipment(input).length === 0) {
    w.push({ level: 'warn', message: 'Bitte wähle mindestens ein verfügbares Trainingsgerät aus.' });
  }
  return w;
}

export function isInputComplete(input: GeneratorInput): boolean {
  return validateInput(input).every((x) => x.level !== 'warn');
}

// ---------- 2. Split-Vorschlag ----------

function templatesFor(freq: number, goal: TrainingGoal, exp: Experience): { name: string; explanation: string; t: Template[] } {
  const FB: Template = { name: 'Ganzkörper', muscles: [...TRAINABLE_MUSCLES] };
  const P: Template = { name: 'Push', muscles: PUSH };
  const Pu: Template = { name: 'Pull', muscles: PULL };
  const L: Template = { name: 'Beine', muscles: LEGS };
  const U: Template = { name: 'Oberkörper', muscles: UPPER };
  const Lo: Template = { name: 'Unterkörper', muscles: LOWER };
  switch (freq) {
    case 1:
      return { name: 'Ganzkörper', explanation: 'Bei einem Trainingstag werden alle gewählten Muskelgruppen in einer Einheit trainiert.', t: [FB] };
    case 2:
      return { name: 'Ganzkörper', explanation: 'Bei zwei Tagen wird jede gewählte Muskelgruppe in beiden Einheiten trainiert – mit wechselnder Übungsauswahl.', t: [FB, FB] };
    case 3:
      if (exp === 'anfaenger' || goal === 'grundlagen' || goal === 'fitness') {
        return { name: 'Ganzkörper (A/B/C)', explanation: 'Drei Ganzkörpereinheiten mit variierenden Übungen: jede Muskelgruppe wird dreimal pro Woche mit moderatem Umfang belastet – gut für Einstieg und Technik.', t: [FB, FB, FB] };
      }
      return { name: 'Push / Pull / Beine', explanation: 'Drückende, ziehende und Beinmuskulatur an jeweils eigenen Tagen – hoher Umfang je Einheit, jede Gruppe einmal pro Woche.', t: [P, Pu, L] };
    case 4:
      return { name: 'Oberkörper / Unterkörper', explanation: 'Zwei Oberkörper- und zwei Unterkörpertage: jede Gruppe zweimal pro Woche bei überschaubarer Einheitendauer.', t: [U, Lo, U, Lo] };
    case 5:
      return { name: 'Oberkörper / Unterkörper / Push / Pull / Beine', explanation: 'Kombination aus Ober-/Unterkörper und Push/Pull/Beine – jede Gruppe ca. zweimal pro Woche.', t: [U, Lo, P, Pu, L] };
    default:
      return { name: 'Push / Pull / Beine ×2', explanation: 'Push/Pull/Beine zweimal pro Woche – hohe Frequenz für erfahrene Trainierende. Achte auf ausreichende Regeneration.', t: [P, Pu, L, P, Pu, L] };
  }
}

export function suggestSplit(input: GeneratorInput): SplitSuggestion {
  const weekdays = [...input.weekdays].sort((a, b) => a - b);
  const selected = sortMuscles(input.muscles.filter((m) => m !== 'ganzkoerper'));
  const freq = weekdays.length;
  const warnings: GeneratorWarning[] = [];
  if (freq === 0 || selected.length === 0) {
    return { splitName: '–', explanation: '', days: [], warnings };
  }
  const tpl = templatesFor(freq, input.goal, input.experience);
  let days: GeneratorDayInput[] = tpl.t.map((t, i) => ({
    weekday: weekdays[i],
    name: t.name,
    muscles: sortMuscles(t.muscles.filter((m) => selected.includes(m))),
  }));

  // Muskelgruppen, die in keinem Template-Tag vorkommen → dem Tag mit den wenigsten Gruppen zuordnen
  const covered = new Set(days.flatMap((d) => d.muscles));
  for (const m of selected) {
    if (!covered.has(m)) {
      const target = days.reduce((best, d, i) => (d.muscles.length < days[best].muscles.length ? i : best), 0);
      days[target] = { ...days[target], muscles: sortMuscles([...days[target].muscles, m]) };
    }
  }

  // Leere Tage (Auswahl passt nicht zum Template) → alle gewählten Gruppen auf alle Tage verteilen
  if (days.some((d) => d.muscles.length === 0)) {
    days = days.map((d) => ({ ...d, name: 'Ganzkörper', muscles: selected }));
    warnings.push({
      level: 'info',
      message: `Die gewählten Muskelgruppen passen nicht zum Split „${tpl.name}“. Es wurde stattdessen ein Ganzkörperplan vorgeschlagen.`,
    });
    return { splitName: 'Ganzkörper (angepasst)', explanation: 'Alle gewählten Muskelgruppen werden an jedem Trainingstag trainiert.', days, warnings };
  }
  return { splitName: tpl.name, explanation: tpl.explanation, days, warnings };
}

/** Prüft, ob an direkt aufeinanderfolgenden Tagen dieselben Muskelgruppen trainiert werden */
export function overlapWarnings(days: GeneratorDayInput[]): GeneratorWarning[] {
  const w: GeneratorWarning[] = [];
  const sorted = [...days].sort((a, b) => a.weekday - b.weekday);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[(i + 1) % sorted.length];
    if (sorted.length < 2 || a === b) continue;
    const gap = (b.weekday - a.weekday + 7) % 7;
    if (gap !== 1) continue;
    const shared = a.muscles.filter((m) => LARGE.includes(m) && b.muscles.includes(m));
    if (shared.length) {
      w.push({
        level: 'info',
        message: `${WEEKDAY_SHORT[a.weekday]} → ${WEEKDAY_SHORT[b.weekday]}: ${shared.map((m) => MUSCLE_LABEL[m]).join(', ')} an zwei Tagen hintereinander. Erwäge einen Ruhetag dazwischen oder eine andere Verteilung.`,
      });
    }
  }
  return w;
}

// ---------- 3. Parameter je Ziel ----------

interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
}

export function prescription(goal: TrainingGoal, exp: Experience, compound: boolean, ex?: Exercise): Prescription {
  // Halte-/Strecken-Übungen behalten ihre eigenen Vorgaben
  if (ex && ex.repUnit && ex.repUnit !== 'wdh') {
    return { sets: goal === 'grundlagen' ? 2 : 3, repsMin: ex.recommended.repsMin, repsMax: ex.recommended.repsMax, restSec: ex.recommended.restSec };
  }
  const expSets = exp === 'anfaenger' ? 0 : exp === 'fortgeschritten' ? 0 : 1;
  switch (goal) {
    case 'maximalkraft':
      return compound ? { sets: 4 + expSets, repsMin: 3, repsMax: 6, restSec: 180 } : { sets: 3, repsMin: 8, repsMax: 10, restSec: 90 };
    case 'fitness':
      return { sets: 3, repsMin: 10, repsMax: 15, restSec: compound ? 75 : 60 };
    case 'grundlagen':
      return { sets: exp === 'anfaenger' ? 2 : 3, repsMin: 10, repsMax: 12, restSec: compound ? 90 : 60 };
    case 'muskelaufbau':
    default:
      return compound ? { sets: 3 + expSets, repsMin: 6, repsMax: 10, restSec: 120 } : { sets: 3, repsMin: 10, repsMax: 15, restSec: 75 };
  }
}

/** Geschätzte Dauer in Minuten: Aufwärmen + Satzzeit (3 s je Wdh.) + Pausen + Gerätewechsel */
export function estimateMinutes(exercises: Pick<PlanExercise, 'sets' | 'repsMin' | 'repsMax' | 'restSec'>[]): number {
  if (!exercises.length) return 0;
  const warmup = 8;
  let sec = 0;
  for (const e of exercises) {
    const work = ((e.repsMin + e.repsMax) / 2) * 3 + 10;
    sec += e.sets * work + Math.max(0, e.sets - 1) * e.restSec + 90; // 90 s Wechsel/Einstellen
  }
  return Math.round(warmup + sec / 60);
}

function slotBudget(durationMin: number | null, exp: Experience): number {
  if (durationMin === null) return exp === 'anfaenger' ? 5 : exp === 'fortgeschritten' ? 6 : 7;
  const byTime: Record<number, number> = { 30: 3, 45: 5, 60: 6, 75: 7, 90: 8 };
  const n = byTime[durationMin] ?? Math.round(durationMin / 11);
  return exp === 'anfaenger' ? Math.min(n, 6) : n;
}

// ---------- 4. Übungsauswahl ----------

const DIFF_ALLOWED: Record<Experience, Exercise['difficulty'][]> = {
  anfaenger: ['anfaenger'],
  fortgeschritten: ['anfaenger', 'fortgeschritten'],
  erfahren: ['anfaenger', 'fortgeschritten', 'experte'],
};

const isCompound = (e: Exercise) => e.type === 'grunduebung' || e.type === 'kraft';

/** Verteilt die Übungsplätze eines Tages auf die Muskelgruppen */
export function allocateSlots(muscles: MuscleGroup[], budget: number, variant = 0): MuscleGroup[] {
  const ms = sortMuscles(muscles);
  if (!ms.length) return [];
  let large = ms.filter((m) => LARGE.includes(m));
  let small = ms.filter((m) => !LARGE.includes(m));
  if (ms.length > budget) {
    // Zu wenig Plätze: Gesäß/Beinbeuger werden über Hüftübungen teils gemeinsam trainiert –
    // je Variante steht eine der beiden Gruppen hinten an. Kleine Gruppen rotieren je Variante.
    if (large.includes('gesaess') && large.includes('beinbeuger')) {
      const later: MuscleGroup = variant % 2 === 0 ? 'gesaess' : 'beinbeuger';
      large = [...large.filter((m) => m !== later), later];
    }
    if (small.length) {
      const r = variant % small.length;
      small = [...small.slice(r), ...small.slice(0, r)];
    }
  }
  const slots: MuscleGroup[] = [];
  // 1. Große Gruppen (bei knappem Budget ohne die letzte, damit eine kleine Gruppe Platz hat)
  const reserveSmall = ms.length > budget && small.length > 0 && budget >= 4 ? 1 : 0;
  for (const m of large) if (slots.length < budget - reserveSmall) slots.push(m);
  // 2. Kleine Gruppen
  for (const m of small) if (slots.length < budget) slots.push(m);
  // 2b. Verbleibende große Gruppen
  for (const m of large) if (slots.length < budget && !slots.includes(m)) slots.push(m);
  // 3. Zusätzliche Plätze reihum an große Gruppen (bei wenigen Gruppen auch an kleine)
  const pool = large.length ? large : small;
  let i = 0;
  while (slots.length < budget && pool.length) {
    const m = pool[i % pool.length];
    // Maximal 3 Übungen je Gruppe pro Tag
    if (slots.filter((s) => s === m).length < 3) slots.push(m);
    i++;
    if (i > pool.length * 3) break;
  }
  return slots;
}

interface PickContext {
  pool: Exercise[];
  equipment: Equipment[];
  experience: Experience;
  usedInDay: Set<string>;
  usedInPlan: Map<string, number>;
  variant: number;
}

function candidatesFor(m: MuscleGroup, ctx: PickContext, strictDifficulty: boolean): Exercise[] {
  const allowed = DIFF_ALLOWED[ctx.experience];
  return ctx.pool.filter(
    (e) =>
      e.primaryMuscle === m &&
      ctx.equipment.includes(e.equipment) &&
      !ctx.usedInDay.has(e.id) &&
      (!strictDifficulty || allowed.includes(e.difficulty)),
  );
}

function pickExercise(m: MuscleGroup, slotIndexForMuscle: number, ctx: PickContext, dayPatterns: Set<string>): Exercise | null {
  let cands = candidatesFor(m, ctx, true);
  if (!cands.length) cands = candidatesFor(m, ctx, false).filter((e) => e.difficulty !== 'experte' || ctx.experience === 'erfahren');
  if (!cands.length) return null;
  const wantCompound = LARGE.includes(m) && slotIndexForMuscle === 0;
  const scored = cands.map((e, i) => {
    let s = 0;
    if (wantCompound && isCompound(e)) s += 10;
    if (!wantCompound && slotIndexForMuscle > 0 && dayPatterns.has(e.pattern)) s -= 4; // anderes Bewegungsmuster bevorzugen
    // Rücken: Zugbewegungen bevorzugen; Hüftbeuge-Übungen (Kreuzheben) nur nachrangig
    if (m === 'ruecken' && e.pattern === 'hinge') s -= 6;
    if (m === 'ruecken' && e.pattern === 'shrug') s -= 3;
    if (ctx.experience === 'anfaenger' && (e.equipment === 'maschine' || e.equipment === 'kabelzug')) s += 1.5; // gut erlernbar
    if (ctx.experience === 'anfaenger' && e.type === 'kraft') s -= 3;
    if (ctx.experience === 'erfahren' && e.type === 'kraft') s += 1;
    s -= (ctx.usedInPlan.get(e.id) ?? 0) * 3; // Wiederholungen im Plan vermeiden
    return { e, s, i };
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  // Variante: deterministisch einen der besten Kandidaten mit gleicher Punktzahl-Spitze rotieren
  const top = scored.filter((x) => x.s >= scored[0].s - 2);
  return top[ctx.variant % top.length].e;
}

function buildDay(
  dayInput: GeneratorDayInput,
  index: number,
  input: GeneratorInput,
  pool: Exercise[],
  usedInPlan: Map<string, number>,
  variant: number,
): { day: PlanDay; warnings: GeneratorWarning[]; estimatedMin: number } {
  const warnings: GeneratorWarning[] = [];
  const equipment = resolveEquipment(input);
  let budget = slotBudget(input.durationMin, input.experience);
  const ctx: PickContext = { pool, equipment, experience: input.experience, usedInDay: new Set(), usedInPlan, variant };

  const build = (b: number): PlanExercise[] => {
    ctx.usedInDay = new Set();
    const slots = allocateSlots(dayInput.muscles, b, variant);
    const perMuscle = new Map<MuscleGroup, number>();
    const patterns = new Set<string>();
    const result: { ex: Exercise; muscle: MuscleGroup }[] = [];
    for (const m of slots) {
      const k = perMuscle.get(m) ?? 0;
      const ex = pickExercise(m, k, ctx, patterns);
      perMuscle.set(m, k + 1);
      if (!ex) continue;
      ctx.usedInDay.add(ex.id);
      patterns.add(ex.pattern);
      result.push({ ex, muscle: m });
    }
    // Reihenfolge: Grund-/Kraftübungen zuerst, dann nach Muskelreihenfolge, Bauch zuletzt
    result.sort((a, b) => {
      const ab = a.muscle === 'bauch' ? 1 : 0;
      const bb = b.muscle === 'bauch' ? 1 : 0;
      if (ab !== bb) return ab - bb;
      const ac = isCompound(a.ex) ? 0 : 1;
      const bc = isCompound(b.ex) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return ORDER.indexOf(a.muscle) - ORDER.indexOf(b.muscle);
    });
    return result.map(({ ex }, i) => {
      const p = prescription(input.goal, input.experience, isCompound(ex), ex);
      return {
        uid: `${dayIdFor(index, dayInput.weekday)}-e${i}-${ex.id}`,
        exerciseId: ex.id,
        sets: p.sets,
        repsMin: p.repsMin,
        repsMax: p.repsMax,
        restSec: p.restSec,
        targetWeight: null,
        notes: '',
      };
    });
  };

  let exercises = build(budget);
  // Zeitbudget einhalten: Übungen reduzieren, dann ggf. Sätze kürzen
  if (input.durationMin) {
    while (estimateMinutes(exercises) > input.durationMin && budget > 2) {
      budget--;
      exercises = build(budget);
    }
    if (estimateMinutes(exercises) > input.durationMin) {
      exercises = exercises.map((e) => ({ ...e, sets: Math.max(2, e.sets - 1) }));
    }
  }

  for (const e of exercises) usedInPlan.set(e.exerciseId, (usedInPlan.get(e.exerciseId) ?? 0) + 1);

  const coveredPrimary = new Set(exercises.map((e) => pool.find((p) => p.id === e.exerciseId)?.primaryMuscle));
  const coveredAny = new Set(
    exercises.flatMap((e) => {
      const ex = pool.find((p) => p.id === e.exerciseId);
      return ex ? [ex.primaryMuscle, ...ex.secondaryMuscles] : [];
    }),
  );
  const missingEquip: string[] = [];
  const indirect: string[] = [];
  const noRoom: string[] = [];
  for (const m of dayInput.muscles) {
    if (coveredPrimary.has(m)) continue;
    const anyAvailable = pool.some((e) => e.primaryMuscle === m && equipment.includes(e.equipment));
    if (!anyAvailable) missingEquip.push(MUSCLE_LABEL[m]);
    else if (coveredAny.has(m)) indirect.push(MUSCLE_LABEL[m]);
    else noRoom.push(MUSCLE_LABEL[m]);
  }
  const wd = WEEKDAY_LABEL[dayInput.weekday];
  if (missingEquip.length) warnings.push({ level: 'warn', message: `${wd}: Für ${missingEquip.join(', ')} gibt es mit der gewählten Ausrüstung keine passende Übung.` });
  if (indirect.length) warnings.push({ level: 'info', message: `${wd}: ${indirect.join(', ')} ${indirect.length === 1 ? 'wird' : 'werden'} an diesem Tag nur indirekt über Grundübungen trainiert.` });
  if (noRoom.length) warnings.push({ level: 'info', message: `${wd}: Für ${noRoom.join(', ')} war im Zeitrahmen kein Platz. Mehr Zeit, mehr Trainingstage oder weniger Muskelgruppen pro Tag wählen.` });

  const day: PlanDay = {
    id: dayIdFor(index, dayInput.weekday),
    name: `${WEEKDAY_LABEL[dayInput.weekday]} – ${dayInput.name}`,
    weekday: dayInput.weekday,
    muscles: dayInput.muscles,
    exercises,
  };
  return { day, warnings, estimatedMin: estimateMinutes(exercises) };
}

// ---------- 5. Plan erzeugen ----------

export function generatePlan(input: GeneratorInput, pool: Exercise[], now = new Date().toISOString()): GeneratorResult {
  const suggestion = suggestSplit(input);
  const days = input.splitMode === 'manuell' && input.days.length ? input.days : suggestion.days;
  const sortedDays = [...days].sort((a, b) => a.weekday - b.weekday);
  const warnings: GeneratorWarning[] = [...validateInput(input).filter((w) => w.level === 'info'), ...suggestion.warnings, ...overlapWarnings(sortedDays)];

  const usedInPlan = new Map<string, number>();
  const builtDays: PlanDay[] = [];
  const dayMeta: DayMeta[] = [];
  // Varianten für wiederholte Tagestypen (z. B. Ganzkörper A/B/C) – deterministisch nach Vorkommen
  const occurrence = new Map<string, number>();
  sortedDays.forEach((d, i) => {
    const key = d.muscles.join(',');
    const variant = occurrence.get(key) ?? 0;
    occurrence.set(key, variant + 1);
    const r = buildDay(d, i, input, pool, usedInPlan, variant);
    builtDays.push(r.day);
    dayMeta.push({ dayId: r.day.id, estimatedMin: r.estimatedMin, variant });
    warnings.push(...r.warnings);
    if (d.muscles.length === 0) warnings.push({ level: 'warn', message: `${WEEKDAY_LABEL[d.weekday]}: Keine Muskelgruppe zugeordnet.` });
  });

  const restDays = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((w) => !sortedDays.some((d) => d.weekday === w));
  const splitName = input.splitMode === 'manuell' ? 'Eigene Aufteilung' : suggestion.splitName;
  const plan: WorkoutPlan = {
    id: `plan-gen-${Date.parse(now).toString(36)}`,
    name: `${GOAL_LABEL[input.goal]} · ${sortedDays.length}× pro Woche`,
    description: `Automatisch erstellt (${splitName}). Ruhetage: ${restDays.map((d) => WEEKDAY_SHORT[d]).join(', ') || 'keine'}.`,
    goal: input.goal,
    days: builtDays,
    notes: '',
    createdAt: now,
    updatedAt: now,
    generated: input,
  };
  return {
    plan,
    splitName,
    explanation: input.splitMode === 'manuell' ? 'Die Muskelgruppen wurden von dir selbst auf die Trainingstage verteilt.' : suggestion.explanation,
    restDays,
    dayMeta,
    warnings: dedupe(warnings),
  };
}

/**
 * Erzeugt einen einzelnen Tag neu. Übungen der anderen Tage werden als „bereits verwendet“
 * berücksichtigt, bleiben aber selbst unverändert.
 */
export function regenerateDay(plan: WorkoutPlan, dayIndex: number, input: GeneratorInput, pool: Exercise[], variant: number): { day: PlanDay; warnings: GeneratorWarning[]; estimatedMin: number } {
  const target = plan.days[dayIndex];
  const usedInPlan = new Map<string, number>();
  plan.days.forEach((d, i) => {
    if (i === dayIndex) return;
    d.exercises.forEach((e) => usedInPlan.set(e.exerciseId, (usedInPlan.get(e.exerciseId) ?? 0) + 1));
  });
  const dayInput: GeneratorDayInput = {
    weekday: (target.weekday ?? 0) as Weekday,
    name: target.name.includes(' – ') ? target.name.split(' – ').slice(1).join(' – ') : target.name,
    muscles: target.muscles,
  };
  const r = buildDay(dayInput, dayIndex, input, pool, usedInPlan, variant);
  // ID und Namen des bestehenden Tages beibehalten
  return { ...r, day: { ...r.day, id: target.id, name: target.name, exercises: r.day.exercises.map((e, i) => ({ ...e, uid: `${target.id}-v${variant}-e${i}-${e.exerciseId}` })) } };
}

function dedupe(w: GeneratorWarning[]): GeneratorWarning[] {
  const seen = new Set<string>();
  return w.filter((x) => (seen.has(x.message) ? false : (seen.add(x.message), true)));
}

export function defaultGeneratorInput(): GeneratorInput {
  return {
    goal: 'muskelaufbau',
    experience: 'anfaenger',
    frequency: 3,
    weekdays: [0, 2, 4],
    muscles: [...TRAINABLE_MUSCLES],
    splitMode: 'auto',
    days: [],
    durationMin: 60,
    equipmentPreset: 'voll',
    equipment: [],
  };
}
