import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Play, Save, Star, Trash2 } from 'lucide-react';
import type { TrainingGoal, WorkoutPlan } from '../types';
import { EmptyState, Field } from '../components/ui';
import { PlanDaysEditor } from '../components/PlanDaysEditor';
import { deletePlan, duplicatePlan, newPlan, savePlan, setActivePlan, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { GOAL_LABEL } from '../data/labels';
import { ClipboardX } from 'lucide-react';

export default function PlanEditor() {
  const { id = '' } = useParams();
  const isNew = id === 'neu';
  const stored = useApp((s) => s.plans.find((p) => p.id === id));
  const activeId = useApp((s) => s.activePlanId);
  const navigate = useNavigate();
  const [draft, setDraft] = useState<WorkoutPlan | null>(() => (isNew ? newPlan() : stored ? structuredClone(stored) : null));
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && stored && (!draft || draft.id !== stored.id)) setDraft(structuredClone(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stored?.id]);

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (isNew) return true;
    if (!stored) return false;
    const strip = (p: WorkoutPlan) => JSON.stringify({ ...p, updatedAt: '' });
    return strip(draft) !== strip(stored);
  }, [draft, stored, isNew]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!draft) {
    return (
      <div className="page">
        <EmptyState icon={<ClipboardX size={26} />} title="Plan nicht gefunden" text="Dieser Trainingsplan existiert nicht (mehr)." action={{ label: 'Zu den Trainingsplänen', to: '/plaene' }} />
      </div>
    );
  }

  const save = () => {
    if (!draft.name.trim()) {
      setNameError('Bitte einen Namen vergeben.');
      document.getElementById('plan-name')?.focus();
      return;
    }
    setNameError(null);
    savePlan({ ...draft, name: draft.name.trim() });
    toast('Trainingsplan gespeichert.');
    if (isNew) navigate(`/plaene/${draft.id}`, { replace: true });
  };

  const leave = async (to: string) => {
    if (dirty) {
      const ok = await confirmDialog({ title: 'Ungespeicherte Änderungen', message: 'Deine Änderungen am Plan wurden noch nicht gespeichert. Trotzdem verlassen?', confirmLabel: 'Verwerfen und verlassen', danger: true });
      if (!ok) return;
    }
    navigate(to);
  };

  return (
    <div className="page pb-40">
      <button type="button" className="btn-ghost -ml-3 mb-4" onClick={() => leave('/plaene')}>
        <ArrowLeft size={16} aria-hidden="true" /> Trainingspläne
      </button>

      <header className="mb-8">
        <p className="eyebrow mb-2">{isNew ? 'Neuer Plan' : 'Plan bearbeiten'}</p>
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <Field label="Name *" htmlFor="plan-name" error={nameError}>
            <input id="plan-name" className="input h-14 text-xl font-bold" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={!!nameError} />
          </Field>
          <Field label="Trainingsziel" htmlFor="plan-goal">
            <select id="plan-goal" className="input h-14" value={draft.goal ?? ''} onChange={(e) => setDraft({ ...draft, goal: (e.target.value || null) as TrainingGoal | null })}>
              <option value="">Kein Ziel angegeben</option>
              {Object.entries(GOAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Beschreibung" htmlFor="plan-desc">
            <textarea id="plan-desc" className="input min-h-[72px] py-2" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label="Notizen" htmlFor="plan-notes">
            <textarea id="plan-notes" className="input min-h-[72px] py-2" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
      </header>

      <PlanDaysEditor plan={draft} onChange={setDraft} />

      {/* Aktionsleiste */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t hairline bg-bg/90 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-10">
          <p className="text-sm text-muted" aria-live="polite">
            {dirty ? <span className="font-semibold text-accent">Ungespeicherte Änderungen</span> : 'Alle Änderungen gespeichert'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isNew && (
              <>
                {activeId !== draft.id && (
                  <button type="button" className="icon-btn border hairline" title="Als aktiven Plan festlegen" aria-label="Als aktiven Plan festlegen" onClick={() => { setActivePlan(draft.id); toast('Als aktiven Plan festgelegt.'); }}>
                    <Star size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn border hairline"
                  title="Duplizieren"
                  aria-label="Plan duplizieren"
                  onClick={async () => {
                    if (dirty) {
                      const ok = await confirmDialog({ title: 'Erst speichern?', message: 'Die Kopie wird aus dem gespeicherten Stand erstellt. Ungespeicherte Änderungen sind nicht enthalten.', confirmLabel: 'Trotzdem duplizieren' });
                      if (!ok) return;
                    }
                    const c = duplicatePlan(draft.id);
                    if (c) {
                      toast(`Kopie „${c.name}“ erstellt.`);
                      navigate(`/plaene/${c.id}`);
                    }
                  }}
                >
                  <Copy size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn border hairline hover:text-danger"
                  title="Plan löschen"
                  aria-label="Plan löschen"
                  onClick={async () => {
                    const ok = await confirmDialog({ title: 'Trainingsplan löschen?', message: `„${draft.name}“ wird dauerhaft gelöscht. Dokumentierte Trainingseinheiten bleiben erhalten.`, confirmLabel: 'Plan löschen', danger: true });
                    if (!ok) return;
                    deletePlan(draft.id);
                    toast('Plan gelöscht.', 'info');
                    navigate('/plaene');
                  }}
                >
                  <Trash2 size={18} />
                </button>
                <Link to={`/training?plan=${draft.id}`} className={`btn-secondary ${dirty ? 'pointer-events-none opacity-40' : ''}`} aria-disabled={dirty}>
                  <Play size={16} aria-hidden="true" /> Training
                </Link>
              </>
            )}
            <button type="button" className="btn-primary" onClick={save} disabled={!dirty}>
              <Save size={16} aria-hidden="true" /> Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
