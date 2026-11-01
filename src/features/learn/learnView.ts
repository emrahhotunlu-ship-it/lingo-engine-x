import { create } from 'zustand';
import type { ChapterProgress } from '../../domain/c1/state';

// D5 V-GRAMMATIK: Laptop-Wahl im Grammatik-Reiter (Vorschau L4). Ab 1.280 px steht das Kapitel-Detail in der Kontextspalte; ein Tipp auf ein
// Kapitel der Liste wählt es dort (nur Anzeige, nichts wird gespeichert und nichts ist planwirksam). `null` = das aktuelle Kapitel.

export const useLearnPick = create<{ idx: number | null }>(() => ({ idx: null }));

/** Ab dieser Breite ist die Kontextspalte immer da (ContextHost, `wideCtx`): das Detail steht dort statt auf eigener Seite. */
export const LEARN_COLUMN_QUERY = '(min-width: 1280px)';

/** „Noch nicht dran“ (Schloss in der Liste, Hinweis im Detail): ein Kapitel nach dem aktuellen mit Inhalten, in dem noch kein Thema begonnen ist. */
export function chapterLater(p: ChapterProgress, idx: number, current: number): boolean {
  return p.status === 'open' && p.ready && idx > current && p.introduced === 0;
}
