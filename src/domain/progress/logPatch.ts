import type { AnswerEvent } from '../srs/types';

// Tagesprotokoll `log/<tag>` im Format der alten App (Daten-Entwurf §4): ein Dokument je
// Lerntag, höchstens 300 Einträge (die neuesten bleiben), doppelte Einträge fallen heraus.

type Doc = Record<string, unknown>;

export const LOG_ENTRIES_MAX = 300;
export const LOG_DOC_MAX_BYTES = 240 * 1024;
const TEXT_MAX = 160;
const clip = (s: string) => (s.length > TEXT_MAX ? s.slice(0, TEXT_MAX) : s);

export type LogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  k: 'v';
  id: string;
  m: string;
  given: string;
  ans: string;
  g: number;
  ms: number;
  ctx: 'rev' | 'xtra';
};

export function logEntry(a: AnswerEvent): LogEntry {
  return { t: a.t, ok: a.grade > 1, lang: a.lang, k: 'v', id: a.id, m: `tr-${a.ex}`, given: clip(a.given), ans: clip(a.ans), g: a.grade, ms: Math.max(0, Math.round(a.ms)), ctx: a.ctx };
}

const keyOf = (e: unknown): string => {
  const r = (e && typeof e === 'object' ? e : {}) as Doc;
  return `${String(r.t)}|${String(r.id ?? r.q)}`;
};
const tOf = (e: unknown): number => {
  const t = (e && typeof e === 'object' ? (e as Doc).t : undefined);
  return typeof t === 'number' && Number.isFinite(t) ? t : 0;
};

/** Neue Liste: vorhandene + neue Einträge, ohne Doppelte, nach Zeit, gekappt auf Anzahl und Größe. */
export function mergeLogEntries(current: readonly unknown[], added: readonly LogEntry[]): unknown[] {
  const seen = new Set<string>();
  const all: unknown[] = [];
  for (const e of [...current, ...added]) {
    const k = keyOf(e);
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(e);
  }
  const sorted = all.map((e, i) => ({ e, i })).sort((a, b) => tOf(a.e) - tOf(b.e) || a.i - b.i).map((x) => x.e);
  let out = sorted.slice(-LOG_ENTRIES_MAX);
  while (out.length > 1 && new TextEncoder().encode(JSON.stringify(out)).length > LOG_DOC_MAX_BYTES) out = out.slice(1);
  return out;
}
