import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Exercise, ExerciseInstructionStep, MuscleGroup } from '../types';
import { Field, Modal, NumberInput, SmartImage } from './ui';
import { DIFFICULTIES, DIFFICULTY_LABEL, EQUIPMENT, EQUIPMENT_LABEL, EXERCISE_TYPES, MUSCLES, MUSCLE_LABEL, PATTERN_LABEL, TYPE_LABEL } from '../data/labels';
import { newCustomExerciseId, upsertCustomExercise, useApp } from '../store/appStore';
import { deleteImage, downscaleImage, isIdbRef, MAX_UPLOAD_BYTES, putImage } from '../services/imageStore';
import { toast } from '../store/uiStore';
import { moveItem, uid } from '../utils';

const lines = (t: string) =>
  t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

function blank(): Exercise {
  return {
    id: newCustomExerciseId(),
    name: '',
    description: '',
    primaryMuscle: 'brust',
    secondaryMuscles: [],
    equipment: 'maschine',
    difficulty: 'anfaenger',
    type: 'grunduebung',
    pattern: 'horizontal_push',
    instructions: [],
    techniqueTips: [],
    commonMistakes: [],
    safetyNotes: [],
    recommended: { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
    repUnit: 'wdh',
    imageUrl: null,
    photoGuide: [],
    alternatives: [],
    isCustom: true,
  };
}

async function storeUpload(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Das Bild ist größer als 8 MB.');
  const small = await downscaleImage(file);
  return putImage(uid('img-'), small);
}

function ImagePicker({ value, onChange, label, id }: { value: string | null; onChange: (ref: string | null) => void; label: string; id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <SmartImage src={value} alt={label} className="h-20 w-28 shrink-0 rounded-xl" placeholder="Kein Bild" />
      <div className="flex flex-wrap gap-2">
        <label htmlFor={id} className={`btn-secondary cursor-pointer ${busy ? 'opacity-50' : ''}`}>
          <ImagePlus size={16} aria-hidden="true" /> {value ? 'Ersetzen' : 'Bild wählen'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              onChange(await storeUpload(f));
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Bild konnte nicht gespeichert werden.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
        {value && (
          <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
            <X size={16} aria-hidden="true" /> Entfernen
          </button>
        )}
      </div>
    </div>
  );
}

export function ExerciseForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Exercise; onSaved?: (e: Exercise) => void }) {
  const navigate = useNavigate();
  const existingNames = useApp((s) => s.customExercises.filter((e) => e.id !== initial?.id).map((e) => e.name.toLowerCase()));
  const [ex, setEx] = useState<Exercise>(() => (initial ? structuredClone(initial) : blank()));
  const [text, setText] = useState(() => ({
    instructions: (initial?.instructions ?? []).join('\n'),
    techniqueTips: (initial?.techniqueTips ?? []).join('\n'),
    commonMistakes: (initial?.commonMistakes ?? []).join('\n'),
    safetyNotes: (initial?.safetyNotes ?? []).join('\n'),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addedRefs, setAddedRefs] = useState<string[]>([]);

  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setEx((e) => ({ ...e, [k]: v }));
  const trackImg = (ref: string | null) => {
    if (ref && isIdbRef(ref)) setAddedRefs((r) => [...r, ref]);
    return ref;
  };
  const setStep = (i: number, patch: Partial<ExerciseInstructionStep>) =>
    setEx((e) => ({ ...e, photoGuide: e.photoGuide.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const validate = () => {
    const err: Record<string, string> = {};
    if (!ex.name.trim()) err.name = 'Bitte einen Namen eingeben.';
    else if (existingNames.includes(ex.name.trim().toLowerCase())) err.name = 'Eine eigene Übung mit diesem Namen existiert bereits.';
    if (ex.recommended.repsMax < ex.recommended.repsMin) err.reps = 'Maximum darf nicht kleiner als Minimum sein.';
    ex.photoGuide.forEach((s, i) => {
      if (!s.title.trim()) err[`step${i}`] = 'Bitte einen Titel für den Schritt angeben.';
    });
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const cleanupUnused = async (final: Exercise | null) => {
    const used = new Set(final ? [final.imageUrl, ...final.photoGuide.map((s) => s.imageUrl)] : [initial?.imageUrl, ...(initial?.photoGuide.map((s) => s.imageUrl) ?? [])]);
    const candidates = final ? [...addedRefs, initial?.imageUrl, ...(initial?.photoGuide.map((s) => s.imageUrl) ?? [])] : addedRefs;
    for (const r of candidates) if (r && isIdbRef(r) && !used.has(r)) await deleteImage(r).catch(() => undefined);
  };

  const save = async () => {
    if (!validate()) return;
    const final: Exercise = {
      ...ex,
      name: ex.name.trim(),
      instructions: lines(text.instructions),
      techniqueTips: lines(text.techniqueTips),
      commonMistakes: lines(text.commonMistakes),
      safetyNotes: lines(text.safetyNotes),
      photoGuide: ex.photoGuide.map((s, i) => ({ ...s, stepNumber: i + 1, altText: s.altText || `${ex.name} – ${s.title}` })),
      isCustom: true,
    };
    upsertCustomExercise(final);
    await cleanupUnused(final);
    toast(initial ? 'Übung gespeichert.' : 'Eigene Übung angelegt.');
    onSaved?.(final);
    onClose();
    if (!initial) navigate(`/uebungen/${encodeURIComponent(final.id)}`);
  };

  const cancel = async () => {
    await cleanupUnused(null);
    onClose();
  };

  const toggleSecondary = (m: MuscleGroup) => set('secondaryMuscles', ex.secondaryMuscles.includes(m) ? ex.secondaryMuscles.filter((x) => x !== m) : [...ex.secondaryMuscles, m]);

  return (
    <Modal
      open={open}
      onClose={cancel}
      title={initial ? 'Eigene Übung bearbeiten' : 'Eigene Übung anlegen'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={cancel}>
            Abbrechen
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Speichern
          </button>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name *" htmlFor="ex-name" error={errors.name}>
              <input id="ex-name" className="input" value={ex.name} maxLength={80} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Beschreibung" htmlFor="ex-desc">
              <textarea id="ex-desc" className="input min-h-[80px] py-2" value={ex.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
          <Field label="Primäre Muskelgruppe" htmlFor="ex-prim">
            <select id="ex-prim" className="input" value={ex.primaryMuscle} onChange={(e) => set('primaryMuscle', e.target.value as MuscleGroup)}>
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Equipment" htmlFor="ex-eq">
            <select id="ex-eq" className="input" value={ex.equipment} onChange={(e) => set('equipment', e.target.value as Exercise['equipment'])}>
              {EQUIPMENT.map((m) => (
                <option key={m} value={m}>
                  {EQUIPMENT_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schwierigkeitsgrad" htmlFor="ex-diff">
            <select id="ex-diff" className="input" value={ex.difficulty} onChange={(e) => set('difficulty', e.target.value as Exercise['difficulty'])}>
              {DIFFICULTIES.map((m) => (
                <option key={m} value={m}>
                  {DIFFICULTY_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Übungstyp" htmlFor="ex-type">
            <select id="ex-type" className="input" value={ex.type} onChange={(e) => set('type', e.target.value as Exercise['type'])}>
              {EXERCISE_TYPES.map((m) => (
                <option key={m} value={m}>
                  {TYPE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bewegungsmuster (für Alternativen & Generator)" htmlFor="ex-pat">
              <select id="ex-pat" className="input" value={ex.pattern} onChange={(e) => set('pattern', e.target.value as Exercise['pattern'])}>
                {Object.entries(PATTERN_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className="label">Sekundäre Muskelgruppen</legend>
          <div className="flex flex-wrap gap-2">
            {MUSCLES.filter((m) => m !== ex.primaryMuscle).map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={ex.secondaryMuscles.includes(m)} onClick={() => toggleSecondary(m)}>
                {MUSCLE_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="label col-span-full">Empfohlene Satz- und Wiederholungsbereiche</legend>
          <Field label="Sätze" htmlFor="ex-sets">
            <NumberInput id="ex-sets" value={ex.recommended.sets} min={1} max={20} onChange={(v) => set('recommended', { ...ex.recommended, sets: v ?? 1 })} />
          </Field>
          <Field label="Wdh. min" htmlFor="ex-rmin">
            <NumberInput id="ex-rmin" value={ex.recommended.repsMin} min={1} max={200} onChange={(v) => set('recommended', { ...ex.recommended, repsMin: v ?? 1 })} />
          </Field>
          <Field label="Wdh. max" htmlFor="ex-rmax" error={errors.reps}>
            <NumberInput id="ex-rmax" value={ex.recommended.repsMax} min={1} max={200} onChange={(v) => set('recommended', { ...ex.recommended, repsMax: v ?? 1 })} />
          </Field>
          <Field label="Pause (Sek.)" htmlFor="ex-rest">
            <NumberInput id="ex-rest" value={ex.recommended.restSec} min={0} max={900} onChange={(v) => set('recommended', { ...ex.recommended, restSec: v ?? 0 })} />
          </Field>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['instructions', 'Ausführungsanleitung'],
              ['techniqueTips', 'Technikhinweise'],
              ['commonMistakes', 'Häufige Fehler'],
              ['safetyNotes', 'Sicherheitshinweise'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} htmlFor={`ex-${k}`} hint="Ein Punkt pro Zeile">
              <textarea id={`ex-${k}`} className="input min-h-[96px] py-2" value={text[k]} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>

        <div>
          <p className="label">Hauptbild</p>
          <ImagePicker id="ex-main-img" label="Hauptbild" value={ex.imageUrl} onChange={(r) => set('imageUrl', trackImg(r))} />
          <p className="mt-2 text-xs text-muted">Bilder werden verkleinert und nur lokal in diesem Browser (IndexedDB) gespeichert.</p>
        </div>

        <fieldset>
          <legend className="label">Fotoanleitung</legend>
          <ol className="space-y-3">
            {ex.photoGuide.map((s, i) => (
              <li key={i} className="rounded-xl border hairline p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">Schritt {i + 1}</span>
                  <div className="flex">
                    <button type="button" className="icon-btn" disabled={i === 0} onClick={() => set('photoGuide', moveItem(ex.photoGuide, i, i - 1))} aria-label={`Schritt ${i + 1} nach oben`}>
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" className="icon-btn" disabled={i === ex.photoGuide.length - 1} onClick={() => set('photoGuide', moveItem(ex.photoGuide, i, i + 1))} aria-label={`Schritt ${i + 1} nach unten`}>
                      <ArrowDown size={16} />
                    </button>
                    <button type="button" className="icon-btn hover:text-danger" onClick={() => set('photoGuide', ex.photoGuide.filter((_, j) => j !== i))} aria-label={`Schritt ${i + 1} entfernen`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Titel" htmlFor={`st-t-${i}`} error={errors[`step${i}`]}>
                    <input id={`st-t-${i}`} className="input" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="z. B. Ausgangsposition" />
                  </Field>
                  <Field label="Beschreibung" htmlFor={`st-d-${i}`}>
                    <input id={`st-d-${i}`} className="input" value={s.description} onChange={(e) => setStep(i, { description: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-3">
                  <ImagePicker id={`st-img-${i}`} label={`Bild Schritt ${i + 1}`} value={s.imageUrl} onChange={(r) => setStep(i, { imageUrl: trackImg(r) })} />
                </div>
              </li>
            ))}
          </ol>
          {ex.photoGuide.length < 6 && (
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => set('photoGuide', [...ex.photoGuide, { stepNumber: ex.photoGuide.length + 1, title: '', description: '', imageUrl: null, altText: '' }])}
            >
              <Plus size={16} aria-hidden="true" /> Schritt hinzufügen
            </button>
          )}
        </fieldset>
        <button type="submit" className="sr-only">
          Speichern
        </button>
      </form>
    </Modal>
  );
}
