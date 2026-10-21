import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '../src/data/exercises';
import { TRAINABLE_MUSCLES } from '../src/data/labels';
import {
  defaultGeneratorInput,
  estimateMinutes,
  generatePlan,
  regenerateDay,
  resolveEquipment,
  suggestSplit,
  validateInput,
} from '../src/services/generator';
import type { GeneratorInput } from '../src/types';
import { sanitizeAppData, emptyData } from '../src/services/storage';

const NOW = '2026-10-21T10:00:00.000Z';
const pool = BUILTIN_EXERCISES;
const byId = new Map(pool.map((e) => [e.id, e]));
const input = (p: Partial<GeneratorInput>): GeneratorInput => ({ ...defaultGeneratorInput(), ...p });

function allExerciseIds(r: ReturnType<typeof generatePlan>) {
  return r.plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
}

describe('Generator', () => {
  it('2 Tage → Ganzkörper', () => {
    const r = generatePlan(input({ frequency: 2, weekdays: [0, 3] }), pool, NOW);
    expect(r.plan.days).toHaveLength(2);
    expect(r.splitName).toBe('Ganzkörper');
    for (const d of r.plan.days) {
      const prim = new Set(d.exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle));
      expect(prim.has('quadrizeps') && prim.has('ruecken') && prim.has('brust')).toBe(true);
    }
    // Beide Tage sind nicht identisch
    expect(r.plan.days[0].exercises.map((e) => e.exerciseId)).not.toEqual(r.plan.days[1].exercises.map((e) => e.exerciseId));
    expect(r.restDays).toEqual([1, 2, 4, 5, 6]);
  });

  it('3 Tage mit individueller Muskelgruppenauswahl (manuell)', () => {
    const r = generatePlan(
      input({
        frequency: 3,
        weekdays: [0, 2, 4],
        experience: 'fortgeschritten',
        muscles: ['brust', 'schultern', 'trizeps', 'ruecken', 'bizeps', 'quadrizeps', 'beinbeuger', 'gesaess', 'waden', 'bauch'],
        splitMode: 'manuell',
        days: [
          { weekday: 0, name: 'Brust/Schulter/Trizeps', muscles: ['brust', 'schultern', 'trizeps'] },
          { weekday: 2, name: 'Rücken/Bizeps', muscles: ['ruecken', 'bizeps'] },
          { weekday: 4, name: 'Beine/Bauch', muscles: ['quadrizeps', 'beinbeuger', 'gesaess', 'waden', 'bauch'] },
        ],
      }),
      pool,
      NOW,
    );
    const day0 = r.plan.days[0].exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle);
    expect(day0.every((m) => ['brust', 'schultern', 'trizeps'].includes(m))).toBe(true);
    const day1 = r.plan.days[1].exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle);
    expect(day1.every((m) => ['ruecken', 'bizeps'].includes(m))).toBe(true);
    expect(r.plan.days[2].muscles).toContain('bauch');
  });

  it('4 Tage → Oberkörper / Unterkörper', () => {
    const r = generatePlan(input({ frequency: 4, weekdays: [0, 1, 3, 4], experience: 'fortgeschritten' }), pool, NOW);
    expect(r.splitName).toBe('Oberkörper / Unterkörper');
    expect(r.plan.days.map((d) => d.name)).toEqual(['Montag – Oberkörper', 'Dienstag – Unterkörper', 'Donnerstag – Oberkörper', 'Freitag – Unterkörper']);
    const lowerPrim = r.plan.days[1].exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle);
    expect(lowerPrim.every((m) => ['quadrizeps', 'beinbeuger', 'gesaess', 'waden', 'bauch'].includes(m))).toBe(true);
  });

  it('6 Tage → Push / Pull / Legs ×2 mit Variation', () => {
    const r = generatePlan(input({ frequency: 6, weekdays: [0, 1, 2, 3, 4, 5], experience: 'erfahren' }), pool, NOW);
    expect(r.splitName).toBe('Push / Pull / Beine ×2');
    expect(r.plan.days).toHaveLength(6);
    expect(r.plan.days[0].exercises.map((e) => e.exerciseId)).not.toEqual(r.plan.days[3].exercises.map((e) => e.exerciseId));
    const pushPrim = r.plan.days[0].exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle);
    expect(pushPrim.every((m) => ['brust', 'schultern', 'trizeps'].includes(m))).toBe(true);
  });

  it('fehlendes Equipment: nur Eigengewicht', () => {
    const inp = input({ frequency: 2, weekdays: [0, 3], equipmentPreset: 'eigengewicht' });
    const r = generatePlan(inp, pool, NOW);
    for (const id of allExerciseIds(r)) expect(byId.get(id)!.equipment).toBe('eigengewicht');
    expect(r.warnings.some((w) => /keine passende Übung/.test(w.message))).toBe(true);
  });

  it('individuelle Ausrüstung leer → Warnung', () => {
    const w = validateInput(input({ equipmentPreset: 'individuell', equipment: [] }));
    expect(w.some((x) => x.level === 'warn')).toBe(true);
    expect(resolveEquipment({ equipmentPreset: 'individuell', equipment: ['kabelzug'] })).toEqual(['kabelzug']);
  });

  it('unvollständige Auswahl: Wochentage passen nicht zur Häufigkeit', () => {
    const w = validateInput(input({ frequency: 4, weekdays: [0, 2] }));
    expect(w.some((x) => x.level === 'warn' && /4 Trainingstage/.test(x.message))).toBe(true);
    expect(validateInput(input({ muscles: [] })).some((x) => x.level === 'warn')).toBe(true);
  });

  it('zu wenige Muskelgruppen → Hinweis, keine ungefragten Ergänzungen', () => {
    const r = generatePlan(input({ frequency: 2, weekdays: [1, 4], muscles: ['bizeps', 'trizeps'] }), pool, NOW);
    expect(r.warnings.some((w) => /nur 2 Muskelgruppen/.test(w.message))).toBe(true);
    for (const id of allExerciseIds(r)) expect(['bizeps', 'trizeps']).toContain(byId.get(id)!.primaryMuscle);
  });

  it('ist deterministisch', () => {
    const a = generatePlan(input({ frequency: 3, weekdays: [0, 2, 4] }), pool, NOW);
    const b = generatePlan(input({ frequency: 3, weekdays: [0, 2, 4] }), pool, NOW);
    expect(a).toEqual(b);
  });

  it('Anfänger erhalten nur Anfänger-Übungen, wenn verfügbar', () => {
    const r = generatePlan(input({ experience: 'anfaenger' }), pool, NOW);
    const diffs = allExerciseIds(r).map((id) => byId.get(id)!.difficulty);
    expect(diffs.every((d) => d === 'anfaenger')).toBe(true);
  });

  it('hält das Zeitbudget ungefähr ein', () => {
    for (const durationMin of [30, 45, 60, 90]) {
      const r = generatePlan(input({ durationMin, frequency: 4, weekdays: [0, 1, 3, 4], experience: 'fortgeschritten' }), pool, NOW);
      for (const d of r.plan.days) expect(estimateMinutes(d.exercises)).toBeLessThanOrEqual(durationMin + 5);
    }
  });

  it('Reihenfolge: Grundübungen vor Isolation, Bauch zuletzt', () => {
    const r = generatePlan(input({ frequency: 4, weekdays: [0, 1, 3, 4], experience: 'fortgeschritten', durationMin: 75 }), pool, NOW);
    for (const d of r.plan.days) {
      const ex = d.exercises.map((e) => byId.get(e.exerciseId)!);
      const nonCore = ex.filter((e) => e.primaryMuscle !== 'bauch');
      const firstIso = nonCore.findIndex((e) => e.type === 'isolation' || e.type === 'stabilitaet');
      if (firstIso >= 0) expect(nonCore.slice(firstIso).every((e) => e.type !== 'kraft' && e.type !== 'grunduebung')).toBe(true);
      const coreIdx = ex.findIndex((e) => e.primaryMuscle === 'bauch');
      if (coreIdx >= 0) expect(ex.slice(coreIdx).every((e) => e.primaryMuscle === 'bauch')).toBe(true);
    }
  });

  it('Neugenerierung eines einzelnen Tages lässt andere Tage unverändert', () => {
    const inp = input({ frequency: 3, weekdays: [0, 2, 4], experience: 'fortgeschritten' });
    const r = generatePlan(inp, pool, NOW);
    const before = JSON.stringify([r.plan.days[0], r.plan.days[2]]);
    const { day } = regenerateDay(r.plan, 1, inp, pool, 1);
    const plan = { ...r.plan, days: r.plan.days.map((d, i) => (i === 1 ? day : d)) };
    expect(JSON.stringify([plan.days[0], plan.days[2]])).toBe(before);
    expect(day.id).toBe(r.plan.days[1].id);
    expect(day.exercises.length).toBeGreaterThan(0);
  });

  it('Änderung eines generierten Plans bleibt erhalten (bearbeitbar)', () => {
    const r = generatePlan(input({}), pool, NOW);
    const edited = { ...r.plan, name: 'Mein Plan', days: r.plan.days.map((d, i) => (i === 0 ? { ...d, exercises: d.exercises.slice(1) } : d)) };
    expect(edited.days[0].exercises.length).toBe(r.plan.days[0].exercises.length - 1);
    expect(edited.days[1]).toEqual(r.plan.days[1]);
  });

  it('Speichern und Wiederherstellen eines Plans (Serialisierung + Validierung)', () => {
    const r = generatePlan(input({ frequency: 4, weekdays: [0, 1, 3, 4] }), pool, NOW);
    const data = { ...emptyData(), plans: [r.plan], activePlanId: r.plan.id };
    const restored = sanitizeAppData(JSON.parse(JSON.stringify(data))).data;
    expect(restored.plans[0].days).toEqual(r.plan.days);
    expect(restored.activePlanId).toBe(r.plan.id);
  });

  it('Split-Vorschlag nutzt nur gewählte Muskeln und füllt leere Tage', () => {
    const s = suggestSplit(input({ frequency: 4, weekdays: [0, 1, 3, 4], muscles: ['brust', 'ruecken'] }));
    expect(s.days.every((d) => d.muscles.length > 0)).toBe(true);
    expect(s.days.flatMap((d) => d.muscles).every((m) => ['brust', 'ruecken'].includes(m))).toBe(true);
    const full = suggestSplit(input({ frequency: 2, weekdays: [0, 3], muscles: TRAINABLE_MUSCLES }));
    expect(full.days[0].muscles.length).toBe(TRAINABLE_MUSCLES.length);
  });
});
