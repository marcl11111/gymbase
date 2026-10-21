import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderHeart, FolderPlus, ListPlus, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { ScrollReveal } from '../animations';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExerciseForm } from '../components/ExerciseForm';
import { AddToDialog } from '../components/AddToDialog';
import { EmptyState, Field, Modal, PageHeader } from '../components/ui';
import { createCollection, deleteCollection, findExercise, removeFromCollection, updateCollection, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL } from '../data/labels';
import type { Equipment, Exercise, ExerciseCollection, MuscleGroup } from '../types';

const SUGGESTIONS = ['Brustübungen', 'Rückenübungen', 'Schulterübungen', 'Armübungen', 'Beinübungen', 'Maschinen', 'Lieblingsübungen', 'Alternativen für belegte Geräte'];

function CollectionDialog({ initial, onClose }: { initial?: ExerciseCollection; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [err, setErr] = useState<string | null>(null);
  const existing = useApp((s) => s.collections.filter((c) => c.id !== initial?.id).map((c) => c.name.toLowerCase()));
  const save = () => {
    const n = name.trim();
    if (!n) return setErr('Bitte einen Namen eingeben.');
    if (existing.includes(n.toLowerCase())) return setErr('Eine Sammlung mit diesem Namen existiert bereits.');
    if (initial) updateCollection(initial.id, { name: n, description: desc });
    else createCollection(n, desc);
    toast(initial ? 'Sammlung gespeichert.' : `Sammlung „${n}“ erstellt.`);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Sammlung bearbeiten' : 'Neue Sammlung'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Speichern
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name *" htmlFor="col-name" error={err}>
          <input id="col-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} list="col-suggestions" />
          <datalist id="col-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Beschreibung" htmlFor="col-desc">
          <textarea id="col-desc" className="input min-h-[80px] py-2" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function CollectionView({ collection }: { collection: ExerciseCollection }) {
  const data = useApp((s) => s);
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [equip, setEquip] = useState<Equipment | ''>('');
  const [addEx, setAddEx] = useState<Exercise | null>(null);
  const items = collection.exerciseIds.map((id) => findExercise(id, data)).filter((e): e is Exercise => !!e);
  const filtered = items.filter((e) => (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) && (!equip || e.equipment === equip));
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="w-full sm:w-52">
          <label htmlFor="cv-m" className="sr-only">
            Nach Muskelgruppe filtern
          </label>
          <select id="cv-m" className="input" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | '')}>
            <option value="">Alle Muskelgruppen</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="cv-e" className="sr-only">
            Nach Equipment filtern
          </label>
          <select id="cv-e" className="input" value={equip} onChange={(e) => setEquip(e.target.value as Equipment | '')}>
            <option value="">Alle Geräte</option>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {EQUIPMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<FolderPlus size={24} />} title="Sammlung ist leer" text="Füge Übungen über das Plus auf einer Übungskarte oder auf der Detailseite hinzu." action={{ label: 'Übungen durchsuchen', to: '/uebungen' }} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">Keine Übung dieser Sammlung passt zum Filter.</p>
      ) : (
        <ScrollReveal key={`${collection.id}${muscle}${equip}`} className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {filtered.map((e) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              extraAction={
                <>
                  <button type="button" className="btn-secondary" onClick={() => setAddEx(e)} aria-label={`${e.name} direkt zu Trainingsplan hinzufügen`} title="Zum Trainingsplan">
                    <ListPlus size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary hover:text-danger"
                    onClick={() => {
                      removeFromCollection(collection.id, e.id);
                      toast(`„${e.name}“ aus „${collection.name}“ entfernt.`, 'info');
                    }}
                    aria-label={`${e.name} aus Sammlung entfernen`}
                    title="Aus Sammlung entfernen"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </>
              }
            />
          ))}
        </ScrollReveal>
      )}
      {addEx && <AddToDialog exercise={addEx} open onClose={() => setAddEx(null)} initialTab="plan" />}
    </div>
  );
}

export default function Collection() {
  const collections = useApp((s) => s.collections);
  const custom = useApp((s) => s.customExercises);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'sammlungen' | 'eigene'>(params.get('neu') ? 'eigene' : 'sammlungen');
  const [selected, setSelected] = useState<string | null>(collections[0]?.id ?? null);
  const [dialog, setDialog] = useState<null | 'new' | ExerciseCollection>(null);
  const [formOpen, setFormOpen] = useState(!!params.get('neu'));

  useEffect(() => {
    if (!collections.some((c) => c.id === selected)) setSelected(collections[0]?.id ?? null);
  }, [collections, selected]);

  const current = useMemo(() => collections.find((c) => c.id === selected), [collections, selected]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Persönlich"
        title="Meine Sammlung"
        text="Organisiere Übungen in eigenen Sammlungen und lege eigene Übungen mit Fotos an. Eine Übung in einer Sammlung ist nicht automatisch Teil eines Trainingsplans."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog('new')}>
              <FolderPlus size={16} aria-hidden="true" /> Neue Sammlung
            </button>
            <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Eigene Übung
            </button>
          </>
        }
      />

      <div className="mb-8 inline-grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1" role="tablist">
        {(
          [
            ['sammlungen', `Sammlungen (${collections.length})`],
            ['eigene', `Eigene Übungen (${custom.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition ${tab === k ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'sammlungen' ? (
        collections.length === 0 ? (
          <div className="space-y-6">
            <EmptyState icon={<FolderHeart size={26} />} title="Noch keine Sammlung" text="Lege Sammlungen wie „Brustübungen“ oder „Alternativen für belegte Geräte“ an." action={{ label: 'Sammlung anlegen', onClick: () => setDialog('new') }} />
            <div>
              <p className="label">Schnellstart</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    onClick={() => {
                      createCollection(s);
                      toast(`Sammlung „${s}“ erstellt.`);
                    }}
                  >
                    <Plus size={14} aria-hidden="true" /> {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <nav aria-label="Sammlungen" className="space-y-1.5">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  aria-current={c.id === selected}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-left text-sm transition ${c.id === selected ? 'bg-accent text-accent-fg' : 'hover:bg-fg/5'}`}
                >
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className={c.id === selected ? '' : 'text-muted'}>{c.exerciseIds.length}</span>
                </button>
              ))}
            </nav>
            {current && (
              <section aria-labelledby="col-title">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="col-title" className="text-2xl font-extrabold">
                      {current.name}
                    </h2>
                    {current.description && <p className="mt-1 text-sm text-muted">{current.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setDialog(current)}>
                      <Pencil size={16} aria-hidden="true" /> Umbenennen
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={async () => {
                        const ok = await confirmDialog({ title: 'Sammlung löschen?', message: `„${current.name}“ wird gelöscht. Die Übungen selbst bleiben erhalten.`, confirmLabel: 'Löschen', danger: true });
                        if (ok) {
                          deleteCollection(current.id);
                          toast('Sammlung gelöscht.', 'info');
                        }
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Löschen
                    </button>
                  </div>
                </div>
                <CollectionView collection={current} />
              </section>
            )}
          </div>
        )
      ) : custom.length === 0 ? (
        <EmptyState icon={<UserRound size={26} />} title="Noch keine eigene Übung" text="Lege Übungen an, die in der Datenbank fehlen – inklusive eigener Fotos für die Schritt-für-Schritt-Anleitung." action={{ label: 'Eigene Übung anlegen', onClick: () => setFormOpen(true) }} />
      ) : (
        <ScrollReveal className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {custom.map((e) => (
            <ExerciseCard key={e.id} exercise={e} />
          ))}
        </ScrollReveal>
      )}

      {dialog && <CollectionDialog initial={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
      {formOpen && (
        <ExerciseForm
          open
          onClose={() => {
            setFormOpen(false);
            if (params.get('neu')) setParams({}, { replace: true });
          }}
        />
      )}
    </div>
  );
}
