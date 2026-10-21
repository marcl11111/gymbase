import type { PlanDay, WorkoutPlan, WorkoutSession } from '../types';
import { weekdayOf } from '../utils';
import { finishedSessions } from './stats';

export interface NextTraining {
  day: PlanDay;
  /** 0 = heute */
  inDays: number | null;
  reason: 'wochentag' | 'rotation';
}

/**
 * Nächster Trainingstag des aktiven Plans:
 *  - Tage mit Wochentag: nächster passender Wochentag (heute zählt, solange heute noch nicht trainiert wurde)
 *  - sonst: Rotation – Tag nach dem zuletzt absolvierten Tag dieses Plans
 */
export function nextTraining(plan: WorkoutPlan | undefined, sessions: WorkoutSession[], now = new Date()): NextTraining | null {
  if (!plan || plan.days.length === 0) return null;
  const today = weekdayOf(now);
  const planSessions = finishedSessions(sessions).filter((s) => s.planId === plan.id);
  const trainedToday = planSessions.some((s) => new Date(s.startedAt).toDateString() === now.toDateString());
  const withWeekday = plan.days.filter((d) => d.weekday !== null);
  if (withWeekday.length) {
    let best: NextTraining | null = null;
    for (const d of withWeekday) {
      let diff = ((d.weekday as number) - today + 7) % 7;
      if (diff === 0 && trainedToday) diff = 7;
      if (!best || diff < (best.inDays ?? 99)) best = { day: d, inDays: diff, reason: 'wochentag' };
    }
    return best;
  }
  const last = planSessions[planSessions.length - 1];
  const lastIdx = last ? plan.days.findIndex((d) => d.id === last.dayId) : -1;
  return { day: plan.days[(lastIdx + 1) % plan.days.length], inDays: null, reason: 'rotation' };
}

export function inDaysLabel(n: number | null): string {
  if (n === null) return 'Als Nächstes';
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  return `In ${n} Tagen`;
}
