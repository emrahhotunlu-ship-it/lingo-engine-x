import { alignWords, countOps } from '../answer/align';
import { typoBudget } from '../answer/check';
import { editDistance } from '../answer/diff';
import { toUS } from '../answer/spelling';
import { legacyNorm } from '../grammar/key';
import type { Verdict, WordOp } from '../learn/types';

// Diktat-Wertung (phase2-plan §5.4). Getippt wird der ganze Satz.
// - Normalisieren: `legacyNorm` (Kurzformen aufgelöst: We've = We have), britisch → amerikanisch
//   auf beiden Seiten, Zahlen 0–20 und Zehner als Wort (20 = twenty).
// - Ausrichtung je Wort: gleich, Tippfehler (Zeichen-Levenshtein im Budget), fehlend, zu viel, falsch.
// - score = 1 − (fehlend + zu viel + falsch + 0,5·Tippfehler) / Wörter der Vorlage.
// - ≥ .95 ohne Hilfe → richtig, ≥ .80 → fast richtig, sonst falsch.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS: Record<string, string> = { '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy', '80': 'eighty', '90': 'ninety', '100': 'hundred' };

export function numberWord(w: string): string {
  if (/^\d+$/.test(w)) {
    const n = Number(w);
    if (n <= 20) return ONES[n] as string;
    return TENS[w] ?? w;
  }
  return w;
}

/** Wörter eines Satzes in vergleichbarer Form. */
export function dictationWords(s: string): string[] {
  return legacyNorm(s)
    .replace(/[()“”"—–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => numberWord(toUS(w.replace(/^'+|'+$/g, ''))))
    .filter(Boolean);
}

export const dictationTypo = (a: string, b: string): boolean => {
  const d = editDistance(a, b);
  return d > 0 && d <= typoBudget(b.length);
};

export type DictationScore = {
  ops: WordOp[];
  missing: number;
  extra: number;
  wrong: number;
  typo: number;
  total: number;
  score: number;
  verdict: Verdict;
};

export function scoreDictation(given: string, target: string, opts: { helpLevel?: number } = {}): DictationScore {
  const g = dictationWords(given);
  const t = dictationWords(target);
  const ops = alignWords(g.join(' '), t.join(' '), { typo: dictationTypo });
  const c = countOps(ops);
  const total = Math.max(1, t.length);
  const raw = 1 - (c.del + c.ins + c.sub + 0.5 * c.typo) / total;
  const score = Math.max(0, Math.round(raw * 100) / 100);
  // Wortgenau richtig ist richtig – auch nach „Langsamer" (die Hilfe senkt nur die Note).
  const verdict: Verdict = raw >= 1 || (raw >= 0.95 && !(opts.helpLevel ?? 0)) ? 'correct' : raw >= 0.8 ? 'near' : 'wrong';
  return { ops, missing: c.del, extra: c.ins, wrong: c.sub, typo: c.typo, total: t.length, score, verdict };
}

/** Verpasste Wörter der Vorlage (fehlend oder falsch gehört) – zum Antippen nach der Wertung. */
export function missedWords(ops: readonly WordOp[]): string[] {
  return ops.filter((o) => o.op === 'del' || o.op === 'sub').map((o) => o.expected ?? '').filter(Boolean);
}
