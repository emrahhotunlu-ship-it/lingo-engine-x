import type { LexKind, Outcome } from './types';

// Wörter-Modul V2: Auswertung einer getippten Antwort (synthese M40 Regeln (a)–(h), M41 Auch richtig/Ausweichwort, M56 Kollokation,
// M78 Präposition/Muster, M79 Zählbarkeit, M81 Partikel/Stellung). Fest, nicht einstellbar. Rein: Wörterbuch und Listen kommen als Daten.
//
// Reihenfolge (M40): (g) angleichen → (h) britisch → Listen des Lehrers (Auch richtig, Ausweichwort, Kollokation, Muster, Plural, Stellung)
// → (c) Beugung → (f) Bindestrich/Leerzeichen → (b) Rechtschreibliste → (e) anderes echtes Wort → (a) Tippfehler → (d) Wortart/Ableitung.
// Die Listen des Lehrers stehen vor (c), weil sie genau festgelegte Antworten sind (*informations* ist „Plural falsch“, keine Beugung)
// und weil Strukturfehler (*discuss about*, *set up it*) sonst als „anderes Wort“ endeten. So landet *lead times* bei (c), nicht bei (e).

export type Target = {
  /** gesuchte Antwort genau so, wie sie in die Lücke gehört (z. B. `lead time`, `set it up`). */
  answer: string;
  k: LexKind;
  /** Wortart der Antwort (für (f)). */
  pos?: 'noun' | 'verb' | 'adj' | 'adv' | null;
  /** Varianten des Lexems (`gr.var`) und Synonyme dieses Satzes: „Auch richtig“. */
  syn?: readonly string[];
  /** britischer Wortschatz: „Auch richtig“ mit US-Hinweis. */
  uk?: readonly string[];
  /** einfachere Ausweichwörter dieses Satzes (M41). */
  evade?: readonly string[];
  /** bekannte falsche Verbindungen (M56: *hold a presentation*). */
  colloc?: readonly string[];
  /** bekannte falsche Muster (M78: *discuss about*). */
  prep?: readonly string[];
  /** nicht zählbar (M79): `gr.cnt === 'u'`. */
  uncount?: boolean;
  /** Wörter derselben Familie (M40d), zusätzlich zur Faustregel. */
  family?: readonly string[];
};

export type CheckDict = {
  /** echtes englisches Wort? (Wörterbuch der App; der Aufrufer liefert es). */
  isWord: (w: string) => boolean;
  /** Rechtschreibliste deutscher Lerner (M40b): falsch → richtig. */
  misspell: ReadonlyMap<string, string>;
  /** echte Verwechslungspaare (M40e, M14): Wort → Partner. */
  confusable: ReadonlyMap<string, readonly string[]>;
  /** britische Schreibweise → US (`toUSText`). */
  toUS: (s: string) => string;
};

export type Check = {
  outcome: Outcome;
  /** Hinweis-Schlüssel für die Warum-Zeile (V3): z. B. `uk`, `grammar`, `plural`, `partner`, `article`. */
  note?: string;
  /** Fundstück aus einer Liste (Ausweichwort, falsche Verbindung, Rechtschreibung). */
  hit?: string;
  /** Damerau-Abstand bei (a). */
  dist?: number;
};

const ARTICLES = /^(the|a|an)\s+/;
const PRONOUNS = new Set(['it', 'them', 'him', 'her', 'me', 'us', 'you', 'this', 'that']);
export const PREPOSITIONS = new Set(['about', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'until', 'with', 'within', 'over', 'under', 'against', 'towards', 'toward', 'through', 'during', 'since', 'after', 'before']);

/** Kurzformen gelten wie die Langform (*I'm* = *I am*, english-teacher V2, Charge 3 Teil 2). */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\b(i|you|we|they)'re\b/g, '$1 are'],
  [/\bi'm\b/g, 'i am'],
  [/\b(it|that|what|there|here|he|she|who)'s\b/g, '$1 is'],
  [/\b(i|you|we|they|he|she|it|that|there)'d\b/g, '$1 would'],
  [/\b(i|you|we|they|he|she|it|that|there)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\b(do|does|did|is|are|was|were|has|have|had|would|should|could|must|need)n't\b/g, '$1 not'],
];

/** (g) Angleichen: Groß/klein, typografische Apostrophe und Anführungen, Leerraum, Satzzeichen am Rand, Kurzformen. */
export function normalize(s: string): string {
  let out = normalizeRaw(s);
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep);
  return out.replace(/\bcan not\b/g, 'cannot');
}

function normalizeRaw(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-–]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'(]+|["'.,;:!?)]+$/g, '')
    .trim();
}

/** (g) Artikel vor dem Wort angleichen, wenn die Lösung keinen Artikel hat (*the lead time* → *lead time*). */
function dropArticle(input: string, answer: string): string {
  return ARTICLES.test(answer) ? input : input.replace(ARTICLES, '');
}

const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const inList = (x: string, l: readonly string[] | undefined, us: (s: string) => string): string | null => {
  for (const v of l ?? []) {
    const n = normalize(v);
    if (x === n || us(x) === us(n)) return v;
  }
  return null;
};

/** Damerau-Levenshtein (eingeschränkt, „optimal string alignment“): eine Vertauschung zählt 1. */
export function damerau(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((d[i - 1]![j] as number) + 1, (d[i]![j - 1] as number) + 1, (d[i - 1]![j - 1] as number) + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (d[i - 2]![j - 2] as number) + 1);
      d[i]![j] = v;
    }
  return d[m]![n] as number;
}

/** Beugungsformen eines Worts (-s/-es/-ies, -ed/-d/-ied, Doppelung, -ing, -er/-est). */
export function inflections(w: string): Set<string> {
  const out = new Set<string>();
  const add = (x: string) => x !== w && out.add(x);
  const e = w.endsWith('e');
  const y = /[^aeiou]y$/.test(w);
  const stem = e ? w.slice(0, -1) : w;
  const dbl = /[^aeiou][aeiou][bdgklmnprt]$/.test(w) ? w + w.slice(-1) : null;
  add(/(s|x|z|ch|sh)$/.test(w) ? `${w}es` : y ? `${w.slice(0, -1)}ies` : `${w}s`);
  add(e ? `${w}d` : y ? `${w.slice(0, -1)}ied` : `${w}ed`);
  add(`${stem}ing`);
  add(e ? `${w}r` : y ? `${w.slice(0, -1)}ier` : `${w}er`);
  add(e ? `${w}st` : y ? `${w.slice(0, -1)}iest` : `${w}est`);
  if (dbl) for (const s of ['ed', 'ing', 'er', 'est']) add(dbl + s);
  // Rückwärts: die Lösung ist schon gebeugt (*postponed*), die Eingabe die Grundform.
  for (const [suf, rep] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['ed', 'e'], ['d', ''], ['ing', ''], ['ing', 'e'], ['er', ''], ['est', '']] as const)
    if (w.endsWith(suf) && w.length - suf.length >= 3) add(w.slice(0, -suf.length) + rep);
  if (/([bdgklmnprt])\1(ed|ing)$/.test(w)) add(w.replace(/([bdgklmnprt])\1(ed|ing)$/, '$1'));
  return out;
}

/** Genau ein Wort weicht ab; liefert die beiden Wörter. */
function oneTokenDiff(a: string[], b: string[]): [string, string] | null {
  if (a.length !== b.length) return null;
  let diff: [string, string] | null = null;
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i]) {
      if (diff) return null;
      diff = [a[i] as string, b[i] as string];
    }
  return diff;
}

/** Faustregel Wortfamilie (M40d): gemeinsamer Anfang ≥ 5, oder ≥ 4 bei kurzen Wörtern (≥ 60 % des kürzeren). *decide/decision*, *manage/manager*. */
export function sameFamily(a: string, b: string, extra?: readonly string[]): boolean {
  if (a === b) return false;
  if (extra?.some((x) => normalize(x) === a)) return true;
  if (a.includes(' ') || b.includes(' ')) return false;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return p >= 5 || (p >= 4 && p >= 0.6 * Math.min(a.length, b.length));
}

const isConfusable = (a: string, b: string, d: CheckDict) => !!d.confusable.get(b)?.includes(a) || !!d.confusable.get(a)?.includes(b);

/** Wortart ändert sich zwischen getrennter und verbundener Schreibung? (*follow up* Verb ↔ *follow-up* Nomen). */
function hyphenChangesPos(input: string, t: Target, answer: string): boolean {
  const spaced = (s: string) => s.includes(' ');
  if (spaced(answer) === spaced(input)) return false; // nur Bindestrich ↔ zusammen: gleiche Wortart (*e-mail/email*)
  const verbish = t.k === 'pv' || t.pos === 'verb';
  const nounish = t.pos === 'noun' || t.pos === 'adj';
  return spaced(answer) ? verbish || t.pos === undefined || t.pos === null : nounish || t.pos === undefined || t.pos === null;
}

/** Strukturfehler bei Mehrwort-Antworten: Pronomen falsch gestellt (M81 *set up it*). */
function isOrderError(inp: string[], ans: string[]): boolean {
  if (inp.length !== ans.length || inp.length < 3) return false;
  if ([...inp].sort().join(' ') !== [...ans].sort().join(' ')) return false;
  return inp.some((w, i) => PRONOUNS.has(w) && ans[i] !== w);
}

/** Präposition ergänzt, weggelassen oder getauscht (M78), sonst gleich. */
function isPrepError(inp: string[], ans: string[]): boolean {
  const strip = (l: string[]) => l.filter((w) => !PREPOSITIONS.has(w)).join(' ');
  if (strip(inp) !== strip(ans)) return false;
  const pi = inp.filter((w) => PREPOSITIONS.has(w)).join(' ');
  const pa = ans.filter((w) => PREPOSITIONS.has(w)).join(' ');
  return pi !== pa;
}

/** Antwort auswerten. `raw` = Eingabe, wie getippt. */
export function checkAnswer(raw: string, t: Target, d: CheckDict): Check {
  const answer = normalize(t.answer);
  let input = normalize(raw);
  if (!input) return { outcome: 'dunno' };
  // (g) Artikel, Groß/klein, Apostrophe
  const noArt = dropArticle(input, answer);
  if (noArt === answer) return { outcome: 'ok', ...(noArt !== input ? { note: 'article' } : {}) };
  input = noArt;
  // (h) britische Schreibweise ist richtig (A7)
  if (d.toUS(input) === d.toUS(answer)) return { outcome: 'ok', note: 'uk' };

  // Listen des Lehrers (genau festgelegte Antworten)
  const us = d.toUS;
  let hit = inList(input, t.syn, us);
  if (hit) return { outcome: 'syn', hit };
  hit = inList(input, t.uk, us);
  if (hit) return { outcome: 'syn', hit, note: 'uk' };
  hit = inList(input, t.evade, us);
  if (hit) return { outcome: 'evade', hit };
  hit = inList(input, t.colloc, us);
  if (hit) return { outcome: 'colloc', hit, note: 'partner' };
  hit = inList(input, t.prep, us);
  if (hit) return { outcome: 'prep', hit };
  const it = tokens(input);
  const at = tokens(answer);
  if (t.uncount) {
    const last = at.at(-1) as string;
    const il = it.at(-1) as string;
    if (it.length === at.length && it.slice(0, -1).join(' ') === at.slice(0, -1).join(' ') && (il === `${last}s` || il === `${last}es`)) return { outcome: 'plural', note: 'plural' };
  }
  if (isOrderError(it, at)) return { outcome: 'order', note: 'particle' };
  if (at.length > 1 && isPrepError(it, at)) return { outcome: 'prep' };

  // (c) Beugung: gleicher Stamm, nur die Endung (bei Mehrwort genau ein Wort)
  const tok = oneTokenDiff(it, at);
  if (tok && inflections(tok[1]).has(tok[0])) return { outcome: 'infl', note: 'grammar' };

  // (f) Bindestrich und Leerzeichen
  const flat = (s: string) => s.replace(/[\s-]+/g, '');
  if (flat(input) === flat(answer)) return hyphenChangesPos(input, t, answer) ? { outcome: 'hyph', note: 'pos' } : { outcome: 'ok', note: 'hyphen' };

  // Kollokation: bei Mehrwort-Lösungen genau ein anderes echtes Wort, das kein Funktionswort ist (*do a decision*)
  if (tok && at.length > 1 && !PREPOSITIONS.has(tok[0]) && !PREPOSITIONS.has(tok[1]) && d.isWord(tok[0]) && !sameFamily(tok[0], tok[1]) && !isConfusable(tok[0], tok[1], d))
    return { outcome: 'colloc', hit: tok[0], note: 'partner' };

  // (b) Rechtschreibliste deutscher Lerner: Formfehler mit eigener Erklärung, nie „fast richtig“
  const words = it.map((w, i) => (d.misspell.get(w) === at[i] ? w : null)).filter(Boolean);
  if (it.length === at.length && words.length && it.every((w, i) => w === at[i] || d.misspell.get(w) === at[i])) return { outcome: 'spell', hit: words[0] as string };

  // (e) anderes echtes Wort: nie Tippfehler (Verwechslungspaar oder Wort außerhalb der Familie)
  const a1 = tok ? tok[1] : answer;
  const i1 = tok ? tok[0] : input;
  if (isConfusable(i1, a1, d)) return { outcome: 'other', note: 'pair' };
  if (d.isWord(i1) && !sameFamily(i1, a1, t.family)) return { outcome: 'other' };

  // (a) Tippfehler: 1 Fehler (Vertauschung = 1) ab 5 Buchstaben, ohne dass ein echtes Wort entsteht
  const dist = damerau(input, answer);
  if (dist === 1 && answer.replace(/[^a-z]/g, '').length >= 5 && !d.isWord(i1)) return { outcome: 'typo', dist };

  // (d) Wortart oder Ableitung (*decide* statt *decision*)
  if (sameFamily(i1, a1, t.family)) return { outcome: 'pos', note: 'pos' };
  return { outcome: 'wrong' };
}
