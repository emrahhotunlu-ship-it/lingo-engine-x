import { z } from 'zod';
import { defineArea } from './sharedUi';
import { ReadHome } from './ui/ReadHome';
import { ReaderRoute } from './ui/ReaderRoute';
import { ReaderScreen } from './ui/reader';
import { CoursePage } from './ui/CoursePage';
import { LessonScreen } from './ui/LessonScreen';

// Lesen-Modul, Tür 1 (docs/umbau/lesen-plan.md §5.1): der Bereich `readArea`, nur von src/areas/index.ts importiert.
// Reiter-Wurzel `read` (Paket L3) und Seite `readArticle` (Platzhalter; Paket L4 setzt den Leser ein).

declare module '../../app/router/types' {
  interface RouteParams {
    /** Reiter „Lesen“: Artikel von heute holen und öffnen. */
    read: NoParams;
    /** Der Leser eines Artikels (Kennung aus dem Monatsindex). */
    readArticle: { id: string; at?: number };
    /** Kurs (Paket L8): Lektionsliste und Hauptknopf. `id` = Kurskennung `k1` … `k8`. */
    readCourse: { id: string };
    /** Eine Kurslektion. `id` = `k1-03`. */
    readLesson: { id: string };
  }
}

export const READ_MODULE = { id: 'read', version: 1 } as const;

export { ReaderScreen };

export const readArea = defineArea({
  id: 'lesen',
  screens: {
    read: { kind: 'tab', component: ReadHome, title: 'rdTitle', keepScroll: true },
    readArticle: { kind: 'page', chrome: 'shell', component: ReaderRoute, title: 'rdTitle', keepScroll: true, params: z.object({ id: z.string().min(1).max(80), at: z.number().int().min(1).max(2000).optional() }) },
    readCourse: { kind: 'page', chrome: 'shell', component: CoursePage, title: 'rdcTitle', keepScroll: true, params: z.object({ id: z.string().regex(/^k[1-9]$/) }) },
    readLesson: { kind: 'page', chrome: 'shell', component: LessonScreen, title: 'rdcTitle', keepScroll: true, params: z.object({ id: z.string().regex(/^k[1-9]-\d{2}$/) }) },
  },
});
