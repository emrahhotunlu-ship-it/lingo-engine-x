import type { Colloc, ContextSpan } from './types';

// Ursprungssatz und Lücke finden (Lern-Entwurf §1.4):
// 1. `[…]` im Beispielsatz (Konvention der alten App) → genau diese Stelle.
// 2. Sonst das Wort selbst oder eine regelmäßige Form davon (Wortgrenzen, ohne Groß/klein).
// 3. Sonst keine Lücke – Satzübungen sind für diese Karte nicht verfügbar.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wort ohne führendes „to " und ohne Auslassungspunkte. */
export function lemmaOf(word: string): string {
  return word
    .trim()
    .replace(/^to\s+/i, '')
    .replace(/\s*(…|\.\.\.)\s*$/, '')
    .trim();
}

/** Regelmäßige Formen eines einzelnen Worts (Endungen, e-Wegfall, y → ies/ied, Doppelkonsonant). */
export function formsOf(w: string): string[] {
  const out = new Set<string>([w]);
  const lower = w.toLowerCase();
  for (const suf of ['s', 'es', 'ed', 'd', 'ing', 'er', 'est']) out.add(lower + suf);
  if (lower.endsWith('e')) {
    out.add(lower.slice(0, -1) + 'ing');
    out.add(lower.slice(0, -1) + 'ed');
  }
  if (/[^aeiou]y$/.test(lower)) {
    out.add(lower.slice(0, -1) + 'ies');
    out.add(lower.slice(0, -1) + 'ied');
  }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(lower)) {
    const last = lower.slice(-1);
    out.add(lower + last + 'ed');
    out.add(lower + last + 'ing');
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function stripBrackets(s: string): string {
  return s.replace(/\[|\]/g, '');
}

/** Sucht `target` (erstes und letztes Wort dürfen gebeugt sein) in `sentence`. */
export function locate(sentence: string, target: string): { start: number; end: number } | null {
  const words = target.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const parts = words.map((w, i) => {
    const flex = i === 0 || i === words.length - 1;
    return flex ? `(?:${formsOf(w).map(escape).join('|')})` : escape(w);
  });
  const re = new RegExp(`(?<![A-Za-z'])${parts.join('\\s+')}(?![A-Za-z'])`, 'i');
  const m = re.exec(sentence);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

export function findContext(ex: unknown, word: string): ContextSpan | null {
  if (typeof ex !== 'string' || !ex.trim()) return null;
  const bracket = /\[([^\]]*\S[^\]]*)\]/.exec(ex);
  if (bracket) {
    const before = stripBrackets(ex.slice(0, bracket.index));
    const gap = (bracket[1] ?? '').trim();
    const lead = (bracket[1] ?? '').indexOf(gap);
    const sentence = stripBrackets(ex);
    const start = before.length + Math.max(0, lead);
    return { sentence, start, end: start + gap.length, gap };
  }
  const sentence = ex.trim();
  const lemma = lemmaOf(word);
  if (!lemma) return null;
  const hit = locate(sentence, lemma);
  if (!hit) return null;
  return { sentence, start: hit.start, end: hit.end, gap: sentence.slice(hit.start, hit.end) };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Kollokationen `[{p, de, gap, opts[], ex}]`; die Lücke liegt beim Partnerwort innerhalb der Klammer. */
export function parseCollocs(col: unknown): Colloc[] {
  if (!Array.isArray(col)) return [];
  const out: Colloc[] = [];
  col.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const c = raw as Record<string, unknown>;
    const gap = str(c.gap).trim();
    const opts = Array.isArray(c.opts) ? c.opts.filter((o): o is string => typeof o === 'string' && !!o.trim()) : [];
    let ctx: ContextSpan | null = null;
    const ex = str(c.ex);
    const bracket = /\[([^\]]+)\]/.exec(ex);
    if (gap && bracket) {
      const sentence = stripBrackets(ex);
      const inner = bracket[1] ?? '';
      const offset = stripBrackets(ex.slice(0, bracket.index)).length;
      const hit = locate(inner, gap);
      if (hit) ctx = { sentence, start: offset + hit.start, end: offset + hit.end, gap: inner.slice(hit.start, hit.end) };
    }
    out.push({ index, p: str(c.p), de: str(c.de), gap, opts, ctx });
  });
  return out;
}
