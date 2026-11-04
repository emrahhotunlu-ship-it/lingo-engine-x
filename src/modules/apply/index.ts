import { createElement, lazy, Suspense, type ComponentType } from 'react';
import { z } from 'zod';
import { defineArea, Skeleton, type ScreenProps } from './sharedUi';

// Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md), Tür 1: der Bereich `applyArea` (nur von src/areas/index.ts angemeldet), die Seite „Anwenden“
// (`ApplyPage`, von src/areas/anwenden.tsx unter Fokus 2.0 eingesetzt) und das Ziel von Schritt 3 des Tagesweges (`applyStepRoute`). Die Bildschirme liegen in
// eigenen Teil-Dateien und werden erst beim Öffnen geladen (Einstiegsdatei klein, Großpaket C).

declare module '../../app/router/types' {
  interface RouteParams {
    /** Schreibübung „Auf eine Mail antworten“, „Eine Mail schreiben“, „Einen Artikel zusammenfassen“. `unit` = Schritt des Tagesweges, sonst frei. */
    applyTask: { kind: 'reply' | 'write' | 'summary'; unit?: number };
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

/** Seite „Anwenden“ (Fokus 2.0), nachgeladen. */
export const ApplyPage = lazyScreen<object>(() => import('./ui/ApplyPage').then((m) => m.ApplyPage));

/** Teil-Dateien im Leerlauf vorladen (wie die Wörter-Bildschirme). */
export function prefetchApply(): Promise<unknown> {
  return Promise.all([import('./ui/TaskScreen'), import('./ui/ApplyPage')]);
}

export const applyArea = defineArea({
  id: 'apply',
  screens: {
    applyTask: {
      kind: 'exercise',
      component: TaskScreen,
      title: 'axTitle',
      params: z.object({ kind: z.enum(['reply', 'write', 'summary']), unit: z.number().int().min(1).max(5).optional() }),
    },
  },
});

export { applyStepRoute } from './ui/route';
export type { StepRoute } from './ui/route';
