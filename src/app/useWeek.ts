import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useLive } from '../data/live';
import { watchDoc } from '../data/watch';
import { readWeekDoc, themeFor, unitPlanFor, weekTargets } from '../domain/week';
import type { UnitPlan, WeekTargets, WeekTheme } from '../domain/week/types';
import { getDb, useCapabilities } from '../platform/capabilities';
import { useClock } from './clock';

// Wochenthema, Wochenziele und Tagesplan der Einheit (docs/neubau/plan.md §1.5, §4.10).
// Liest `app/week` über GENAU EIN Abo, egal wie viele Bildschirme `useWeek` nutzen (Referenzzählung
// wie `data/watch.ts`, plan.md §8 00:35), nur solange ein Nutzer eingehängt ist; tolerant über
// `readWeekDoc`. Gerechnet wird mit `domain/week` (P7a). Der Plan hängt nie von `env` ab
// (Prüfbefund M5): Rückfälle ohne KI/Sprachausgabe entscheidet P1 beim Blockstart mit
// `resolveBlock(block, env)`. P1 friert den Plan je Lerntag ein (`lx:plan:<tag>`).

export type WeekState = { theme: WeekTheme | null; targets: WeekTargets; plan: UnitPlan | null };

/** Reine Ableitung für einen Lerntag (getestet). */
export function weekFor(day: string, raw: unknown, prefs: { goalMin?: number } = {}): WeekState {
  const week = readWeekDoc(raw);
  const pick = themeFor(day, week);
  return {
    theme: pick.theme,
    targets: weekTargets(pick.theme, { day, week }),
    plan: unitPlanFor(day, week, typeof prefs.goalMin === 'number' ? { goalMin: prefs.goalMin } : {}),
  };
}

type WeekDoc = { status: 'loading' | 'ready' | 'error'; data: Record<string, unknown> | null; ok: boolean };

/** Rohdokument `app/week` (geteilt von allen `useWeek`-Nutzern). */
export const useWeekDoc = create<WeekDoc>(() => ({ status: 'loading', data: null, ok: true }));

/** Nachfrist wie `data/watch.ts`: Beim Bildschirmwechsel hängt der alte Nutzer aus, bevor der neue einhängt. */
const RELEASE_MS = 400;

let refs = 0;
let stop: (() => void) | null = null;
let release: ReturnType<typeof setTimeout> | null = null;

/** Abo anmelden (höchstens eines für `app/week`); die zurückgegebene Funktion meldet ab. */
export function watchWeek(): () => void {
  refs++;
  if (release) {
    clearTimeout(release);
    release = null;
  }
  if (!stop) {
    const db = getDb();
    if (db)
      stop = watchDoc(
        db,
        'app/week',
        (w) => useWeekDoc.setState({ status: 'ready', data: w.exists ? (w.data ?? null) : null, ok: w.ok }),
        () => useWeekDoc.setState((s) => ({ ...s, status: 'error' })),
      );
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    refs--;
    if (refs > 0 || release) return;
    release = setTimeout(() => {
      release = null;
      if (refs > 0) return;
      stop?.();
      stop = null;
      useWeekDoc.setState({ status: 'loading', data: null, ok: true });
    }, RELEASE_MS);
  };
}

/** Nur für Tests: Abo und Zähler zurücksetzen. */
export function resetWeekWatch(): void {
  if (release) clearTimeout(release);
  release = null;
  stop?.();
  stop = null;
  refs = 0;
  useWeekDoc.setState({ status: 'loading', data: null, ok: true });
}

export function useWeek(): WeekState {
  const dbReady = useCapabilities((s) => s.db === 'ready');
  useEffect(() => (dbReady ? watchWeek() : undefined), [dbReady]);
  const data = useWeekDoc((s) => s.data);
  const day = useClock((s) => s.today);
  const goalMin = useLive((s) => s.docs['app/profile']?.goalMin);
  return useMemo(() => weekFor(day, data, { goalMin: typeof goalMin === 'number' ? goalMin : undefined }), [day, data, goalMin]);
}
