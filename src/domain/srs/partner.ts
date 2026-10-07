import { TRAP_INDEX } from '../../content/nb/trapIndex';
import { trapForCard } from './traps';
import { packExtraOf } from '../c1pack/packFields';
import { locate } from './context';
import type { Colloc, TrainCard } from './types';

// Partnerwort-Lücke (Lernplattform 2.0 §5.6): Die Lücke steht NUR am Partnerwort („___ concerns about data security“), nie an der
// ganzen Wendung. Quellen: die Wortpartner der Karte (`col`, wie bisher) und die Paket-Felder `gap` (nur gelesen, nie geschrieben:
// `packExtraOf` legt sie beim Lesen über die Karte). Rein.

const norm = (s: string): string => s.toLowerCase().trim();

/** Eine Partnerwort-Lücke der Karte (mit Satz und Auswahl), sonst `null`. `pickIndex` wählt unter mehreren (z. B. per Zufall). */
export function partnerOf(card: TrainCard, pickIndex = 0): Colloc | null {
  const own = card.col.filter((c) => c.ctx && c.opts.length >= 2);
  if (own.length) return own[Math.abs(pickIndex) % own.length] ?? own[0] ?? null;
  const ctx = card.context;
  const gap = packExtraOf(card)?.gap;
  if (!ctx || !gap) return null;
  // Das Partnerwort steht in der Wendung (bzw. im Satz): nur diese Stelle wird zur Lücke.
  const inChunk = ctx.sentence.slice(ctx.start, ctx.end);
  const hit = locate(inChunk, gap.at);
  if (!hit) return null;
  const start = ctx.start + hit.start;
  const end = ctx.start + hit.end;
  const word = ctx.sentence.slice(start, end);
  const opts = [...new Set(gap.wrong.filter((w) => norm(w) !== norm(word) && norm(w) !== norm(gap.at)))];
  if (!opts.length) return null;
  return { index: -1, p: card.word, de: card.de ?? '', gap: word, opts, ctx: { sentence: ctx.sentence, start, end, gap: word } };
}

export const hasPartner = (card: TrainCard): boolean => partnerOf(card) !== null;

/** Familienmitglied für „Wortfamilie“: ein anderes Glied als das Kartenwort, das Kartenwort selbst steht im Satz. */
export function familyFrom(card: TrainCard): { pos: 'noun' | 'verb' | 'adj' | 'adv'; word: string } | null {
  const fam = packExtraOf(card)?.fam;
  if (!fam || !card.context) return null;
  const own = norm(card.lemma);
  for (const pos of ['noun', 'adj', 'verb', 'adv'] as const) {
    const w = fam[pos];
    if (w && norm(w) !== own && !locate(card.context.sentence, w)) return { pos, word: w };
  }
  return null;
}

/** Übungssatz der Deutsch-Falle zur Karte und die falsch benutzte Stelle darin („Falle finden“), sonst `null`. */
export function trapTask(card: TrainCard): { id: string; sentence: string; start: number; end: number } | null {
  const trap = trapForCard(card);
  if (!trap) return null;
  const words = [card.lemma, card.word, ...(TRAP_INDEX[trap.id]?.en ?? [])];
  for (const w of words) {
    const hit = w ? locate(trap.wrong, w) : null;
    if (hit) return { id: trap.id, sentence: trap.wrong, start: hit.start, end: hit.end };
  }
  return null;
}
