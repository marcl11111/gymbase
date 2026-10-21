import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, FolderPlus, Lightbulb, ListPlus, Pencil, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { ScrollReveal, ScrollZoom, SplitHeadline } from '../animations';
import { PhotoGuide } from '../components/PhotoGuide';
import { AddToDialog } from '../components/AddToDialog';
import { DifficultyDots, FavoriteButton } from '../components/ExerciseCard';
import { EmptyState, SmartImage, useImageSrc } from '../components/ui';
import { ExerciseForm } from '../components/ExerciseForm';
import { deleteCustomExercise, useApp, useExercise, useExercises } from '../store/appStore';
import { findAlternatives } from '../services/exerciseQuery';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, PATTERN_LABEL, TYPE_LABEL } from '../data/labels';
import { confirmDialog, toast } from '../store/uiStore';
import { lastPerformance } from '../services/stats';
import { formatDate, formatWeight } from '../utils';

function Section({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: string[]; tone?: 'warn' | 'ok' | 'bad' }) {
  if (!items.length) return null;
  const color = tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-accent' : 'text-accent';
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <span className={color} aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fg/30" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const exercise = useExercise(decodeURIComponent(id));
  const all = useExercises();
  const sessions = useApp((s) => s.sessions);
  const unit = useApp((s) => s.settings.unit);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | 'sammlung' | 'plan'>(null);
  const [editing, setEditing] = useState(false);
  const heroSrc = useImageSrc(exercise?.imageUrl);

  const alternatives = useMemo(() => (exercise ? findAlternatives(exercise, all, { limit: 6 }) : []), [exercise, all]);
  const idx = exercise ? all.findIndex((e) => e.id === exercise.id) : -1;
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const last = exercise ? lastPerformance(sessions, exercise.id) : null;

  if (!exercise) {
    return (
      <div className="page">
        <EmptyState icon={<XCircle size={26} />} title="Übung nicht gefunden" text="Diese Übung existiert nicht (mehr)." action={{ label: 'Zur Übungsdatenbank', to: '/uebungen' }} />
      </div>
    );
  }

  const r = exercise.recommended;
  const repUnit = exercise.repUnit === 'sek' ? 'Sekunden' : exercise.repUnit === 'm' ? 'Meter' : 'Wiederholungen';

  return (
    <div key={exercise.id}>
      {/* Hero mit Scroll-Zoom */}
      {heroSrc ? (
        <ScrollZoom src={heroSrc} alt={exercise.name} className="h-[52svh] min-h-[320px] sm:h-[62svh]" from={1.02} to={1.22}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-10">
            <Link to="/uebungen" className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/70">
              <ArrowLeft size={16} aria-hidden="true" /> Übungen
            </Link>
            <p className="eyebrow mb-2">{MUSCLE_LABEL[exercise.primaryMuscle]}</p>
            <SplitHeadline key={exercise.id} as="h1" trigger="load" text={exercise.name} className="max-w-4xl text-4xl font-black leading-[1.05] text-fg sm:text-6xl" />
          </div>
        </ScrollZoom>
      ) : (
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-10">
          <Link to="/uebungen" className="btn-ghost -ml-3 mb-4">
            <ArrowLeft size={16} aria-hidden="true" /> Übungen
          </Link>
          <p className="eyebrow mb-2">{MUSCLE_LABEL[exercise.primaryMuscle]}</p>
          <SplitHeadline key={exercise.id} as="h1" trigger="load" text={exercise.name} className="text-4xl font-black sm:text-6xl" />
          <SmartImage src={null} alt={exercise.name} className="mt-6 aspect-[21/9] rounded-2xl" placeholder="Kein Hauptbild hinterlegt" />
        </div>
      )}

      <div className="page pt-8">
        {/* Aktionen & Eckdaten */}
        <ScrollReveal className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between" stagger={0.1}>
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-active">{MUSCLE_LABEL[exercise.primaryMuscle]}</span>
            {exercise.secondaryMuscles.map((m) => (
              <span key={m} className="chip">
                {MUSCLE_LABEL[m]}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton id={exercise.id} name={exercise.name} className="border hairline" />
            <button type="button" className="btn-secondary" onClick={() => setDialog('sammlung')}>
              <FolderPlus size={16} aria-hidden="true" /> Zur Sammlung
            </button>
            <button type="button" className="btn-primary" onClick={() => setDialog('plan')}>
              <ListPlus size={16} aria-hidden="true" /> Zum Trainingsplan
            </button>
            {exercise.isCustom && (
              <>
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                  <Pencil size={16} aria-hidden="true" /> Bearbeiten
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    const ok = await confirmDialog({ title: 'Eigene Übung löschen?', message: `„${exercise.name}“ wird aus Sammlungen, Favoriten und Plänen entfernt. Bereits dokumentierte Trainingseinheiten bleiben erhalten.`, confirmLabel: 'Löschen', danger: true });
                    if (!ok) return;
                    deleteCustomExercise(exercise.id);
                    toast('Übung gelöscht.', 'info');
                    navigate('/sammlung');
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" /> Löschen
                </button>
              </>
            )}
          </div>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ScrollReveal>
              <p className="text-lg leading-relaxed sm:text-xl">{exercise.description || 'Keine Beschreibung hinterlegt.'}</p>
            </ScrollReveal>
            <ScrollReveal>
              <PhotoGuide exercise={exercise} />
            </ScrollReveal>
            <ScrollReveal className="space-y-6" stagger={0.1}>
              {exercise.instructions.length > 0 && (
                <div className="card p-5 sm:p-6">
                  <h2 className="mb-4 text-lg font-bold">Ausführung</h2>
                  <ol className="space-y-3">
                    {exercise.instructions.map((t, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                        <span className="text-muted">{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <Section title="Technikhinweise" icon={<Lightbulb size={20} />} items={exercise.techniqueTips} />
              <Section title="Häufige Fehler" icon={<AlertTriangle size={20} />} items={exercise.commonMistakes} tone="warn" />
              <Section title="Sicherheitshinweise" icon={<ShieldAlert size={20} />} items={exercise.safetyNotes} tone="bad" />
            </ScrollReveal>
          </div>

          <aside className="space-y-6">
            <ScrollReveal className="space-y-6" stagger={0.1}>
              <div className="card p-5 sm:p-6">
                <h2 className="mb-4 text-lg font-bold">Steckbrief</h2>
                <dl className="space-y-3 text-sm">
                  {[
                    ['Equipment', EQUIPMENT_LABEL[exercise.equipment]],
                    ['Übungstyp', TYPE_LABEL[exercise.type]],
                    ['Bewegungsmuster', PATTERN_LABEL[exercise.pattern]],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b hairline pb-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-semibold">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Schwierigkeit</dt>
                    <dd>
                      <DifficultyDots d={exercise.difficulty} />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="card p-5 sm:p-6">
                <h2 className="mb-1 text-lg font-bold">Empfehlung</h2>
                <p className="mb-4 text-xs text-muted">Orientierungswert – passe ihn an Ziel und Tagesform an.</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-fg/5 p-3">
                    <div className="font-display text-2xl font-extrabold">{r.sets}</div>
                    <div className="text-[11px] text-muted">Sätze</div>
                  </div>
                  <div className="rounded-xl bg-fg/5 p-3">
                    <div className="font-display text-2xl font-extrabold">
                      {r.repsMin}–{r.repsMax}
                    </div>
                    <div className="text-[11px] text-muted">{repUnit}</div>
                  </div>
                  <div className="rounded-xl bg-fg/5 p-3">
                    <div className="font-display text-2xl font-extrabold">{r.restSec}</div>
                    <div className="text-[11px] text-muted">Sek. Pause</div>
                  </div>
                </div>
              </div>
              {last && (
                <div className="card p-5 sm:p-6">
                  <h2 className="mb-1 text-lg font-bold">Letzte Leistung</h2>
                  <p className="mb-3 text-xs text-muted">{formatDate(last.date)}</p>
                  <ul className="space-y-1.5 text-sm">
                    {last.sets.map((s, i) => (
                      <li key={i} className="flex justify-between tabular-nums">
                        <span className="text-muted">Satz {i + 1}</span>
                        <span className="font-semibold">
                          {formatWeight(s.weight, unit)} × {s.reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </ScrollReveal>
          </aside>
        </div>

        {/* Alternativen */}
        <section aria-labelledby="alt-h" className="mt-16">
          <p className="eyebrow mb-2">Alternativen-Finder</p>
          <h2 id="alt-h" className="mb-2 text-2xl font-extrabold">
            Gerät belegt? Diese Übungen sind ähnlich.
          </h2>
          <p className="mb-6 max-w-2xl text-sm text-muted">Ähnliche Zielmuskulatur und Bewegung – aber nicht biomechanisch identisch. Belastungswinkel, Stabilisationsanteil und Gewicht können abweichen.</p>
          {alternatives.length ? (
            <ScrollReveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
              {alternatives.map(({ exercise: a, reasons }) => (
                <AlternativeCard key={a.id} id={a.id} name={a.name} image={a.imageUrl} reasons={reasons} />
              ))}
            </ScrollReveal>
          ) : (
            <p className="text-sm text-muted">Keine passende Alternative gefunden.</p>
          )}
        </section>

        {/* Vorherige / nächste Übung */}
        <nav aria-label="Weitere Übungen" className="mt-16 grid grid-cols-2 gap-3">
          {prev ? (
            <Link to={`/uebungen/${encodeURIComponent(prev.id)}`} className="card group flex items-center gap-3 p-4 hover:border-fg/20">
              <ChevronLeft size={20} className="shrink-0 text-muted transition group-hover:-translate-x-1" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs text-muted">Vorherige</span>
                <span className="block truncate font-semibold">{prev.name}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/uebungen/${encodeURIComponent(next.id)}`} className="card group flex items-center justify-end gap-3 p-4 text-right hover:border-fg/20">
              <span className="min-w-0">
                <span className="block text-xs text-muted">Nächste</span>
                <span className="block truncate font-semibold">{next.name}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted transition group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>

      {dialog && <AddToDialog exercise={exercise} open onClose={() => setDialog(null)} initialTab={dialog} />}
      {editing && <ExerciseForm open initial={exercise} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AlternativeCard({ id, name, image, reasons }: { id: string; name: string; image: string | null; reasons: string[] }) {
  const ex = useExercise(id);
  const [open, setOpen] = useState(false);
  return (
    <div className="card flex gap-3 p-3">
      <SmartImage src={image} alt={name} className="h-20 w-24 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Link to={`/uebungen/${encodeURIComponent(id)}`} className="line-clamp-2 text-sm font-bold hover:underline">
          {name}
        </Link>
        <ul className="mt-1 space-y-0.5">
          {reasons.slice(0, 2).map((r) => (
            <li key={r} className="flex items-start gap-1 text-[11px] text-muted">
              <CheckCircle2 size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex gap-3">
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline" onClick={() => setOpen(true)}>
            Übernehmen <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && ex && <AddToDialog exercise={ex} open onClose={() => setOpen(false)} initialTab="plan" />}
    </div>
  );
}
