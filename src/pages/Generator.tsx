import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Info, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import type { Equipment, EquipmentPreset, Experience, GeneratorDayInput, GeneratorInput, MuscleGroup, TrainingGoal, Weekday, WorkoutPlan } from '../types';
import { Field, SmartImage } from '../components/ui';
import { PlanDaysEditor } from '../components/PlanDaysEditor';
import { useApp, useExercises, savePlan, setActivePlan } from '../store/appStore';
import { toast } from '../store/uiStore';
import {
  DURATIONS,
  defaultGeneratorInput,
  estimateMinutes,
  generatePlan,
  isInputComplete,
  overlapWarnings,
  regenerateDay,
  resolveEquipment,
  suggestSplit,
  validateInput,
  type GeneratorResult,
} from '../services/generator';
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  EQUIPMENT_PRESET_LABEL,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  MUSCLE_COVER,
  MUSCLE_LABEL,
  TRAINABLE_MUSCLES,
  WEEKDAYS,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
} from '../data/labels';
import { gsap, prefersReducedMotion } from '../animations/gsap';
import { uid } from '../utils';

const STEPS = ['Ziel', 'Erfahrung', 'Häufigkeit', 'Muskelgruppen', 'Aufteilung', 'Dauer', 'Ausrüstung', 'Plan'];

const GOAL_TEXT: Record<TrainingGoal, string> = {
  muskelaufbau: 'Mittlere Wiederholungsbereiche (6–15), moderate Pausen, ausreichend Volumen pro Muskelgruppe.',
  maximalkraft: 'Schwere Grundübungen mit wenigen Wiederholungen (3–6) und langen Pausen, ergänzt durch Zusatzübungen.',
  fitness: 'Ausgewogene Belastung mit 10–15 Wiederholungen und kürzeren Pausen.',
  grundlagen: 'Gut erlernbare Übungen, geringeres Volumen, Fokus auf saubere Technik.',
};
const EXP_TEXT: Record<Experience, string> = {
  anfaenger: 'Weniger als ca. 6 Monate regelmäßiges Training. Übersichtlicher Plan, einfache Übungen.',
  fortgeschritten: 'Ca. 6 Monate bis 2 Jahre Erfahrung. Mehr Variation, freie Grundübungen.',
  erfahren: 'Mehrjährige Erfahrung. Höheres Volumen und anspruchsvolle Übungen möglich.',
};

function OptionCard({ selected, onClick, title, text, icon }: { selected: boolean; onClick: () => void; title: string; text?: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`card relative flex min-h-[110px] flex-col items-start p-5 text-left transition ${selected ? 'border-accent bg-accent/[0.07] ring-1 ring-accent' : 'hover:border-fg/25'}`}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-fg" aria-hidden="true">
          <Check size={14} />
        </span>
      )}
      {icon}
      <span className="pr-8 text-lg font-bold">{title}</span>
      {text && <span className="mt-1 text-sm text-muted">{text}</span>}
    </button>
  );
}

function Warnings({ items }: { items: { level: 'info' | 'warn'; message: string }[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2" aria-live="polite">
      {items.map((w, i) => (
        <li key={i} className={`flex gap-2.5 rounded-xl p-3 text-sm ${w.level === 'warn' ? 'bg-danger/10 text-danger' : 'bg-fg/5 text-muted'}`}>
          {w.level === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
          {w.message}
        </li>
      ))}
    </ul>
  );
}

export default function Generator() {
  const pool = useExercises();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const preferred = useApp((s) => s.settings.preferredEquipment);
  const [input, setInput] = useState<GeneratorInput>(() => {
    const d = defaultGeneratorInput();
    return preferred.length ? { ...d, equipmentPreset: 'individuell', equipment: preferred } : d;
  });
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [variants, setVariants] = useState<Record<string, number>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef(1);

  const set = <K extends keyof GeneratorInput>(k: K, v: GeneratorInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  useEffect(() => {
    if (!stageRef.current || prefersReducedMotion()) return;
    gsap.fromTo(stageRef.current, { opacity: 0, x: 40 * dirRef.current }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const suggestion = useMemo(() => suggestSplit(input), [input]);
  const warnings = useMemo(() => validateInput(input), [input]);

  // Manuelle Verteilung mit dem Vorschlag vorbelegen bzw. an geänderte Wochentage anpassen
  const manualDays: GeneratorDayInput[] = useMemo(() => {
    const sorted = [...input.weekdays].sort((a, b) => a - b);
    return sorted.map((w) => input.days.find((d) => d.weekday === w) ?? suggestion.days.find((d) => d.weekday === w) ?? { weekday: w, name: 'Training', muscles: [] });
  }, [input.weekdays, input.days, suggestion.days]);

  const stepValid = (s: number): boolean => {
    if (s === 2) return input.weekdays.length === input.frequency && input.frequency > 0;
    if (s === 3) return input.muscles.length > 0;
    if (s === 4) return input.splitMode === 'auto' || manualDays.every((d) => d.muscles.length > 0);
    if (s === 6) return resolveEquipment(input).length > 0;
    return true;
  };

  const go = (to: number) => {
    dirRef.current = to > step ? 1 : -1;
    setStep(to);
  };

  const generate = () => {
    const finalInput: GeneratorInput = { ...input, days: input.splitMode === 'manuell' ? manualDays : [] };
    setInput(finalInput);
    const r = generatePlan(finalInput, pool);
    r.plan.id = uid('plan-');
    setResult(r);
    setPlan(r.plan);
    setVariants({});
    go(7);
  };

  const regenerate = (dayIndex: number) => {
    if (!plan || !result) return;
    const day = plan.days[dayIndex];
    const v = (variants[day.id] ?? 0) + 1;
    const r = regenerateDay(plan, dayIndex, input, pool, v);
    setVariants((x) => ({ ...x, [day.id]: v }));
    setPlan({ ...plan, days: plan.days.map((d, i) => (i === dayIndex ? r.day : d)) });
    toast(`${day.name} neu generiert – andere Tage unverändert.`);
  };

  const accept = (openEditor: boolean) => {
    if (!plan) return;
    if (!plan.name.trim()) {
      toast('Bitte einen Namen für den Plan vergeben.', 'error');
      return;
    }
    savePlan(plan);
    setActivePlan(plan.id);
    toast(`„${plan.name}“ gespeichert und als aktiver Plan festgelegt.`);
    navigate(openEditor ? `/plaene/${plan.id}` : '/plaene');
  };

  const toggleWeekday = (w: Weekday) => set('weekdays', input.weekdays.includes(w) ? input.weekdays.filter((x) => x !== w) : [...input.weekdays, w].sort((a, b) => a - b));
  const toggleMuscle = (m: MuscleGroup) => set('muscles', input.muscles.includes(m) ? input.muscles.filter((x) => x !== m) : [...input.muscles, m]);
  const setManualMuscles = (weekday: Weekday, muscles: MuscleGroup[]) =>
    set(
      'days',
      manualDays.map((d) => (d.weekday === weekday ? { ...d, muscles } : d)),
    );

  return (
    <div className="page">
      <Link to="/plaene" className="btn-ghost -ml-3 mb-4">
        <ArrowLeft size={16} aria-hidden="true" /> Trainingspläne
      </Link>
      <header className="mb-8">
        <p className="eyebrow mb-2">
          <Sparkles size={14} className="mr-1 inline" aria-hidden="true" />
          Trainingsplan-Generator
        </p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{step < 7 ? STEPS[step] : 'Dein Plan-Vorschlag'}</h1>
      </header>

      {/* Fortschritt */}
      <nav aria-label="Schritte" className="mb-8">
        <ol className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                type="button"
                disabled={i > step || (i === 7 && !result)}
                onClick={() => go(i)}
                className="group w-full text-left disabled:cursor-default"
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Schritt ${i + 1}: ${s}${i < step ? ' (erledigt)' : ''}`}
              >
                <span className={`block h-1.5 rounded-full transition-colors duration-500 ${i <= step ? 'bg-accent' : 'bg-fg/10'}`} />
                <span className={`mt-2 hidden text-xs font-semibold md:block ${i === step ? 'text-fg' : 'text-muted'}`}>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div ref={stageRef}>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(GOAL_LABEL) as TrainingGoal[]).map((g) => (
              <OptionCard key={g} selected={input.goal === g} onClick={() => set('goal', g)} title={GOAL_LABEL[g]} text={GOAL_TEXT[g]} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((x) => (
              <OptionCard key={x} selected={input.experience === x} onClick={() => set('experience', x)} title={EXPERIENCE_LABEL[x]} text={EXP_TEXT[x]} />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <fieldset>
              <legend className="label">Wie oft pro Woche?</legend>
              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" className="chip min-h-[48px] px-5 text-base" aria-pressed={input.frequency === n} onClick={() => set('frequency', n)}>
                    {n} Tage
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">
                An welchen Tagen? ({input.weekdays.length} von {input.frequency} gewählt)
              </legend>
              <div className="grid grid-cols-7 gap-1.5 sm:max-w-xl">
                {WEEKDAYS.map((w) => (
                  <button key={w} type="button" aria-pressed={input.weekdays.includes(w)} aria-label={WEEKDAY_LABEL[w]} onClick={() => toggleWeekday(w)} className={`flex h-14 flex-col items-center justify-center rounded-xl text-sm font-bold transition ${input.weekdays.includes(w) ? 'bg-accent text-accent-fg' : 'bg-elevated text-muted hover:text-fg'}`}>
                    {WEEKDAY_SHORT[w]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">
                Ruhetage:{' '}
                {WEEKDAYS.filter((w) => !input.weekdays.includes(w))
                  .map((w) => WEEKDAY_SHORT[w])
                  .join(', ') || 'keine'}
              </p>
            </fieldset>
            <Warnings items={warnings.filter((w) => /Trainingstage pro Woche/.test(w.message))} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => set('muscles', [...TRAINABLE_MUSCLES])}>
                Alle auswählen
              </button>
              <button type="button" className="btn-ghost" onClick={() => set('muscles', [])}>
                Auswahl leeren
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {TRAINABLE_MUSCLES.map((m) => {
                const on = input.muscles.includes(m);
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => toggleMuscle(m)} className={`group relative overflow-hidden rounded-2xl text-left transition ${on ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100'}`}>
                    <SmartImage src={`exercises/${MUSCLE_COVER[m]}/1.jpg`} alt="" className="aspect-[4/3]" imgClassName={`transition duration-500 group-hover:scale-105 ${on ? '' : 'grayscale'}`} />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
                    <span className="absolute bottom-3 left-3 font-bold text-white">{MUSCLE_LABEL[m]}</span>
                    <span className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full ${on ? 'bg-accent text-accent-fg' : 'border-2 border-white/60'}`} aria-hidden="true">
                      {on && <Check size={16} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <Warnings items={warnings.filter((w) => /Muskelgruppe/.test(w.message))} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard selected={input.splitMode === 'auto'} onClick={() => set('splitMode', 'auto')} title="Automatischer Vorschlag" text="GymBase verteilt die gewählten Muskelgruppen sinnvoll auf deine Trainingstage." icon={<Wand2 size={22} className="mb-3 text-accent" aria-hidden="true" />} />
              <OptionCard
                selected={input.splitMode === 'manuell'}
                onClick={() => {
                  setInput((i) => ({ ...i, splitMode: 'manuell', days: manualDays }));
                }}
                title="Manuelle Verteilung"
                text="Du entscheidest selbst, welche Muskelgruppen an welchem Tag trainiert werden."
              />
            </div>
            {input.splitMode === 'auto' ? (
              <div className="card p-5">
                <p className="eyebrow mb-1">Vorschlag</p>
                <h2 className="text-xl font-extrabold">{suggestion.splitName}</h2>
                <p className="mt-1 text-sm text-muted">{suggestion.explanation}</p>
                <ul className="mt-4 space-y-2">
                  {suggestion.days.map((d) => (
                    <li key={d.weekday} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-fg/5 px-4 py-3 text-sm">
                      <span className="w-24 font-bold">{WEEKDAY_LABEL[d.weekday]}</span>
                      <span className="font-semibold text-accent">{d.name}</span>
                      <span className="text-muted">{d.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-secondary mt-4" onClick={() => setInput((i) => ({ ...i, splitMode: 'manuell', days: suggestion.days }))}>
                  Vorschlag bearbeiten
                </button>
                <div className="mt-4">
                  <Warnings items={[...suggestion.warnings, ...overlapWarnings(suggestion.days)]} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {manualDays.map((d) => (
                  <div key={d.weekday} className="card p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="w-24 font-bold">{WEEKDAY_LABEL[d.weekday]}</span>
                      <label className="sr-only" htmlFor={`dn-${d.weekday}`}>
                        Bezeichnung {WEEKDAY_LABEL[d.weekday]}
                      </label>
                      <input
                        id={`dn-${d.weekday}`}
                        className="input h-10 min-h-0 max-w-xs"
                        value={d.name}
                        maxLength={40}
                        onChange={(e) => set('days', manualDays.map((x) => (x.weekday === d.weekday ? { ...x, name: e.target.value } : x)))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Muskelgruppen ${WEEKDAY_LABEL[d.weekday]}`}>
                      {input.muscles.map((m) => (
                        <button key={m} type="button" className="chip min-h-[34px] text-xs" aria-pressed={d.muscles.includes(m)} onClick={() => setManualMuscles(d.weekday, d.muscles.includes(m) ? d.muscles.filter((x) => x !== m) : [...d.muscles, m])}>
                          {MUSCLE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                    {d.muscles.length === 0 && <p className="mt-2 text-xs text-danger">Bitte mindestens eine Muskelgruppe zuordnen.</p>}
                  </div>
                ))}
                {(() => {
                  const unassigned = input.muscles.filter((m) => !manualDays.some((d) => d.muscles.includes(m)));
                  return (
                    <Warnings
                      items={[
                        ...(unassigned.length ? [{ level: 'info' as const, message: `Noch keinem Tag zugeordnet: ${unassigned.map((m) => MUSCLE_LABEL[m]).join(', ')}.` }] : []),
                        ...overlapWarnings(manualDays),
                      ]}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <fieldset>
            <legend className="label">Verfügbare Zeit pro Einheit (optional)</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip min-h-[48px] px-5" aria-pressed={input.durationMin === null} onClick={() => set('durationMin', null)}>
                Keine Angabe
              </button>
              {DURATIONS.map((d) => (
                <button key={d} type="button" className="chip min-h-[48px] px-5" aria-pressed={input.durationMin === d} onClick={() => set('durationMin', d)}>
                  <Clock size={14} aria-hidden="true" /> {d} Minuten
                </button>
              ))}
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted">Die Zeit beeinflusst Anzahl der Übungen, Sätze und Pausen. Die angezeigte Dauer ist eine Schätzung – tatsächliche Zeiten hängen von Aufwärmen, Gerätewechseln und Tagesform ab.</p>
          </fieldset>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(EQUIPMENT_PRESET_LABEL) as EquipmentPreset[]).map((p) => (
                <OptionCard key={p} selected={input.equipmentPreset === p} onClick={() => setInput((i) => ({ ...i, equipmentPreset: p, equipment: p === 'individuell' && i.equipment.length === 0 ? [...EQUIPMENT] : i.equipment }))} title={EQUIPMENT_PRESET_LABEL[p]} />
              ))}
            </div>
            {input.equipmentPreset === 'individuell' && (
              <fieldset>
                <legend className="label">Verfügbare Geräte</legend>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map((e: Equipment) => (
                    <button key={e} type="button" className="chip" aria-pressed={input.equipment.includes(e)} onClick={() => set('equipment', input.equipment.includes(e) ? input.equipment.filter((x) => x !== e) : [...input.equipment, e])}>
                      {EQUIPMENT_LABEL[e]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <p className="text-sm text-muted">Berücksichtigt: {resolveEquipment(input).map((e) => EQUIPMENT_LABEL[e]).join(', ') || '–'}. Übungen mit nicht verfügbarem Equipment werden ausgeschlossen.</p>
            <Warnings items={warnings.filter((w) => /Trainingsgerät/.test(w.message))} />
          </div>
        )}

        {step === 7 && result && plan && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="card p-5 lg:col-span-2">
                <p className="eyebrow mb-1">{result.splitName}</p>
                <p className="text-sm text-muted">{result.explanation}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted">Ziel</dt>
                    <dd className="font-semibold">{GOAL_LABEL[input.goal]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Erfahrung</dt>
                    <dd className="font-semibold">{EXPERIENCE_LABEL[input.experience]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Trainingstage</dt>
                    <dd className="font-semibold">{plan.days.map((d) => (d.weekday !== null ? WEEKDAY_SHORT[d.weekday] : '?')).join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Ruhetage</dt>
                    <dd className="font-semibold">{result.restDays.map((d) => WEEKDAY_SHORT[d]).join(', ') || 'keine'}</dd>
                  </div>
                </dl>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {plan.days.map((d) => (
                    <li key={d.id} className="tag">
                      {d.name}: ca. {estimateMinutes(d.exercises)} min
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Dauer = Schätzung inkl. Aufwärmen, keine Garantie.</p>
              </div>
              <div className="card space-y-3 p-5">
                <Field label="Name des Plans" htmlFor="gen-name">
                  <input id="gen-name" className="input" value={plan.name} maxLength={80} onChange={(e) => setPlan({ ...plan, name: e.target.value })} />
                </Field>
                <button type="button" className="btn-primary w-full" onClick={() => accept(false)}>
                  <Check size={16} aria-hidden="true" /> Plan übernehmen
                </button>
                <button type="button" className="btn-secondary w-full" onClick={() => accept(true)}>
                  Speichern & im Editor öffnen
                </button>
                <button type="button" className="btn-ghost w-full" onClick={() => go(4)}>
                  Andere Aufteilung wählen
                </button>
              </div>
            </div>
            <Warnings items={result.warnings} />
            <PlanDaysEditor
              plan={plan}
              onChange={setPlan}
              dayActions={(_d, i) => (
                <button type="button" className="btn-ghost h-9 min-h-0" onClick={() => regenerate(i)} title="Nur diesen Tag neu generieren">
                  <RefreshCw size={15} aria-hidden="true" /> Tag neu generieren
                </button>
              )}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 7 && (
        <div className="mt-10 flex items-center justify-between gap-3 border-t hairline pt-6">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => go(step - 1)}>
            <ArrowLeft size={16} aria-hidden="true" /> Zurück
          </button>
          {step < 6 ? (
            <button type="button" className="btn-primary" disabled={!stepValid(step)} onClick={() => go(step + 1)}>
              Weiter <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!stepValid(6) || !isInputComplete({ ...input, days: manualDays })} onClick={generate}>
              <Sparkles size={16} aria-hidden="true" /> Plan generieren
            </button>
          )}
        </div>
      )}
    </div>
  );
}
