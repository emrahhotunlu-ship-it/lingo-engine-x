import { toUS } from '../answer/spelling';
import type { UsHint } from './types';

// Britisch ist nie ein Fehler (A7.3, Plan F11): Meldet die KI eine Stelle, deren einzige
// Korrektur die US-Schreibweise oder das US-Wort ist, wird daraus ein Hinweis „Amerikanisch: …".
// Er zählt nicht als Fehler und kommt nie ins Fehler-Radar. Deterministisch, nicht nur per Prompt.

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Ist `fix` genau die amerikanische Form von `orig`? */
export function isUkToUs(orig: string, fix: string): boolean {
  const o = norm(orig);
  const f = norm(fix);
  if (!o || !f || o === f) return false;
  return toUS(o) === f;
}

export function splitUkHints<E extends { orig: string; fix: string }>(errors: readonly E[]): { errors: E[]; usHints: UsHint[] } {
  const out: E[] = [];
  const usHints: UsHint[] = [];
  for (const e of errors) {
    if (isUkToUs(e.orig, e.fix)) {
      if (!usHints.some((h) => norm(h.orig) === norm(e.orig))) usHints.push({ orig: e.orig, us: e.fix });
    } else out.push(e);
  }
  return { errors: out, usHints };
}
