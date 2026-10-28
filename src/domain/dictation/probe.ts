import type { InputTally } from '../../engine/inputKind';
import { inputKindOf } from '../../engine/inputKind';
import { detectLang, langScores } from '../lang/detect';
import { dictPosOf } from '../lexicon/dict';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7): Laptop-Diktat-Probe, reine Logik.
// Erfolg = der Text kam ohne Tastendruck als Diktat (P4-Erkennung `in = 'd'`), ist Englisch (Wörterbuch) und trifft
// mindestens 70 % der Wörter des Zielsatzes. Ein Misserfolg nennt immer den ersten zutreffenden Grund.

export const DICTATION_TARGET = "I'll send you the revised quote by Friday.";
export const MATCH_MIN = 0.7;
/** Anteil bekannter englischer Wörter, ab dem der Text als Englisch gilt. */
const EN_MIN = 0.6;

export type ProbeReason = 'empty' | 'keys' | 'paste' | 'notDictation' | 'notEnglish' | 'mismatch';
export type ProbeResult = { ok: boolean; reason: ProbeReason | null; match: number };

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/n't\b/g, ' not'],
  [/'ll\b/g, ' will'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'m\b/g, ' am'],
  [/'d\b/g, ' would'],
];

/** Wörter in Kleinschreibung, Kurzformen aufgelöst, ohne Satzzeichen. */
export function words(text: string): string[] {
  let s = text.toLowerCase().replace(/[’‘`´]/g, "'");
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  return s
    .replace(/[^a-zäöüß0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Wortübereinstimmung 0…1: gemeinsame Wörter (mit Vielfachheit) durch die längere der beiden Wortlisten. */
export function wordMatch(text: string, target: string = DICTATION_TARGET): number {
  const a = words(text);
  const b = words(target);
  if (!a.length || !b.length) return 0;
  const pool = new Map<string, number>();
  for (const w of b) pool.set(w, (pool.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of a) {
    const n = pool.get(w) ?? 0;
    if (n > 0) {
      hit += 1;
      pool.set(w, n - 1);
    }
  }
  return hit / Math.max(a.length, b.length);
}

/** Pronomen, Wochentage und Monate fehlen im Wörterbuch der alten App. */
const EN_EXTRA = new Set([
  'i', 'me', 'my', 'mine', 'you', 'we', 'us', 'our', 'it', 'they', 'them', 'will', 'am', 'is', 'are', 'not',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);

const isEnWord = (w: string): boolean => EN_EXTRA.has(w) || langScores(w).en > 0 || dictPosOf(w).length > 0;

/** Englisch: keine Umlaute, nicht als Deutsch erkannt, mindestens 60 % der Wörter im Wörterbuch (oder häufige Funktionswörter). */
export function isEnglishText(text: string): boolean {
  if (/[äöüÄÖÜß]/.test(text)) return false;
  if (detectLang(text) === 'de') return false;
  const ws = words(text);
  if (!ws.length) return false;
  return ws.filter(isEnWord).length / ws.length >= EN_MIN;
}

/**
 * Bewertung eines Versuchs. `typedKeys` = Tasten, die ein Zeichen schreiben (ohne Strg/Cmd/Alt, ohne Fn/Pfeile/Enter):
 * Die Diktier-Taste (Fn zweimal) und Win + H zählen nicht, Löschen auch nicht (der Text selbst kam dann trotzdem ohne Taste).
 */
export function evaluateProbe(o: { text: string; tally: InputTally; typedKeys: number; target?: string }): ProbeResult {
  const text = o.text.trim();
  const match = wordMatch(text, o.target ?? DICTATION_TARGET);
  const fail = (reason: ProbeReason): ProbeResult => ({ ok: false, reason, match });
  if (!text) return fail('empty');
  if (o.typedKeys > 0) return fail('keys');
  if (o.tally.pasteChars > 0) return fail('paste');
  if (inputKindOf(o.tally, text, 't') !== 'd') return fail('notDictation');
  if (!isEnglishText(text)) return fail('notEnglish');
  if (match < MATCH_MIN) return fail('mismatch');
  return { ok: true, reason: null, match };
}

/** Taste, die ein Zeichen schreibt (für `typedKeys`). */
export function isTypingKey(key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean }): boolean {
  return [...key].length === 1 && !mods.ctrl && !mods.meta && !mods.alt;
}
