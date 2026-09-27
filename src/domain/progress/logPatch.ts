import type { DrillAnswer, GrammarAnswer } from '../learn/types';
import type { AnswerEvent } from '../srs/types';
import type { ChannelLogEntry } from './channelLog';

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
  ctx: 'rev' | 'duty' | 'xtra';
  lesson?: string;
  override?: true;
};

/** Grammatik-Eintrag (Form der alten App, `session.js:437`, plus `ms`/`ctx`). */
export type GrammarLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  k: 'g';
  topic: string;
  type: string;
  q: string;
  given: string;
  ans: string;
  src: string;
  m: string;
  g: number;
  ms: number;
  ctx: 'rev' | 'duty' | 'xtra';
  lesson?: string;
  override?: true;
};

/** Übungs-Eintrag (Diktat, Lückenjagd, Satzbau, Lektionsfrage) in der Form der alten App. */
export type DrillLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  type: DrillAnswer['type'];
  q: string;
  given: string;
  ans: string;
  g: number;
  ms: number;
  ctx: 'rev' | 'duty' | 'xtra';
  lesson?: string;
  override?: true;
};

/** Phase 4: Verständnisfragen aus Lesen, Hören, Entdecken (`channelLog.ts`, ohne `id`/`k`). */
export type AnyLogEntry = LogEntry | GrammarLogEntry | DrillLogEntry | ActivityLogEntry | ChannelLogEntry;

export const DONT_KNOW = "(don't know)";

export function grammarLogEntry(a: GrammarAnswer): GrammarLogEntry {
  const lesson = a.task.src === 'lesson' && a.task.ref?.startsWith('lesson/') ? a.task.ref.slice(7) : undefined;
  return {
    t: a.t,
    ok: !a.dontKnow && a.verdict !== 'wrong',
    lang: a.lang,
    k: 'g',
    topic: a.task.topic,
    type: a.task.type,
    q: clip(a.task.prompt),
    given: a.dontKnow ? DONT_KNOW : clip(a.given),
    ans: clip(a.task.answer),
    src: a.task.src,
    m: `gr-${a.task.type}`,
    g: a.grade,
    ms: Math.max(0, Math.round(a.ms)),
    ctx: a.ctx,
    ...(lesson ? { lesson } : {}),
    ...(a.override ? { override: true as const } : {}),
  };
}

export function drillLogEntry(a: DrillAnswer): DrillLogEntry {
  return {
    t: a.t,
    ok: a.verdict !== 'wrong',
    lang: a.lang,
    type: a.type,
    q: clip(a.q),
    given: clip(a.given),
    ans: clip(a.ans),
    g: a.grade,
    ms: Math.max(0, Math.round(a.ms)),
    ctx: a.ctx,
    ...(a.lesson ? { lesson: a.lesson } : {}),
    ...(a.override ? { override: true as const } : {}),
  };
}

/**
 * Phase 3 (Plan §3.6): Eintrag für ein beendetes Gespräch bzw. eine Business-Einheit.
 * Nie `k:'v'`, nie `ctx:'rev'|'xtra'` – so verfälscht er weder „Wiederholen" noch die Trefferquote.
 */
export type ActivityLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  type: 'speak' | 'biz';
  /** Szene bzw. Einheit (`sc-vida`, `mail`, `pb-decline` …). */
  id: string;
  m: 'speak' | 'biz-mail' | 'biz-pitch' | 'biz-play';
  q: string;
  /** Eigene Züge (Sprechen) bzw. Fragen (Drill); 1 bei Mail und Pitch. */
  n: number;
  ms: number;
  ctx: 'spk' | 'biz';
};

/** Aktivitätseintrag mit gekürztem Titel und gerundeter Dauer. */
export function activityEntry(e: ActivityLogEntry): ActivityLogEntry {
  return { ...e, q: clip(e.q), n: Math.max(0, Math.round(e.n)), ms: Math.max(0, Math.round(e.ms)) };
}

export function logEntry(a: AnswerEvent): LogEntry {
  return { t: a.t, ok: a.grade > 1, lang: a.lang, k: 'v', id: a.id, m: a.lesson ? 'lesson' : `tr-${a.ex}`, given: clip(a.given), ans: clip(a.ans), g: a.grade, ms: Math.max(0, Math.round(a.ms)), ctx: a.ctx, ...(a.lesson ? { lesson: a.lesson } : {}), ...(a.override ? { override: true as const } : {}) };
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
export function mergeLogEntries(current: readonly unknown[], added: readonly AnyLogEntry[]): unknown[] {
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
