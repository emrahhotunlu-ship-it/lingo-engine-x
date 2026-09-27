import { topicById } from '../content';
import { normCat, topicCat } from '../grammar/radar';
import { newVocabDoc } from '../srs/newCard';
import type { ImportView } from './docs';

// Übernahme eines Lehrer-Imports (Phase 5 §5.5, E5-13…E5-15). Rein: berechnet aus dem Import,
// der Auswahl und dem bekannten Bestand, WAS geschrieben wird. Jeder Eintrag hat einen festen
// Zeitstempel (`piMs + i`) bzw. eine feste Kennung (`pi<ms>-t<i>`) – so ist jeder Schritt
// wiederholbar, ohne dass etwas doppelt entsteht (db.d.ts: Schreibvorgänge dürfen doppelt ankommen).

type Doc = Record<string, unknown>;

export type ApplySel = { c: number[]; t: number[]; w: number[] };
export type GrammarErr = { q: string; given: string; ans: string; t: number; src: 'preply'; box: 0; due: number; done: false; last: 0 };
export type RadarEvent = { c: string; s: 'g'; t: number; q: string; g: string; a: string };
export type PoolItem = Doc & { id: string; src: 'preply' };
export type SkipReason = 'no_sentence' | 'exists' | 'bad_topic' | 'invalid';
export type ApplyPlan = {
  vocab: Array<{ path: string; made: { id: string; doc: Doc } }>;
  grammar: Array<{ path: string; topic: string; add: GrammarErr[] }>;
  radar: RadarEvent[];
  pool: PoolItem[];
  skipped: Array<{ group: 'c' | 't' | 'w'; i: number; reason: SkipReason }>;
};

export const GRAMMAR_ERRORS_MAX = 10;
export const RADAR_MAX = 400;
export const POOL_MAX = 90;
const DAY_MS = 86_400_000;

const norm = (s: unknown): string => (typeof s === 'string' ? s.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim() : '');
const clip = (s: string, max: number): string => (Array.from(s).length <= max ? s : Array.from(s).slice(0, max - 1).join('') + '…');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

/** Karte aus einem Import-Wort oder der Grund, warum es nicht geht. */
export function wordCard(pi: Pick<ImportView, 'id' | 'title'>, w: { en: string; de: string; pos: string; ex: string }, today: string, now: number): { id: string; doc: Doc } | null {
  return newVocabDoc({
    word: w.en,
    de: w.de,
    pos: w.pos || null,
    ex: w.ex,
    src: 'preply',
    origin: { v: 1, kind: 'preply', ref: `preply/${pi.id}`, ...(pi.title ? { title: pi.title } : {}), t: now },
    today,
  });
}

/** Zustand eines Worts in der Vorschau: wählbar, schon als Karte da, oder ohne Satz nicht übernehmbar. */
export function wordState(pi: Pick<ImportView, 'id' | 'title'>, w: { en: string; de: string; pos: string; ex: string }, vocabIds: ReadonlySet<string>): 'ok' | 'exists' | 'invalid' {
  const made = wordCard(pi, w, '2000-01-01', 0);
  if (!made) return 'invalid';
  return vocabIds.has(made.id) ? 'exists' : 'ok';
}

export function planApply(pi: ImportView, sel: ApplySel, ctx: { now: number; today: string; vocabIds: ReadonlySet<string>; topicIds: ReadonlySet<string> }): ApplyPlan {
  const base = pi.t || ctx.now;
  const plan: ApplyPlan = { vocab: [], grammar: [], radar: [], pool: [], skipped: [] };

  const byTopic = new Map<string, GrammarErr[]>();
  for (const i of [...new Set(sel.c)].sort((a, b) => a - b)) {
    const c = pi.corrections[i];
    if (!c) {
      plan.skipped.push({ group: 'c', i, reason: 'invalid' });
      continue;
    }
    const t = base + i;
    // Kategorie der alten App (wie Phase 2): Grammatikthema → topicCat, sonst normCat (→ wordchoice).
    plan.radar.push({ c: ctx.topicIds.has(c.topic) ? topicCat(c.topic) : normCat(c.topic), s: 'g', t, q: clip(c.right, 160), g: clip(c.wrong, 100), a: clip(c.right, 100) });
    if (!ctx.topicIds.has(c.topic)) continue; // vocab/other: nur ins Radar (E5-15)
    const list = byTopic.get(c.topic) ?? [];
    list.push({ q: c.wrong, given: c.wrong, ans: c.right, t, src: 'preply', box: 0, due: ctx.now + DAY_MS, done: false, last: 0 });
    byTopic.set(c.topic, list);
  }
  for (const [topic, add] of byTopic) plan.grammar.push({ path: `grammar/${topic}`, topic, add });

  for (const i of [...new Set(sel.t)].sort((a, b) => a - b)) {
    const it = pi.items[i];
    if (!it) {
      plan.skipped.push({ group: 't', i, reason: 'invalid' });
      continue;
    }
    plan.pool.push({
      type: it.type,
      topic: it.topic,
      prompt: it.prompt,
      answer: it.answer,
      accepted: it.accepted,
      options: it.type === 'mc' ? it.options : null,
      hint_de: it.hint_de,
      explanation_de: it.explanation_de,
      explanation_en: it.explanation_en,
      id: `${pi.id}-t${i}`,
      src: 'preply',
    });
  }

  const seen = new Set<string>();
  for (const i of [...new Set(sel.w)].sort((a, b) => a - b)) {
    const w = pi.words[i];
    const made = w ? wordCard(pi, w, ctx.today, ctx.now) : null;
    if (!w || !made) {
      plan.skipped.push({ group: 'w', i, reason: w ? 'no_sentence' : 'invalid' });
      continue;
    }
    if (ctx.vocabIds.has(made.id) || seen.has(made.id)) {
      plan.skipped.push({ group: 'w', i, reason: 'exists' });
      continue;
    }
    seen.add(made.id);
    plan.vocab.push({ path: `vocab/${made.id}`, made });
  }
  return plan;
}

/** Leeres Grammatik-Dokument eines Themas (Voreinstellung p0), falls es noch keins gibt. */
export function defaultGrammarDoc(topic: string, today: string): Doc {
  const p0 = topicById(topic)?.p0 ?? 0.5;
  return { id: topic, p: p0, anchor: p0, anchorD: today, n: 0, c: 0, due: 0, last: 0, recent: [], seen: [], seenText: [], hist: [], errors: [] };
}

const errKey = (e: unknown) => `${norm(obj(e).given)}|${norm(obj(e).ans)}`;

/**
 * Fehler an ein Grammatikthema anhängen (Deckel 10). Doppelte (gleiche Antwort und Lösung
 * oder gleiches `t`) fallen weg. Wird der Deckel überschritten, gehen zuerst erledigte, dann die
 * ältesten Fehler. `replaced` zählt offene Fehler, die dafür weichen mussten (R10).
 */
export function grammarErrorsOp(cur: Doc | undefined, add: readonly GrammarErr[], def: Doc): { op: { set: Doc } | { update: Doc } | null; added: number; replaced: number } {
  const existing = cur ? arr(cur.errors).map(obj) : [];
  if (cur && cur.errors != null && !Array.isArray(cur.errors)) return { op: null, added: 0, replaced: 0 };
  const keys = new Set(existing.map(errKey));
  const ts = new Set(existing.map((e) => e.t).filter((t) => typeof t === 'number'));
  const fresh = add.filter((e) => !keys.has(errKey(e)) && !ts.has(e.t));
  if (!fresh.length) return { op: null, added: 0, replaced: 0 };
  let list: Doc[] = [...existing, ...fresh];
  let replaced = 0;
  while (list.length > GRAMMAR_ERRORS_MAX) {
    const doneIdx = list
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.done === true)
      .sort((a, b) => (Number(a.e.t) || 0) - (Number(b.e.t) || 0))[0]?.i;
    const freshSet = new Set(fresh);
    const oldestOpen = list
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => !freshSet.has(e as GrammarErr))
      .sort((a, b) => (Number(a.e.t) || 0) - (Number(b.e.t) || 0))[0]?.i;
    const idx = doneIdx ?? oldestOpen ?? 0;
    if (doneIdx === undefined) replaced += 1;
    list = list.filter((_, i) => i !== idx);
  }
  if (!cur) return { op: { set: { ...def, errors: list } }, added: fresh.length, replaced };
  return { op: { update: { errors: list } }, added: fresh.length, replaced };
}

/** Radar-Ereignisse vorn einfügen (neueste zuerst, ≤ 400), doppelte (t|q) fallen weg. */
export function radarOp(cur: Doc | undefined, add: readonly RadarEvent[]): { set: Doc } | { update: Doc } | null {
  if (cur && cur.events != null && !Array.isArray(cur.events)) return null;
  const existing = cur ? arr(cur.events).map(obj) : [];
  const keys = new Set(existing.map((e) => `${String(e.t)}|${String(e.q)}`));
  const fresh = add.filter((e) => !keys.has(`${e.t}|${e.q}`));
  if (!fresh.length) return null;
  const events = [...[...fresh].sort((a, b) => b.t - a.t), ...existing].slice(0, RADAR_MAX);
  return cur ? { update: { events } } : { set: { events } };
}

/** Aufgaben in den Übungsspeicher (≤ 90). Kein Verdrängen (E5-14): was keinen Platz hat, zählt als `refused`. */
export function poolOp(cur: Doc | undefined, add: readonly PoolItem[], now: number): { op: { set: Doc } | { update: Doc } | null; added: number; refused: number } {
  if (cur && cur.items != null && !Array.isArray(cur.items)) return { op: null, added: 0, refused: add.length };
  const existing = cur ? arr(cur.items) : [];
  const ids = new Set(existing.map((e) => obj(e).id).filter((v) => typeof v === 'string'));
  const fresh = add.filter((e) => !ids.has(e.id));
  const room = Math.max(0, POOL_MAX - existing.length);
  const take = fresh.slice(0, room);
  const refused = fresh.length - take.length;
  if (!take.length) return { op: null, added: 0, refused };
  const items = [...existing, ...take];
  return { op: cur ? { update: { items } } : { set: { items, t: now } }, added: take.length, refused };
}
