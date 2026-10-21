import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Copy, Pencil, Play, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { ScrollReveal } from '../animations';
import { PageHeader } from '../components/ui';
import { deletePlan, duplicatePlan, setActivePlan, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { GOAL_LABEL, WEEKDAY_SHORT } from '../data/labels';
import { estimateMinutes } from '../services/generator';
import { formatDate } from '../utils';

export default function Plans() {
  const plans = useApp((s) => s.plans);
  const activeId = useApp((s) => s.activePlanId);
  const navigate = useNavigate();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Planung"
        title="Trainingspläne"
        text="Erstelle Pläne selbst oder lass dir einen Vorschlag generieren – beide sind vollständig bearbeitbar."
        actions={
          <>
            <Link to="/plaene/neu" className="btn-secondary">
              <Plus size={16} aria-hidden="true" /> Selbst erstellen
            </Link>
            <Link to="/plaene/generator" className="btn-primary">
              <Sparkles size={16} aria-hidden="true" /> Plan generieren
            </Link>
          </>
        }
      />

      {plans.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ScrollReveal>
            <Link to="/plaene/generator" className="card group block h-full p-8 transition hover:border-accent/50">
              <Sparkles size={28} className="mb-4 text-accent" aria-hidden="true" />
              <h2 className="mb-2 text-2xl font-extrabold">Plan generieren</h2>
              <p className="text-muted">Ziel, Erfahrung, Trainingstage, Muskelgruppen, Zeit und Ausrüstung wählen – GymBase stellt einen nachvollziehbaren Plan zusammen.</p>
            </Link>
          </ScrollReveal>
          <ScrollReveal>
            <Link to="/plaene/neu" className="card group block h-full p-8 transition hover:border-fg/30">
              <ClipboardList size={28} className="mb-4 text-muted" aria-hidden="true" />
              <h2 className="mb-2 text-2xl font-extrabold">Selbst erstellen</h2>
              <p className="text-muted">Trainingstage anlegen, Übungen aus Datenbank, Favoriten oder Sammlungen hinzufügen und Sätze, Wiederholungen und Pausen festlegen.</p>
            </Link>
          </ScrollReveal>
        </div>
      ) : (
        <ScrollReveal className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" stagger={0.08}>
          {plans.map((p) => {
            const active = p.id === activeId;
            const exCount = p.days.reduce((a, d) => a + d.exercises.length, 0);
            const avgMin = p.days.length ? Math.round(p.days.reduce((a, d) => a + estimateMinutes(d.exercises), 0) / p.days.length) : 0;
            return (
              <article key={p.id} className={`card flex flex-col p-6 ${active ? 'ring-1 ring-accent/60' : ''}`}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {active && (
                      <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg">
                        <CheckCircle2 size={12} aria-hidden="true" /> Aktiver Plan
                      </span>
                    )}
                    <h2 className="text-xl font-extrabold leading-tight">
                      <Link to={`/plaene/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {p.goal ? `${GOAL_LABEL[p.goal]} · ` : ''}geändert {formatDate(p.updatedAt)}
                    </p>
                  </div>
                </div>
                {p.description && <p className="mb-4 line-clamp-2 text-sm text-muted">{p.description}</p>}
                <ul className="mb-5 space-y-1.5 text-sm">
                  {p.days.slice(0, 6).map((d) => (
                    <li key={d.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {d.weekday !== null && <span className="mr-2 font-semibold text-accent">{WEEKDAY_SHORT[d.weekday]}</span>}
                        {d.name.replace(/^[A-Za-zäöü]+ – /, '')}
                      </span>
                      <span className="shrink-0 text-muted">{d.exercises.length} Üb.</span>
                    </li>
                  ))}
                </ul>
                <p className="mb-5 text-xs text-muted">
                  {p.days.length} Trainingstage · {exCount} Übungen · ca. {avgMin} min pro Einheit (Schätzung)
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link to={`/plaene/${p.id}`} className="btn-primary flex-1">
                    <Pencil size={16} aria-hidden="true" /> Bearbeiten
                  </Link>
                  {!active && (
                    <button
                      type="button"
                      className="icon-btn border hairline"
                      title="Als aktiven Plan festlegen"
                      aria-label={`${p.name} als aktiven Plan festlegen`}
                      onClick={() => {
                        setActivePlan(p.id);
                        toast(`„${p.name}“ ist jetzt der aktive Plan.`);
                      }}
                    >
                      <Star size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn border hairline"
                    title="Training mit diesem Plan starten"
                    aria-label={`Training mit ${p.name} starten`}
                    onClick={() => navigate(`/training?plan=${p.id}`)}
                  >
                    <Play size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn border hairline"
                    title="Duplizieren"
                    aria-label={`${p.name} duplizieren`}
                    onClick={() => {
                      const c = duplicatePlan(p.id);
                      if (c) toast(`Kopie „${c.name}“ erstellt.`);
                    }}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn border hairline hover:text-danger"
                    title="Löschen"
                    aria-label={`${p.name} löschen`}
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: 'Trainingsplan löschen?',
                        message: `„${p.name}“ wird dauerhaft gelöscht. Bereits dokumentierte Trainingseinheiten bleiben in deiner Historie erhalten.`,
                        confirmLabel: 'Plan löschen',
                        danger: true,
                      });
                      if (ok) {
                        deletePlan(p.id);
                        toast('Plan gelöscht.', 'info');
                      }
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </ScrollReveal>
      )}
    </div>
  );
}
