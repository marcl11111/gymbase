import { useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ExerciseFilter } from '../services/exerciseQuery';
import { isFilterActive } from '../services/exerciseQuery';
import { DIFFICULTIES, DIFFICULTY_LABEL, EQUIPMENT, EQUIPMENT_LABEL, EXERCISE_TYPES, MUSCLES, MUSCLE_LABEL, TYPE_LABEL } from '../data/labels';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

interface Props {
  value: ExerciseFilter;
  onChange: (f: ExerciseFilter) => void;
  onReset: () => void;
  resultCount?: number;
  /** Kompakte Variante (z. B. im Plan-Editor): nur Muskel- & Equipmentfilter */
  compact?: boolean;
  idPrefix?: string;
}

export function FilterPanel({ value, onChange, onReset, resultCount, compact, idPrefix = 'f' }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = value.muscles.length + value.equipment.length + value.difficulty.length + value.types.length;

  const group = <T extends string>(label: string, all: T[], selected: T[], labels: Record<T, string>, key: keyof ExerciseFilter) => (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={selected.includes(v)} onClick={() => onChange({ ...value, [key]: toggle(selected, v) })}>
            {labels[v]}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor={`${idPrefix}-search`} className="sr-only">
            Übungen durchsuchen
          </label>
          <input
            id={`${idPrefix}-search`}
            type="search"
            className="input pl-10 pr-10"
            placeholder="Übung oder Muskelgruppe suchen …"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            autoComplete="off"
          />
          {value.query && (
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg" onClick={() => onChange({ ...value, query: '' })} aria-label="Suche leeren">
              <X size={16} />
            </button>
          )}
        </div>
        <button type="button" className={`btn-secondary ${compact ? '' : 'lg:hidden'}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">{activeCount}</span>}
        </button>
      </div>
      <div className={`${open ? 'block' : 'hidden'} ${compact ? '' : 'lg:block'} card space-y-5 p-4`}>
        {group('Muskelgruppe', MUSCLES, value.muscles, MUSCLE_LABEL, 'muscles')}
        {group('Equipment', EQUIPMENT, value.equipment, EQUIPMENT_LABEL, 'equipment')}
        {!compact && group('Schwierigkeitsgrad', DIFFICULTIES, value.difficulty, DIFFICULTY_LABEL, 'difficulty')}
        {!compact && group('Übungstyp', EXERCISE_TYPES, value.types, TYPE_LABEL, 'types')}
      </div>
      <div className="flex min-h-[32px] items-center justify-between text-sm text-muted">
        {resultCount !== undefined && (
          <span aria-live="polite">
            {resultCount} {resultCount === 1 ? 'Übung' : 'Übungen'}
          </span>
        )}
        {isFilterActive(value) && (
          <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" /> Alle Filter zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
