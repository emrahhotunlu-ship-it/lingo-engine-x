import { useMemo } from 'react';
import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { chapterRunOn } from '../../app/flags';
import { useLive } from '../../data/live';
import { chosenChapterOf } from '../../domain/c1/c1doc';
import { chapterNow, type ChapterCursor } from '../../domain/c1/cursor';
import type { ChapterStateResult } from '../../domain/c1/state';

// Kapitel-Arbeit (K1/K2): das gewählte Kapitel (optimistisch und aus `app/c1.ch`) und der daraus abgeleitete Stand. Leichter Baustein ohne
// Rundenlogik, damit Programmkarte, Lernen, Heute und Verbraucher ihn ohne Import-Schleife lesen.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Optimistische Wahl (Kapitelnummer 1 bis 7), bis `app/c1` sie zeigt; `null` = es gilt das Dokument. */
export const useChapterPick = create<{ n: number | null }>(() => ({ n: null }));

export const c1Raw = (): unknown => (useLive.getState().docs as Record<string, unknown>)['app/c1'];

/** Gewähltes Kapitel jetzt (1 bis 7) oder `null`: erst die optimistische Wahl, dann `app/c1.ch`. Ohne Schalter `chapterRun` immer `null`. */
export function chosenNow(): number | null {
  if (!chapterRunOn()) return null;
  return useChapterPick.getState().n ?? chosenChapterOf(c1Raw())?.n ?? null;
}

/** Gewähltes Kapitel (reaktiv). */
export function useChosenChapter(): number | null {
  const pick = useChapterPick((s) => s.n);
  const raw = useLive((s) => (s.docs as Record<string, unknown>)['app/c1']);
  if (!chapterRunOn()) return null;
  return pick ?? chosenChapterOf(raw)?.n ?? null;
}

/** Kapitelstand und Cursor aus den Live-Daten und der Wahl: die eine Quelle für Programmkarte, Kapitelblatt und „Als Nächstes“. */
export function useChapterNow(): { state: ChapterStateResult; cursor: ChapterCursor | null } {
  const today = useClock((s) => s.today);
  const nowMs = useClock((s) => s.now);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const chosen = useChosenChapter();
  return useMemo(() => chapterNow({ docs, today, nowMs, chosen }), [docs, today, nowMs, chosen]);
}
