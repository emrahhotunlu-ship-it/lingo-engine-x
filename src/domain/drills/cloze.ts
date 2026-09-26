import { typoBudget } from '../answer/check';
import { editDistance } from '../answer/diff';
import { normalize } from '../answer/normalize';
import { toUS } from '../answer/spelling';
import type { Verdict } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';
import type { ContextSpan, TrainCard } from '../srs/types';
import { lemmaCandidates } from '../text/lemma';

// Lückenjagd (phase2-plan §5.5): Abruf des Partnerworts einer Kollokation im Kontextsatz
// (freie Eingabe in der kinetischen Lücke). Material: Emrahs Karten mit Kollokation und
// Kontextsatz. Machbar ab 8. Keine Karten-Schreibvorgänge (D12).

export const CLOZE_MIN = 8;
export const CLOZE_ROUND = 8;

export type ClozeItem = {
  key: string;
  cardId: string;
  /** Kontextsatz mit markierter Lücke (`sentence.slice(start, end) === gap`). */
  sentence: ContextSpan;
  /** Lösung, wie sie im Satz steht. */
  gap: string;
  /** Grundform des Partners in der Kollokation (`make` in „make a decision"). */
  base: string;
  phrase: string;
  de: string;
  /** Falsche Partner der Karte (für die Rückmeldung, nie vor dem Prüfen gezeigt). */
  wrongPartners: string[];
};

export function clozeCandidates(cards: readonly TrainCard[]): ClozeItem[] {
  const out: ClozeItem[] = [];
  for (const c of cards) {
    if (c.hidden) continue;
    for (const col of c.col) {
      if (!col.ctx || !col.gap) continue;
      out.push({
        key: `${c.id}#${col.index}`,
        cardId: c.id,
        sentence: col.ctx,
        gap: col.ctx.gap,
        base: col.gap,
        phrase: col.p,
        de: col.de,
        wrongPartners: col.opts.filter((o) => normalize(o) !== normalize(col.gap)),
      });
    }
  }
  return out;
}

export const clozeFeasible = (cards: readonly TrainCard[]): boolean => clozeCandidates(cards).length >= CLOZE_MIN;

/** Runde: gelernte Karten zuerst, deterministisch gemischt je Startwert. */
export function buildCloze(i: { cards: readonly TrainCard[]; seed: string; n?: number }): ClozeItem[] {
  const n = i.n ?? CLOZE_ROUND;
  const known = new Set(i.cards.filter((c) => !c.isNew).map((c) => c.id));
  const all = shuffle(clozeCandidates(i.cards), mulberry32(hash32(i.seed)));
  const picked: ClozeItem[] = [];
  const cardsUsed = new Set<string>();
  // Je Karte höchstens eine Lücke, solange es genug Karten gibt.
  for (const pass of [0, 1]) {
    for (const it of [...all.filter((x) => known.has(x.cardId)), ...all.filter((x) => !known.has(x.cardId))]) {
      if (picked.length >= n) break;
      if (picked.includes(it) || (pass === 0 && cardsUsed.has(it.cardId))) continue;
      picked.push(it);
      cardsUsed.add(it.cardId);
    }
  }
  return picked;
}

export type ClozeCheck = {
  verdict: Verdict;
  kind?: 'typo' | 'form' | 'confusable' | 'uk';
  /** Wozu der falsche Partner gehört („do → a task, business, a favor"). */
  belongsTo: string[];
  us?: string;
};

/**
 * Prüfen: gleich (auch britisch) → richtig; Tippfehler oder andere Form des Partners
 * (made → make) → fast richtig; ein anderer Partner → falsch (Verwechslung) mit Hinweis, wozu er gehört.
 */
export function checkCloze(item: ClozeItem, givenRaw: string, deps: { allCols?: ReadonlyArray<{ p: string; gap: string }> } = {}): ClozeCheck {
  const g = normalize(givenRaw);
  const targets = [...new Set([normalize(item.gap), normalize(item.base)])].filter(Boolean);
  if (!g) return { verdict: 'wrong', belongsTo: [] };
  if (targets.includes(g)) return { verdict: 'correct', belongsTo: [] };
  const us = toUS(g);
  if (targets.some((t) => toUS(t) === us)) return { verdict: 'correct', kind: 'uk', us, belongsTo: [] };
  const lg = lemmaCandidates(g);
  if (targets.some((t) => lemmaCandidates(t).some((x) => lg.includes(x)))) return { verdict: 'near', kind: 'form', belongsTo: [] };
  const belongsTo = (deps.allCols ?? [])
    .filter((c) => lemmaCandidates(normalize(c.gap)).some((x) => lg.includes(x)) && normalize(c.p) !== normalize(item.phrase))
    .map((c) => c.p)
    .filter((p, k, a) => a.indexOf(p) === k)
    .slice(0, 3);
  const isPartner = belongsTo.length > 0 || item.wrongPartners.some((o) => normalize(o) === g);
  if (!isPartner && targets.some((t) => {
    const d = editDistance(g, t);
    return d > 0 && d <= typoBudget(t.length);
  })) return { verdict: 'near', kind: 'typo', belongsTo: [] };
  return isPartner ? { verdict: 'wrong', kind: 'confusable', belongsTo } : { verdict: 'wrong', belongsTo: [] };
}

/** Alle Kollokationen der Karten `{p, gap}` (für „wozu gehört der falsche Partner"). */
export function allCollocations(cards: readonly TrainCard[]): Array<{ p: string; gap: string }> {
  return cards.flatMap((c) => c.col.filter((x) => x.p && x.gap).map((x) => ({ p: x.p, gap: x.gap })));
}
