import { detectLang, isWrongLang } from '../shared';
import { normKey } from './text';

// Lokale Prüfung des Schritts „Selbst anwenden“ (Paket L8, docs/umbau/lesen-kurse.md §2 Nr. 5). Rein, ohne KI.
// Eine Wendung zählt als benutzt, wenn ihre Wörter in dieser Reihenfolge im Text stehen: gebeugt („spreads“, „spread“, „spreading“),
// mit anderem Possessivpronomen („on their own“ / „on its own“) und mit höchstens zwei Wörtern dazwischen („shut it down“).

/** Wörter, die in einer Wendung austauschbar sind (Possessiv- und Bezugswörter, Artikel). */
const WILD = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their', 'one', 'ones', 'someones', 'somebodys', 'someone', 'somebody', 'a', 'an', 'the', 'this', 'that']);

/** Unregelmäßige Verben: alle Formen zeigen auf die Grundform. */
const IRREGULAR: ReadonlyArray<readonly string[]> = [
  ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  ['have', 'has', 'had', 'having'],
  ['do', 'does', 'did', 'done', 'doing'],
  ['go', 'goes', 'went', 'gone', 'going'],
  ['get', 'gets', 'got', 'gotten', 'getting'],
  ['make', 'makes', 'made', 'making'],
  ['take', 'takes', 'took', 'taken', 'taking'],
  ['give', 'gives', 'gave', 'given', 'giving'],
  ['run', 'runs', 'ran', 'running'],
  ['bring', 'brings', 'brought', 'bringing'],
  ['build', 'builds', 'built', 'building'],
  ['find', 'finds', 'found', 'finding'],
  ['hold', 'holds', 'held', 'holding'],
  ['keep', 'keeps', 'kept', 'keeping'],
  ['lead', 'leads', 'led', 'leading'],
  ['put', 'puts', 'putting'],
  ['set', 'sets', 'setting'],
  ['send', 'sends', 'sent', 'sending'],
  ['see', 'sees', 'saw', 'seen', 'seeing'],
  ['show', 'shows', 'showed', 'shown', 'showing'],
  ['think', 'thinks', 'thought', 'thinking'],
  ['write', 'writes', 'wrote', 'written', 'writing'],
  ['spread', 'spreads', 'spreading'],
  ['shut', 'shuts', 'shutting'],
  ['begin', 'begins', 'began', 'begun', 'beginning'],
  ['come', 'comes', 'came', 'coming'],
  ['know', 'knows', 'knew', 'known', 'knowing'],
  ['say', 'says', 'said', 'saying'],
  ['tell', 'tells', 'told', 'telling'],
  ['pay', 'pays', 'paid', 'paying'],
  ['meet', 'meets', 'met', 'meeting'],
  ['rely', 'relies', 'relied', 'relying'],
  ['apply', 'applies', 'applied', 'applying'],
  ['carry', 'carries', 'carried', 'carrying'],
];
const BASE = new Map<string, string>(IRREGULAR.flatMap((forms) => forms.map((f) => [f, forms[0] ?? f] as const)));

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

/** Wörter eines Textes, klein, ohne Apostroph-Endung („one’s“ → „ones“). */
export function tokens(text: string): string[] {
  return (text.normalize('NFKC').toLowerCase().match(TOKEN_RE) ?? []).map((t) => t.replace(/['’]/g, ''));
}

/** Wortstamm für den Vergleich: Grundform bei unregelmäßigen Verben, sonst ohne -ing/-ed/-es/-s/-ies und mit gekürztem Doppelkonsonanten. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  const irregular = BASE.get(w);
  if (irregular) return irregular;
  let s = w;
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 4 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 3 && s.endsWith('ed')) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith('es')) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.length > 3 && /([^aeiou])\1$/.test(s)) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith('y')) s = s.slice(0, -1);
  return BASE.get(s) ?? s;
}

const sameToken = (a: string, b: string): boolean => a === b || (WILD.has(a) && WILD.has(b)) || stem(a) === stem(b);

/** Höchstens so viele fremde Wörter stehen zwischen zwei Wörtern der Wendung („shut it down“). */
const MAX_GAP = 2;

/** Steht die Wendung (auch gebeugt) im Text? */
export function phraseUsed(text: string, phrase: string): boolean {
  const want = tokens(phrase);
  const have = tokens(text);
  if (want.length === 0 || have.length === 0) return false;
  const first = want[0] ?? '';
  for (let start = 0; start < have.length; start++) {
    if (!sameToken(have[start] ?? '', first)) continue;
    let pos = start;
    let ok = true;
    for (let k = 1; k < want.length; k++) {
      let found = -1;
      for (let j = pos + 1; j <= Math.min(have.length - 1, pos + 1 + MAX_GAP); j++) {
        if (sameToken(have[j] ?? '', want[k] ?? '')) {
          found = j;
          break;
        }
      }
      if (found < 0) {
        ok = false;
        break;
      }
      pos = found;
    }
    if (ok) return true;
  }
  return false;
}

/** Sätze eines eigenen Textes: am Satzende (. ! ?) geteilt, nur Sätze mit mindestens 3 Wörtern. */
export function userSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => tokens(s).length >= 3);
}

export const APPLY_MIN_SENTENCES = 2;
export const APPLY_MIN_WORDS = 8;
export const APPLY_MAX_CHARS = 700;

export type ApplyProblem = 'empty' | 'tooShort' | 'notEnglish' | 'tooLong';
export type ApplyCheck = {
  /** Kann abgeschickt werden (genug Sätze, englisch, nicht zu lang). */
  ok: boolean;
  problem: ApplyProblem | null;
  sentences: number;
  words: number;
  /** Je Zielwendung: benutzt? (gleiche Reihenfolge wie `targets`) */
  hits: boolean[];
};

/**
 * Lokale Prüfung des eigenen Textes. Nur eine Hürde für Mühe und Sprache (mindestens zwei Sätze, zusammen mindestens acht Wörter,
 * englisch); fehlende Wendungen blockieren nicht, sie werden benannt. Geprüft wird ohne KI und sofort.
 */
export function checkApply(text: string, targets: readonly string[]): ApplyCheck {
  const trimmed = text.trim();
  const words = tokens(trimmed).length;
  const sentences = userSentences(trimmed).length;
  const hits = targets.map((t) => phraseUsed(trimmed, t));
  const base = { sentences, words, hits };
  if (!trimmed) return { ...base, ok: false, problem: 'empty' };
  if (trimmed.length > APPLY_MAX_CHARS) return { ...base, ok: false, problem: 'tooLong' };
  if (sentences < APPLY_MIN_SENTENCES || words < APPLY_MIN_WORDS) return { ...base, ok: false, problem: 'tooShort' };
  if (isWrongLang(trimmed, 'en', 4) || detectLang(trimmed) === 'de') return { ...base, ok: false, problem: 'notEnglish' };
  return { ...base, ok: true, problem: null };
}

/** Zwei Wendungen sind gleich (für „Ziel ist eine der Schlüsselwendungen“). */
export const samePhrase = (a: string, b: string): boolean => normKey(a) === normKey(b);
