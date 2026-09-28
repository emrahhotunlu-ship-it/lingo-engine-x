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

// Unregelmäßige Verben, deren Stammformen keine Endungsregel trifft (Befund 28.09.2026: „catch on“
// im Beispielsatz als „caught on“ – die Karte ließ sich nicht anlegen, weil `locate()` die Form
// nicht fand). Nur das erste bzw. letzte Wort einer Wendung wird gebeugt gesucht (targetRe), deshalb
// reicht eine flache Stammform-Liste der gebräuchlichsten Business-Englisch-Verben.
const IRREGULAR: Readonly<Record<string, readonly string[]>> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  become: ['became', 'become'],
  begin: ['began', 'begun'],
  break: ['broke', 'broken'],
  bring: ['brought'],
  build: ['built'],
  buy: ['bought'],
  catch: ['caught'],
  choose: ['chose', 'chosen'],
  come: ['came'],
  cut: ['cut'],
  deal: ['dealt'],
  do: ['did', 'done'],
  draw: ['drew', 'drawn'],
  drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'],
  fall: ['fell', 'fallen'],
  feel: ['felt'],
  find: ['found'],
  fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten'],
  get: ['got', 'gotten'],
  give: ['gave', 'given'],
  go: ['went', 'gone'],
  grow: ['grew', 'grown'],
  have: ['has', 'had'],
  hear: ['heard'],
  hold: ['held'],
  keep: ['kept'],
  know: ['knew', 'known'],
  lay: ['laid'],
  lead: ['led'],
  leave: ['left'],
  lose: ['lost'],
  make: ['made'],
  mean: ['meant'],
  meet: ['met'],
  pay: ['paid'],
  put: ['put'],
  read: ['read'],
  rise: ['rose', 'risen'],
  run: ['ran'],
  say: ['said'],
  see: ['saw', 'seen'],
  sell: ['sold'],
  send: ['sent'],
  set: ['set'],
  show: ['showed', 'shown'],
  shut: ['shut'],
  sit: ['sat'],
  speak: ['spoke', 'spoken'],
  spend: ['spent'],
  stand: ['stood'],
  take: ['took', 'taken'],
  teach: ['taught'],
  tell: ['told'],
  think: ['thought'],
  understand: ['understood'],
  wear: ['wore', 'worn'],
  win: ['won'],
  write: ['wrote', 'written'],
};

/** Regelmäßige Formen eines einzelnen Worts (Endungen, e-Wegfall, y → ies/ied, Doppelkonsonant, Unregelmäßige). */
export function formsOf(w: string): string[] {
  const out = new Set<string>([w]);
  const lower = w.toLowerCase();
  for (const suf of ['s', 'es', 'ed', 'd', 'ing', 'er', 'est']) out.add(lower + suf);
  for (const form of IRREGULAR[lower] ?? []) out.add(form);
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

const RE_CACHE = new Map<string, RegExp>();
const RE_CACHE_MAX = 4000;

/** Regex je Zielwendung, einmal gebaut (P7-1: ~1.500 Karten bei jedem Kartenaufbau). */
function targetRe(words: readonly string[]): RegExp {
  const key = words.join(' ');
  const hit = RE_CACHE.get(key);
  if (hit) return hit;
  const parts = words.map((w, i) => {
    const flex = i === 0 || i === words.length - 1;
    return flex ? `(?:${formsOf(w).map(escape).join('|')})` : escape(w);
  });
  // Ohne Lookbehind: Safari vor 16.4 kann `(?<!…)` nicht lesen. Die Wortgrenze davor steht in Gruppe 1.
  const re = new RegExp(`(^|[^A-Za-z'])(${parts.join('\\s+')})(?![A-Za-z'])`, 'i');
  if (RE_CACHE.size >= RE_CACHE_MAX) RE_CACHE.clear();
  RE_CACHE.set(key, re);
  return re;
}

/** Sucht `target` (erstes und letztes Wort dürfen gebeugt sein) in `sentence`. */
export function locate(sentence: string, target: string): { start: number; end: number } | null {
  const words = target.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  // P7-1: Jede regelmäßige Form des ersten Worts beginnt mit seinem Stamm ohne letzten Buchstaben
  // (try → tries, make → making, stop → stopped). Fehlt er im Satz UND keine unregelmäßige Form
  // (catch → caught), gibt es keinen Treffer – ohne Regex-Bau.
  const first = (words[0] ?? '').toLowerCase();
  const stem = first.length > 1 ? first.slice(0, -1) : first;
  const low = sentence.toLowerCase();
  const hasIrregular = (IRREGULAR[first] ?? []).some((f) => low.includes(f));
  if (!low.includes(stem) && !hasIrregular) return null;
  const m = targetRe(words).exec(sentence);
  if (!m) return null;
  const start = m.index + (m[1]?.length ?? 0);
  return { start, end: start + (m[2]?.length ?? 0) };
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
