import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExerciseCard } from '../components/ExerciseCard';
import { FilterPanel } from '../components/FilterPanel';
import { EmptyState, PageHeader, SmartImage } from '../components/ui';
import { ScrollReveal } from '../animations';
import { useExercises } from '../store/appStore';
import { EMPTY_FILTER, filterExercises, type ExerciseFilter } from '../services/exerciseQuery';
import { MUSCLE_COVER, MUSCLE_LABEL, MUSCLES } from '../data/labels';
import type { MuscleGroup } from '../types';

const PAGE = 24;

export default function Exercises() {
  const all = useExercises();
  const [params, setParams] = useSearchParams();
  const initialMuscle = params.get('muskel') as MuscleGroup | null;
  const [filter, setFilter] = useState<ExerciseFilter>(() => ({ ...EMPTY_FILTER, muscles: initialMuscle && MUSCLES.includes(initialMuscle) ? [initialMuscle] : [] }));
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const m = params.get('muskel') as MuscleGroup | null;
    if (m && MUSCLES.includes(m)) setFilter((f) => (f.muscles.length === 1 && f.muscles[0] === m ? f : { ...EMPTY_FILTER, muscles: [m] }));
  }, [params]);

  const result = useMemo(() => filterExercises(all, filter), [all, filter]);
  const visible = result.slice(0, limit);
  const key = JSON.stringify(filter);

  const update = (f: ExerciseFilter) => {
    setFilter(f);
    setLimit(PAGE);
    if (params.get('muskel')) setParams({}, { replace: true });
  };

  const counts = useMemo(() => {
    const c = {} as Record<MuscleGroup, number>;
    for (const m of MUSCLES) c[m] = all.filter((e) => e.primaryMuscle === m).length;
    return c;
  }, [all]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Übungsdatenbank"
        title="Übungen"
        text={`${all.length} Übungen mit Technikhinweisen und aufklappbarer Fotoanleitung. Suche, filtere oder wähle eine Muskelgruppe.`}
        actions={
          <Link to="/sammlung?neu=1" className="btn-secondary">
            <Plus size={16} aria-hidden="true" /> Eigene Übung
          </Link>
        }
      />

      {/* Muskelübersicht */}
      <section aria-labelledby="muscle-h" className="mb-10">
        <h2 id="muscle-h" className="label mb-3">
          Muskelübersicht
        </h2>
        <ScrollReveal className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2" stagger={0.03} y={12}>
          {MUSCLES.map((m) => {
            const active = filter.muscles.length === 1 && filter.muscles[0] === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => update({ ...filter, muscles: active ? [] : [m] })}
                className={`group relative w-32 shrink-0 overflow-hidden rounded-2xl text-left transition ${active ? 'ring-2 ring-accent' : ''}`}
              >
                <SmartImage src={`exercises/${MUSCLE_COVER[m]}/1.jpg`} alt="" className="aspect-[4/5]" imgClassName="opacity-60 transition duration-500 group-hover:scale-110 group-hover:opacity-80" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" aria-hidden="true" />
                <span className="absolute bottom-2.5 left-3 right-2 text-white">
                  <span className="block text-sm font-bold">{MUSCLE_LABEL[m]}</span>
                  <span className="text-[11px] text-white/70">{counts[m]} Übungen</span>
                </span>
              </button>
            );
          })}
        </ScrollReveal>
      </section>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <FilterPanel value={filter} onChange={update} onReset={() => update(EMPTY_FILTER)} resultCount={result.length} />
        </aside>
        <section aria-label="Suchergebnisse">
          {result.length === 0 ? (
            <EmptyState icon={<SearchX size={26} />} title="Keine Übung gefunden" text="Passe Suche oder Filter an – oder lege eine eigene Übung an." action={{ label: 'Filter zurücksetzen', onClick: () => update(EMPTY_FILTER) }} />
          ) : (
            <>
              <ScrollReveal key={key} className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05} scale={0.97} deps={[key]}>
                {visible.map((e) => (
                  <ExerciseCard key={e.id} exercise={e} />
                ))}
              </ScrollReveal>
              {result.length > limit && (
                <div className="mt-8 flex justify-center">
                  <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                    Weitere Übungen laden ({result.length - limit})
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
