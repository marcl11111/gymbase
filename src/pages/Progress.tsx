import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Trash2, Trophy } from 'lucide-react';
import { ScrollReveal } from '../animations';
import { BarChart, LineChart } from '../components/Charts';
import { EmptyState, PageHeader, Stat } from '../components/ui';
import { deleteSession, useApp } from '../store/appStore';
import { confirmDialog, toast } from '../store/uiStore';
import { completedSets, exerciseProgress, finishedSessions, personalRecords, sessionDurationMs, sessionSetCount, sessionVolume, trainedExerciseIds, weeklyBuckets } from '../services/stats';
import { formatDate, formatDuration, formatNumber, formatWeight, toDisplayWeight } from '../utils';

const RANGES = [
  { key: '4w', label: '4 Wochen', weeks: 4 },
  { key: '12w', label: '12 Wochen', weeks: 12 },
  { key: '26w', label: '6 Monate', weeks: 26 },
  { key: '52w', label: '1 Jahr', weeks: 52 },
] as const;

export default function Progress() {
  const sessions = useApp((s) => s.sessions);
  const unit = useApp((s) => s.settings.unit);
  const finished = useMemo(() => finishedSessions(sessions), [sessions]);
  const trained = useMemo(() => trainedExerciseIds(sessions), [sessions]);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('12w');
  const [openSession, setOpenSession] = useState<string | null>(null);

  const selected = exerciseId || trained[0]?.id || '';
  const weeks = RANGES.find((r) => r.key === range)!.weeks;
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - weeks * 7);
    return d;
  }, [weeks]);
  const buckets = useMemo(() => weeklyBuckets(sessions, weeks), [sessions, weeks]);
  const points = useMemo(() => (selected ? exerciseProgress(sessions, selected, from) : []), [sessions, selected, from]);
  const prs = useMemo(() => personalRecords(sessions), [sessions]);
  const inRange = finished.filter((s) => Date.parse(s.startedAt) >= from.getTime());
  const conv = (kg: number | null) => toDisplayWeight(kg, unit);

  if (finished.length === 0) {
    return (
      <div className="page">
        <PageHeader eyebrow="Statistik" title="Fortschritt" />
        <EmptyState icon={<BarChart3 size={26} />} title="Noch keine Trainingsdaten" text="Diagramme und Bestleistungen werden ausschließlich aus deinen gespeicherten Trainingseinheiten berechnet. Starte dein erstes Training im Trainingsmodus." action={{ label: 'Training starten', to: '/training' }} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Statistik" title="Fortschritt" text="Alle Werte basieren auf deinen gespeicherten, abgeschlossenen Trainingseinheiten." />

      {/* Filterleiste */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <label htmlFor="pr-ex" className="label">
            Übung
          </label>
          <select id="pr-ex" className="input" value={selected} onChange={(e) => setExerciseId(e.target.value)}>
            {trained.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.count}×)
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Zeitraum">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className="chip min-h-[44px]" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollReveal className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4" stagger={0.06}>
        <Stat label="Einheiten" value={inRange.length} hint="im Zeitraum" />
        <Stat label="Pro Woche" value={formatNumber(inRange.length / weeks, 1)} hint="Durchschnitt" />
        <Stat label="Volumen" value={formatNumber(conv(inRange.reduce((a, s) => a + sessionVolume(s), 0)) ?? 0)} hint={`${unit} × Wdh. im Zeitraum`} />
        <Stat label="Sätze" value={inRange.reduce((a, s) => a + sessionSetCount(s), 0)} hint="abgehakt im Zeitraum" />
      </ScrollReveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScrollReveal className="lg:col-span-2">
          <section className="card p-5 sm:p-6" aria-labelledby="w-h">
            <h2 id="w-h" className="text-xl font-extrabold">
              Gewichtsentwicklung
            </h2>
            <p className="mb-4 text-sm text-muted">{trained.find((t) => t.id === selected)?.name}: schwerster Satz je Einheit. Das 1RM ist eine Schätzung (Epley-Formel, nur Sätze bis 12 Wdh.).</p>
            {points.length >= 2 ? (
              <LineChart
                labels={points.map((p) => formatDate(p.date, { day: '2-digit', month: '2-digit' }))}
                series={[
                  { label: 'Max. Gewicht', data: points.map((p) => conv(p.maxWeight)) },
                  { label: 'Geschätztes 1RM', data: points.map((p) => conv(p.est1RM)), dashed: true, secondary: true },
                ]}
                unit={unit}
                ariaLabel="Liniendiagramm der Gewichtsentwicklung"
              />
            ) : (
              <p className="rounded-xl bg-fg/5 p-6 text-center text-sm text-muted">Für einen Verlauf werden mindestens zwei Einheiten mit dieser Übung im gewählten Zeitraum benötigt ({points.length} vorhanden).</p>
            )}
          </section>
        </ScrollReveal>
        <ScrollReveal>
          <section className="card h-full p-5 sm:p-6" aria-labelledby="v-h">
            <h2 id="v-h" className="mb-4 text-xl font-extrabold">
              Trainingsvolumen pro Woche
            </h2>
            <BarChart labels={buckets.map((b) => b.label)} series={[{ label: 'Volumen', data: buckets.map((b) => Math.round(conv(b.volume) ?? 0)) }]} unit={`${unit} × Wdh.`} ariaLabel="Balkendiagramm Trainingsvolumen pro Woche" />
          </section>
        </ScrollReveal>
        <ScrollReveal>
          <section className="card h-full p-5 sm:p-6" aria-labelledby="f-h">
            <h2 id="f-h" className="mb-4 text-xl font-extrabold">
              Trainingseinheiten pro Woche
            </h2>
            <BarChart labels={buckets.map((b) => b.label)} series={[{ label: 'Einheiten', data: buckets.map((b) => b.sessions) }]} ariaLabel="Balkendiagramm Anzahl Trainingseinheiten pro Woche" />
          </section>
        </ScrollReveal>
      </div>

      {/* Bestleistungen */}
      <ScrollReveal className="mt-10">
        <section aria-labelledby="pr-h">
          <h2 id="pr-h" className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
            <Trophy size={22} className="text-accent" aria-hidden="true" /> Persönliche Bestleistungen
          </h2>
          {prs.length && prs.some((p) => p.maxWeight) ? (
            <div className="mb-6 card p-5 sm:p-6">
              <BarChart
                labels={prs.filter((p) => p.maxWeight).slice(0, 12).map((p) => (p.exerciseName.length > 18 ? `${p.exerciseName.slice(0, 16)}…` : p.exerciseName))}
                series={[{ label: 'Höchstes Gewicht', data: prs.filter((p) => p.maxWeight).slice(0, 12).map((p) => conv(p.maxWeight!.value)) }]}
                unit={unit}
                digits={1}
                ariaLabel="Balkendiagramm höchstes dokumentiertes Gewicht je Übung"
              />
            </div>
          ) : null}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr className="border-b hairline">
                  <th className="px-4 py-3">Übung</th>
                  <th className="px-4 py-3">Höchstes Gewicht</th>
                  <th className="px-4 py-3">Meiste Wdh.</th>
                  <th className="px-4 py-3">1RM (geschätzt)</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((p) => (
                  <tr key={p.exerciseId} className="border-b hairline last:border-0">
                    <td className="px-4 py-3 font-semibold">{p.exerciseName}</td>
                    <td className="px-4 py-3 tabular-nums">{p.maxWeight ? `${formatWeight(p.maxWeight.value, unit)} × ${p.maxWeight.reps}` : '–'}</td>
                    <td className="px-4 py-3 tabular-nums">{p.maxReps ? `${p.maxReps.value}${p.maxReps.weight ? ` @ ${formatWeight(p.maxReps.weight, unit)}` : ''}` : '–'}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{p.est1RM ? `≈ ${formatWeight(p.est1RM.value, unit)}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </ScrollReveal>

      {/* Historie */}
      <section aria-labelledby="hist-h" className="mt-10">
        <h2 id="hist-h" className="mb-4 text-2xl font-extrabold">
          Trainingshistorie
        </h2>
        <ul className="space-y-2">
          {[...finished].reverse().map((s) => {
            const open = openSession === s.id;
            return (
              <li key={s.id} className="card">
                <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open} onClick={() => setOpenSession(open ? null : s.id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.dayName || s.planName}</span>
                    <span className="block text-xs text-muted">
                      {formatDate(s.startedAt, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} · {formatDuration(sessionDurationMs(s))} · {sessionSetCount(s)} Sätze · {formatWeight(sessionVolume(s), unit)}
                    </span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {open && (
                  <div className="border-t hairline p-4">
                    <ul className="space-y-3">
                      {s.exercises.map((e, i) => (
                        <li key={i}>
                          <p className="text-sm font-semibold">{e.exerciseName}</p>
                          <p className="text-xs text-muted">
                            {completedSets(e.sets).length
                              ? completedSets(e.sets)
                                  .map((x) => `${toDisplayWeight(x.weight, unit) ?? 0} ${unit} × ${x.reps}`)
                                  .join(' · ')
                              : 'Keine Sätze abgehakt'}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {s.notes && <p className="mt-3 rounded-lg bg-fg/5 p-3 text-sm">{s.notes}</p>}
                    <button
                      type="button"
                      className="btn-danger mt-4 h-10 min-h-0"
                      onClick={async () => {
                        const ok = await confirmDialog({ title: 'Einheit löschen?', message: 'Diese Trainingseinheit wird aus der Historie entfernt. Statistiken und Bestleistungen werden neu berechnet.', confirmLabel: 'Löschen', danger: true });
                        if (ok) {
                          deleteSession(s.id);
                          toast('Einheit gelöscht.', 'info');
                        }
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" /> Einheit löschen
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
