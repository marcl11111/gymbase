import { useState } from 'react';
import { Check, FolderPlus, ListPlus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Exercise } from '../types';
import { Modal } from './ui';
import {
  addExerciseToPlanDay,
  addToCollection,
  createCollection,
  makePlanExercise,
  newPlan,
  removeFromCollection,
  savePlan,
  useApp,
} from '../store/appStore';
import { toast } from '../store/uiStore';

export function AddToDialog({ exercise, open, onClose, initialTab = 'sammlung' }: { exercise: Exercise; open: boolean; onClose: () => void; initialTab?: 'sammlung' | 'plan' }) {
  const [tab, setTab] = useState<'sammlung' | 'plan'>(initialTab);
  return (
    <Modal open={open} onClose={onClose} title={`„${exercise.name}“ hinzufügen`} size="md">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1" role="tablist" aria-label="Ziel wählen">
        {(
          [
            ['sammlung', 'Sammlung', <FolderPlus key="i" size={16} aria-hidden="true" />],
            ['plan', 'Trainingsplan', <ListPlus key="i" size={16} aria-hidden="true" />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${tab === key ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      {tab === 'sammlung' ? <CollectionTab exercise={exercise} /> : <PlanTab exercise={exercise} onClose={onClose} />}
    </Modal>
  );
}

function CollectionTab({ exercise }: { exercise: Exercise }) {
  const collections = useApp((s) => s.collections);
  const [name, setName] = useState('');
  const create = () => {
    const n = name.trim();
    if (!n) return;
    const c = createCollection(n);
    addToCollection(c.id, exercise.id);
    setName('');
    toast(`Sammlung „${n}“ erstellt und Übung hinzugefügt.`);
  };
  return (
    <div className="space-y-4">
      {collections.length === 0 ? (
        <p className="text-sm text-muted">Du hast noch keine Sammlung. Lege unten deine erste an, z. B. „Brustübungen“ oder „Alternativen für belegte Geräte“.</p>
      ) : (
        <ul className="space-y-2">
          {collections.map((c) => {
            const inside = c.exerciseIds.includes(exercise.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={inside}
                  onClick={() => {
                    if (inside) {
                      removeFromCollection(c.id, exercise.id);
                      toast(`Aus „${c.name}“ entfernt.`, 'info');
                    } else {
                      addToCollection(c.id, exercise.id);
                      toast(`Zu „${c.name}“ hinzugefügt.`);
                    }
                  }}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 text-left text-sm transition ${inside ? 'border-accent/60 bg-accent/10' : 'hairline hover:bg-fg/5'}`}
                >
                  <span>
                    <span className="font-semibold">{c.name}</span>
                    <span className="ml-2 text-muted">{c.exerciseIds.length} Übungen</span>
                  </span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md ${inside ? 'bg-accent text-accent-fg' : 'border hairline'}`} aria-hidden="true">
                    {inside && <Check size={14} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <label htmlFor="new-col" className="sr-only">
          Neue Sammlung
        </label>
        <input id="new-col" className="input" placeholder="Neue Sammlung, z. B. Lieblingsübungen" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <button type="submit" className="btn-secondary" disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Anlegen
        </button>
      </form>
    </div>
  );
}

function PlanTab({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const plans = useApp((s) => s.plans);
  const activePlanId = useApp((s) => s.activePlanId);
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<string>(activePlanId ?? plans[0]?.id ?? '');
  const plan = plans.find((p) => p.id === planId);
  const [dayId, setDayId] = useState<string>(plan?.days[0]?.id ?? '');
  const [dupWarning, setDupWarning] = useState(false);

  const add = (force = false) => {
    const r = addExerciseToPlanDay(planId, dayId, exercise.id, force);
    if (r === 'duplicate') {
      setDupWarning(true);
      return;
    }
    if (r === 'added') {
      const day = plan?.days.find((d) => d.id === dayId);
      toast(`Zu „${plan?.name}“ · ${day?.name} hinzugefügt.`);
      setDupWarning(false);
      onClose();
    }
  };

  if (plans.length === 0) {
    return (
      <div className="space-y-4 text-sm text-muted">
        <p>Es gibt noch keinen Trainingsplan.</p>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            const p = newPlan();
            p.days[0].exercises.push(makePlanExercise(exercise));
            savePlan(p);
            onClose();
            navigate(`/plaene/${p.id}`);
            toast('Neuer Plan mit dieser Übung angelegt.');
          }}
        >
          <Plus size={16} aria-hidden="true" /> Neuen Plan mit dieser Übung anlegen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="plan-select">
          Trainingsplan
        </label>
        <select
          id="plan-select"
          className="input"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setDayId(plans.find((p) => p.id === e.target.value)?.days[0]?.id ?? '');
            setDupWarning(false);
          }}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="day-select">
          Trainingstag
        </label>
        <select
          id="day-select"
          className="input"
          value={dayId}
          onChange={(e) => {
            setDayId(e.target.value);
            setDupWarning(false);
          }}
        >
          {plan?.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.exercises.length} Übungen)
            </option>
          ))}
        </select>
      </div>
      {dupWarning && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm" role="alert">
          Diese Übung ist an diesem Trainingstag bereits enthalten.
          <button type="button" className="ml-2 font-semibold text-accent underline" onClick={() => add(true)}>
            Trotzdem erneut hinzufügen
          </button>
        </div>
      )}
      <button type="button" className="btn-primary w-full" disabled={!plan || !dayId} onClick={() => add(false)}>
        <ListPlus size={16} aria-hidden="true" /> Zum Trainingstag hinzufügen
      </button>
    </div>
  );
}
