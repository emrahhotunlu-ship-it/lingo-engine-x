import { locate } from '../srs/context';
import { coreWord } from './baseLesson';

// Lokale Prüfung der Produktion ohne KI (phase2-plan §5.1 Schritt 4): mindestens 2 Pflichtwörter
// (in beliebiger Form), mindestens 12 Wörter und nicht einfach der Mustertext
// (Jaccard der Wortmengen < .8). Das Can-Do-Urteil gibt es dann nicht; Emrah vergleicht selbst.

export const MIN_WORDS = 12;
export const MIN_MUST_USE = 2;
export const MAX_SIMILARITY = 0.8;

export type ProductionCheck = {
  ok: boolean;
  used: string[];
  missing: string[];
  words: number;
  tooShort: boolean;
  tooFewMustUse: boolean;
  tooSimilar: boolean;
};

const tokens = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];

export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// Begleiter (Artikel, Possessiva) zählen beim Suchen nicht: „chair the meeting" erfüllt
// „to chair a meeting".
const DETERMINERS = /\b(a|an|the|my|your|our|their|his|her|its|this|that|these|those)\b/gi;
const withoutDeterminers = (s: string) => s.replace(DETERMINERS, ' ').replace(/\s+/g, ' ').trim();

/** Steht das Zielwort (Grundform oder gebeugt, Begleiter egal) im Text? */
export function containsTarget(text: string, target: string): boolean {
  const core = withoutDeterminers(coreWord(target));
  return !!core && locate(withoutDeterminers(text), core) !== null;
}

/** Kommt das Pflichtwort im Text vor? */
export const usesWord = containsTarget;

export function localProductionCheck(text: string, mustUse: readonly string[], model?: string | null): ProductionCheck {
  const used = mustUse.filter((w) => usesWord(text, w));
  const missing = mustUse.filter((w) => !used.includes(w));
  const words = tokens(text).length;
  const tooShort = words < MIN_WORDS;
  const tooFewMustUse = used.length < Math.min(MIN_MUST_USE, mustUse.length);
  const tooSimilar = !!model && jaccard(text, model) >= MAX_SIMILARITY;
  return { ok: !tooShort && !tooFewMustUse && !tooSimilar, used, missing, words, tooShort, tooFewMustUse, tooSimilar };
}
