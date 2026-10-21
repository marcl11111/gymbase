import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardList, Dumbbell, Flame, Heart, Play, Search, Sparkles, Trophy, Weight } from 'lucide-react';
import { gsap, useGsap } from '../animations/gsap';
import { ParallaxSection, PinnedSection, ScrollReveal, SplitHeadline } from '../animations';
import { AnimatedLogo } from '../components/Logo';
import { BarChart } from '../components/Charts';
import { EmptyState, SmartImage, Stat } from '../components/ui';
import { buildSessionFromDay, findExercise, startSession, useApp, useExercises } from '../store/appStore';
import { finishedSessions, personalRecords, sessionDurationMs, sessionsThisWeek, sessionVolume, weeklyBuckets } from '../services/stats';
import { inDaysLabel, nextTraining } from '../services/schedule';
import { MUSCLE_COVER, MUSCLE_LABEL, TRAINABLE_MUSCLES, WEEKDAY_SHORT, WEEKDAYS } from '../data/labels';
import { assetUrl, formatDate, formatDuration, formatNumber, formatWeight, startOfWeek, weekdayOf } from '../utils';
import { confirmDialog, toast } from '../store/uiStore';

const HERO_IMG = 'exercises/Barbell_Squat/1.jpg';

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Hero: Logo + Begrüßung; beim Scrollen zoomt das Bild auf, die Sektion bleibt kurz stehen */
function Hero({ name }: { name: string }) {
  const now = new Date();
  const ref = useGsap<HTMLElement>(({ root, reduced, small }) => {
    if (reduced) return;
    const frame = root.querySelector('[data-hero-frame]');
    const img = root.querySelector('[data-hero-img]');
    const copy = root.querySelector('[data-hero-copy]');
    const caption = root.querySelector('[data-hero-caption]');
    gsap.from(root.querySelector('[data-hero-intro]'), { y: 60, opacity: 0, duration: 1.1, delay: 0.25, ease: 'expo.out' });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: small ? '+=55%' : '+=90%',
        scrub: 0.6,
        pin: !small,
        anticipatePin: 1,
      },
    });
    tl.to(copy, { opacity: 0, y: -60, ease: 'none' }, 0)
      .fromTo(frame, { scale: small ? 1 : 0.78, borderRadius: 28 }, { scale: small ? 1.04 : 1, borderRadius: small ? 20 : 8, ease: 'none' }, 0)
      .fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none' }, 0)
      .fromTo(caption, { opacity: 0, y: 30 }, { opacity: 1, y: 0, ease: 'none' }, 0.45);
  });
  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden px-4 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <div data-hero-copy className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-3">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <SplitHeadline as="h1" trigger="load" delay={0.2} className="text-4xl font-black leading-[1.02] sm:text-6xl lg:text-7xl" text={`${greeting(now)}${name ? `, ${name}` : ''}.`} />
          <p className="mt-4 max-w-xl text-lg text-muted">Übungen entdecken, Pläne bauen, Training dokumentieren – alles an einem Ort.</p>
        </div>
        <AnimatedLogo mode="intro" delay={0.1} className="hidden w-56 shrink-0 lg:block" />
      </div>
      <div data-hero-intro className="relative mx-auto mt-8 w-full max-w-7xl flex-1 pb-8">
        <div data-hero-frame className="relative h-[46svh] w-full overflow-hidden rounded-[28px] will-change-transform sm:h-[56svh]">
          <img data-hero-img src={assetUrl(HERO_IMG) ?? ''} alt="Kniebeuge mit der Langhantel im Rack" className="h-full w-full object-cover object-[50%_35%] will-change-transform" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div data-hero-caption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fdc910]">GymBase</p>
            <p className="mt-2 max-w-lg text-2xl font-extrabold leading-tight sm:text-4xl">Jede Wiederholung zählt. Jede wird gespeichert.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const data = useApp((s) => s);
  const exercises = useExercises();
  const activePlan = data.plans.find((p) => p.id === data.activePlanId);
  const finished = useMemo(() => finishedSessions(data.sessions), [data.sessions]);
  const next = nextTraining(activePlan, data.sessions);
  const prs = useMemo(() => personalRecords(data.sessions).filter((p) => p.maxWeight), [data.sessions]);
  const weeks = useMemo(() => weeklyBuckets(data.sessions, 8), [data.sessions]);
  const savedCount = new Set([...data.favorites, ...data.collections.flatMap((c) => c.exerciseIds), ...data.customExercises.map((e) => e.id)]).size;
  const thisWeekVolume = weeks[weeks.length - 1]?.volume ?? 0;
  const weekStart = startOfWeek(new Date()).getTime();
  const trainedWeekdays = new Set(finished.filter((s) => Date.parse(s.startedAt) >= weekStart).map((s) => weekdayOf(new Date(s.startedAt))));
  const plannedWeekdays = new Set(activePlan?.days.map((d) => d.weekday).filter((w): w is NonNullable<typeof w> => w !== null));
  const favs = data.favorites.map((id) => findExercise(id, data)).filter(Boolean).slice(0, 8);
  const unit = data.settings.unit;

  const start = async () => {
    if (!activePlan || !next) return;
    if (data.activeSession) {
      const ok = await confirmDialog({ title: 'Training läuft bereits', message: 'Es ist bereits eine Trainingseinheit aktiv. Möchtest du zu ihr wechseln?', confirmLabel: 'Zum laufenden Training' });
      if (ok) navigate('/training');
      return;
    }
    startSession(buildSessionFromDay(activePlan, next.day));
    toast(`Training „${next.day.name}“ gestartet.`);
    navigate('/training');
  };

  return (
    <div>
      <Hero name={data.settings.userName} />

      <div className="mx-auto max-w-7xl space-y-16 px-4 pb-28 sm:px-6 lg:px-10 lg:pb-20">
        {/* Kennzahlen */}
        <section aria-labelledby="kpi-h">
          <h2 id="kpi-h" className="sr-only">
            Kennzahlen
          </h2>
          <ScrollReveal className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" stagger={0.07}>
            <Stat label="Diese Woche" value={sessionsThisWeek(data.sessions)} hint="Trainingseinheiten" icon={<Flame size={18} />} />
            <Stat label="Gesamt" value={finished.length} hint="Trainingseinheiten" icon={<CalendarDays size={18} />} />
            <Stat label="Gespeichert" value={savedCount} hint="Übungen in Favoriten, Sammlungen & eigene" icon={<Heart size={18} />} />
            <Stat label="Rekorde" value={prs.length} hint="Übungen mit Bestleistung" icon={<Trophy size={18} />} />
            <Stat label="Volumen" value={thisWeekVolume ? formatNumber(unit === 'kg' ? thisWeekVolume : thisWeekVolume / 0.45359237) : '–'} hint={`${unit} × Wdh. diese Woche`} icon={<Weight size={18} />} />
          </ScrollReveal>
        </section>

        {/* Plan & nächster Tag */}
        <section aria-labelledby="plan-h" className="grid gap-4 lg:grid-cols-5">
          <ScrollReveal className="lg:col-span-3">
            <div className="card relative h-full overflow-hidden p-6 sm:p-8">
              <p className="eyebrow mb-2">Nächster Trainingstag</p>
              {activePlan && next ? (
                <>
                  <h2 id="plan-h" className="text-3xl font-extrabold sm:text-4xl">
                    {next.day.name}
                  </h2>
                  <p className="mt-2 text-muted">
                    <span className="font-semibold text-fg">{inDaysLabel(next.inDays)}</span> · {next.day.exercises.length} Übungen · Plan „{activePlan.name}“
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {next.day.exercises.slice(0, 6).map((pe) => (
                      <li key={pe.uid} className="tag">
                        {findExercise(pe.exerciseId, data)?.name ?? 'Unbekannte Übung'}
                      </li>
                    ))}
                    {next.day.exercises.length > 6 && <li className="tag">+{next.day.exercises.length - 6} weitere</li>}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button type="button" className="btn-primary" onClick={start} disabled={next.day.exercises.length === 0}>
                      <Play size={16} aria-hidden="true" /> Training starten
                    </button>
                    <Link to={`/plaene/${activePlan.id}`} className="btn-secondary">
                      Plan bearbeiten
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 id="plan-h" className="text-3xl font-extrabold">
                    Noch kein aktiver Plan
                  </h2>
                  <p className="mt-2 max-w-md text-muted">Erstelle einen Trainingsplan selbst oder lass dir anhand deiner Ziele, Trainingstage und Muskelgruppen einen Vorschlag generieren.</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link to="/plaene/generator" className="btn-primary">
                      <Sparkles size={16} aria-hidden="true" /> Plan generieren
                    </Link>
                    <Link to="/plaene" className="btn-secondary">
                      <ClipboardList size={16} aria-hidden="true" /> Selbst erstellen
                    </Link>
                  </div>
                </>
              )}
            </div>
          </ScrollReveal>
          <ScrollReveal className="lg:col-span-2">
            <div className="card h-full p-6">
              <p className="eyebrow mb-4">Diese Woche</p>
              <ul className="grid grid-cols-7 gap-1.5" aria-label="Trainingstage dieser Woche">
                {WEEKDAYS.map((w) => {
                  const done = trainedWeekdays.has(w);
                  const planned = plannedWeekdays.has(w);
                  const isToday = weekdayOf(new Date()) === w;
                  return (
                    <li key={w} className="flex flex-col items-center gap-2">
                      <span className={`text-xs font-semibold ${isToday ? 'text-fg' : 'text-muted'}`}>{WEEKDAY_SHORT[w]}</span>
                      <span
                        className={`flex h-10 w-full items-center justify-center rounded-xl text-xs font-bold ${done ? 'bg-accent text-accent-fg' : planned ? 'border-2 border-dashed border-accent/50 text-accent' : 'bg-fg/5 text-muted'} ${isToday ? 'ring-2 ring-fg/30' : ''}`}
                        aria-label={`${WEEKDAY_SHORT[w]}: ${done ? 'trainiert' : planned ? 'geplant' : 'kein Training'}`}
                      >
                        {done ? '✓' : planned ? '•' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-muted">Gefüllt = trainiert · gestrichelt = laut aktivem Plan geplant</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link to="/uebungen" className="btn-secondary">
                  <Search size={16} aria-hidden="true" /> Übungen
                </Link>
                <Link to="/fortschritt" className="btn-secondary">
                  Fortschritt <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* Volumen */}
        <section aria-labelledby="vol-h">
          <ScrollReveal>
            <div className="card p-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="eyebrow mb-1">Verlauf</p>
                  <h2 id="vol-h" className="text-2xl font-extrabold">
                    Trainingsvolumen pro Woche
                  </h2>
                </div>
                <span className="text-xs text-muted">letzte 8 Wochen</span>
              </div>
              {weeks.some((w) => w.volume > 0) ? (
                <BarChart
                  labels={weeks.map((w) => `KW ab ${w.label}`)}
                  series={[{ label: 'Volumen', data: weeks.map((w) => Math.round(unit === 'kg' ? w.volume : w.volume / 0.45359237)) }]}
                  unit={`${unit} × Wdh.`}
                  ariaLabel="Balkendiagramm: Trainingsvolumen pro Woche der letzten acht Wochen"
                />
              ) : (
                <p className="rounded-xl bg-fg/5 p-6 text-center text-sm text-muted">Sobald du Trainingseinheiten mit Gewicht und Wiederholungen dokumentierst, erscheint hier dein Wochenvolumen.</p>
              )}
            </div>
          </ScrollReveal>
        </section>

        {/* Letzte Einheiten & Rekorde */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ScrollReveal>
            <div className="card h-full p-6">
              <h2 className="mb-4 text-xl font-extrabold">Zuletzt trainiert</h2>
              {finished.length ? (
                <ul className="divide-y divide-fg/5">
                  {finished
                    .slice(-5)
                    .reverse()
                    .map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{s.dayName || s.planName}</p>
                          <p className="text-xs text-muted">
                            {formatDate(s.startedAt, { weekday: 'short', day: '2-digit', month: '2-digit' })} · {formatDuration(sessionDurationMs(s))} · {s.exercises.length} Übungen
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatWeight(sessionVolume(s), unit)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <EmptyState className="border-0 shadow-none" icon={<Dumbbell size={24} />} title="Noch keine Einheit" text="Starte deine erste Trainingseinheit im Trainingsmodus." action={{ label: 'Zum Trainingsmodus', to: '/training' }} />
              )}
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card h-full p-6">
              <h2 className="mb-4 text-xl font-extrabold">Persönliche Bestleistungen</h2>
              {prs.length ? (
                <ul className="divide-y divide-fg/5">
                  {[...prs]
                    .sort((a, b) => Date.parse(b.maxWeight!.date) - Date.parse(a.maxWeight!.date))
                    .slice(0, 5)
                    .map((p) => (
                      <li key={p.exerciseId} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.exerciseName}</p>
                          <p className="text-xs text-muted">{formatDate(p.maxWeight!.date)}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatWeight(p.maxWeight!.value, unit)} × {p.maxWeight!.reps}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <EmptyState className="border-0 shadow-none" icon={<Trophy size={24} />} title="Noch keine Rekorde" text="Bestleistungen werden automatisch aus deinen gespeicherten Sätzen erkannt." />
              )}
            </div>
          </ScrollReveal>
        </section>

        {/* Favoriten */}
        <section aria-labelledby="fav-h">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="fav-h" className="text-2xl font-extrabold">
              Favorisierte Übungen
            </h2>
            <Link to="/favoriten" className="text-sm font-semibold text-accent hover:underline">
              Alle anzeigen
            </Link>
          </div>
          {favs.length ? (
            <ScrollReveal className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2" stagger={0.05}>
              {favs.map((e) => (
                <Link key={e!.id} to={`/uebungen/${encodeURIComponent(e!.id)}`} className="card group w-56 shrink-0 snap-start overflow-hidden">
                  <SmartImage src={e!.imageUrl} alt={e!.name} className="aspect-[3/2]" imgClassName="transition duration-500 group-hover:scale-105" />
                  <div className="p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">{MUSCLE_LABEL[e!.primaryMuscle]}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold">{e!.name}</p>
                  </div>
                </Link>
              ))}
            </ScrollReveal>
          ) : (
            <EmptyState icon={<Heart size={24} />} title="Noch keine Favoriten" text="Markiere Übungen mit dem Herz, um sie hier schnell zu finden." action={{ label: 'Übungen entdecken', to: '/uebungen' }} />
          )}
        </section>
      </div>

      {/* Muskelgruppen-Schnellzugriff mit Parallax */}
      <ParallaxSection image={assetUrl('exercises/Wide-Grip_Lat_Pulldown/1.jpg') ?? ''} className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <p className="eyebrow mb-2">Übungsdatenbank</p>
          <SplitHeadline as="h2" className="mb-8 text-3xl font-black sm:text-5xl" text={`${exercises.length} Übungen. Wähle eine Muskelgruppe.`} />
          <ScrollReveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" stagger={0.04} y={20} scale={0.96}>
            {TRAINABLE_MUSCLES.map((m) => (
              <Link key={m} to={`/uebungen?muskel=${m}`} className="group relative block overflow-hidden rounded-2xl">
                <SmartImage src={`exercises/${MUSCLE_COVER[m]}/1.jpg`} alt="" className="aspect-square" imgClassName="opacity-70 transition duration-500 group-hover:scale-110 group-hover:opacity-90" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
                <span className="absolute bottom-3 left-3 font-bold text-white">{MUSCLE_LABEL[m]}</span>
              </Link>
            ))}
          </ScrollReveal>
        </div>
      </ParallaxSection>

      {finished.length < 3 && (
        <PinnedSection
          steps={[
            { eyebrow: '01 · Entdecken', title: 'Übungen verstehen', text: 'Jede Übung mit Beschreibung, Technikhinweisen und aufklappbarer Fotoanleitung Schritt für Schritt.', image: assetUrl('exercises/Dumbbell_Bench_Press/0.jpg') ?? '', imageAlt: 'Kurzhantel-Bankdrücken' },
            { eyebrow: '02 · Planen', title: 'Plan selbst bauen oder generieren', text: 'Wähle Ziel, Trainingstage und Muskelgruppen – GymBase schlägt einen vollständig bearbeitbaren Plan vor.', image: assetUrl('exercises/Seated_Cable_Rows/1.jpg') ?? '', imageAlt: 'Rudern am Kabel' },
            { eyebrow: '03 · Trainieren', title: 'Sätze abhaken, Pausen timen', text: 'Im Trainingsmodus trägst du Gewicht und Wiederholungen ein – mit Pausentimer und letzter Leistung.', image: assetUrl('exercises/Barbell_Deadlift/1.jpg') ?? '', imageAlt: 'Kreuzheben' },
            { eyebrow: '04 · Fortschritt', title: 'Entwicklung sehen', text: 'Diagramme und Bestleistungen werden ausschließlich aus deinen gespeicherten Trainingsdaten berechnet.', image: assetUrl('exercises/Standing_Military_Press/1.jpg') ?? '', imageAlt: 'Schulterdrücken' },
          ]}
        />
      )}
    </div>
  );
}
