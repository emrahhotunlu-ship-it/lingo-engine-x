import { bandOf, bank, type BankWord } from '../bank/words';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { GRAMMAR_TASKS, GRAMMAR_TOPICS, type GrammarTask } from './grammar';

// Einstufung (docs/neustart.md §6).
// 1. Wortschatz: Ja/Nein-Test nach Meara (X-Lex) mit erfundenen Kontrollwörtern. Jedes dritte „Ja"
//    wird mit einer kurzen Bedeutungsfrage überprüft; ein Fehler dort zählt als „Nein".
//    Schätzung je Band: h' = (h − f) / (1 − f), h = Trefferquote, f = „Ja" bei Kontrollwörtern.
// 2. Grammatik: eine Aufgabe je Thema aus den vorhandenen Aufgaben.

export const TEST_BANDS = 9;
export const WORDS_PER_BAND = 8;
export const PSEUDO_COUNT = 18;

export type VocabTestItem =
  | { kind: 'real'; id: string; w: string; band: number; de: string; options: string[] }
  | { kind: 'pseudo'; w: string };

export type VocabAnswer = { item: VocabTestItem; yes: boolean; verified?: boolean };

const CONTENT_POS = new Set(['n', 'v', 'adj', 'adv']);

function candidates(band: number): BankWord[] {
  const lo = (band - 1) * 1000;
  const hi = band * 1000;
  return bank().words.filter((w) => w.r > lo && w.r <= hi && CONTENT_POS.has(w.p) && w.w.length >= 4 && w.de.length <= 40);
}

function options(word: BankWord, pool: readonly BankWord[], rng: () => number): string[] {
  const same = pool.filter((o) => o.i !== word.i && o.p === word.p && o.de !== word.de);
  const picks = shuffle(same, rng).slice(0, 3).map((o) => o.de.split(', ')[0] ?? o.de);
  return shuffle([word.de.split(', ')[0] ?? word.de, ...picks], rng);
}

export function buildVocabTest(seed: number): VocabTestItem[] {
  const rng = mulberry32(seed);
  const real: VocabTestItem[] = [];
  for (let band = 1; band <= TEST_BANDS; band++) {
    const pool = candidates(band);
    for (const w of shuffle(pool, rng).slice(0, WORDS_PER_BAND)) {
      real.push({ kind: 'real', id: w.i, w: w.w, band, de: w.de.split(', ')[0] ?? w.de, options: options(w, pool, rng) });
    }
  }
  const pseudo: VocabTestItem[] = shuffle(bank().pseudo, rng)
    .slice(0, PSEUDO_COUNT)
    .map((w) => ({ kind: 'pseudo', w }));
  // Leicht nach schwer, Kontrollwörter gleichmäßig verteilt.
  const out: VocabTestItem[] = [];
  const every = Math.max(1, Math.floor(real.length / Math.max(1, pseudo.length)));
  let p = 0;
  real.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % every === 0 && p < pseudo.length) out.push(pseudo[p++]!);
  });
  while (p < pseudo.length) out.push(pseudo[p++]!);
  return out;
}

/** Soll dieses „Ja" mit einer Bedeutungsfrage überprüft werden? (jedes dritte echte Wort) */
export const verifyThis = (yesCount: number): boolean => yesCount % 3 === 1;

export type VocabScore = { bands: number[]; falseAlarm: number; size: number; xlex: number };

export function scoreVocab(answers: readonly VocabAnswer[]): VocabScore {
  const pseudo = answers.filter((a) => a.item.kind === 'pseudo');
  const f = pseudo.length ? pseudo.filter((a) => a.yes).length / pseudo.length : 0;
  const bands: number[] = [];
  for (let band = 1; band <= TEST_BANDS; band++) {
    const items = answers.filter((a) => a.item.kind === 'real' && a.item.band === band);
    if (!items.length) {
      bands.push(0);
      continue;
    }
    const h = items.filter((a) => a.yes && a.verified !== false).length / items.length;
    const corrected = f >= 1 ? 0 : (h - f) / (1 - f);
    bands.push(Math.round(Math.max(0, Math.min(1, corrected)) * 100) / 100);
  }
  const size = Math.round(bands.reduce((s, h) => s + h * 1000, 0) / 50) * 50;
  const xlex = Math.round(bands.slice(0, 5).reduce((s, h) => s + h * 1000, 0) / 50) * 50;
  return { bands, falseAlarm: Math.round(f * 100) / 100, size, xlex };
}

export const CEFR = ['A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'] as const;
export type Cefr = (typeof CEFR)[number];

/** Wortschatz → Niveau (X-Lex-Bereich der 5.000 häufigsten Wörter, Milton 2010). */
export function cefrFromVocab(xlex: number): Cefr {
  if (xlex < 2000) return 'A2';
  if (xlex < 2750) return 'B1';
  if (xlex < 3250) return 'B1+';
  if (xlex < 3750) return 'B2';
  if (xlex < 4250) return 'B2+';
  if (xlex < 4750) return 'C1';
  return 'C1+';
}

/** Grammatik (Anteil sicherer Themen bis B2+, dazu C1-Werkzeuge) → Niveau. */
export function cefrFromGrammar(scores: Readonly<Record<string, number>>): Cefr {
  const core = GRAMMAR_TOPICS.filter((t) => t.level !== 'C1').map((t) => scores[t.id] ?? 0);
  const c1 = GRAMMAR_TOPICS.filter((t) => t.level === 'C1').map((t) => scores[t.id] ?? 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const a = avg(core);
  const c = avg(c1);
  if (a < 0.4) return 'A2';
  if (a < 0.55) return 'B1';
  if (a < 0.7) return 'B1+';
  if (a < 0.8) return 'B2';
  if (a < 0.9 || c < 0.5) return 'B2+';
  return c < 0.8 ? 'C1' : 'C1+';
}

export function overallCefr(v: Cefr, g: Cefr): Cefr {
  return CEFR[Math.min(CEFR.indexOf(v), CEFR.indexOf(g))]!;
}

/** Eine Aufgabe je Thema, bevorzugt Auswahl oder Lücke (schnell zu beantworten). */
export function buildGrammarCheck(seed: number): GrammarTask[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const out: GrammarTask[] = [];
  for (const topic of GRAMMAR_TOPICS) {
    const tasks = GRAMMAR_TASKS.filter((t) => t.topic === topic.id);
    const quick = tasks.filter((t) => t.type === 'mc' || t.type === 'gap');
    const pick = shuffle(quick.length ? quick : tasks, rng)[0];
    if (pick) out.push(pick);
  }
  return out;
}

/** Grammatikwert je Thema: Ergebnis der Einstufung, gemittelt mit dem alten Wert, falls vorhanden. */
export function scoreGrammar(results: Readonly<Record<string, boolean>>, legacy: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const topic of GRAMMAR_TOPICS) {
    const r = results[topic.id];
    const old = legacy[topic.id];
    if (r === undefined && old === undefined) continue;
    const now = r === undefined ? old! : r ? 0.85 : 0.35;
    out[topic.id] = Math.round((old === undefined ? now : (now + old) / 2) * 100) / 100;
  }
  return out;
}

export const seedFor = (s: string): number => hash32(s);
export { bandOf };
