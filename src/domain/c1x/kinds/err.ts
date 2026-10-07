import { legacyNorm } from '../../grammar/key';
import { splitWords } from '../../answer/align';
import type { C1Response, C1Score, Err, ErrBad } from '../types';
import { BRITISH, cmp, findSeq, keyOf, usHint, wordCount, type Problems } from './common';

// `err`: Fehler finden, auch fehlerfreie Sätze. 2 Punkte: Fundort (angetipptes Wort liegt in der Fehlerstelle) + Korrektur
// (gewählter oder getippter Ersatz ∈ `bad.fix`). Fehlerfreier Satz: „Kein Fehler“ = 2/2, jedes angetippte Wort = 0 (`falseAlarm`);
// Fehler übersehen („Kein Fehler“ bei fehlerhaftem Satz) = 0 (`missed`).

/** Wortbereich [von, bis] (0-basiert, einschließlich) der Fehlerstelle in den Leerzeichen-Wörtern des Satzes, oder `null`. */
export function errRange(item: Pick<Err, 'text' | 'bad'>): [number, number] | null {
  if (!item.bad) return null;
  const hay = splitWords(item.text).map(keyOf);
  const seq = splitWords(item.bad.span).map(keyOf);
  const at = findSeq(hay, seq, item.bad.nth ?? 1);
  return at < 0 ? null : [at, at + seq.length - 1];
}

/** Der Satz mit eingesetzter Korrektur. */
export function errFixed(item: Pick<Err, 'text' | 'bad'>, fix: string): string {
  const range = errRange(item);
  if (!range) return item.text;
  const words = splitWords(item.text);
  return [...words.slice(0, range[0]), ...(fix ? [fix] : []), ...words.slice(range[1] + 1)].join(' ');
}

const fixKey = (s: string): string => cmp(s);

export function scoreErr(item: Err, r: Extract<C1Response, { kind: 'err' }>): C1Score {
  const free = r.typed === true;
  const loc = (ok: boolean) => ({ id: 'loc' as const, ok });
  const fix = (ok: boolean) => ({ id: 'fix' as const, ok });
  if (!item.bad) {
    if (r.tap === 'none') return { got: 2, max: 2, parts: [loc(true), fix(true)], verdict: 'correct', free };
    return { got: 0, max: 2, parts: [loc(false), fix(false)], verdict: 'wrong', free, reason: 'falseAlarm' };
  }
  if (r.tap === 'none') return { got: 0, max: 2, parts: [loc(false), fix(false)], verdict: 'wrong', free, reason: 'missed' };
  const range = errRange(item);
  const found = range !== null && r.tap >= range[0] && r.tap <= range[1];
  if (!found) return { got: 0, max: 2, parts: [loc(false), fix(false)], verdict: 'wrong', free };
  const given = r.fix?.trim() ?? '';
  // `fix: ''` (streichen) gilt nur, wenn die Korrektur ausdrücklich leer abgegeben wurde.
  const fixOk = r.fix !== undefined && item.bad.fix.some((f) => fixKey(f) === fixKey(given));
  const us = fixOk && given !== '' ? usHint(given, item.bad.fix) : undefined;
  const got = 1 + (fixOk ? 1 : 0);
  return { got, max: 2, parts: [loc(true), fix(fixOk)], verdict: got >= 2 ? 'correct' : 'near', free, ...(us ? { us } : {}) };
}

export function checkErr(item: Err): Problems {
  const out: Problems = [];
  const legacy = /^err-v2-/.test(item.id);
  const n = wordCount(item.text);
  if (!legacy && (n < 6 || n > 25)) out.push(`Satz hat ${n} Wörter (6–25)`);
  if (BRITISH.test(item.text)) out.push('britische Schreibweise');
  const bad: ErrBad | null = item.bad;
  if (!bad) return out;
  if (!legacy && bad.fix.some((f) => f.trim() === '')) out.push('fix darf nicht leer sein (streichen nur bei Aufgaben aus dem LP2-Adapter)');
  if (legacy && !bad.choices) return [...out, ...(errRange(item) ? [] : [`span „${bad.span}“ kommt im Satz nicht vor`])];
  if (!bad.choices) return [...out, 'choices fehlen (drei Korrektur-Chips)'];
  if (!errRange(item)) out.push(`span „${bad.span}“ kommt${bad.nth ? ` ${bad.nth}-mal` : ''} im Satz nicht vor`);
  const fixes = bad.fix.map(fixKey);
  const first = fixes[0] ?? '';
  const choices = bad.choices;
  const inChoices = choices.map(fixKey);
  if (!inChoices.includes(first)) out.push('fix[0] steht nicht in choices');
  if (inChoices.filter((c) => fixes.includes(c)).length !== 1) out.push('genau ein choice muss eine gültige Korrektur sein');
  if (new Set(inChoices).size !== 3) out.push('choices nicht alle verschieden');
  if (legacyNorm(errFixed(item, bad.fix[0] ?? '')) === legacyNorm(item.text)) out.push('Satz mit fix[0] ist gleich dem Satz (kein Fehler)');
  return out;
}
