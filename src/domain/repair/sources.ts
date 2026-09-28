import { repairNorm, type NewRepair, type RepairSrc } from './repair';

// Reparatur-Sätze aus Korrekturen gewinnen (Lernberatung 27.09., V2): aus der Rollenspiel-
// Analyse je Zug, aus der Schreibkorrektur und aus dem Preply-Import. Rein und getestet.
// Nur echte Fehler (falsch ≠ richtig); reine Stil- und Tonvorschläge bleiben draußen. Aus
// einem langen Text wird nur der Satz genommen, in dem der Fehler steht, damit Emrah einen
// kurzen Satz neu formuliert und nicht einen ganzen Absatz.

/** Kategorien, die Stil oder Ton betreffen, nicht Richtigkeit. */
export const STYLE_CATS: ReadonlySet<string> = new Set(['register', 'coherence', 'punctuation', 'style', 'tone']);

export type Fix = { wrong: string; right: string; why?: string | null; cat?: string | null };

/** Sätze eines Texts mit Lage (Ende an . ! ? oder Zeilenumbruch). */
export function splitSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  const re = /[^.!?\n]+(?:[.!?]+["”’)]*|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    const lead = m[0].length - m[0].trimStart().length;
    const s = m[0].trim();
    if (s) out.push({ text: s, start: m.index + lead, end: m.index + lead + s.length });
  }
  return out;
}

/** Fundstelle ohne Rücksicht auf Groß-/Kleinschreibung und typografische Apostrophe. */
function locate(hay: string, needle: string): number {
  const h = hay.toLowerCase().replace(/[’‘]/g, "'");
  const n = needle.trim().toLowerCase().replace(/[’‘]/g, "'");
  return n ? h.indexOf(n) : -1;
}

const isReal = (f: Fix): boolean => {
  if (f.cat && STYLE_CATS.has(f.cat)) return false;
  const w = f.wrong.trim();
  const r = f.right.trim();
  return !!w && !!r && repairNorm(w) !== repairNorm(r);
};

const joinWhy = (fixes: readonly Fix[]): string | null => {
  const parts = [...new Set(fixes.map((f) => f.why?.trim() ?? '').filter(Boolean))];
  return parts.length ? parts.join(' ') : null;
};

/**
 * Aus einem eigenen Text und seinen Korrekturen (Teilstücke falsch → richtig) je betroffenem
 * Satz einen Reparatur-Satz: der Originalsatz und derselbe Satz mit allen Korrekturen darin.
 * Korrekturen, die im Text nicht zu finden sind, fallen weg (nie raten).
 */
export function repairsFromText(text: string, fixes: readonly Fix[], src: RepairSrc, ctx?: string | null): NewRepair[] {
  const real = fixes.filter(isReal);
  if (!real.length) return [];
  const out: NewRepair[] = [];
  for (const s of splitSentences(text)) {
    const hits: Array<{ at: number; f: Fix }> = [];
    for (const f of real) {
      const at = locate(s.text, f.wrong);
      if (at < 0) continue;
      const end = at + f.wrong.trim().length;
      if (hits.some((h) => at < h.at + h.f.wrong.trim().length && h.at < end)) continue; // überlappt
      hits.push({ at, f });
    }
    if (!hits.length) continue;
    let right = s.text;
    for (const h of [...hits].sort((a, b) => b.at - a.at)) right = right.slice(0, h.at) + h.f.right.trim() + right.slice(h.at + h.f.wrong.trim().length);
    if (/^[a-z]/.test(right) && /^[A-Z]/.test(s.text)) right = right.charAt(0).toUpperCase() + right.slice(1);
    if (repairNorm(right) === repairNorm(s.text)) continue;
    const used = hits.map((h) => h.f);
    out.push({ wrong: s.text, right, why: joinWhy(used), src, ctx: ctx ?? null, fix: used.map((f) => f.right.trim()) });
  }
  return out;
}

/** Rollenspiel: eigene Züge mit fertiger Analyse (Fehlerliste der drei Schichten). */
export function repairsFromTalk(
  turns: ReadonlyArray<{ role: string; text: string }>,
  analyses: Readonly<Record<number, { state: string; data?: { english: boolean; errors: ReadonlyArray<{ wrong: string; right: string; cat: string; why: string }> } } | undefined>>,
  ctx: string,
): NewRepair[] {
  const out: NewRepair[] = [];
  turns.forEach((t, i) => {
    if (t.role !== 'me') return;
    const a = analyses[i];
    if (a?.state !== 'done' || !a.data?.english) return;
    out.push(...repairsFromText(t.text, a.data.errors, 'talk', ctx));
  });
  return dedupe(out);
}

/** Schreiben: Korrekturliste der Schreibkorrektur (`orig` → `fix`). */
export function repairsFromWriting(text: string, errors: ReadonlyArray<{ orig: string; fix: string; cat: string; why: string }>, ctx: string): NewRepair[] {
  return dedupe(repairsFromText(text, errors.map((e) => ({ wrong: e.orig, right: e.fix, cat: e.cat, why: e.why })), 'write', ctx));
}

/** Preply (bis 28.09.2026): ausgewählte Korrekturen des Lehrers (ganzer Satz falsch → ganzer Satz richtig). */
export function repairsFromPreply(corrections: ReadonlyArray<{ wrong: string; right: string; why: string }>, sel: readonly number[], ctx: string): NewRepair[] {
  return correctionsToRepairs(corrections, sel, 'preply', ctx);
}

/** Lehrer-Feedback (28.09.2026, ersetzt die Preply-Brücke): ausgewählte Korrekturen des Lehrers. */
export function repairsFromTeacher(corrections: ReadonlyArray<{ wrong: string; right: string; why: string }>, sel: readonly number[], ctx: string): NewRepair[] {
  return correctionsToRepairs(corrections, sel, 'teacher', ctx);
}

function correctionsToRepairs(corrections: ReadonlyArray<{ wrong: string; right: string; why: string }>, sel: readonly number[], src: 'preply' | 'teacher', ctx: string): NewRepair[] {
  const out: NewRepair[] = [];
  for (const i of [...new Set(sel)].sort((a, b) => a - b)) {
    const c = corrections[i];
    if (!c || !isReal(c)) continue;
    out.push({ wrong: c.wrong.trim(), right: c.right.trim(), why: c.why.trim() || null, src, ctx });
  }
  return dedupe(out);
}

function dedupe(list: readonly NewRepair[]): NewRepair[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = repairNorm(r.wrong);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
