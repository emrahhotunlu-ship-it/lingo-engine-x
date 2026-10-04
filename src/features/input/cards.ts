import { dayKey } from '../../domain/date';
import { cardSrcFor } from '../../domain/lookup/cardSrc';
import type { WordTapArea } from '../../engine/wordTap';
import { logWarn } from '../../platform/diagnostics';
import { saveLookupCard } from '../lookup/store';

// „Als Karte speichern" für Wendungen aus Lesen, Hören, Schreiben und Entdecken (Plan F21/F22):
// über den Phase-1-Weg (`saveLookupCard`, Kollisionstabelle), mit Ursprungssatz, `src` nach
// Bereich (read/listen/write) und Herkunft `origin {kind, ref, title}`.

export type ChunkCard = { en: string; de: string; sentence: string };

export async function saveChunkCard(c: ChunkCard, area: WordTapArea, ref: string, title: string): Promise<boolean> {
  const kind = area === 'read' || area === 'listen' || area === 'write' || area === 'discover' ? area : 'lookup';
  const now = Date.now();
  const res = await saveLookupCard({
    word: c.en,
    de: c.de,
    pos: /\s/.test(c.en.trim()) ? 'phrase' : null,
    ex: c.sentence,
    surface: null,
    src: cardSrcFor(area),
    origin: { v: 1, kind, ref, title, t: now },
    today: dayKey(now),
  });
  const ok = res === 'saved' || res === 'exists';
  if (!ok) logWarn('input:card', { code: res, message: 'Karte nicht gespeichert' }, c.en);
  return ok;
}
