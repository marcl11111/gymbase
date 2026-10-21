import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ClipboardList, Flag, History, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Timer, Trophy, X } from 'lucide-react';
import type { SessionExercise, WorkoutSession } from '../types';
import { EmptyState, Modal, NumberInput, PageHeader, SmartImage } from '../components/ui';
import { AnimatedLogo } from '../components/Logo';
import { ExercisePicker } from '../components/PlanDaysEditor';
import { buildSessionFromDay, discardActiveSession, finishActiveSession, findExercise, startSession, updateActiveSession, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { detectNewRecords, lastPerformance, sessionDurationMs, sessionSetCount, sessionVolume, type NewRecord } from '../services/stats';
import { nextTraining } from '../services/schedule';
import { MUSCLE_LABEL, WEEKDAY_SHORT } from '../data/labels';
import { formatClock, formatDate, formatDuration, formatWeight, fromDisplayWeight, toDisplayWeight } from '../utils';
import { gsap, prefersReducedMotion } from '../animations/gsap';

// ---------- Hilfen ----------

function elapsedMs(s: WorkoutSession, now: number): number {
  const pausedExtra = s.pausedAt ? now - Date.parse(s.pausedAt) : 0;
  return Math.max(0, now - Date.parse(s.startedAt) - s.pausedMs - pausedExtra);
}

function useNow(interval = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* Audio nicht verfügbar */
  }
}

// ---------- Pausentimer ----------

interface RestState {
  total: number;
  endAt: number | null; // läuft
  remaining: number; // pausiert
}

function RestTimer({ rest, setRest }: { rest: RestState | null; setRest: (r: RestState | null) => void }) {
  const now = useNow(250);
  const ringRef = useRef<SVGCircleElement>(null);
  const firedRef = useRef(false);
  const remaining = rest ? (rest.endAt ? Math.max(0, (rest.endAt - now) / 1000) : rest.remaining) : 0;

  useEffect(() => {
    if (!rest) return;
    if (rest.endAt && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      beep();
      toast('Pause vorbei – weiter geht’s!', 'info');
    }
    if (remaining > 0) firedRef.current = false;
  }, [remaining, rest]);

  if (!rest) return null;
  const pct = rest.total ? Math.min(1, remaining / rest.total) : 0;
  const C = 2 * Math.PI * 26;
  const running = rest.endAt !== null;
  return (
    <div className="card fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 p-3 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[360px] lg:bottom-6" role="timer" aria-label="Pausentimer">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="5" />
        <circle ref={ringRef} cx="32" cy="32" r="26" fill="none" stroke="rgb(var(--accent))" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{remaining <= 0 ? 'Pause beendet' : running ? 'Pause' : 'Pausiert'}</p>
        <p className="font-display text-3xl font-extrabold tabular-nums" aria-live="off">
          {formatClock(Math.ceil(remaining))}
        </p>
      </div>
      <div className="flex gap-1">
        {remaining > 0 && (
          <button
            type="button"
            className="icon-btn"
            aria-label={running ? 'Pausentimer anhalten' : 'Pausentimer fortsetzen'}
            onClick={() => setRest(running ? { ...rest, endAt: null, remaining } : { ...rest, endAt: Date.now() + remaining * 1000 })}
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Pausentimer zurücksetzen" onClick={() => setRest({ ...rest, endAt: Date.now() + rest.total * 1000, remaining: rest.total })}>
          <RotateCcw size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="15 Sekunden hinzufügen" onClick={() => setRest(rest.endAt ? { ...rest, total: rest.total + 15, endAt: rest.endAt + 15000 } : { ...rest, total: rest.total + 15, remaining: remaining + 15 })}>
          <span className="text-xs font-bold">+15</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Pausentimer schließen" onClick={() => setRest(null)}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Startansicht ----------

function StartView() {
  const plans = useApp((s) => s.plans);
  const activePlanId = useApp((s) => s.activePlanId);
  const sessions = useApp((s) => s.sessions);
  const [params] = useSearchParams();
  const [planId, setPlanId] = useState(params.get('plan') ?? activePlanId ?? plans[0]?.id ?? '');
  const plan = plans.find((p) => p.id === planId);
  const next = nextTraining(plan, sessions);

  const start = (dayId: string | null) => {
    const day = plan?.days.find((d) => d.id === dayId) ?? null;
    startSession(buildSessionFromDay(dayId ? plan ?? null : null, day));
    toast(day ? `Training „${day.name}“ gestartet.` : 'Freies Training gestartet.');
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Trainingsmodus" title="Training starten" text="Wähle einen Trainingstag aus einem gespeicherten Plan oder starte ein freies Training." />
      {plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={26} />}
          title="Noch kein Trainingsplan"
          text="Für ein geführtes Training brauchst du einen Plan. Alternativ kannst du ein freies Training starten und Übungen spontan hinzufügen."
          action={{ label: 'Plan erstellen', to: '/plaene' }}
        />
      ) : (
        <div className="space-y-6">
          <div className="max-w-md">
            <label className="label" htmlFor="tr-plan">
              Trainingsplan
            </label>
            <select id="tr-plan" className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan?.days.map((d) => {
              const isNext = next?.day.id === d.id;
              return (
                <li key={d.id} className={`card flex flex-col p-5 ${isNext ? 'ring-1 ring-accent/60' : ''}`}>
                  {isNext && <span className="mb-2 self-start rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg">Als Nächstes</span>}
                  <h2 className="text-lg font-bold">
                    {d.weekday !== null && <span className="mr-2 text-accent">{WEEKDAY_SHORT[d.weekday]}</span>}
                    {d.name}
                  </h2>
                  <p className="mb-4 mt-1 line-clamp-2 text-sm text-muted">{d.exercises.map((e) => findExercise(e.exerciseId)?.name).filter(Boolean).join(' · ') || 'Keine Übungen'}</p>
                  <button type="button" className="btn-primary mt-auto" disabled={d.exercises.length === 0} onClick={() => start(d.id)}>
                    <Play size={16} aria-hidden="true" /> Starten
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-8">
        <button type="button" className="btn-secondary" onClick={() => start(null)}>
          <Plus size={16} aria-hidden="true" /> Freies Training starten
        </button>
      </div>
    </div>
  );
}

// ---------- Satzzeile ----------

function SetRow({ ex, exIdx, si, onDone }: { ex: SessionExercise; exIdx: number; si: number; onDone: (done: boolean) => void }) {
  const unit = useApp((s) => s.settings.unit);
  const set = ex.sets[si];
  const rowRef = useRef<HTMLLIElement>(null);
  const update = (patch: Partial<typeof set>) =>
    updateActiveSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i === exIdx ? { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) } : e)),
    }));
  const target = set.targetRepsMin === set.targetRepsMax ? `${set.targetRepsMin}` : `${set.targetRepsMin}–${set.targetRepsMax}`;
  return (
    <li ref={rowRef} className={`grid grid-cols-[32px_1fr_1fr_52px] items-center gap-2 rounded-xl px-2 py-2 transition-colors ${set.done ? 'bg-accent/10' : ''}`}>
      <span className="text-center text-sm font-bold text-muted">{si + 1}</span>
      <NumberInput ariaLabel={`Satz ${si + 1} Gewicht in ${unit}`} allowEmpty step={0.5} value={toDisplayWeight(set.weight, unit)} min={0} max={2000} onChange={(v) => update({ weight: fromDisplayWeight(v, unit) })} className="h-12" />
      <div className="relative">
        <NumberInput ariaLabel={`Satz ${si + 1} Wiederholungen, Ziel ${target}`} allowEmpty value={set.reps} min={0} max={999} onChange={(v) => update({ reps: v })} className="h-12" />
        {set.reps === null && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted/70">Ziel {target}</span>}
      </div>
      <button
        type="button"
        aria-pressed={set.done}
        aria-label={set.done ? `Satz ${si + 1} als offen markieren` : `Satz ${si + 1} abhaken`}
        onClick={() => {
          const done = !set.done;
          // Leere Wiederholungen beim Abhaken mit dem Zielwert füllen
          update({ done, reps: done && set.reps === null ? set.targetRepsMax : set.reps });
          if (done && rowRef.current && !prefersReducedMotion()) gsap.fromTo(rowRef.current, { scale: 0.97 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
          onDone(done);
        }}
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition ${set.done ? 'bg-accent text-accent-fg' : 'border-2 hairline text-muted hover:text-fg'}`}
      >
        <Check size={22} />
      </button>
    </li>
  );
}

// ---------- Aktive Einheit ----------

function ActiveView({ session, onFinished }: { session: WorkoutSession; onFinished: (d: { s: WorkoutSession; records: NewRecord[] }) => void }) {
  const sessions = useApp((s) => s.sessions);
  const unit = useApp((s) => s.settings.unit);
  const defaultRest = useApp((s) => s.settings.defaultRestSec);
  const now = useNow(1000);
  const [rest, setRest] = useState<RestState | null>(null);
  const [picker, setPicker] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dir = useRef(1);

  const idx = Math.min(session.currentIndex, Math.max(0, session.exercises.length - 1));
  const ex = session.exercises[idx];
  const meta = ex ? findExercise(ex.exerciseId) : undefined;
  const last = ex ? lastPerformance(sessions, ex.exerciseId) : null;
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const progress = totalSets ? doneSets / totalSets : 0;
  const paused = session.status === 'pausiert';

  useEffect(() => {
    if (barRef.current) gsap.to(barRef.current, { scaleX: progress, duration: prefersReducedMotion() ? 0 : 0.6, ease: 'power3.out' });
  }, [progress]);

  useEffect(() => {
    if (cardRef.current && !prefersReducedMotion()) gsap.fromTo(cardRef.current, { opacity: 0, x: 30 * dir.current }, { opacity: 1, x: 0, duration: 0.35, clearProps: 'transform' });
  }, [idx]);

  const goTo = (i: number) => {
    dir.current = i > idx ? 1 : -1;
    updateActiveSession((s) => ({ ...s, currentIndex: Math.max(0, Math.min(s.exercises.length - 1, i)) }));
  };

  const togglePause = () => {
    updateActiveSession((s) =>
      s.status === 'pausiert'
        ? { ...s, status: 'aktiv', pausedMs: s.pausedMs + (s.pausedAt ? Date.now() - Date.parse(s.pausedAt) : 0), pausedAt: null }
        : { ...s, status: 'pausiert', pausedAt: new Date().toISOString() },
    );
    if (rest?.endAt) setRest({ ...rest, endAt: null, remaining: Math.max(0, (rest.endAt - Date.now()) / 1000) });
  };

  const finish = async () => {
    const open = totalSets - doneSets;
    if (doneSets === 0) {
      const ok = await confirmDialog({ title: 'Keine Sätze abgehakt', message: 'Du hast noch keinen Satz abgehakt. Möchtest du das Training trotzdem beenden und speichern?', confirmLabel: 'Trotzdem speichern' });
      if (!ok) return;
    } else if (open > 0) {
      const ok = await confirmDialog({ title: 'Training beenden?', message: `${open} ${open === 1 ? 'Satz ist' : 'Sätze sind'} noch offen. Nur abgehakte Sätze fließen in Statistik und Bestleistungen ein.`, confirmLabel: 'Beenden und speichern' });
      if (!ok) return;
    }
    const done = finishActiveSession();
    setRest(null);
    if (done) onFinished({ s: done, records: detectNewRecords(done, [...sessions, done]) });
  };

  const cancel = async () => {
    const ok = await confirmDialog({ title: 'Training verwerfen?', message: 'Alle Eingaben dieser Einheit werden gelöscht und nicht in der Historie gespeichert.', confirmLabel: 'Verwerfen', danger: true });
    if (ok) {
      discardActiveSession();
      setRest(null);
      toast('Training verworfen.', 'info');
    }
  };

  const changeSets = (delta: 1 | -1) =>
    updateActiveSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== idx) return e;
        if (delta === -1) return e.sets.length > 1 ? { ...e, sets: e.sets.slice(0, -1) } : e;
        const tpl = e.sets[e.sets.length - 1] ?? { targetRepsMin: 8, targetRepsMax: 12, targetWeight: null, reps: null, weight: null, done: false };
        return { ...e, sets: [...e.sets, { ...tpl, reps: null, done: false }] };
      }),
    }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-48 pt-4 sm:px-6 lg:pt-8">
      {/* Kopf */}
      <div className="sticky top-14 z-30 -mx-4 mb-5 border-b hairline bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-accent">{session.planName}</p>
            <h1 className="truncate text-lg font-extrabold">{session.dayName || 'Freies Training'}</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className={`mr-1 font-display text-xl font-extrabold tabular-nums ${paused ? 'text-muted' : ''}`} aria-label="Trainingsdauer">
              {formatClock(elapsedMs(session, now) / 1000)}
            </span>
            <button type="button" className="icon-btn border hairline" onClick={togglePause} aria-label={paused ? 'Training fortsetzen' : 'Training pausieren'}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets} aria-label="Fortschritt der Einheit">
          <div ref={barRef} className="h-full origin-left rounded-full bg-accent" style={{ transform: 'scaleX(0)' }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {doneSets} von {totalSets} Sätzen · Übung {session.exercises.length ? idx + 1 : 0} von {session.exercises.length}
        </p>
      </div>

      {paused && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-fg/5 p-4 text-sm">
          <span>Training pausiert – die Zeit läuft nicht weiter.</span>
          <button type="button" className="btn-primary" onClick={togglePause}>
            <Play size={16} aria-hidden="true" /> Fortsetzen
          </button>
        </div>
      )}

      {/* Übungsnavigation */}
      {session.exercises.length > 0 && (
        <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Übungen der Einheit">
          {session.exercises.map((e, i) => {
            const complete = e.sets.length > 0 && e.sets.every((x) => x.done);
            return (
              <button key={i} type="button" role="tab" aria-selected={i === idx} onClick={() => goTo(i)} className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition ${i === idx ? 'bg-fg text-bg' : complete ? 'bg-accent/15 text-accent' : 'bg-elevated text-muted'}`}>
                {complete && <Check size={12} aria-hidden="true" />}
                {i + 1}. {e.exerciseName.length > 22 ? `${e.exerciseName.slice(0, 20)}…` : e.exerciseName}
              </button>
            );
          })}
        </div>
      )}

      {ex ? (
        <div ref={cardRef} className="card overflow-hidden">
          <div className="grid sm:grid-cols-[200px_1fr]">
            <SmartImage src={meta?.imageUrl} alt={ex.exerciseName} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">{MUSCLE_LABEL[ex.primaryMuscle]}</p>
              <h2 className="text-xl font-extrabold">{ex.exerciseName}</h2>
              <p className="mt-1 text-sm text-muted">
                Ziel: {ex.sets.length} × {ex.sets[0]?.targetRepsMin}–{ex.sets[0]?.targetRepsMax}
                {meta?.repUnit === 'sek' ? ' Sek.' : meta?.repUnit === 'm' ? ' m' : ' Wdh.'}
                {ex.sets[0]?.targetWeight ? ` · ${formatWeight(ex.sets[0].targetWeight, unit)}` : ''} · Pause {ex.restSec} s
              </p>
              {ex.notes && <p className="mt-2 rounded-lg bg-fg/5 px-3 py-2 text-xs">{ex.notes}</p>}
              <div className="mt-3 flex items-start gap-2 text-xs text-muted">
                <History size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {last ? (
                  <span>
                    Zuletzt ({formatDate(last.date, { day: '2-digit', month: '2-digit' })}): {last.sets.map((s) => `${toDisplayWeight(s.weight, unit) ?? 0}×${s.reps}`).join(', ')} {unit}
                  </span>
                ) : (
                  <span>Noch keine dokumentierte Leistung.</span>
                )}
              </div>
              {meta && (
                <Link to={`/uebungen/${encodeURIComponent(meta.id)}`} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
                  Technik & Fotoanleitung ansehen
                </Link>
              )}
            </div>
          </div>
          <div className="border-t hairline p-3 sm:p-4">
            <div className="grid grid-cols-[32px_1fr_1fr_52px] gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span className="text-center">Satz</span>
              <span className="text-center">Gewicht ({unit})</span>
              <span className="text-center">{meta?.repUnit === 'sek' ? 'Sekunden' : meta?.repUnit === 'm' ? 'Meter' : 'Wdh.'}</span>
              <span className="text-center">✓</span>
            </div>
            <ol className="space-y-1">
              {ex.sets.map((_, si) => (
                <SetRow
                  key={`${idx}-${si}`}
                  ex={ex}
                  exIdx={idx}
                  si={si}
                  onDone={(done) => {
                    if (!done) return;
                    const restSec = ex.restSec || defaultRest;
                    const allDone = ex.sets.every((x, j) => (j === si ? true : x.done));
                    if (restSec > 0) setRest({ total: restSec, endAt: paused ? null : Date.now() + restSec * 1000, remaining: restSec });
                    if (allDone && idx < session.exercises.length - 1) toast('Übung abgeschlossen. Weiter zur nächsten?', 'success', { label: 'Weiter', run: () => goTo(idx + 1) });
                  }}
                />
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => changeSets(1)}>
                <Plus size={16} aria-hidden="true" /> Satz
              </button>
              <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => changeSets(-1)} disabled={ex.sets.length <= 1}>
                <Minus size={16} aria-hidden="true" /> Satz
              </button>
              <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => setRest({ total: ex.restSec || defaultRest, endAt: Date.now() + (ex.restSec || defaultRest) * 1000, remaining: ex.restSec || defaultRest })}>
                <Timer size={16} aria-hidden="true" /> Pausentimer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon={<Plus size={24} />} title="Noch keine Übung" text="Füge Übungen zu diesem freien Training hinzu." action={{ label: 'Übung hinzufügen', onClick: () => setPicker(true) }} />
      )}

      <div className="mt-4">
        <label htmlFor="ses-notes" className="label">
          Notizen zur Einheit
        </label>
        <textarea id="ses-notes" className="input min-h-[64px] py-2" value={session.notes} onChange={(e) => updateActiveSession((s) => ({ ...s, notes: e.target.value }))} placeholder="z. B. Tagesform, Schlaf, Besonderheiten" />
      </div>

      {/* Fußleiste */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t hairline bg-bg/95 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <button type="button" className="btn-secondary px-3" onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Vorherige Übung">
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Zurück</span>
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost px-3" onClick={() => setPicker(true)} aria-label="Übung hinzufügen">
              <Plus size={18} />
            </button>
            <button type="button" className="btn-ghost px-3 hover:text-danger" onClick={cancel} aria-label="Training verwerfen">
              <X size={18} />
            </button>
            <button type="button" className="btn-primary" onClick={finish}>
              <Flag size={16} aria-hidden="true" /> Beenden
            </button>
          </div>
          <button type="button" className="btn-secondary px-3" onClick={() => goTo(idx + 1)} disabled={idx >= session.exercises.length - 1} aria-label="Nächste Übung">
            <span className="hidden sm:inline">Weiter</span>
            <SkipForward size={18} className="sm:hidden" />
            <ChevronRight size={18} className="hidden sm:block" />
          </button>
        </div>
      </div>

      <RestTimer rest={rest} setRest={setRest} />

      {picker && (
        <Modal open onClose={() => setPicker(false)} title="Übung zur Einheit hinzufügen" size="lg">
          <ExercisePicker
            targetLabel="diese Einheit"
            onAdd={(e) => {
              updateActiveSession((s) => ({
                ...s,
                exercises: [
                  ...s.exercises,
                  {
                    exerciseId: e.id,
                    exerciseName: e.name,
                    primaryMuscle: e.primaryMuscle,
                    restSec: e.recommended.restSec,
                    notes: '',
                    sets: Array.from({ length: e.recommended.sets }, () => ({ targetRepsMin: e.recommended.repsMin, targetRepsMax: e.recommended.repsMax, targetWeight: null, reps: null, weight: null, done: false })),
                  },
                ],
                currentIndex: s.exercises.length,
              }));
              setPicker(false);
              toast(`„${e.name}“ hinzugefügt.`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Summary({ data, onClose }: { data: { s: WorkoutSession; records: NewRecord[] }; onClose: () => void }) {
  const unit = useApp((s) => s.settings.unit);
  const { s, records } = data;
  return (
    <div className="page flex flex-col items-center text-center">
      <AnimatedLogo className="mb-6 w-56" />
      <p className="eyebrow mb-2">Training gespeichert</p>
      <h1 className="text-4xl font-black">Stark gemacht.</h1>
      <p className="mt-2 text-muted">
        {s.dayName || s.planName} · {formatDate(s.startedAt)}
      </p>
      <dl className="mt-8 grid w-full max-w-xl grid-cols-3 gap-3">
        <div className="card p-4">
          <dt className="text-xs text-muted">Dauer</dt>
          <dd className="font-display text-2xl font-extrabold">{formatDuration(sessionDurationMs(s))}</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs text-muted">Sätze</dt>
          <dd className="font-display text-2xl font-extrabold">{sessionSetCount(s)}</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs text-muted">Volumen</dt>
          <dd className="font-display text-2xl font-extrabold">{formatWeight(sessionVolume(s), unit)}</dd>
        </div>
      </dl>
      {records.length > 0 && (
        <div className="card mt-6 w-full max-w-xl p-5 text-left">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Trophy size={18} className="text-accent" aria-hidden="true" /> Neue Bestleistungen
          </h2>
          <ul className="space-y-2 text-sm">
            {records.map((r) => (
              <li key={r.exerciseId} className="flex justify-between gap-3">
                <span>{r.exerciseName}</span>
                <span className="font-semibold tabular-nums">
                  {r.kind === 'gewicht' ? formatWeight(r.value, unit) : `${r.value} Wdh.`}
                  {r.previous !== null && <span className="ml-1 font-normal text-muted">(vorher {r.kind === 'gewicht' ? formatWeight(r.previous, unit) : r.previous})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={onClose}>
          Zum Fortschritt
        </button>
        <Link to="/" className="btn-secondary">
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function Training() {
  const session = useApp((s) => s.activeSession);
  const navigate = useNavigate();
  const [summary, setSummary] = useState<{ s: WorkoutSession; records: NewRecord[] } | null>(null);
  if (summary) return <Summary data={summary} onClose={() => navigate('/fortschritt')} />;
  if (session) return <ActiveView session={session} onFinished={setSummary} />;
  return <StartView />;
}
