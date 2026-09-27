import { dayKey } from '../date';
import { repairNorm } from '../repair/repair';

// Persönliche „Deutsch-Fallen“ (Lernberatung 27.09., V3): alle eigenen Fehler aus allen Quellen
// in EINER Form – Rollenspiel-Analyse (`talk/*.runs[].report.focus`), Schreibkorrektur
// (`writing/*.res.errors`), Preply-Import (`preply/*.corrections`), Grammatik-Fehler
// (`grammar/*.errors`), Fehler-Radar (`app/radar.events`), „Sag es“ (`say/*.items[].fb1`) und
// Reparatur-Sätze (`app/repair`). Tolerant: eine fremd geformte Quelle ergibt nichts, nie einen
// Fehler. Rein und getestet.

type Doc = Readonly<Record<string, unknown>>;

export type MistakeSrc = 'talk' | 'write' | 'preply' | 'grammar' | 'radar' | 'say' | 'repair';
export type Mistake = { src: MistakeSrc; wrong: string; right: string; t: number };

export type MistakeSources = {
  grammar?: ReadonlyMap<string, Doc> | null;
  talk?: ReadonlyMap<string, Doc> | null;
  writing?: ReadonlyMap<string, Doc> | null;
  preply?: ReadonlyMap<string, Doc> | null;
  say?: ReadonlyMap<string, Doc> | null;
  radar?: Doc | null;
  repair?: Doc | null;
};

/** Längste Fassung eines Fehlers (Zeichen), wie er gespeichert und an Claude gegeben wird. */
export const MISTAKE_TEXT_MAX = 240;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const cut = (s: string): string => (s.length <= MISTAKE_TEXT_MAX ? s : `${s.slice(0, MISTAKE_TEXT_MAX - 1).trimEnd()}…`);
const GAP = /_{2,}|…|\.\.\./;

/** Zeitpunkt aus Kennungen wie `pi1790…`, `w1790…` (Altdokumente ohne `t`). */
const msFromId = (id: string): number => {
  const m = /(\d{12,14})/.exec(id);
  return m ? Number(m[1]) : 0;
};

/** Stelle im Satz ersetzen (ohne Rücksicht auf Groß-/Kleinschreibung); `null`, wenn sie fehlt. */
function replaceIn(sentence: string, part: string, by: string): string | null {
  const at = sentence.toLowerCase().indexOf(part.toLowerCase());
  return part && at >= 0 ? sentence.slice(0, at) + by + sentence.slice(at + part.length) : null;
}

function push(out: Mistake[], src: MistakeSrc, wrong: string, right: string, t: number): void {
  const w = cut(wrong);
  const r = cut(right);
  if (!w || !r || repairNorm(w) === repairNorm(r) || !repairNorm(w)) return;
  out.push({ src, wrong: w, right: r, t: Math.max(0, t) });
}

/** Grammatik: Aufgabe mit Lücke → ganzer Satz mit der gegebenen bzw. richtigen Antwort. */
function grammarMistakes(grammar: ReadonlyMap<string, Doc>, out: Mistake[]): void {
  for (const d of grammar.values()) {
    for (const e of arr(d.errors)) {
      const q = str(e.q);
      const given = str(e.given);
      const ans = str(e.ans);
      if (!given || !ans) continue;
      if (q && GAP.test(q)) push(out, 'grammar', q.replace(GAP, given), q.replace(GAP, ans), num(e.t));
      else push(out, 'grammar', given, ans, num(e.t));
    }
  }
}

function talkMistakes(talk: ReadonlyMap<string, Doc>, out: Mistake[]): void {
  for (const d of talk.values()) {
    for (const r of arr(d.runs)) {
      for (const f of arr(obj(r.report).focus)) push(out, 'talk', str(f.said), str(f.better), num(r.t));
    }
  }
}

function writingMistakes(writing: ReadonlyMap<string, Doc>, out: Mistake[]): void {
  for (const [id, d] of writing) {
    const t = num(d.t) || Date.parse(`${str(d.date)}T12:00:00Z`) || msFromId(id);
    for (const e of arr(obj(d.res).errors)) push(out, 'write', str(e.orig) || str(e.wrong), str(e.fix) || str(e.right), Number.isFinite(t) ? t : 0);
  }
}

function preplyMistakes(preply: ReadonlyMap<string, Doc>, out: Mistake[]): void {
  for (const [id, d] of preply) {
    const t = num(d.t) || msFromId(id);
    for (const c of arr(d.corrections)) push(out, 'preply', str(c.wrong) || str(c.orig), str(c.right) || str(c.fix), t);
  }
}

function sayMistakes(say: ReadonlyMap<string, Doc>, out: Mistake[]): void {
  for (const d of say.values()) {
    for (const it of arr(d.items)) {
      for (const c of arr(obj(it.fb1).corrections)) push(out, 'say', str(c.wrong), str(c.right), num(it.t));
    }
  }
}

/** Radar: `q` ist der Satz mit der Stelle, `g` gegeben, `a` richtig. */
function radarMistakes(radar: Doc, out: Mistake[]): void {
  for (const e of arr(radar.events)) {
    const q = str(e.q);
    const g = str(e.g);
    const a = str(e.a);
    if (!g || !a) continue;
    const right = q ? replaceIn(q, g, a) : null;
    if (q && right) push(out, 'radar', q, right, num(e.t));
    else push(out, 'radar', g, a, num(e.t));
  }
}

function repairMistakes(repair: Doc, out: Mistake[]): void {
  for (const e of arr(repair.items)) push(out, 'repair', str(e.wrong), str(e.right), num(e.t));
}

/**
 * Alle Fehler, neueste zuerst. Derselbe Satz (normalisiert) am selben Lerntag zählt einmal –
 * ein Reparatur-Satz ist oft dieselbe Korrektur wie in „Sag es“ oder im Gespräch.
 */
export function collectMistakes(s: MistakeSources): Mistake[] {
  const out: Mistake[] = [];
  if (s.grammar) grammarMistakes(s.grammar, out);
  if (s.talk) talkMistakes(s.talk, out);
  if (s.writing) writingMistakes(s.writing, out);
  if (s.preply) preplyMistakes(s.preply, out);
  if (s.say) sayMistakes(s.say, out);
  if (s.radar) radarMistakes(s.radar, out);
  if (s.repair) repairMistakes(s.repair, out);
  out.sort((a, b) => b.t - a.t);
  const seen = new Set<string>();
  return out.filter((m) => {
    const k = `${repairNorm(m.wrong)}|${m.t > 0 ? dayKey(m.t) : ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Für die Vorlage: jeder Satz nur einmal (der neueste). */
export function uniqueMistakes(list: readonly Mistake[]): Mistake[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    const k = repairNorm(m.wrong);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
