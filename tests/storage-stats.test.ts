import { beforeEach, describe, expect, it } from 'vitest';
import { emptyData, loadData, sanitizeAppData, saveData, STORAGE_KEY, BACKUP_KEY } from '../src/services/storage';
import { detectNewRecords, estimate1RM, personalRecords, sessionVolume, weeklyBuckets, lastPerformance } from '../src/services/stats';
import { mergeData, parseImport } from '../src/services/backup';
import type { WorkoutSession } from '../src/types';

function session(id: string, date: string, sets: [number, number][], exerciseId = 'Barbell_Squat'): WorkoutSession {
  return {
    id,
    planId: null,
    planName: 'Test',
    dayId: null,
    dayName: '',
    startedAt: date,
    endedAt: date,
    pausedMs: 0,
    pausedAt: null,
    exercises: [
      {
        exerciseId,
        exerciseName: 'Kniebeuge',
        primaryMuscle: 'quadrizeps',
        restSec: 90,
        notes: '',
        sets: sets.map(([weight, reps]) => ({ targetRepsMin: 5, targetRepsMax: 8, targetWeight: null, weight, reps, done: true })),
      },
    ],
    currentIndex: 0,
    notes: '',
    status: 'abgeschlossen',
    unit: 'kg',
  };
}

describe('Speicherung', () => {
  beforeEach(() => localStorage.clear());

  it('speichert und lädt Daten', () => {
    const d = { ...emptyData(), favorites: ['Pushups'] };
    saveData(d);
    expect(loadData().data.favorites).toEqual(['Pushups']);
  });

  it('beschädigtes JSON führt nicht zum Absturz und wird gesichert', () => {
    localStorage.setItem(STORAGE_KEY, '{kaputt');
    const r = loadData();
    expect(r.data).toEqual(emptyData());
    expect(r.warning).toBeTruthy();
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{kaputt');
  });

  it('ungültige Einträge werden übersprungen, gültige bleiben', () => {
    const { data, report } = sanitizeAppData({
      version: 1,
      plans: [{ id: 'p1', name: 'OK', days: [] }, { foo: 'bar' }],
      sessions: [session('s1', '2026-10-01T10:00:00Z', [[100, 5]]), 42],
      settings: { unit: 'lb', defaultRestSec: -5, theme: 'blau' },
    });
    expect(data.plans).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);
    expect(report.skipped.length).toBe(2);
    expect(data.settings.unit).toBe('lb');
    expect(data.settings.defaultRestSec).toBe(0);
    expect(data.settings.theme).toBe('dark');
  });

  it('aktive Einheit bleibt nach Neuladen erhalten', () => {
    const active = { ...session('a1', '2026-10-21T08:00:00Z', [[50, 10]]), status: 'aktiv' as const, endedAt: null };
    saveData({ ...emptyData(), activeSession: active });
    expect(loadData().data.activeSession?.id).toBe('a1');
  });
});

describe('Import/Export', () => {
  it('validiert Importdateien', () => {
    expect(() => parseImport('nicht json')).toThrow();
    expect(() => parseImport('{"x":1}')).toThrow();
    const ok = parseImport(JSON.stringify({ app: 'GymBase', data: { ...emptyData(), favorites: ['A', 'A', 'B'] }, images: { 'idb:x': 'data:image/png;base64,AA', evil: 'x' } }));
    expect(ok.data.favorites).toEqual(['A', 'B']);
    expect(Object.keys(ok.images)).toEqual(['idb:x']);
  });
  it('Zusammenführen behält bestehende Daten', () => {
    const cur = { ...emptyData(), plans: [{ id: 'p1', name: 'Alt', description: '', goal: null, days: [], notes: '', createdAt: '', updatedAt: '' }] };
    const inc = { ...emptyData(), plans: [{ ...cur.plans[0], name: 'Neu' }, { ...cur.plans[0], id: 'p2', name: 'Zusatz' }] };
    const m = mergeData(cur, inc);
    expect(m.plans.map((p) => p.name)).toEqual(['Alt', 'Zusatz']);
  });
});

describe('Statistik', () => {
  const s1 = session('s1', '2026-10-05T10:00:00Z', [[100, 5], [100, 5]]);
  const s2 = session('s2', '2026-10-12T10:00:00Z', [[105, 5], [100, 6]]);

  it('Volumen', () => {
    expect(sessionVolume(s1)).toBe(1000);
  });
  it('Bestleistungen und geschätztes 1RM', () => {
    const pr = personalRecords([s1, s2])[0];
    expect(pr.maxWeight?.value).toBe(105);
    expect(pr.maxReps?.value).toBe(6);
    expect(pr.est1RM?.value).toBeCloseTo(122.5, 1);
    expect(estimate1RM(100, 15)).toBeNull();
  });
  it('erkennt neue Rekorde', () => {
    const rec = detectNewRecords(s2, [s1, s2]);
    expect(rec[0]).toMatchObject({ kind: 'gewicht', value: 105, previous: 100 });
    expect(detectNewRecords(s1, [s1])).toEqual([]);
  });
  it('Wochenbuckets', () => {
    const b = weeklyBuckets([s1, s2], 4, new Date('2026-10-14T12:00:00Z'));
    expect(b).toHaveLength(4);
    expect(b.reduce((a, x) => a + x.sessions, 0)).toBe(2);
  });
  it('letzte Leistung', () => {
    expect(lastPerformance([s1, s2], 'Barbell_Squat')?.sets[0].weight).toBe(105);
  });
});
