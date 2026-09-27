import { locateAll } from './errorSpans';
import type { WritingReviewRes } from './records';
import { ERROR_CATS, type ErrorCat, type TextError } from './types';
import { splitUkHints } from './usHints';

// Nachbearbeitung einer KI-Korrektur (Plan §5, writing-review@1 / apply-check@1) – kein
// Schemafehler, also kein Neuversuch: Stellen im Text wiederfinden (sonst nur in der Liste),
// britische Formen als Hinweis abtrennen (F11), Doppelte entfernen.

export type RawError = { orig: string; fix: string; cat: string; topic?: string | null; sev?: 'minor' | 'major'; why: string };

const asCat = (c: string): ErrorCat => (ERROR_CATS.includes(c as ErrorCat) ? (c as ErrorCat) : 'other');

export function processErrors(raw: readonly RawError[], text: string): { errors: TextError[]; usHints: WritingReviewRes['usHints'] } {
  const seen = new Set<string>();
  const unique = raw.filter((e) => {
    const k = `${e.orig.trim().toLowerCase()}|${e.fix.trim().toLowerCase()}`;
    if (seen.has(k) || e.orig.trim() === e.fix.trim()) return false;
    seen.add(k);
    return true;
  });
  const { errors, usHints } = splitUkHints(unique);
  const spans = locateAll(
    errors.map((e) => e.orig),
    text,
  );
  return {
    errors: errors.map((e, i) => ({
      orig: e.orig.trim(),
      fix: e.fix.trim(),
      cat: asCat(e.cat),
      topic: e.topic ?? null,
      sev: e.sev === 'major' ? 'major' : 'minor',
      why: e.why.trim(),
      span: spans[i] ?? null,
    })),
    usHints,
  };
}

export function processReview(
  out: Omit<WritingReviewRes, 'errors' | 'usHints'> & { errors: readonly RawError[] },
  text: string,
): WritingReviewRes {
  const { errors, usHints } = processErrors(out.errors, text);
  return { ...out, errors, usHints };
}
