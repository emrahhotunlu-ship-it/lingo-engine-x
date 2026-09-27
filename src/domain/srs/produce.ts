import { containsPhrase } from '../chunks/newChunk';
import { locateChunk } from './chunkCards';
import { locate } from './context';
import type { Grade, TrainCard } from './types';

// Eigener Satz ohne Claude (phase1-plan §4.10): nur, wenn die KI-Prüfung ausfällt (Fehler,
// Drosselung) und Emrah „Ohne Claude prüfen" wählt. Keine Selbstbewertung (CLAUDE.md A7): die
// Note folgt aus drei nachprüfbaren Punkten – Wort bzw. Wendung kommt vor, ganzer Satz (≥ 6
// Wörter), nicht vom Ursprungssatz abgeschrieben.

export type SelfCheck = { containsTarget: boolean; longEnough: boolean; notCopied: boolean; grade: Grade };

export const PRODUCE_MIN_WORDS = 6;
const COPY_LIMIT = 0.8;

const wordsOf = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);

function jaccard(a: string, b: string): number {
  const A = new Set(wordsOf(a));
  const B = new Set(wordsOf(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Steht das Wort (auch gebeugt) bzw. die Wendung im Satz? */
export function usesTarget(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>): boolean {
  if (card.kind === 'chunk') return containsPhrase(sentence, card.word) || !!locateChunk(sentence, card.word);
  return !!locate(sentence, card.lemma) || containsPhrase(sentence, card.lemma);
}

export function selfCheckProduce(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>): SelfCheck {
  const containsTarget = usesTarget(sentence, card);
  const longEnough = wordsOf(sentence).length >= PRODUCE_MIN_WORDS;
  const origin = card.context?.sentence ?? '';
  const notCopied = !origin || jaccard(sentence, origin) < COPY_LIMIT;
  const grade: Grade = !containsTarget ? 1 : longEnough && notCopied ? 3 : 2;
  return { containsTarget, longEnough, notCopied, grade };
}
