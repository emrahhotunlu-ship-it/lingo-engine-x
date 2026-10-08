import { checkCloze, type ClozeItem } from '../../drills/cloze';
import { hash32, mulberry32, shuffle } from '../../random';
import type { TrainCard } from '../../srs/types';
import { GATE } from './trigger';

// Kapitelprüfung, Kapitelwörter (Lernplattform 3.0 §4.4, P42/P43): 8 Wörter oder Wendungen aus Emrahs eigenen Karten, frei getippt in ihrem Beispielsatz,
// ohne Tipps. „Kapitelwörter“ sind keine Inhaltsliste, sondern eine Auswahlregel: Karten, die er schon geübt hat (nicht neu), mit Beispielsatz, bevorzugt
// die, die er seit dem Beginn des Kapitels dazubekommen hat (`added` ≥ Kapitelbeginn), dann die übrigen. Der Wunsch kommt aus der deutschen
// Bedeutung („Gesucht: …“), nicht aus einem Hinweis auf die Form. Gibt es weniger als `GATE.wordsMin` passende Karten, entfällt der Wörterteil.

export type GateWord = { key: string; cardId: string; sentence: string; start: number; end: number; gap: string; de: string; kind: 'vocab' | 'chunk' };

const usable = (c: TrainCard): boolean => !c.hidden && !c.isNew && c.stage >= 1 && !!c.context && c.context.gap.trim().length >= 2 && !!(c.de ?? '').trim();

/** Die Kapitelwörter eines Versuchs. `since` = Beginn des Kapitels (Tagesschlüssel der ersten Einführung eines Themas) oder `null`. Gemischt mit festem Startwert. */
export function chapterWords(i: { cards: readonly TrainCard[]; since: string | null; seed: string; n?: number }): GateWord[] {
  const n = i.n ?? GATE.words;
  const pool = i.cards.filter(usable);
  const rng = mulberry32(hash32(i.seed));
  const fresh = shuffle(pool.filter((c) => i.since !== null && c.added !== '' && c.added >= i.since), rng);
  const rest = shuffle(pool.filter((c) => !fresh.includes(c)), rng);
  const picked = [...fresh, ...rest].slice(0, n);
  if (picked.length < GATE.wordsMin) return [];
  return picked.map((c) => {
    const ctx = c.context as NonNullable<TrainCard['context']>;
    return { key: c.key, cardId: c.id, sentence: ctx.sentence, start: ctx.start, end: ctx.end, gap: ctx.gap, de: c.de ?? '', kind: c.kind };
  });
}

/** Antwort prüfen: nur `correct` (auch britische Schreibweise) zählt. Tippfehler und andere Formen sind „fast“, das zählt hier nicht. */
export function checkGateWord(w: GateWord, given: string): { right: boolean; near: boolean } {
  const item: ClozeItem = {
    key: w.key,
    cardId: w.cardId,
    sentence: { sentence: w.sentence, start: w.start, end: w.end, gap: w.gap },
    gap: w.gap,
    base: w.gap,
    phrase: w.gap,
    de: w.de,
    wrongPartners: [],
  };
  const r = checkCloze(item, given);
  return { right: r.verdict === 'correct', near: r.verdict === 'near' };
}

/** Der Satz mit Lücke (`______`) statt des gesuchten Worts. */
export const maskedSentence = (w: Pick<GateWord, 'sentence' | 'start' | 'end'>): string => `${w.sentence.slice(0, w.start)}______${w.sentence.slice(w.end)}`;
