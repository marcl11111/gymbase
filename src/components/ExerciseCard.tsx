import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, Plus, UserRound } from 'lucide-react';
import type { Exercise } from '../types';
import { DIFFICULTY_LABEL, EQUIPMENT_LABEL, MUSCLE_LABEL } from '../data/labels';
import { SmartImage } from './ui';
import { PhotoGuide } from './PhotoGuide';
import { AddToDialog } from './AddToDialog';
import { toggleFavorite, useApp } from '../store/appStore';
import { toast } from '../store/uiStore';

export function FavoriteButton({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  const fav = useApp((s) => s.favorites.includes(id));
  return (
    <button
      type="button"
      className={`icon-btn ${fav ? 'text-accent hover:text-accent' : ''} ${className}`}
      aria-pressed={fav}
      aria-label={fav ? `${name} aus Favoriten entfernen` : `${name} zu Favoriten hinzufügen`}
      title={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
      onClick={() => {
        const added = toggleFavorite(id);
        toast(added ? `„${name}“ zu Favoriten hinzugefügt.` : `„${name}“ aus Favoriten entfernt.`, added ? 'success' : 'info');
      }}
    >
      <Heart size={20} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

export function DifficultyDots({ d }: { d: Exercise['difficulty'] }) {
  const n = d === 'anfaenger' ? 1 : d === 'fortgeschritten' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={DIFFICULTY_LABEL[d]}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= n ? 'bg-accent' : 'bg-fg/15'}`} />
        ))}
      </span>
      {DIFFICULTY_LABEL[d]}
    </span>
  );
}

export function ExerciseCard({ exercise, extraAction }: { exercise: Exercise; extraAction?: React.ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-fg/20">
      <Link to={`/uebungen/${encodeURIComponent(exercise.id)}`} className="relative block" aria-label={`${exercise.name} – Details öffnen`} tabIndex={-1}>
        <SmartImage src={exercise.imageUrl} alt={exercise.name} className="aspect-[3/2]" imgClassName="transition duration-700 ease-out group-hover:scale-[1.04]" />
        {exercise.isCustom && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
            <UserRound size={12} aria-hidden="true" /> Eigene Übung
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{MUSCLE_LABEL[exercise.primaryMuscle]}</p>
            <h3 className="mt-1 text-base font-bold leading-snug">
              <Link to={`/uebungen/${encodeURIComponent(exercise.id)}`} className="hover:underline">
                {exercise.name}
              </Link>
            </h3>
          </div>
          <FavoriteButton id={exercise.id} name={exercise.name} className="-mr-2 -mt-2" />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="tag">{EQUIPMENT_LABEL[exercise.equipment]}</span>
          <DifficultyDots d={exercise.difficulty} />
        </div>
        <div className="mt-auto flex gap-2">
          <Link to={`/uebungen/${encodeURIComponent(exercise.id)}`} className="btn-secondary flex-1">
            Details <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setAddOpen(true)} aria-label={`${exercise.name} zu Sammlung oder Trainingsplan hinzufügen`} title="Zu Sammlung oder Plan hinzufügen">
            <Plus size={18} aria-hidden="true" />
          </button>
          {extraAction}
        </div>
        <div className="-mx-2 mt-2 border-t hairline pt-2">
          <PhotoGuide exercise={exercise} compact />
        </div>
      </div>
      {addOpen && <AddToDialog exercise={exercise} open={addOpen} onClose={() => setAddOpen(false)} />}
    </article>
  );
}
