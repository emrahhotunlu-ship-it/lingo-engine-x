import { z } from 'zod';
import { britishSpelling, detectLang, isWrongLang, lexicalUnit, wordCount } from '../shared';
import { ARTICLE_KINDS, TOPIC_KEYS } from '../schemas';
import type { ArticleKind, Check, KeyWord, Sentence, TopicKey } from '../schemas';
import { countWords, normKey, normalizeDashes } from './text';

// `britishSpelling` liegt jetzt in src/domain/text/british.ts (gemeinsam mit den KI-Korrekturen); hier nur durchgereicht.
export { britishSpelling };

// Prüftore für einen erzeugten Artikel (docs/umbau/lesen-plan.md §3.4). Reine Funktion `acceptArticle`, wie Q3 „accept*“:
// Verstoß = Schemafehler im KI-Tor (löst den EINEN Neuversuch aus, A6 Nr. 3), danach Fehlerkarte; nie ein schief ausgerichteter Artikel.
// Neun Tore, jedes mit eigenem Regel-Test (tests/unit/read/accept.test.ts):
//   1 form · 2 length · 3 language · 4 alignment · 5 glued · 6 keywords · 7 questions · 8 spelling · 9 duplicate

export const GATES = ['form', 'length', 'language', 'alignment', 'glued', 'keywords', 'questions', 'spelling', 'duplicate'] as const;
export type Gate = (typeof GATES)[number];

export type Issue = { gate: Gate; path: Array<string | number>; message: string };

/** Grenzen (Plan §3.4). Ein Test hält sie fest. */
export const LIMITS = {
  paras: [3, 9],
  sentences: [14, 60],
  sentenceWords: 60,
  words: [380, 800],
  titleChars: 90,
  asOfChars: 40,
  summaryChars: 240,
  /** Wörterverhältnis Deutsch/Englisch je Satz (nur Sätze ab 5 englischen Wörtern) und im Ganzen. */
  sentenceRatio: [0.6, 1.8],
  totalRatio: [0.85, 1.35],
  /** Anteil der Sätze mit auffälligem Verhältnis, der noch durchgeht. */
  outlierShare: 0.08,
  /** Anteil der Sätze, deren Sprache unklar bleibt (je Seite). */
  unclearShare: 0.05,
  /** Eigennamen aus dem Englischen, die im Deutschen fehlen dürfen. */
  namesMissingShare: 0.35,
  keyWords: 5,
  keyWordsLenientMin: 3,
  /** Mindestens so viele Schlüsselwörter sind mehrteilig (Wortverbindungen); im nachsichtigen Modus entfällt das. */
  keyWordsMultiMin: 2,
  /** „quietly“ höchstens einmal, „however“ höchstens dreimal im ganzen Text. */
  quietlyMax: 1,
  howeverMax: 3,
  questions: [2, 3],
  duplicateJaccard: 0.8,
} as const;

export type AcceptCtx = {
  /** Titel (und Thema) der letzten Artikel, höchstens die letzten 30 (Tor 9). */
  recent?: ReadonlyArray<{ title: string; topic?: string | null }>;
  /** Das angefragte Thema; ist es gesetzt, gilt es und nicht das vom Modell genannte. */
  topic?: TopicKey;
  /** Nachsichtig (nur für die Antwort des einen Neuversuchs): ≥ 3 gültige Schlüsselwörter genügen, der Rest wird verworfen. */
  lenient?: boolean;
  /** Eigene Wortgrenzen für den englischen Text (Standard: `LIMITS.words`). Die Routine schreibt kürzere Meldungen (Artikel der App: 380-800). */
  words?: readonly [number, number];
};

export type AcceptedArticle = {
  title: string;
  topic: TopicKey;
  kind: ArticleKind;
  level: string;
  asOf: string;
  summary: string;
  paras: Sentence[][];
  keyWords: KeyWord[];
  check?: Check[];
};

export type Dropped = { what: 'check' | 'keyWord'; reason: string };
/**
 * `notSetPhrase` (Kartenqualität 26.10.2026): mehrteilige Schlüsselwörter, die die Prüfung `lexicalUnit` als freie Gruppe meldet. Sie bleiben im
 * Artikel (nie ein Ablehnungsgrund für sich), zählen aber nicht als „mehrteilig“ (`keyWordsMultiMin`); der Leser speichert sie nicht als Karte.
 */
export type AcceptResult = { ok: true; article: AcceptedArticle; dropped: Dropped[]; repaired: string[]; notSetPhrase: string[] } | { ok: false; issues: Issue[] };

// ---------------------------------------------------------------- Tor 1: Form (zod-Schema der Antwort)

const sentenceShape = z.object({ e: z.string(), d: z.string() });
/** Antwortform von `read-article@1` ohne die Inhaltsgrenzen (der Prompt zeigt ein Beispiel dieser Form; ein Test hält das fest). */
export const answerShape = z.object({
  title: z.string(),
  topic: z.string().optional(),
  kind: z.string().optional(),
  level: z.string().optional(),
  asOf: z.string().optional(),
  summary: z.string().optional(),
  paras: z.array(z.array(sentenceShape)),
  keyWords: z.array(z.unknown()),
  check: z.array(z.unknown()).optional(),
});

const push = (out: Issue[], gate: Gate, path: Array<string | number>, message: string): void => {
  out.push({ gate, path, message });
};

/** Höchstens `max` Mängel je Tor, damit ein Tor (z. B. Sprache in 20 Sätzen) die anderen nicht verdeckt und der Neuversuch kurz bleibt. */
function limitPerGate(list: readonly Issue[], max: number): Issue[] {
  const seen = new Map<Gate, number>();
  return list.filter((i) => {
    const n = (seen.get(i.gate) ?? 0) + 1;
    seen.set(i.gate, n);
    return n <= max;
  });
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

// ---------------------------------------------------------------- Hilfen

const MID_END = /[.!?]["”’')]?\s+[A-ZÄÖÜ]/g;
const ABBR = new Set(['u.s', 'u.k', 'e.g', 'i.e', 'dr', 'mr', 'mrs', 'ms', 'prof', 'inc', 'ltd', 'co', 'corp', 'vs', 'etc', 'no', 'st', 'jr', 'sr', 'approx', 'fig', 'ca', 'bzw', 'usw', 'ggf', 'evtl', 'nr', 'z.b', 'd.h', 'u.a', 'v.a', 'a.m', 'p.m', 'ph.d', 'inkl', 'zzgl', 'max', 'min']);

/** Steht mitten im Satz ein weiteres Satzende (zwei Sätze verklebt)? Abkürzungen und Initialen zählen nicht. */
export function hasInnerSentenceEnd(s: string): boolean {
  for (const m of s.matchAll(MID_END)) {
    const before = s.slice(0, m.index + 1);
    const token = (before.split(/\s+/).pop() ?? '').replace(/^[("„“‚'‘]+/, '').replace(/\.$/, '').toLowerCase();
    if (!/[.!?]/.test(m[0].charAt(0))) continue;
    if (m[0].charAt(0) !== '.') return true;
    if (ABBR.has(token) || /^\d{1,4}$/.test(token) || /^[a-zäöü]$/i.test(token) || /^(?:[a-zäöü]\.)+[a-zäöü]$/i.test(token)) continue;
    return true;
  }
  return false;
}

const GLUED_BOUNDARY = /[a-zäöüß][.!?]["”')]?[A-ZÄÖÜ]/;
// Schreibweisen mit Punkt zwischen Buchstaben, die keine verklebten Sätze sind (Character.AI, GitLab.com, Node.js; Groß/Klein egal).
// Deutsche Ordnungszahlen („am 12. Oktober“) sind kein Satzende (Zahl vor dem Punkt).
const DOTTED = /\b(?:Ph\.D|ASP\.NET|[A-Za-z0-9]+\.(?:js|io|ai|NET|com|org|net|dev|app)|[a-z]\.[a-z]\.[A-Z]?)\b/gi;
const MARKUP = /[*#<>`]|\{\{|\}\}|_{2,}|\[(?:\.\.\.|…)\]/;
const LANG_SPELL = /\b[CF]#/g;

/** Verklebter oder verunreinigter Text (Tor 5): kein `.Wort`, keine doppelten Leerzeichen, kein Markdown/HTML, kein Platzhalter. */
export function gluedProblem(s: string): string | null {
  const t = s.replace(DOTTED, ' ');
  if (GLUED_BOUNDARY.test(t)) return 'sentence end glued to the next word';
  if (/ {2,}/.test(s)) return 'double spaces';
  if (MARKUP.test(s.replace(LANG_SPELL, ' '))) return 'markup or placeholder characters';
  return null;
}

// Typische KI-Floskeln (Stil, im Tor „spelling“): ein Treffer löst den einen Neuversuch aus. Der Prompt verbietet sie ebenfalls.
const CLICHES = /\b(?:in today[’']s fast[- ]paced|game[- ]?changer|delv(?:e|es|ed|ing)\s+(?:into|deeper)|navigate the complexit|unlock(?:s|ed|ing)? the (?:power|potential|full)|in conclusion,)/i;

/** Floskel gefunden? Liefert die Fundstelle. */
export function clichePhrase(text: string): string | null {
  return CLICHES.exec(text)?.[0] ?? null;
}

/** Wie oft kommt das Wort im Text vor (ganze Wörter, ohne Groß-/Kleinschreibung)? */
export function countWordIn(text: string, word: string): number {
  return (text.match(new RegExp(`\\b${word}\\b`, 'gi')) ?? []).length;
}

// Wörter, die im Deutschen gleich oder fast gleich aussehen und heißen: als Schlüsselwort zu leicht (Tor 6).
const GERMAN_SAME = new Set(
  'routine focused specific team project problem system manager management plan idea information kontakt contact interesting normal final original social global digital local national international professional personal potential general special natural central basic simple direct action actions color market markets budget status concept process product products service services client clients online email'.split(' '),
);

const FUNCTION_WORDS = new Set(
  'a an the and or but nor so yet of in on at to for from by with without into onto over under about as is are was were be been being am do does did has have had it its this that these those there here which who whom whose what when where why how not no than then also very more most can could may might must shall should will would'.split(' '),
);

const NUMBER_RE = /\d[\d.,]*\d|\d/g;
/** Zahlen eines Satzes als Ziffernfolgen ohne Trennzeichen („1,000“ und „1.000“ → „1000“; „3.5“ und „3,5“ → „35“). */
export function numberTokens(s: string): string[] {
  return (s.match(NUMBER_RE) ?? []).map((n) => n.replace(/[.,]/g, ''));
}

// Wörter, die im Deutschen anders heißen (Namen, die keine Namen im Sinn von Tor 4 sind).
const TRANSLATED_CAPS = new Set(
  'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december american european german chinese french british english japanese indian canadian african asian germany france china japan india europe america asia africa canada spain italy russia brazil mexico australia switzerland austria netherlands united states kingdom union'.split(' '),
);

/** Eigennamen im Satz: großgeschriebene Wörter (≥ 4 Buchstaben) NICHT am Satzanfang, ohne übersetzte Eigennamen. */
export function nameTokens(e: string): string[] {
  const words = e.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  return words.slice(1).filter((w) => w.length >= 4 && /^[A-Z][a-z]/.test(w) && !TRANSLATED_CAPS.has(w.toLowerCase()));
}

function jaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Position von `w` im Satz (Wortanfang, Endungen erlaubt: „headcount“ in „headcounts“). */
export function containsWord(sentence: string, w: string): boolean {
  const key = normKey(w);
  if (!key) return false;
  const hay = ` ${normKey(sentence)}`;
  return hay.includes(` ${key}`);
}

const FIXED_LEVELS = new Set(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);

// ---------------------------------------------------------------- acceptArticle

/**
 * Prüft die rohe Antwort (`unknown`) gegen alle neun Tore und liefert den bereinigten Artikel oder die Mängel.
 * Mängel haben die Form `{gate, path, message}` und sind englisch, weil sie als Rückmeldung an Claude gehen (Neuversuch des KI-Tors).
 * Ungültige Prüffragen (Tor 7) und überzählige Schlüsselwörter im nachsichtigen Modus fallen still weg; der Artikel bleibt gültig.
 */
export function acceptArticle(raw: unknown, ctx: AcceptCtx = {}): AcceptResult {
  const issues: Issue[] = [];
  const dropped: Dropped[] = [];
  const repaired: string[] = [];

  // Tor 1: Form
  const shape = answerShape.safeParse(raw);
  if (!shape.success) {
    for (const i of shape.error.issues.slice(0, 5)) push(issues, 'form', i.path.filter((p): p is string | number => typeof p !== 'symbol'), i.message);
    return { ok: false, issues };
  }
  const a = shape.data;
  const title = normalizeDashes(a.title.trim());
  if (!title) push(issues, 'form', ['title'], 'title must not be empty');
  const nParas = a.paras.length;
  if (nParas < LIMITS.paras[0] || nParas > LIMITS.paras[1]) push(issues, 'form', ['paras'], `needs ${LIMITS.paras[0]} to ${LIMITS.paras[1]} paragraphs, got ${nParas}`);
  const paras: Sentence[][] = a.paras.map((p) => p.map((s) => ({ e: normalizeDashes(s.e.trim()), d: normalizeDashes(s.d.trim()) })));
  const flat: Array<{ s: Sentence; p: number; i: number }> = [];
  paras.forEach((p, pi) => p.forEach((s, si) => flat.push({ s, p: pi, i: si })));
  const n = flat.length;
  if (n < LIMITS.sentences[0] || n > LIMITS.sentences[1]) push(issues, 'form', ['paras'], `needs ${LIMITS.sentences[0]} to ${LIMITS.sentences[1]} sentences in total, got ${n}`);
  paras.forEach((p, pi) => {
    if (p.length === 0) push(issues, 'form', ['paras', pi], 'paragraph must not be empty');
  });
  for (const { s, p, i } of flat) {
    if (!s.e || !s.d) push(issues, 'form', ['paras', p, i], 'e and d must both be non-empty');
    else if (/[\r\n]/.test(s.e) || /[\r\n]/.test(s.d)) push(issues, 'form', ['paras', p, i], 'no line breaks inside a sentence');
    else if (countWords(s.e) > LIMITS.sentenceWords || countWords(s.d) > LIMITS.sentenceWords) push(issues, 'form', ['paras', p, i], `a sentence has more than ${LIMITS.sentenceWords} words; split it`);
  }
  if (issues.length > 0) return { ok: false, issues: issues.slice(0, 8) };

  // Tor 2: Länge
  const wordsE = flat.reduce((acc, f) => acc + countWords(f.s.e), 0);
  const wordsD = flat.reduce((acc, f) => acc + countWords(f.s.d), 0);
  const [minWords, maxWords] = ctx.words ?? LIMITS.words;
  if (wordsE < minWords || wordsE > maxWords) push(issues, 'length', ['paras'], `English text must have ${minWords} to ${maxWords} words, got ${wordsE}`);
  if (Array.from(title).length > LIMITS.titleChars) push(issues, 'length', ['title'], `title must have at most ${LIMITS.titleChars} characters`);

  // Tor 3: Sprachtreue (Englisch links, Deutsch rechts; Kurzsätze unter 4 Wörtern prüft detect nicht)
  const perSentence: Issue[] = [];
  let unclearE = 0;
  let unclearD = 0;
  let longE = 0;
  let longD = 0;
  for (const { s, p, i } of flat) {
    if (isWrongLang(s.e, 'en') || detectLang(s.e) === 'de') push(perSentence, 'language', ['paras', p, i, 'e'], 'must be English');
    if (isWrongLang(s.d, 'de') || detectLang(s.d) === 'en') push(perSentence, 'language', ['paras', p, i, 'd'], 'must be German');
    if (wordCount(s.e) >= 4) {
      longE++;
      if (detectLang(s.e) === 'unknown') unclearE++;
    }
    if (wordCount(s.d) >= 4) {
      longD++;
      if (detectLang(s.d) === 'unknown') unclearD++;
    }
  }
  const allE = flat.map((f) => f.s.e).join(' ');
  const allD = flat.map((f) => f.s.d).join(' ');
  if (detectLang(allE) !== 'en') push(issues, 'language', ['paras'], 'the e texts together must clearly be English');
  if (detectLang(allD) !== 'de') push(issues, 'language', ['paras'], 'the d texts together must clearly be German');
  if (unclearE > Math.ceil(longE * LIMITS.unclearShare)) push(issues, 'language', ['paras'], `too many English sentences of unclear language (${unclearE} of ${longE})`);
  if (unclearD > Math.ceil(longD * LIMITS.unclearShare)) push(issues, 'language', ['paras'], `too many German sentences of unclear language (${unclearD} of ${longD})`);
  // Gesamturteile zuerst, dann die einzelnen Sätze (limitPerGate kürzt am Ende).
  issues.push(...perSentence);

  // Tor 4: 1:1-Ausrichtung
  const ratioAll = wordsE > 0 ? wordsD / wordsE : 0;
  if (ratioAll < LIMITS.totalRatio[0] || ratioAll > LIMITS.totalRatio[1]) push(issues, 'alignment', ['paras'], `German/English word ratio ${fmt(ratioAll)} is outside ${LIMITS.totalRatio[0]}–${LIMITS.totalRatio[1]}; translate every sentence 1:1`);
  let outliers = 0;
  let names = 0;
  let namesMissing = 0;
  let prev = '';
  for (const { s, p, i } of flat) {
    const we = countWords(s.e);
    const wd = countWords(s.d);
    if (we >= 5) {
      const r = wd / we;
      if (r < LIMITS.sentenceRatio[0] || r > LIMITS.sentenceRatio[1]) outliers++;
    }
    const dNums = new Set(numberTokens(s.d));
    for (const num of numberTokens(s.e)) {
      if (!dNums.has(num)) {
        push(issues, 'alignment', ['paras', p, i, 'd'], `number ${num} of the English sentence is missing in the German one`);
        break;
      }
    }
    const dl = s.d.toLowerCase();
    for (const nm of nameTokens(s.e)) {
      names++;
      if (!dl.includes(nm.slice(0, 4).toLowerCase())) namesMissing++;
    }
    if (hasInnerSentenceEnd(s.e) || hasInnerSentenceEnd(s.d)) push(issues, 'alignment', ['paras', p, i], 'a sentence contains a second sentence end; one entry must be exactly one sentence');
    if (s.e === prev) push(issues, 'alignment', ['paras', p, i, 'e'], 'two identical sentences in a row');
    prev = s.e;
  }
  if (outliers > Math.floor(n * LIMITS.outlierShare)) push(issues, 'alignment', ['paras'], `${outliers} of ${n} sentences have a German/English length ratio outside ${LIMITS.sentenceRatio[0]}–${LIMITS.sentenceRatio[1]}; translate each sentence fully, neither merged nor split`);
  if (names >= 4 && namesMissing / names > LIMITS.namesMissingShare) push(issues, 'alignment', ['paras'], 'proper names of the English text are missing in the German text');

  // Tor 5: kein verklebter oder verunreinigter Text
  for (const { s, p, i } of flat) {
    const pe = gluedProblem(s.e);
    if (pe) push(issues, 'glued', ['paras', p, i, 'e'], pe);
    const pd = gluedProblem(s.d);
    if (pd) push(issues, 'glued', ['paras', p, i, 'd'], pd);
  }
  const pt = gluedProblem(title);
  if (pt) push(issues, 'glued', ['title'], pt);

  // Tor 8: US-Schreibweise
  const checkSpell = (text: string, path: Array<string | number>): void => {
    const hit = britishSpelling(text);
    if (hit) push(issues, 'spelling', path, `use American spelling, not "${hit}"`);
  };
  for (const { s, p, i } of flat) checkSpell(s.e, ['paras', p, i, 'e']);
  checkSpell(title, ['title']);
  for (const { s, p, i } of flat) {
    const hit = clichePhrase(s.e);
    if (hit) push(issues, 'spelling', ['paras', p, i, 'e'], `avoid the filler phrase "${hit}"; write something more specific`);
  }
  if (countWordIn(allE, 'quietly') > LIMITS.quietlyMax) push(issues, 'spelling', ['paras'], `use "quietly" at most ${LIMITS.quietlyMax} time`);
  if (countWordIn(allE, 'however') > LIMITS.howeverMax) push(issues, 'spelling', ['paras'], `use "however" at most ${LIMITS.howeverMax} times; vary the discourse markers`);

  // Tor 9: Dublette
  const tk = normKey(title);
  const topic: TopicKey = ctx.topic ?? (TOPIC_KEYS.find((k) => k === a.topic) ?? 'custom');
  for (const r of ctx.recent ?? []) {
    const rk = normKey(r.title);
    if (!rk) continue;
    if (rk === tk || (tk.split(' ').length >= 3 && (r.topic ?? topic) === topic && jaccard(rk, tk) >= LIMITS.duplicateJaccard)) {
      push(issues, 'duplicate', ['title'], 'this title is too close to a recent article; choose a different angle');
      break;
    }
  }

  // Tor 6: Schlüsselwörter
  const keyWords: KeyWord[] = [];
  const seenKw = new Set<string>();
  a.keyWords.forEach((rawKw, idx) => {
    const kw = checkKeyWord(rawKw, paras);
    if ('problem' in kw) {
      dropped.push({ what: 'keyWord', reason: kw.problem });
      if (!ctx.lenient) push(issues, 'keywords', ['keyWords', idx], kw.problem);
      return;
    }
    const key = normKey(kw.value.w);
    if (seenKw.has(key)) {
      dropped.push({ what: 'keyWord', reason: 'duplicate' });
      if (!ctx.lenient) push(issues, 'keywords', ['keyWords', idx], 'duplicate key word');
      return;
    }
    seenKw.add(key);
    if (kw.repaired) repaired.push(`keyWords.${idx}.i`);
    checkSpell(kw.value.w, ['keyWords', idx, 'w']);
    keyWords.push(kw.value);
  });
  const isMulti = (k: KeyWord): boolean => k.w.split(' ').length >= 2;
  const notSetPhrase = keyWords.filter((k) => isMulti(k) && lexicalUnit(k.w).verdict === 'check').map((k) => k.w);
  if (ctx.lenient) {
    if (keyWords.length < LIMITS.keyWordsLenientMin) push(issues, 'keywords', ['keyWords'], `needs at least ${LIMITS.keyWordsLenientMin} valid key words, got ${keyWords.length}`);
  } else {
    if (a.keyWords.length !== LIMITS.keyWords) push(issues, 'keywords', ['keyWords'], `needs exactly ${LIMITS.keyWords} key words, got ${a.keyWords.length}`);
    const multi = keyWords.filter(isMulti).length - notSetPhrase.length;
    const loose = notSetPhrase.length ? ` (not set phrases, so not counted: ${notSetPhrase.map((w) => `"${w}"`).join(', ')})` : '';
    if (multi < LIMITS.keyWordsMultiMin) push(issues, 'keywords', ['keyWords'], `at least ${LIMITS.keyWordsMultiMin} key words must be multi-word collocations (verb + noun, adjective + noun, fixed phrases), got ${multi}${loose}`);
  }

  if (issues.length > 0) return { ok: false, issues: limitPerGate(issues, 3).slice(0, 12) };

  // Tor 7: Prüffragen (nie ein Grund, den Artikel abzulehnen)
  let check: Check[] | undefined;
  if (a.check !== undefined) {
    const q = checkQuestions(a.check);
    if (q.ok) check = q.value;
    else dropped.push({ what: 'check', reason: q.reason });
  }

  const kind = ARTICLE_KINDS.find((k) => k === a.kind) ?? 'explainer';
  const level = typeof a.level === 'string' && FIXED_LEVELS.has(a.level.trim().toLowerCase()) ? a.level.trim().toLowerCase() : 'c1';
  const asOf = Array.from((a.asOf ?? '').replace(/\s+/g, ' ').trim()).slice(0, LIMITS.asOfChars).join('').trimEnd();
  let summary = Array.from(normalizeDashes((a.summary ?? '').replace(/\s+/g, ' ').trim())).slice(0, LIMITS.summaryChars).join('').trimEnd();
  if (summary && isWrongLang(summary, 'de')) summary = '';
  const article: AcceptedArticle = { title, topic, kind, level, asOf, summary, paras, keyWords, ...(check ? { check } : {}) };
  return { ok: true, article, dropped, repaired, notSetPhrase };
}

// ---------------------------------------------------------------- Tor 6 im Einzelnen

function checkKeyWord(raw: unknown, paras: Sentence[][]): { value: KeyWord; repaired: boolean } | { problem: string } {
  if (!raw || typeof raw !== 'object') return { problem: 'key word must be an object {w, de, i}' };
  const o = raw as { w?: unknown; de?: unknown; i?: unknown };
  const w = typeof o.w === 'string' ? o.w.replace(/\s+/g, ' ').trim() : '';
  const de = typeof o.de === 'string' ? o.de.replace(/\s+/g, ' ').trim() : '';
  if (!w || Array.from(w).length > 40) return { problem: 'w must be a word or phrase of at most 40 characters' };
  if (!de || Array.from(de).length > 60) return { problem: 'de must be a German meaning of at most 60 characters' };
  if (isWrongLang(de, 'de')) return { problem: 'de must be German' };
  const toks = normKey(w).split(' ');
  if (toks.length === 1 && FUNCTION_WORDS.has(toks[0] ?? '')) return { problem: `"${w}" is a function word, not a key word` };
  if (toks.length === 1 && GERMAN_SAME.has(toks[0] ?? '')) return { problem: `"${w}" is too easy for a key word (it looks and means the same in German); choose a more demanding word or phrase` };
  // Fundstelle: `i` = [Absatz, Satz]; stimmt sie nicht, wird der erste Satz gesucht, der das Wort enthält (stille Reparatur).
  const at = Array.isArray(o.i) && o.i.length === 2 && Number.isInteger(o.i[0]) && Number.isInteger(o.i[1]) ? ([o.i[0], o.i[1]] as [number, number]) : null;
  const sentence = at ? paras[at[0]]?.[at[1]]?.e : undefined;
  if (at && sentence !== undefined && containsWord(sentence, w)) return { value: { w, de, i: at }, repaired: false };
  for (let p = 0; p < paras.length; p++) {
    const ps = paras[p] ?? [];
    for (let s = 0; s < ps.length; s++) if (containsWord(ps[s]?.e ?? '', w)) return { value: { w, de, i: [p, s] }, repaired: true };
  }
  return { problem: `"${w}" does not occur in any English sentence of the article` };
}

// ---------------------------------------------------------------- Tor 7 im Einzelnen

function checkQuestions(raw: unknown[]): { ok: true; value: Check[] } | { ok: false; reason: string } {
  if (raw.length < LIMITS.questions[0] || raw.length > LIMITS.questions[1]) return { ok: false, reason: `needs ${LIMITS.questions[0]} to ${LIMITS.questions[1]} questions` };
  const out: Check[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') return { ok: false, reason: 'question must be an object' };
    const o = r as { q?: unknown; o?: unknown; a?: unknown; why?: unknown; why_en?: unknown };
    const q = typeof o.q === 'string' ? o.q.trim() : '';
    const why = typeof o.why === 'string' ? o.why.trim() : '';
    if (!q || Array.from(q).length > 200) return { ok: false, reason: 'q missing or too long' };
    if (!Array.isArray(o.o) || o.o.length !== 3 || !o.o.every((x) => typeof x === 'string' && x.trim().length > 0 && Array.from(x).length <= 150)) return { ok: false, reason: 'o needs three non-empty options' };
    const opts = (o.o as string[]).map((x) => x.trim());
    if (new Set(opts.map(normKey)).size !== 3) return { ok: false, reason: 'options must differ' };
    if (typeof o.a !== 'number' || !Number.isInteger(o.a) || o.a < 0 || o.a > 2) return { ok: false, reason: 'a must be 0, 1 or 2' };
    if (!why || isWrongLang(why, 'de')) return { ok: false, reason: 'why must be German' };
    if (isWrongLang(q, 'en') || britishSpelling(q) || opts.some((x) => britishSpelling(x))) return { ok: false, reason: 'question must be American English' };
    // `why_en` (Kurslektionen): die Begründung in der anderen Oberflächensprache. Ungültig oder nicht Englisch → still weglassen (Rückfall auf `why`), nie ein Fehler.
    const whyEn = typeof o.why_en === 'string' ? o.why_en.trim() : '';
    const keepEn = whyEn.length >= 10 && Array.from(whyEn).length <= 420 && !isWrongLang(whyEn, 'en') && detectLang(whyEn) !== 'de' && !britishSpelling(whyEn);
    out.push({ q, o: [opts[0] ?? '', opts[1] ?? '', opts[2] ?? ''], a: o.a, why, ...(keepEn ? { why_en: whyEn } : {}) });
  }
  return { ok: true, value: out };
}
