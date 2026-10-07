import { alignWords } from '../answer/align';
import { typoBudget } from '../answer/check';
import { editDistance } from '../answer/diff';
import { BRITISH } from '../c1x/kinds/common';
import { familyOf, patternById, patternsOf } from '../grammar/patterns';
import { legacyNorm } from '../grammar/key';
import { wordCount } from '../text/textStats';

// Reine Bausteine von „Erklär mir meine Antwort“ (Lernplattform 3.0 P26, KT T1): die Abweichung berechnet die App (`alignWords`, T-R3), Claude
// bekommt sie fertig; Claudes Beispielsatz wird vor der Anzeige formal geprüft (T-R4, fällt still weg statt Neuversuch); die gespeicherte
// Erklärung (`ax`) ist an genau diese Antwort gebunden und wird nach 60 Tagen neu erzeugt.

export type ExplainOp = { op: 'sub' | 'ins' | 'del' | 'typo'; g: string; e: string };
export const OPS_MAX = 6;

/** Abweichungen zwischen Antwort und Lösung (gleiche Stellen weggelassen), höchstens 6; leer, wenn die Antwort fehlt. */
export function explainOps(given: string, answer: string): ExplainOp[] {
  if (!given.trim() || !answer.trim()) return [];
  const out: ExplainOp[] = [];
  for (const o of alignWords(given, answer, { typo: isTypo })) {
    if (o.op === 'eq') continue;
    out.push({ op: o.op, g: o.given ?? '', e: o.expected ?? '' });
    if (out.length >= OPS_MAX) break;
  }
  return out;
}

/** Tippfehler wie bei der Prüfung getippter Antworten: kleiner Abstand je nach Wortlänge (`typoBudget`). */
const isTypo = (a: string, b: string): boolean => a.length >= 5 && editDistance(a, b) <= typoBudget(Math.max(a.length, b.length));

export type NeighborRef = { id: string; name: string };
export const NEIGHBORS_MAX = 4;

/** Muster derselben Kontrastfamilie (ohne das eigene), höchstens 4, englisch benannt. `contrast.with` des Musters kommt zuerst. */
export function neighborsOf(topic: string, patternId: string | null): NeighborRef[] {
  const out: NeighborRef[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string): void => {
    if (!seen.has(id) && id !== patternId && out.length < NEIGHBORS_MAX) {
      seen.add(id);
      out.push({ id, name });
    }
  };
  const own = patternId ? patternById(patternId.includes(':') ? patternId : `${topic}:${patternId}`) : null;
  const withId = own?.contrast?.with;
  if (withId) {
    const w = patternById(withId.includes(':') ? withId : `${topic}:${withId}`);
    if (w) add(w.id, w.name.en);
  }
  for (const t of familyOf(topic)) for (const p of patternsOf(t)?.patterns ?? []) add(p.id, p.name.en);
  for (const p of patternsOf(topic)?.patterns ?? []) add(p.id, p.name.en);
  return out;
}

export type ExplainExample = { en: string; de: string | null };

/**
 * Prüft den Beispielsatz von Claude: 6 bis 20 Wörter, amerikanisch, keine geraden Anführungszeichen, nicht der Aufgabensatz. Besteht er nicht,
 * fällt er still weg (`null`); das löst keinen Neuversuch aus. `de` bleibt nur, wenn er kein Englisch ist.
 */
export function acceptExample(x: unknown, task: string): ExplainExample | null {
  const raw = typeof x === 'string' ? { en: x } : x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
  if (!raw || typeof raw.en !== 'string') return null;
  const en = raw.en.trim();
  const n = wordCount(en);
  if (n < 6 || n > 20 || en.includes('"') || BRITISH.test(en)) return null;
  if (legacyNorm(en) === legacyNorm(task)) return null;
  const de = typeof raw.de === 'string' && raw.de.trim() && !raw.de.includes('"') ? raw.de.trim().slice(0, 200) : null;
  return { en: en.slice(0, 200), de };
}

// ------------------------------------------------------------------ gespeicherte Erklärung (`ax`)

export type AxBi = { de: string; en: string };
/** `grammar/<topic>.errors[i].ax` bzw. `vocab/<id>.axs[i]`: ≤ 1 KB. */
export type Ax = {
  /** Die Antwort, zu der die Erklärung gehört. */
  g: string;
  y?: AxBi;
  w: AxBi;
  ex?: ExplainExample;
  sig?: string[];
  cf?: string;
  alt?: 1;
  pv: string;
  t: number;
  bad?: 1;
};

/** Erklärungen werden nach so vielen Tagen neu erzeugt (Muster und Prompt können sich verbessert haben). */
export const AX_MAX_AGE_DAYS = 60;
const DAY_MS = 86_400_000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bi = (v: unknown): AxBi | undefined => (isObj(v) && typeof v.de === 'string' && typeof v.en === 'string' ? { de: v.de, en: v.en } : undefined);

/** Liest eine gespeicherte Erklärung tolerant; `null`, wenn sie fehlt, unbrauchbar ist (kein `why`) oder gemeldet wurde. */
export function readAx(v: unknown): Ax | null {
  if (!isObj(v) || typeof v.g !== 'string' || typeof v.t !== 'number' || v.bad === 1) return null;
  const w = bi(v.w);
  if (!w) return null;
  const y = bi(v.y);
  const ex = isObj(v.ex) && typeof v.ex.en === 'string' ? { en: v.ex.en, de: typeof v.ex.de === 'string' ? v.ex.de : null } : undefined;
  const sig = Array.isArray(v.sig) ? v.sig.filter((s): s is string => typeof s === 'string').slice(0, 3) : undefined;
  return {
    g: v.g,
    ...(y ? { y } : {}),
    w,
    ...(ex ? { ex } : {}),
    ...(sig?.length ? { sig } : {}),
    ...(typeof v.cf === 'string' && v.cf ? { cf: v.cf } : {}),
    ...(v.alt === 1 ? { alt: 1 as const } : {}),
    pv: typeof v.pv === 'string' ? v.pv : '',
    t: v.t,
  };
}

/** Gilt die gespeicherte Erklärung für diese Antwort und ist noch frisch (höchstens 60 Tage)? */
export function axFits(ax: Ax | null, given: string, now: number): ax is Ax {
  return !!ax && legacyNorm(ax.g) === legacyNorm(given) && now - ax.t >= 0 && now - ax.t < AX_MAX_AGE_DAYS * DAY_MS;
}

/** Aus der Antwort von Claude den gespeicherten Eintrag bauen (≤ 1 KB). */
export function toAx(given: string, out: { yours: AxBi | null; why: AxBi; signal: string[]; confused: string | null; alsoRight: boolean; example: ExplainExample | null }, pv: string, now: number): Ax {
  return {
    g: given.slice(0, 160),
    ...(out.yours ? { y: out.yours } : {}),
    w: out.why,
    ...(out.example ? { ex: out.example } : {}),
    ...(out.signal.length ? { sig: out.signal } : {}),
    ...(out.confused ? { cf: out.confused } : {}),
    ...(out.alsoRight ? { alt: 1 as const } : {}),
    pv,
    t: now,
  };
}

/** Höchstgröße eines gespeicherten Eintrags (UTF-8-Bytes). */
export const AX_MAX_BYTES = 1024;
const enc = new TextEncoder();
const bytes = (v: unknown): number => enc.encode(JSON.stringify(v)).length;

/** Hält den Eintrag unter 1 KB: erst die deutsche Übersetzung des Beispiels, dann das Beispiel, dann die Signalwörter weglassen. */
export function fitAx(ax: Ax): Ax {
  let cur = ax;
  const steps: Array<(a: Ax) => Ax> = [
    (a) => (a.ex?.de ? { ...a, ex: { en: a.ex.en, de: null } } : a),
    (a) => {
      const { ex: _ex, ...rest } = a;
      void _ex;
      return rest;
    },
    (a) => {
      const { sig: _sig, ...rest } = a;
      void _sig;
      return rest;
    },
  ];
  for (const f of steps) {
    if (bytes(cur) <= AX_MAX_BYTES) break;
    cur = f(cur);
  }
  return cur;
}

/** Fehlerliste mit gesetzter Erklärung an dem Eintrag zur Frage `q` (und `cf` am Eintrag); alles andere bleibt unberührt. `null`, wenn es keinen Eintrag gibt. */
export function withAx<T extends Record<string, unknown>>(errors: readonly T[], q: string, ax: Ax): T[] | null {
  const k = legacyNorm(q);
  const i = errors.findIndex((e) => legacyNorm(e.q) === k);
  if (i < 0) return null;
  const cur = errors[i] as T;
  const next = { ...cur, ax, ...(ax.cf ? { cf: ax.cf } : {}) };
  return errors.map((e, j) => (j === i ? next : e));
}

/** „Melden“ löscht die Erklärung am Eintrag (`ax` weg, `cf` weg) – die Aufgabe selbst bleibt. */
export function withoutAx<T extends Record<string, unknown>>(errors: readonly T[], q: string): T[] | null {
  const k = legacyNorm(q);
  const i = errors.findIndex((e) => legacyNorm(e.q) === k && 'ax' in e);
  if (i < 0) return null;
  return errors.map((e, j) => {
    if (j !== i) return e;
    const { ax: _ax, cf: _cf, ...rest } = e;
    void _ax;
    void _cf;
    return rest as T;
  });
}

/** Wörter: höchstens 3 gespeicherte Erklärungen, die älteste fällt heraus; eine zur selben Antwort ersetzt sich. */
export function withAxs(list: unknown, ax: Ax): unknown[] {
  const cur = (Array.isArray(list) ? list : []).filter(isObj);
  const rest = cur.filter((e) => typeof e.g !== 'string' || legacyNorm(e.g) !== legacyNorm(ax.g));
  return [...rest, ax].slice(-3);
}
