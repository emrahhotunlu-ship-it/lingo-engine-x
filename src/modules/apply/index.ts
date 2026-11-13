import { createElement, lazy, Suspense, type ComponentType } from 'react';
import { z } from 'zod';
import { defineArea, KEY_PREFIX, logWarn, removeOlderDayKeys, Skeleton, useClock, type ScreenProps } from './sharedUi';

// Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md), Tür 1: der Bereich `applyArea` (nur von src/areas/index.ts angemeldet), die Seite „Anwenden“
// (`ApplyPage`, von src/areas/anwenden.tsx unter Fokus 2.0 eingesetzt) und das Ziel von Schritt 3 des Tagesweges (`applyStepRoute`). Die Bildschirme liegen in
// eigenen Teil-Dateien und werden erst beim Öffnen geladen (Einstiegsdatei klein, Großpaket C).

declare module '../../app/router/types' {
  interface RouteParams {
    /** Schreibübung „Auf eine Mail antworten“, „Eine Mail schreiben“, „Einen Artikel zusammenfassen“. `unit` = Schritt des Tagesweges, sonst frei. */
    applyTask: { kind: 'reply' | 'write' | 'summary'; unit?: number };
    /**
     * Brücken-Sätze (Großpaket P, P4): eigene Sätze mit einem Wort aus der Wörter-App und einem Grammatik-Muster. `unit` = Schritt 3 des Tagesweges
     * (Pflicht), sonst freie Zusatzrunde; `n = 1` am kurzen Tag (sonst zwei Sätze).
     */
    applyBridge: { unit?: number; n?: number };
  }
}

export const APPLY_MODULE = { id: 'apply', version: 1 } as const;

const fallback = createElement(Skeleton, { className: 'mx-auto mt-10 h-64 w-full max-w-[47.5rem]' });

function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Lazy = lazy(() => load().then((c) => ({ default: c })));
  return function LazyScreen(props: P) {
    return createElement(Suspense, { fallback }, createElement(Lazy as ComponentType<P>, props));
  };
}

const TaskScreen = lazyScreen<ScreenProps<'applyTask'>>(() => import('./ui/TaskScreen').then((m) => m.ApplyTaskScreen));
const BridgeScreen = lazyScreen<ScreenProps<'applyBridge'>>(() => import('./ui/BridgeScreen').then((m) => m.ApplyBridgeScreen));

/** Seite „Anwenden“ (Fokus 2.0), nachgeladen. */
export const ApplyPage = lazyScreen<object>(() => import('./ui/ApplyPage').then((m) => m.ApplyPage));

/** Teil-Dateien einmal im Leerlauf nach dem Start vorladen (wie die Wörter-Bildschirme, app/prefetch.ts): nur Laden, keine Ausführung, keine Schreibvorgänge. */
function prefetchApply(): void {
  const run = (): void => {
    for (const load of [() => import('./ui/ApplyPage'), () => import('./ui/BridgeScreen'), () => import('./ui/TaskScreen')]) load().catch((err: unknown) => logWarn('prefetch', err));
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

/**
 * Beim Start: gemerkte Runden der Brücken-Sätze (`lx:bridge:<Tag>:…`, BridgeScreen) älterer Lerntage aus dem Browser-Speicher entfernen – sie
 * gelten nur für ihren Lerntag (data-guard 13.11.2026). Nur Bequemlichkeit, nie Lernstand.
 */
export function pruneBridgeKeys(today: string = useClock.getState().today): number {
  return removeOlderDayKeys(`${KEY_PREFIX}bridge:`, today);
}

export const applyArea = defineArea({
  id: 'apply',
  boot: () => {
    pruneBridgeKeys();
    prefetchApply();
  },
  screens: {
    applyTask: {
      kind: 'exercise',
      component: TaskScreen,
      title: 'axTitle',
      params: z.object({ kind: z.enum(['reply', 'write', 'summary']), unit: z.number().int().min(1).max(5).optional() }),
    },
    applyBridge: {
      kind: 'exercise',
      component: BridgeScreen,
      title: 'axBTitle',
      params: z.object({ unit: z.number().int().min(1).max(5).optional(), n: z.number().int().min(1).max(2).optional() }),
    },
  },
});

export { applyStepRoute } from './ui/route';
export type { StepRoute } from './ui/route';
