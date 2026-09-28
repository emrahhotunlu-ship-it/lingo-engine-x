import { useMemo } from 'react';
import { useLive } from '../../data/live';
import { mergeArchives } from '../../domain/capacity/compact';
import { legacyDayKey } from '../../domain/date';
import { computeStreak, pflichtDays } from '../../domain/streak';
import { useClock } from '../clock';

// Serie für den Profil-Knopf oben links (plan.md §1.2, architektur.md §2.5): dieselbe Rechnung wie
// auf Heute (`computeStreak` unverändert, ausgelagerte Jahre zählen mit). Nur mit Selektoren (G7).

const EMPTY: ReadonlyMap<string, Record<string, unknown>> = new Map();

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function useStreakCount(): number | null {
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const archive = useLive((s) => s.collections.archive) ?? EMPTY;
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  return useMemo(() => {
    if (!profile) return null;
    const p = obj(mergeArchives(obj(profile), archive.values()));
    const since = obj(schema).pflichtSince;
    return computeStreak({
      days: obj(p.days) as Record<string, number>,
      xpDays: obj(p.xpDays) as Record<string, number>,
      pflichtSince: typeof since === 'string' ? since : null,
      pflichtDone: pflichtDays(p.pflicht),
      today,
      legacyToday: legacyDayKey(now),
    }).count;
  }, [profile, schema, archive, today, now]);
}

/** Initiale für den Profil-Knopf (`app/profile.name`), sonst `null` (dann ein Symbol). */
export function useInitial(): string | null {
  const name = useLive((s) => s.docs['app/profile']?.name);
  if (typeof name !== 'string') return null;
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : null;
}
