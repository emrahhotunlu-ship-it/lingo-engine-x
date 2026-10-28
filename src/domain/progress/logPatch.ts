import { answerRight } from '../learn/right';
import type { DrillAnswer, GrammarAnswer } from '../learn/types';
import { ATTEMPT_MS_MAX, attemptMs, attemptPl, attemptSt } from '../../data/schemas';
import type { AnswerEvent, AttemptInput, AttemptMeta } from '../srs/types';
import type { ChannelLogEntry } from './channelLog';

// Tagesprotokoll `log/<tag>` im Format der alten App (Daten-Entwurf §4): ein Dokument je
// Lerntag, höchstens 300 Einträge (die neuesten bleiben, die erste „Wiederholen"-Antwort je Karte
// zuerst, W4), doppelte Einträge fallen heraus.

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
  dev?: 't' | 'k';
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt (10-ms-Raster, ≤ 600.000) und Eingabeart. Nur gespeichert. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4): gemischt, Senden ohne Claude-Wartezeit (nur wenn ≠ `ms`), Prompt-Zeichen, zweiter Versuch, verborgen, Stufe vorher. */
  mx?: 1;
  sm?: number;
  pl?: number;
  n?: 2;
  bg?: 1;
  st?: number;
};

/**
 * Wendungs-Eintrag (phase1-plan §3.5, Form der alten App: `type:'chunk'`, kein `k`). `q` ist die
 * Wendung. Zählt wie eine Vokabel zu „Wiederholen“ (Schlüssel `chunk/<id>`, `entryCardKey`).
 */
export type ChunkLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  type: 'chunk';
  id: string;
  m: string;
  q: string;
  given: string;
  ans: string;
  g: number;
  ms: number;
  ctx: 'rev' | 'duty' | 'xtra';
  override?: true;
  dev?: 't' | 'k';
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt (10-ms-Raster, ≤ 600.000) und Eingabeart. Nur gespeichert. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4): gemischt, Senden ohne Claude-Wartezeit (nur wenn ≠ `ms`), Prompt-Zeichen, zweiter Versuch, verborgen, Stufe vorher. */
  mx?: 1;
  sm?: number;
  pl?: number;
  n?: 2;
  bg?: 1;
  st?: number;
};

/**
 * Kartenschlüssel eines Protokolleintrags: `chunk/<id>` (Wendung), `vocab/<id>` (Vokabel),
 * sonst `null` (Grammatik, Übungen, Gespräche). Grundlage für „Wiederholen“ (Kap. 2.2).
 */
export function entryCardKey(e: { id?: unknown; k?: unknown; type?: unknown }): string | null {
  if (typeof e.id !== 'string' || !e.id) return null;
  if (e.type === 'chunk') return `chunk/${e.id}`;
  if (e.k === 'v') return `vocab/${e.id}`;
  // Lernberatung 27.09., V2: Reparatur-Sätze zählen wie eine Karte zu „Wiederholen“.
  if (e.type === 'repair') return `repair/${e.id}`;
  return null;
}

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
  dev?: 't' | 'k';
  /** c1x (Lernplattform 3.0 §10.0 Nr. 4): Punkte, Art, Muster, Aufgaben-ID, Claude-Aufgabe, getippt. */
  pts?: [number, number];
  c1k?: string;
  pat?: string;
  cid?: string;
  ai?: true;
  free?: true;
  /** Millisekunden bis zur Abgabe einer getippten c1x-Antwort (Lernplattform 3.0 P24, Tempo-Messung). */
  tm?: number;
  /** Antwort aus einer Tempo-Runde (P44-Nachbesserung): zählt nie für K6 „Fehler finden“. Nur ergänzend. */
  tp?: true;
  /** Tutor-Engine v3 (Nachprüfung N2, nur ergänzend, nur wenn > 0): Hilfestufe vor dem Prüfen (1 Leitfrage/Formel, 2 erster Buchstabe). */
  hl?: 1 | 2;
  /** Tutor-Engine v3 §3.2 (nur ergänzend, ≤ 60 B): Urteil c/a/n/w/u, Ursache, Gegenmuster. */
  v?: 'c' | 'a' | 'n' | 'w' | 'u';
  h?: string;
  vs?: string;
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt und Eingabeart; `tm` bleibt daneben unverändert. Nur gespeichert. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4): gemischt, Senden ohne Claude-Wartezeit (nur wenn ≠ `ms`), Prompt-Zeichen, zweiter Versuch, verborgen, Stufe vorher. */
  mx?: 1;
  sm?: number;
  pl?: number;
  n?: 2;
  bg?: 1;
  st?: number;
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
  dev?: 't' | 'k';
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt (10-ms-Raster, ≤ 600.000) und Eingabeart. Nur gespeichert. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4): gemischt, Senden ohne Claude-Wartezeit (nur wenn ≠ `ms`), Prompt-Zeichen, zweiter Versuch, verborgen, Stufe vorher. */
  mx?: 1;
  sm?: number;
  pl?: number;
  n?: 2;
  bg?: 1;
  st?: number;
};

/**
 * Reparatur-Satz (Lernberatung 27.09., V2): `id` aus `app/repair`, `q` = alter Satz, `ans` = bessere
 * Fassung. Zählt mit `ctx:'rev'` zu „Wiederholen“ (Schlüssel `repair/<id>`, `entryCardKey`).
 */
export type RepairLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  type: 'repair';
  id: string;
  m: 'repair';
  q: string;
  given: string;
  ans: string;
  g: number;
  ms: number;
  ctx: 'rev' | 'xtra';
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt und Eingabeart. Nur gespeichert. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4): gemischt, Senden ohne Claude-Wartezeit (nur wenn ≠ `ms`), Prompt-Zeichen, zweiter Versuch, verborgen, Stufe vorher. */
  mx?: 1;
  sm?: number;
  pl?: number;
  n?: 2;
  bg?: 1;
  st?: number;
};

export function repairLogEntry(i: Omit<RepairLogEntry, 'type' | 'm'>): RepairLogEntry {
  const { fk, in: kind, mx, sm, pl, n, bg, st, ...rest } = i;
  return { ...rest, type: 'repair', m: 'repair', q: clip(i.q), given: clip(i.given), ans: clip(i.ans), ...timingOf({ fk, in: kind, mx, sm, pl, n, bg, st, ms: i.ms }) };
}

// ------------------------------------------------------------------ S1-ZEIT (Relaunch Stufe 1 P4)

/** Messwerte eines Versuchs, wie sie eine Übung übergibt (alle optional, nie ausgewertet; Bedeutung in `AnswerEvent`). */
export type AttemptTiming = AttemptMeta;

/**
 * Messwerte für einen Protokolleintrag; fehlt ein Wert oder ist er ungültig, bleibt das Feld weg (Altbestand, Antworten ohne Kontakt).
 * `fk` gerundet auf 10 ms (≤ 600.000); `ms` bleibt roh wie bisher (Note und Lernzeit lesen es), `sm` (Senden ohne Claude-Wartezeit) nur, wenn es von `ms` abweicht.
 */
export function timingOf(a: AttemptTiming & { ms?: number }): AttemptTiming {
  const out: AttemptTiming = {};
  if (typeof a.fk === 'number' && Number.isFinite(a.fk) && a.fk >= 0) out.fk = attemptMs(a.fk);
  if (a.in === 't' || a.in === 'd' || a.in === 'c') out.in = a.in;
  if (a.mx === 1) out.mx = 1;
  if (typeof a.sm === 'number' && Number.isFinite(a.sm) && a.sm >= 0) {
    const sm = Math.min(ATTEMPT_MS_MAX, Math.round(a.sm));
    if (typeof a.ms !== 'number' || sm !== Math.round(a.ms)) out.sm = sm;
  }
  const pl = attemptPl(a.pl);
  if (pl !== undefined) out.pl = pl;
  if (a.n === 2) out.n = 2;
  if (a.bg === 1) out.bg = 1;
  const st = attemptSt(a.st);
  if (st !== undefined) out.st = st;
  return out;
}

/** Phase 4: Verständnisfragen aus Lesen, Hören, Entdecken (`channelLog.ts`, ohne `id`/`k`). */
export type AnyLogEntry = LogEntry | ChunkLogEntry | GrammarLogEntry | DrillLogEntry | ActivityLogEntry | ChannelLogEntry | RepairLogEntry;

export const DONT_KNOW = "(don't know)";

/** Hilfestufe nur, wenn Hilfe genutzt wurde (tolerant: ältere Antwort-Objekte ohne `help` schreiben nichts). */
function hlOf(a: GrammarAnswer): { hl?: 1 | 2 } {
  const lv: unknown = (a as { help?: { level?: unknown } }).help?.level;
  return lv === 1 || lv === 2 ? { hl: lv } : {};
}

export function grammarLogEntry(a: GrammarAnswer & AttemptTiming): GrammarLogEntry {
  const lesson = a.task.src === 'lesson' && a.task.ref?.startsWith('lesson/') ? a.task.ref.slice(7) : undefined;
  return {
    t: a.t,
    ok: answerRight(a),
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
    ...(a.dev ? { dev: a.dev } : {}),
    ...(a.pts ? { pts: a.pts } : {}),
    ...(a.c1k ? { c1k: a.c1k } : {}),
    ...(a.task.c1 ? { cid: a.task.c1.id, pat: a.task.c1.pat } : {}),
    ...(a.task.c1?.src === 'ai' ? { ai: true as const } : {}),
    ...(a.pts && a.free ? { free: true as const, tm: Math.max(1, Math.round(a.ms)) } : {}),
    ...(a.tempo ? { tp: true as const } : {}),
    ...hlOf(a),
    ...(a.tj ? { v: a.tj.v, ...(a.tj.h ? { h: a.tj.h.slice(0, 12) } : {}), ...(a.tj.vs ? { vs: a.tj.vs.slice(0, 40) } : {}) } : {}),
    ...timingOf(a),
  };
}

export function drillLogEntry(a: DrillAnswer & AttemptTiming): DrillLogEntry {
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
    ...(a.dev ? { dev: a.dev } : {}),
    ...timingOf(a),
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
  type: 'speak' | 'biz' | 'say' | 'fluency' | 'tones';
  /** Szene bzw. Einheit (`sc-vida`, `mail`, `pb-decline` …). */
  id: string;
  m: 'speak' | 'biz-mail' | 'biz-pitch' | 'biz-play' | 'say' | 'fluency' | 'tones';
  q: string;
  /** Eigene Züge (Sprechen) bzw. Fragen (Drill); 1 bei Mail und Pitch. */
  n: number;
  ms: number;
  ctx: 'spk' | 'biz' | 'say' | 'fluency' | 'tones';
};

/** Aktivitätseintrag mit gekürztem Titel und gerundeter Dauer. */
export function activityEntry(e: ActivityLogEntry): ActivityLogEntry {
  return { ...e, q: clip(e.q), n: Math.max(0, Math.round(e.n)), ms: Math.max(0, Math.round(e.ms)) };
}

export function logEntry(a: AnswerEvent): LogEntry | ChunkLogEntry {
  if (a.kind === 'chunk') {
    return { t: a.t, ok: a.grade > 1, lang: a.lang, type: 'chunk', id: a.id, m: `tr-${a.ex}`, q: clip(a.q ?? a.ans), given: clip(a.given), ans: clip(a.ans), g: a.grade, ms: Math.max(0, Math.round(a.ms)), ctx: a.ctx, ...(a.override ? { override: true as const } : {}), ...(a.dev ? { dev: a.dev } : {}), ...timingOf(a) };
  }
  return { t: a.t, ok: a.grade > 1, lang: a.lang, k: 'v', id: a.id, m: a.lesson ? 'lesson' : `tr-${a.ex}`, given: clip(a.given), ans: clip(a.ans), g: a.grade, ms: Math.max(0, Math.round(a.ms)), ctx: a.ctx, ...(a.lesson ? { lesson: a.lesson } : {}), ...(a.override ? { override: true as const } : {}), ...(a.dev ? { dev: a.dev } : {}), ...timingOf(a) };
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
  // W4: Beim Kürzen fallen zuerst die ältesten übrigen Einträge weg; die erste „Wiederholen"-Antwort
  // je Karte (zählt zur Pflicht, `deriveToday`) bleibt, damit „erledigt" nie wieder „offen" wird.
  const keep = protectedEntries(sorted);
  let out = sorted;
  if (out.length > LOG_ENTRIES_MAX) out = dropOldest(out, out.length - LOG_ENTRIES_MAX, keep);
  while (out.length > 1 && new TextEncoder().encode(JSON.stringify(out)).length > LOG_DOC_MAX_BYTES) out = dropOldest(out, 1, keep);
  return out;
}

/** Die erste `ctx:'rev'`-Antwort je Karte (Vokabel oder Wendung; pflichtrelevant). */
function protectedEntries(list: readonly unknown[]): Set<unknown> {
  const ids = new Set<string>();
  const out = new Set<unknown>();
  for (const e of list) {
    const r = (e && typeof e === 'object' ? e : {}) as Doc;
    const key = entryCardKey(r);
    if (r.ctx !== 'rev' || !key || ids.has(key)) continue;
    ids.add(key);
    out.add(e);
  }
  return out;
}

/** `n` Einträge entfernen: erst die ältesten ungeschützten, dann (nur wenn nötig) die ältesten geschützten. */
function dropOldest(list: readonly unknown[], n: number, keep: ReadonlySet<unknown>): unknown[] {
  const drop = new Set<unknown>();
  for (const e of list) {
    if (drop.size >= n) break;
    if (!keep.has(e)) drop.add(e);
  }
  for (const e of list) {
    if (drop.size >= n) break;
    drop.add(e);
  }
  return list.filter((e) => !drop.has(e));
}

// ------------------------------------------------------------------ Sekunden je Pflichtschritt (`log/<tag>.um`, Lernplattform 2.0 §8)

/** Pflichtschritte, für die `um` Sekunden führt (Wörter 1, Grammatik 2, Satzbau 3, Fehler korrigieren 5). */
export const UM_BLOCKS = [1, 2, 3, 5] as const;
/** Höchste Sekundenzahl, die ein Schritt je Tag tragen kann (Schutz gegen offen gelassene Bildschirme). */
export const UM_MAX_SEC = 3600;

/**
 * `um` des Tagesprotokolls mit einem fertigen Schritt: `{ [block]: { s: Sekunden, dev: 't' | 'k' } }`. Ein Schritt wird nur EINMAL je Tag
 * eingetragen (der erste Abschluss gilt, nichts wird überschrieben); gibt `null` zurück, wenn nichts zu schreiben ist (Wert ungültig oder schon da).
 * Der Aufruf kommt beim Abschluss eines Pflichtschritts (`unitDone`); geschrieben wird mit dem übrigen Protokoll über den einen Schreibpfad.
 */
export function unitSecondsPatch(cur: unknown, a: { block: number; s: number; dev: 't' | 'k' | undefined }): { um: Record<string, { s: number; dev: 't' | 'k' }> } | null {
  if (!(UM_BLOCKS as readonly number[]).includes(a.block) || (a.dev !== 't' && a.dev !== 'k') || !Number.isFinite(a.s) || a.s < 0) return null;
  const old = cur && typeof cur === 'object' && !Array.isArray(cur) ? (cur as Record<string, unknown>) : {};
  if (old[String(a.block)] !== undefined) return null;
  return { um: { [String(a.block)]: { s: Math.min(UM_MAX_SEC, Math.round(a.s)), dev: a.dev } } };
}
