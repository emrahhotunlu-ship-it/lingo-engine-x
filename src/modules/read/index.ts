import { z } from 'zod';
import { defineArea } from './sharedUi';
import { ReadHome } from './ui/ReadHome';
import { ReaderPlaceholder } from './ui/ReaderPlaceholder';

// Lesen-Modul, Tür 1 (docs/umbau/lesen-plan.md §5.1): der Bereich `readArea`, nur von src/areas/index.ts importiert.
// Reiter-Wurzel `read` (Paket L3) und Seite `readArticle` (Platzhalter; Paket L4 setzt den Leser ein).

declare module '../../app/router/types' {
  interface RouteParams {
    /** Reiter „Lesen“: Artikel von heute holen und öffnen. */
    read: NoParams;
    /** Der Leser eines Artikels (Kennung aus dem Monatsindex). */
    readArticle: { id: string };
  }
}

export const READ_MODULE = { id: 'read', version: 1 } as const;

export const readArea = defineArea({
  id: 'lesen',
  screens: {
    read: { kind: 'tab', component: ReadHome, title: 'rdTitle', keepScroll: true },
    readArticle: { kind: 'page', component: ReaderPlaceholder, title: 'rdTitle', keepScroll: true, params: z.object({ id: z.string().min(1).max(80) }) },
  },
});
