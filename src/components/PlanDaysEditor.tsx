/**
 * Gemeinsamer Editor für Trainingstage – genutzt vom manuellen Plan-Editor
 * und von der Vorschau des Generators.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Heart, Library, FolderHeart, Plus, Repeat2, Trash2, X } from 'lucide-react';
import type { Exercise, PlanDay, PlanExercise, Weekday, WorkoutPlan } from '../types';
import { FilterPanel } from './FilterPanel';
import { Field, Modal, NumberInput, SmartImage } from './ui';
import { makePlanExercise, findExercise, newDay, useApp, useExercises } from '../store/appStore';
import { EMPTY_FILTER, filterExercises, findAlternatives, type ExerciseFilter } from '../services/exerciseQuery';
import { estimateMinutes } from '../services/generator';
import { EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL, WEEKDAYS, WEEKDAY_LABEL } from '../data/labels';
import { confirmDialog, toast } from '../store/uiStore';
import { fromDisplayWeight, moveItem, toDisplayWeight, uid } from '../utils';
import { gsap, prefersReducedMotion } from '../animations/gsap';

// ---------- Übungszeile ----------

function ExerciseRow({
  pe,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  onReplace,
  isNew,
}: {
  pe: PlanExercise;
  index: number;
  count: number;
  onChange: (p: PlanExercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  isNew: boolean;
}) {
  const ex = useExercises().find((e) => e.id === pe.exerciseId);
  const unit = useApp((s) => s.settings.unit);
  const [notesOpen, setNotesOpen] = useState(!!pe.notes);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pe.uid });
  const rowRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (isNew && rowRef.current && !prefersReducedMotion()) {
      gsap.fromTo(rowRef.current, { opacity: 0, y: -10, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, clearProps: 'transform' });
    }
  }, [isNew]);

  const style = { transform: CSS.Transform.toString(transform), transition };
  const unitLabel = ex?.repUnit === 'sek' ? 'Sek.' : ex?.repUnit === 'm' ? 'Meter' : 'Wdh.';

  return (
    <li
      ref={(n) => {
        setNodeRef(n);
        rowRef.current = n;
      }}
      style={style}
      className={`rounded-2xl border hairline bg-surface p-3 ${isDragging ? 'relative z-10 shadow-2xl ring-1 ring-accent/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button type="button" className="icon-btn h-10 w-8 cursor-grab touch-none active:cursor-grabbing" aria-label={`${ex?.name ?? 'Übung'} verschieben (Ziehen oder Leertaste + Pfeiltasten)`} {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
        <SmartImage src={ex?.imageUrl} alt="" className="hidden h-12 w-16 shrink-0 rounded-lg sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="mr-2 text-xs font-bold text-muted">{index + 1}.</span>
              {ex ? (
                <Link to={`/uebungen/${encodeURIComponent(ex.id)}`} className="font-semibold hover:underline">
                  {ex.name}
                </Link>
              ) : (
                <span className="font-semibold text-danger">Übung nicht mehr vorhanden</span>
              )}
              {ex && <p className="text-xs text-muted">{MUSCLE_LABEL[ex.primaryMuscle]} · {EQUIPMENT_LABEL[ex.equipment]}</p>}
            </div>
            <div className="flex shrink-0">
              <button type="button" className="icon-btn h-9 w-9" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Nach oben">
                <ArrowUp size={16} />
              </button>
              <button type="button" className="icon-btn h-9 w-9" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Nach unten">
                <ArrowDown size={16} />
              </button>
              <button type="button" className="icon-btn h-9 w-9" onClick={onReplace} aria-label="Übung ersetzen" title="Ersetzen">
                <Repeat2 size={16} />
              </button>
              <button type="button" className="icon-btn h-9 w-9 hover:text-danger" onClick={onRemove} aria-label="Übung entfernen" title="Entfernen">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Field label="Sätze" htmlFor={`${pe.uid}-s`}>
              <NumberInput id={`${pe.uid}-s`} value={pe.sets} min={1} max={20} onChange={(v) => onChange({ ...pe, sets: v ?? 1 })} />
            </Field>
            <Field label={`${unitLabel} von`} htmlFor={`${pe.uid}-r1`}>
              <NumberInput id={`${pe.uid}-r1`} value={pe.repsMin} min={1} max={300} onChange={(v) => onChange({ ...pe, repsMin: v ?? 1, repsMax: Math.max(v ?? 1, pe.repsMax) })} />
            </Field>
            <Field label={`${unitLabel} bis`} htmlFor={`${pe.uid}-r2`}>
              <NumberInput id={`${pe.uid}-r2`} value={pe.repsMax} min={1} max={300} onChange={(v) => onChange({ ...pe, repsMax: Math.max(pe.repsMin, v ?? pe.repsMin) })} />
            </Field>
            <Field label="Pause (s)" htmlFor={`${pe.uid}-p`}>
              <NumberInput id={`${pe.uid}-p`} value={pe.restSec} min={0} max={900} onChange={(v) => onChange({ ...pe, restSec: v ?? 0 })} />
            </Field>
            <Field label={`Zielgew. (${unit})`} htmlFor={`${pe.uid}-w`}>
              <NumberInput id={`${pe.uid}-w`} allowEmpty step={0.5} value={toDisplayWeight(pe.targetWeight, unit)} min={0} max={2000} onChange={(v) => onChange({ ...pe, targetWeight: fromDisplayWeight(v, unit) })} />
            </Field>
          </div>
          {notesOpen ? (
            <div className="mt-2">
              <label htmlFor={`${pe.uid}-n`} className="sr-only">
                Notiz
              </label>
              <input id={`${pe.uid}-n`} className="input" placeholder="Notiz, z. B. Sitzhöhe 4" value={pe.notes} onChange={(e) => onChange({ ...pe, notes: e.target.value })} />
            </div>
          ) : (
            <button type="button" className="mt-2 text-xs font-semibold text-muted hover:text-fg" onClick={() => setNotesOpen(true)}>
              + Notiz hinzufügen
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------- Ersetzen-Dialog ----------

export function ReplaceDialog({ exerciseId, onPick, onClose }: { exerciseId: string; onPick: (id: string) => void; onClose: () => void }) {
  const all = useExercises();
  const ex = all.find((e) => e.id === exerciseId);
  const [query, setQuery] = useState('');
  const alts = useMemo(() => (ex ? findAlternatives(ex, all, { limit: 8 }) : []), [ex, all]);
  const results = useMemo(() => (query.trim() ? filterExercises(all, { ...EMPTY_FILTER, query }).slice(0, 12) : []), [all, query]);
  const list = query.trim() ? results.map((e) => ({ exercise: e, reasons: [] as string[] })) : alts;
  return (
    <Modal open onClose={onClose} title={`„${ex?.name ?? 'Übung'}“ ersetzen`} size="md">
      <label htmlFor="replace-q" className="sr-only">
        Übung suchen
      </label>
      <input id="replace-q" className="input mb-4" placeholder="Andere Übung suchen …" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!query.trim() && <p className="mb-3 text-xs text-muted">Vorschläge mit ähnlicher Zielmuskulatur und Bewegung (nicht biomechanisch identisch):</p>}
      <ul className="space-y-2">
        {list.map(({ exercise: a, reasons }) => (
          <li key={a.id}>
            <button type="button" className="flex w-full items-center gap-3 rounded-xl border hairline p-2 text-left hover:bg-fg/5" onClick={() => onPick(a.id)}>
              <SmartImage src={a.imageUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{a.name}</span>
                <span className="block truncate text-xs text-muted">{reasons[0] ?? `${MUSCLE_LABEL[a.primaryMuscle]} · ${EQUIPMENT_LABEL[a.equipment]}`}</span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted">Keine Treffer.</li>}
      </ul>
    </Modal>
  );
}

// ---------- Übungsauswahl (Bereich A) ----------

type Source = 'alle' | 'favoriten' | `col:${string}`;

export function ExercisePicker({ onAdd, targetLabel }: { onAdd: (ex: Exercise) => void; targetLabel: string }) {
  const all = useExercises();
  const favorites = useApp((s) => s.favorites);
  const collections = useApp((s) => s.collections);
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER);
  const [source, setSource] = useState<Source>('alle');
  const [limit, setLimit] = useState(30);
  const pool = useMemo(() => {
    if (source === 'favoriten') return all.filter((e) => favorites.includes(e.id));
    if (source.startsWith('col:')) {
      const c = collections.find((x) => `col:${x.id}` === source);
      return all.filter((e) => c?.exerciseIds.includes(e.id));
    }
    return all;
  }, [all, favorites, collections, source]);
  const results = useMemo(() => filterExercises(pool, filter), [pool, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quelle">
        <button type="button" className="chip" aria-pressed={source === 'alle'} onClick={() => setSource('alle')}>
          <Library size={14} aria-hidden="true" /> Datenbank
        </button>
        <button type="button" className="chip" aria-pressed={source === 'favoriten'} onClick={() => setSource('favoriten')}>
          <Heart size={14} aria-hidden="true" /> Favoriten ({favorites.length})
        </button>
        {collections.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={source === `col:${c.id}`} onClick={() => setSource(`col:${c.id}`)}>
            <FolderHeart size={14} aria-hidden="true" /> {c.name}
          </button>
        ))}
      </div>
      <FilterPanel compact idPrefix="pick" value={filter} onChange={(f) => { setFilter(f); setLimit(30); }} onReset={() => setFilter(EMPTY_FILTER)} resultCount={results.length} />
      <ul className="space-y-2">
        {results.slice(0, limit).map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-xl border hairline bg-surface p-2">
            <SmartImage src={e.imageUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.name}</p>
              <p className="truncate text-xs text-muted">
                {MUSCLE_LABEL[e.primaryMuscle]} · {EQUIPMENT_LABEL[e.equipment]}
              </p>
            </div>
            <button type="button" className="btn-secondary h-10 min-h-0 px-3" onClick={() => onAdd(e)} aria-label={`${e.name} zu ${targetLabel} hinzufügen`}>
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Hinzufügen</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="rounded-xl bg-fg/5 p-4 text-center text-sm text-muted">{source === 'alle' ? 'Keine Übung gefunden.' : 'Diese Quelle enthält keine passenden Übungen.'}</li>}
      </ul>
      {results.length > limit && (
        <button type="button" className="btn-ghost w-full" onClick={() => setLimit((l) => l + 30)}>
          Weitere anzeigen
        </button>
      )}
    </div>
  );
}

// ---------- Tageseditor ----------

interface DaysEditorProps {
  plan: WorkoutPlan;
  onChange: (p: WorkoutPlan) => void;
  /** Zusätzliche Aktionen je Tag (z. B. „Tag neu generieren“) */
  dayActions?: (day: PlanDay, index: number) => ReactNode;
}

export function PlanDaysEditor({ plan, onChange, dayActions }: DaysEditorProps) {
  const [activeDayId, setActiveDayId] = useState(plan.days[0]?.id ?? '');
  const [replaceFor, setReplaceFor] = useState<{ dayId: string; uid: string; exerciseId: string } | null>(null);
  const [mobileView, setMobileView] = useState<'plan' | 'auswahl'>('plan');
  const [newUids, setNewUids] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    if (!plan.days.some((d) => d.id === activeDayId)) setActiveDayId(plan.days[0]?.id ?? '');
  }, [plan.days, activeDayId]);

  const activeDay = plan.days.find((d) => d.id === activeDayId) ?? plan.days[0];
  const setDay = (id: string, patch: Partial<PlanDay>) => onChange({ ...plan, days: plan.days.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const setExercises = (id: string, exercises: PlanExercise[]) => setDay(id, { exercises });

  const addExercise = async (ex: Exercise) => {
    if (!activeDay) return;
    if (activeDay.exercises.some((e) => e.exerciseId === ex.id)) {
      const ok = await confirmDialog({ title: 'Bereits im Trainingstag', message: `„${ex.name}“ ist an „${activeDay.name}“ bereits enthalten. Trotzdem ein zweites Mal hinzufügen?`, confirmLabel: 'Trotzdem hinzufügen' });
      if (!ok) return;
    }
    const pe = makePlanExercise(ex);
    setNewUids((s) => new Set(s).add(pe.uid));
    setExercises(activeDay.id, [...activeDay.exercises, pe]);
    toast(`„${ex.name}“ zu ${activeDay.name} hinzugefügt.`);
  };

  const removeDay = async (day: PlanDay) => {
    const ok = await confirmDialog({
      title: 'Trainingstag löschen?',
      message: `„${day.name}“ mit ${day.exercises.length} Übungen wird aus dem Plan entfernt. Der restliche Plan bleibt erhalten.`,
      confirmLabel: 'Tag löschen',
      danger: true,
    });
    if (!ok) return;
    onChange({ ...plan, days: plan.days.filter((d) => d.id !== day.id) });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!activeDay || !e.over || e.active.id === e.over.id) return;
    const from = activeDay.exercises.findIndex((x) => x.uid === e.active.id);
    const to = activeDay.exercises.findIndex((x) => x.uid === e.over!.id);
    if (from < 0 || to < 0) return;
    setExercises(activeDay.id, arrayMove(activeDay.exercises, from, to));
  };

  return (
    <div>
      {/* Tagesleiste */}
      <div className="mb-4 flex items-center gap-2">
        <div className="scrollbar-none flex flex-1 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Trainingstage">
          {plan.days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={d.id === activeDay?.id}
              onClick={() => setActiveDayId(d.id)}
              className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-semibold transition ${d.id === activeDay?.id ? 'bg-accent text-accent-fg' : 'bg-elevated text-muted hover:text-fg'}`}
            >
              {d.name || `Tag ${i + 1}`}
              <span className="ml-2 opacity-70">{d.exercises.length}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => {
            const d = newDay(plan.days.length);
            onChange({ ...plan, days: [...plan.days, d] });
            setActiveDayId(d.id);
          }}
        >
          <Plus size={16} aria-hidden="true" /> Tag
        </button>
      </div>

      {/* Mobile Umschalter */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1 lg:hidden" role="tablist" aria-label="Ansicht">
        {(
          [
            ['plan', 'Trainingstag'],
            ['auswahl', 'Übungen hinzufügen'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mobileView === k} onClick={() => setMobileView(k)} className={`min-h-[40px] rounded-lg text-sm font-semibold ${mobileView === k ? 'bg-surface text-fg shadow' : 'text-muted'}`}>
            {l}
          </button>
        ))}
      </div>

      {!activeDay ? (
        <div className="card p-8 text-center text-sm text-muted">Dieser Plan hat keine Trainingstage. Lege oben einen Tag an.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Bereich B: aktueller Tag */}
          <section className={`${mobileView === 'plan' ? 'block' : 'hidden'} lg:block`} aria-label="Aktueller Trainingstag">
            <div className="card mb-4 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <Field label="Name des Trainingstags" htmlFor={`dn-${activeDay.id}`}>
                  <input id={`dn-${activeDay.id}`} className="input" value={activeDay.name} maxLength={60} onChange={(e) => setDay(activeDay.id, { name: e.target.value })} />
                </Field>
                <Field label="Wochentag" htmlFor={`dw-${activeDay.id}`}>
                  <select id={`dw-${activeDay.id}`} className="input" value={activeDay.weekday ?? ''} onChange={(e) => setDay(activeDay.id, { weekday: e.target.value === '' ? null : (Number(e.target.value) as Weekday) })}>
                    <option value="">Kein fester Tag</option>
                    {WEEKDAYS.map((w) => (
                      <option key={w} value={w}>
                        {WEEKDAY_LABEL[w]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <details className="mt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
                  <ChevronDown size={14} aria-hidden="true" /> Muskelgruppen dieses Tages ({activeDay.muscles.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MUSCLES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="chip min-h-[32px] text-xs"
                      aria-pressed={activeDay.muscles.includes(m)}
                      onClick={() => setDay(activeDay.id, { muscles: activeDay.muscles.includes(m) ? activeDay.muscles.filter((x) => x !== m) : [...activeDay.muscles, m] })}
                    >
                      {MUSCLE_LABEL[m]}
                    </button>
                  ))}
                </div>
              </details>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t hairline pt-3">
                <p className="text-xs text-muted">
                  Geschätzte Dauer: <span className="font-semibold text-fg">ca. {estimateMinutes(activeDay.exercises)} min</span> (Richtwert inkl. Aufwärmen)
                </p>
                <div className="flex flex-wrap gap-1">
                  {dayActions?.(activeDay, plan.days.indexOf(activeDay))}
                  <button type="button" className="icon-btn h-9 w-9" disabled={plan.days.indexOf(activeDay) === 0} onClick={() => onChange({ ...plan, days: moveItem(plan.days, plan.days.indexOf(activeDay), plan.days.indexOf(activeDay) - 1) })} aria-label="Tag nach vorne verschieben">
                    <ArrowUp size={16} className="-rotate-90" />
                  </button>
                  <button type="button" className="icon-btn h-9 w-9" disabled={plan.days.indexOf(activeDay) === plan.days.length - 1} onClick={() => onChange({ ...plan, days: moveItem(plan.days, plan.days.indexOf(activeDay), plan.days.indexOf(activeDay) + 1) })} aria-label="Tag nach hinten verschieben">
                    <ArrowDown size={16} className="-rotate-90" />
                  </button>
                  <button type="button" className="btn-ghost h-9 min-h-0 hover:text-danger" onClick={() => removeDay(activeDay)}>
                    <X size={16} aria-hidden="true" /> Tag löschen
                  </button>
                </div>
              </div>
            </div>

            {activeDay.exercises.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed hairline p-8 text-center">
                <p className="font-semibold">Noch keine Übungen an diesem Tag</p>
                <p className="mt-1 text-sm text-muted">Füge Übungen aus der Auswahl hinzu.</p>
                <button type="button" className="btn-primary mt-4 lg:hidden" onClick={() => setMobileView('auswahl')}>
                  <Plus size={16} aria-hidden="true" /> Übungen hinzufügen
                </button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={activeDay.exercises.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {activeDay.exercises.map((pe, i) => (
                      <ExerciseRow
                        key={pe.uid}
                        pe={pe}
                        index={i}
                        count={activeDay.exercises.length}
                        isNew={newUids.has(pe.uid)}
                        onChange={(n) => setExercises(activeDay.id, activeDay.exercises.map((x) => (x.uid === pe.uid ? n : x)))}
                        onRemove={() => {
                          const name = findExercise(pe.exerciseId)?.name ?? 'Übung';
                          const before = activeDay.exercises;
                          setExercises(activeDay.id, before.filter((x) => x.uid !== pe.uid));
                          toast(`„${name}“ entfernt.`, 'info');
                        }}
                        onMove={(dir) => setExercises(activeDay.id, moveItem(activeDay.exercises, i, i + dir))}
                        onReplace={() => setReplaceFor({ dayId: activeDay.id, uid: pe.uid, exerciseId: pe.exerciseId })}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>

          {/* Bereich A: Auswahl */}
          <aside className={`${mobileView === 'auswahl' ? 'block' : 'hidden'} lg:block`} aria-label="Übungsauswahl">
            <div className="lg:sticky lg:top-6">
              <p className="label">Übungen hinzufügen zu: {activeDay.name}</p>
              <div className="lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
                <ExercisePicker onAdd={addExercise} targetLabel={activeDay.name} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {replaceFor && (
        <ReplaceDialog
          exerciseId={replaceFor.exerciseId}
          onClose={() => setReplaceFor(null)}
          onPick={(id) => {
            const day = plan.days.find((d) => d.id === replaceFor.dayId);
            if (day) {
              const nu = uid('pe-');
              setNewUids((s) => new Set(s).add(nu));
              setExercises(day.id, day.exercises.map((x) => (x.uid === replaceFor.uid ? { ...x, exerciseId: id, uid: nu } : x)));
              toast(`Ersetzt durch „${findExercise(id)?.name}“.`);
            }
            setReplaceFor(null);
          }}
        />
      )}
    </div>
  );
}
