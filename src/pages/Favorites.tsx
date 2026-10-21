import { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { ScrollReveal } from '../animations';
import { ExerciseCard } from '../components/ExerciseCard';
import { EmptyState, PageHeader } from '../components/ui';
import { findExercise, useApp } from '../store/appStore';
import { MUSCLE_LABEL } from '../data/labels';
import type { Exercise, MuscleGroup } from '../types';

export default function Favorites() {
  const data = useApp((s) => s);
  const favs = useMemo(() => data.favorites.map((id) => findExercise(id, data)).filter((e): e is Exercise => !!e), [data]);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const muscles = [...new Set(favs.map((f) => f.primaryMuscle))];
  const shown = muscle ? favs.filter((f) => f.primaryMuscle === muscle) : favs;
  return (
    <div className="page">
      <PageHeader eyebrow="Persönlich" title="Favoriten" text="Deine markierten Übungen auf einen Blick." />
      {favs.length === 0 ? (
        <EmptyState icon={<Heart size={26} />} title="Noch keine Favoriten" text="Tippe auf das Herz einer Übung, um sie hier zu sammeln." action={{ label: 'Übungen entdecken', to: '/uebungen' }} />
      ) : (
        <>
          {muscles.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Nach Muskelgruppe filtern">
              <button type="button" className="chip" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
                Alle ({favs.length})
              </button>
              {muscles.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
                  {MUSCLE_LABEL[m]}
                </button>
              ))}
            </div>
          )}
          <ScrollReveal key={muscle ?? 'all'} className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
            {shown.map((e) => (
              <ExerciseCard key={e.id} exercise={e} />
            ))}
          </ScrollReveal>
        </>
      )}
    </div>
  );
}
