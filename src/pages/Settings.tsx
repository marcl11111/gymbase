import { useEffect, useState } from 'react';
import { Download, Moon, RotateCcw, Sun, Upload } from 'lucide-react';
import { Field, Modal, NumberInput, PageHeader } from '../components/ui';
import { getState, replaceAllData, resetAllData, updateSettings, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { buildExport, downloadJson, mergeData, parseImport, restoreImages, type ParsedImport } from '../services/backup';
import { estimateStorage } from '../services/imageStore';
import { EQUIPMENT, EQUIPMENT_LABEL } from '../data/labels';

function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[280px_1fr]">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-xl bg-elevated p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`flex min-h-[40px] items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${value === o.value ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const s = useApp((st) => st.settings);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [pending, setPending] = useState<ParsedImport | null>(null);

  useEffect(() => {
    estimateStorage().then(setStorage);
  }, []);

  const exportData = async () => {
    const file = await buildExport(getState());
    downloadJson(file, `gymbase-export-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Export erstellt.');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast('Die Datei ist zu groß (max. 50 MB).', 'error');
    try {
      setPending(parseImport(await f.text()));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import fehlgeschlagen.', 'error');
    }
  };

  const applyImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await confirmDialog({ title: 'Alle Daten ersetzen?', message: 'Deine aktuellen Daten werden vollständig durch die Importdatei ersetzt. Erstelle vorher ggf. einen Export.', confirmLabel: 'Ersetzen', danger: true });
      if (!ok) return;
    }
    const images = await restoreImages(pending.images);
    replaceAllData(mode === 'merge' ? mergeData(getState(), pending.data) : pending.data);
    toast(`Import abgeschlossen${images ? ` (${images} Bilder)` : ''}.`);
    setPending(null);
  };

  return (
    <div className="page space-y-6">
      <PageHeader eyebrow="Konfiguration" title="Einstellungen" />

      <Section title="Darstellung" text="Dark Mode ist Standard. Die Akzentfarbe kann zwischen Logo-Gelb und Limegrün gewechselt werden.">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="label">Designmodus</p>
            <Segmented
              label="Designmodus"
              value={s.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'dark', label: (<><Moon size={16} aria-hidden="true" /> Dunkel</>) },
                { value: 'light', label: (<><Sun size={16} aria-hidden="true" /> Hell</>) },
              ]}
            />
          </div>
          <div>
            <p className="label">Akzentfarbe</p>
            <Segmented
              label="Akzentfarbe"
              value={s.accent}
              onChange={(accent) => updateSettings({ accent })}
              options={[
                { value: 'brand', label: (<><span className="h-3.5 w-3.5 rounded-full bg-[#fdc910]" aria-hidden="true" /> Logo-Gelb</>) },
                { value: 'lime', label: (<><span className="h-3.5 w-3.5 rounded-full bg-[#bef264]" aria-hidden="true" /> Limegrün</>) },
              ]}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={s.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} />
          <span className="text-sm">
            Animationen reduzieren <span className="text-muted">(zusätzlich zur Systemeinstellung „Bewegung reduzieren“)</span>
          </span>
        </label>
        <Field label="Dein Name (für die Begrüßung)" htmlFor="set-name">
          <input id="set-name" className="input max-w-sm" value={s.userName} maxLength={40} onChange={(e) => updateSettings({ userName: e.target.value })} />
        </Field>
      </Section>

      <Section title="Training" text="Standardwerte für neue Übungen in Plänen und den Pausentimer.">
        <div>
          <p className="label">Maßeinheit</p>
          <Segmented label="Maßeinheit" value={s.unit} onChange={(unit) => updateSettings({ unit })} options={[{ value: 'kg', label: 'Kilogramm (kg)' }, { value: 'lb', label: 'Pfund (lb)' }]} />
          <p className="mt-2 text-xs text-muted">Gewichte werden intern in kg gespeichert und bei Bedarf umgerechnet – vorhandene Daten bleiben korrekt.</p>
        </div>
        <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Pause (Sek.)" htmlFor="set-rest">
            <NumberInput id="set-rest" value={s.defaultRestSec} min={0} max={900} onChange={(v) => updateSettings({ defaultRestSec: v ?? 0 })} />
          </Field>
          <Field label="Sätze" htmlFor="set-sets">
            <NumberInput id="set-sets" value={s.defaultSets} min={1} max={10} onChange={(v) => updateSettings({ defaultSets: v ?? 1 })} />
          </Field>
          <Field label="Wdh. min" htmlFor="set-rmin">
            <NumberInput id="set-rmin" value={s.defaultRepsMin} min={1} max={100} onChange={(v) => updateSettings({ defaultRepsMin: v ?? 1, defaultRepsMax: Math.max(v ?? 1, s.defaultRepsMax) })} />
          </Field>
          <Field label="Wdh. max" htmlFor="set-rmax">
            <NumberInput id="set-rmax" value={s.defaultRepsMax} min={1} max={100} onChange={(v) => updateSettings({ defaultRepsMax: Math.max(s.defaultRepsMin, v ?? s.defaultRepsMin) })} />
          </Field>
        </div>
        <fieldset>
          <legend className="label">Bevorzugtes Equipment (Vorauswahl im Generator)</legend>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <button key={e} type="button" className="chip" aria-pressed={s.preferredEquipment.includes(e)} onClick={() => updateSettings({ preferredEquipment: s.preferredEquipment.includes(e) ? s.preferredEquipment.filter((x) => x !== e) : [...s.preferredEquipment, e] })}>
                {EQUIPMENT_LABEL[e]}
              </button>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Daten" text="Alle persönlichen Daten liegen ausschließlich lokal in diesem Browser. Sichere sie regelmäßig per Export.">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={exportData}>
            <Download size={16} aria-hidden="true" /> Daten exportieren (JSON)
          </button>
          <label htmlFor="import-file" className="btn-secondary cursor-pointer">
            <Upload size={16} aria-hidden="true" /> Daten importieren
          </label>
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <p className="text-xs text-muted">Der Export enthält eigene Übungen (inkl. Bilder), Sammlungen, Favoriten, Trainingspläne, Trainingseinheiten und Einstellungen.</p>
        {storage && storage.quota > 0 && (
          <p className="text-xs text-muted">
            Browser-Speicher: {(storage.usage / 1024 / 1024).toFixed(1)} MB von ca. {(storage.quota / 1024 / 1024).toFixed(0)} MB belegt.
          </p>
        )}
        <div className="border-t hairline pt-5">
          <button
            type="button"
            className="btn-danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Alle persönlichen Daten löschen?',
                message: 'Eigene Übungen, Bilder, Sammlungen, Favoriten, Pläne, Trainingshistorie und Einstellungen werden unwiderruflich gelöscht. Die Übungsdatenbank bleibt erhalten.',
                confirmLabel: 'Endgültig löschen',
                danger: true,
                requireText: 'LÖSCHEN',
              });
              if (!ok) return;
              await resetAllData();
              toast('Alle persönlichen Daten wurden gelöscht.', 'info');
            }}
          >
            <RotateCcw size={16} aria-hidden="true" /> Persönliche Daten zurücksetzen
          </button>
        </div>
      </Section>

      <p className="px-1 text-xs text-muted">Übungsfotos: Free Exercise DB (github.com/yuhonas/free-exercise-db), Public Domain (Unlicense). Hinweise in GymBase ersetzen keine ärztliche oder trainerische Beratung.</p>

      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Import prüfen"
          size="sm"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => applyImport('replace')}>
                Alles ersetzen
              </button>
              <button type="button" className="btn-primary" onClick={() => applyImport('merge')}>
                Zusammenführen
              </button>
            </>
          }
        >
          <p className="mb-3 text-sm text-muted">Die Datei wurde geprüft und enthält:</p>
          <ul className="space-y-1 text-sm">
            <li>{pending.summary.exercises} eigene Übungen</li>
            <li>{pending.summary.collections} Sammlungen</li>
            <li>{pending.summary.favorites} Favoriten</li>
            <li>{pending.summary.plans} Trainingspläne</li>
            <li>{pending.summary.sessions} Trainingseinheiten</li>
            <li>{Object.keys(pending.images).length} Bilder</li>
          </ul>
          {pending.skipped.length > 0 && <p className="mt-3 text-sm text-danger">{pending.skipped.length} ungültige Einträge werden übersprungen.</p>}
          <p className="mt-4 text-xs text-muted">„Zusammenführen“ behält deine bestehenden Daten und ergänzt neue Einträge. „Alles ersetzen“ überschreibt alles.</p>
        </Modal>
      )}
    </div>
  );
}
