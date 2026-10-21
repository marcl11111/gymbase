import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILTIN_EXERCISES } from '../src/data/exercises';
import { EQUIPMENT, MUSCLES } from '../src/data/labels';
import { EMPTY_FILTER, filterExercises, findAlternatives } from '../src/services/exerciseQuery';

describe('Übungsdatenbank', () => {
  it('enthält mindestens 60 Übungen mit eindeutigen IDs', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(BUILTIN_EXERCISES.map((e) => e.id)).size).toBe(BUILTIN_EXERCISES.length);
  });

  it('deckt alle Muskelgruppen und Gerätearten ab', () => {
    for (const m of MUSCLES) expect(BUILTIN_EXERCISES.some((e) => e.primaryMuscle === m), m).toBe(true);
    for (const eq of EQUIPMENT) expect(BUILTIN_EXERCISES.some((e) => e.equipment === eq), eq).toBe(true);
  });

  it('jede Übung hat eine Fotoanleitung mit 2–4 Schritten und vollständigen Texten', () => {
    for (const e of BUILTIN_EXERCISES) {
      expect(e.photoGuide.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.photoGuide.length, e.id).toBeLessThanOrEqual(4);
      e.photoGuide.forEach((s, i) => {
        expect(s.stepNumber).toBe(i + 1);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.description.length).toBeGreaterThan(10);
        expect(s.altText.length).toBeGreaterThan(0);
      });
      expect(e.instructions.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.techniqueTips.length).toBeGreaterThan(0);
      expect(e.commonMistakes.length).toBeGreaterThan(0);
      expect(e.safetyNotes.length).toBeGreaterThan(0);
    }
  });

  it('alle referenzierten Bilddateien existieren lokal', () => {
    for (const e of BUILTIN_EXERCISES) {
      const paths = [e.imageUrl, ...e.photoGuide.map((s) => s.imageUrl)].filter((p): p is string => !!p);
      for (const p of paths) expect(existsSync(resolve(__dirname, '../public', p)), p).toBe(true);
    }
  });

  it('Bilder ohne Foto sind als Platzhalter gekennzeichnet', () => {
    const noPhoto = BUILTIN_EXERCISES.flatMap((e) => e.photoGuide.filter((s) => s.imageUrl === null));
    for (const s of noPhoto) expect(s.description).toMatch(/kein Foto/i);
  });
});

describe('Suche und Filter', () => {
  const all = BUILTIN_EXERCISES;
  it('Suche nach Name', () => {
    const r = filterExercises(all, { ...EMPTY_FILTER, query: 'bankdrücken' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.name.toLowerCase().includes('bankdrücken') || e.name.toLowerCase().includes('bankdruecken'))).toBe(true);
  });
  it('Suche nach Muskelgruppe und Umlaut-tolerant', () => {
    const r = filterExercises(all, { ...EMPTY_FILTER, query: 'gesass' });
    expect(r.some((e) => e.primaryMuscle === 'gesaess')).toBe(true);
  });
  it('kombinierte Filter', () => {
    const r = filterExercises(all, { ...EMPTY_FILTER, muscles: ['brust'], equipment: ['maschine'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.equipment === 'maschine')).toBe(true);
    expect(r.every((e) => e.primaryMuscle === 'brust' || e.secondaryMuscles.includes('brust'))).toBe(true);
    const r2 = filterExercises(all, { ...EMPTY_FILTER, muscles: ['brust'], equipment: ['maschine'], difficulty: ['experte'] });
    expect(r2.length).toBe(0);
  });
  it('leerer Filter liefert alle', () => {
    expect(filterExercises(all, EMPTY_FILTER).length).toBe(all.length);
  });
});

describe('Alternativen-Finder', () => {
  it('liefert für den Latzug Rückenübungen', () => {
    const lat = BUILTIN_EXERCISES.find((e) => e.id === 'Wide-Grip_Lat_Pulldown')!;
    const alts = findAlternatives(lat, BUILTIN_EXERCISES);
    expect(alts.length).toBeGreaterThan(2);
    expect(alts.every((a) => a.exercise.primaryMuscle === 'ruecken')).toBe(true);
    expect(alts.some((a) => a.exercise.pattern === 'vertical_pull')).toBe(true);
  });
  it('berücksichtigt Equipment', () => {
    const lat = BUILTIN_EXERCISES.find((e) => e.id === 'Wide-Grip_Lat_Pulldown')!;
    const alts = findAlternatives(lat, BUILTIN_EXERCISES, { equipment: ['kurzhantel'] });
    expect(alts.every((a) => a.exercise.equipment === 'kurzhantel')).toBe(true);
  });
});
