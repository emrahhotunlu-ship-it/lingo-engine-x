import { validateDoc } from '../../data/validate';
import { learningDayEnd } from '../date';
import { expectedNewPerDay } from '../unit/backlog';
import { applyUpdate } from './applyReview';
import { histOf, type FlipDir } from './flip';
import { stageOf } from './ladder';
import { isLearningState } from './scheduler';
import type { TrainCard } from './types';
import { isHardCard, isJobCard, isPhraseCard } from './vocabList';

// Stapel = gespeicherte Filter (architektur.md §4.4, plan.md N22, data-guard 00:35).
// Eingebaute Stapel werden nie gespeichert; eigene Stapel liegen in EINEM Dokument `app/decks`.
// Karten bekommen kein neues Feld: Zugehörigkeit ergibt allein `matchDeck` (rein, getestet).
// Schreiben nur per `writer.transform` mit diesen Ops: Grenzen und Bytegröße werden VOR dem
// Schreiben geprüft; verletzt → kein Schreiben, sondern ein Fehlercode für den Hinweis.

type Doc = Record<string, unknown>;

export const DECKS_PATH = 'app/decks';
export const DECK_LIMITS = { decks: 40, idsPerDeck: 500, idsTotal: 2000, flagged: 200, bytes: 64 * 1024, name: 40 } as const;
/** Hartnäckig (N28): ab 6 Fehlschlägen. */
export const LEECH_MIN = 6;

/** Gemerkter Modus eines Stapels; `listen` = Hör-Modus (N35). */
export type DeckMode = 'type' | 'flip' | 'listen';
export type ReviewModePref = 'auto' | 'type' | 'flip';
export type DeckFilter = {
  kinds?: ('vocab' | 'chunk')[];
  src?: string[];
  stage?: { min?: number; max?: number };
  due?: boolean;
  hard?: boolean;
  query?: string;
  ids?: string[];
};
export type DeckDef = { id: string; name: string; order: number; created: string; mode?: DeckMode; dir?: FlipDir; size?: number; hidden?: boolean; filter: DeckFilter };
export type BuiltinPrefs = { mode?: DeckMode; dir?: FlipDir; size?: number };
export type DeckPrefs = { dir?: FlipDir; grades?: 4 | 2; mode?: ReviewModePref };
export type DecksDoc = { v: 1; decks: Record<string, DeckDef>; builtin: Record<string, BuiltinPrefs>; prefs: DeckPrefs; flagged: string[] };

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const numOr = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const strs = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
const mode = (v: unknown): DeckMode | undefined => (v === 'type' || v === 'flip' || v === 'listen' ? v : undefined);
const dir = (v: unknown): FlipDir | undefined => (v === 'de-en' || v === 'en-de' || v === 'mix' ? v : undefined);
export const jsonBytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v ?? null)).length;

function readFilter(v: unknown): DeckFilter {
  if (!isObj(v)) return {};
  const f: DeckFilter = {};
  const kinds = strs(v.kinds)?.filter((k): k is 'vocab' | 'chunk' => k === 'vocab' || k === 'chunk');
  if (kinds?.length) f.kinds = kinds;
  const src = strs(v.src);
  if (src?.length) f.src = src;
  if (isObj(v.stage)) {
    const min = numOr(v.stage.min);
    const max = numOr(v.stage.max);
    if (min !== undefined || max !== undefined) f.stage = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  }
  if (v.due === true) f.due = true;
  if (v.hard === true) f.hard = true;
  const q = str(v.query);
  if (q) f.query = q;
  const ids = strs(v.ids);
  if (ids?.length) f.ids = ids;
  return f;
}

/** Tolerantes Lesen (fehlend oder fremd geformt → leer); unbekannte Felder bleiben im Dokument. */
export function readDecks(raw: unknown): DecksDoc {
  const out: DecksDoc = { v: 1, decks: {}, builtin: {}, prefs: {}, flagged: [] };
  if (!isObj(raw)) return out;
  if (isObj(raw.decks)) {
    for (const [id, d] of Object.entries(raw.decks)) {
      if (!isObj(d)) continue;
      const def: DeckDef = { id, name: str(d.name) ?? id, order: numOr(d.order) ?? 0, created: str(d.created) ?? '', filter: readFilter(d.filter) };
      const m = mode(d.mode);
      if (m) def.mode = m;
      const dr = dir(d.dir);
      if (dr) def.dir = dr;
      const size = numOr(d.size);
      if (size !== undefined) def.size = size;
      if (d.hidden === true) def.hidden = true;
      out.decks[id] = def;
    }
  }
  if (isObj(raw.builtin)) {
    for (const [id, b] of Object.entries(raw.builtin)) {
      if (!isObj(b)) continue;
      const p: BuiltinPrefs = {};
      const m = mode(b.mode);
      if (m) p.mode = m;
      const dr = dir(b.dir);
      if (dr) p.dir = dr;
      const size = numOr(b.size);
      if (size !== undefined) p.size = size;
      out.builtin[id] = p;
    }
  }
  if (isObj(raw.prefs)) {
    const dr = dir(raw.prefs.dir);
    if (dr) out.prefs.dir = dr;
    if (raw.prefs.grades === 2 || raw.prefs.grades === 4) out.prefs.grades = raw.prefs.grades;
    const m = raw.prefs.mode;
    if (m === 'auto' || m === 'type' || m === 'flip') out.prefs.mode = m;
  }
  out.flagged = strs(raw.flagged) ?? [];
  return out;
}

/** Sichtbare eigene Stapel in Reihenfolge. */
export const visibleDecks = (d: DecksDoc): DeckDef[] => Object.values(d.decks).filter((x) => !x.hidden).sort((a, b) => a.order - b.order || a.created.localeCompare(b.created));

// ------------------------------------------------------------------ Zugehörigkeit

const low = (s: string | null | undefined) => (s ?? '').toLowerCase();
const DAY_MS = 86_400_000;

/** Fehlschläge einer Karte: Lapses bzw. falsche Antworten (neue `xs` oder alte `modes`). */
export function failures(c: Pick<TrainCard, 'doc' | 'xs' | 'modes'>): number {
  const lapses = numOr(c.doc.lapses) ?? 0;
  const sum = (r: Record<string, { w: number }>) => Object.values(r).reduce((a, x) => a + (x.w || 0), 0);
  return Math.max(lapses, sum(c.xs), sum(c.modes));
}
export const isLeechCard = (c: TrainCard): boolean => !c.isNew && failures(c) >= LEECH_MIN;

export const isDueCard = (c: TrainCard, nowMs: number): boolean => !c.isNew && c.fsrs.due < learningDayEnd(nowMs);

/** Eigener Filter (rein). `ids` wirkt als feste Liste, die übrigen Bedingungen zusätzlich. */
export function matchDeck(c: TrainCard, f: DeckFilter, nowMs: number): boolean {
  if (c.hidden) return false;
  if (f.ids && !f.ids.includes(c.key) && !f.ids.includes(c.id)) return false;
  if (f.kinds?.length && !f.kinds.includes(c.kind)) return false;
  // Quelle „Lehrer“ (`preply`) umfasst auch das neue Lehrer-Feedback (`teacher`).
  if (f.src?.length && !f.src.includes(c.src ?? '') && !(c.src === 'teacher' && f.src.includes('preply'))) return false;
  if (f.stage) {
    const s = stageOf(c.doc);
    if (f.stage.min !== undefined && s < f.stage.min) return false;
    if (f.stage.max !== undefined && s > f.stage.max) return false;
  }
  if (f.due && !(c.isNew || isDueCard(c, nowMs))) return false;
  if (f.hard && !isHardCard(c)) return false;
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q && !low(c.word).includes(q) && !low(c.lemma).includes(q) && !low(c.de).includes(q) && !low(c.def).includes(q)) return false;
  }
  return true;
}

/** Eingebaute Stapel (plan.md §1.3): nicht gespeichert, reine Regeln. */
export const BUILTIN_DECKS = ['inbox', 'hard', 'leech', 'job', 'phrases', 'mistakes', 'src:translate', 'src:lookup', 'src:preply', 'src:lesson', 'src:ai', 'src:pack'] as const;
export type BuiltinDeck = (typeof BUILTIN_DECKS)[number];
export const isBuiltinDeck = (id: string): id is BuiltinDeck => (BUILTIN_DECKS as readonly string[]).includes(id);

const SRC_DECK: Record<string, readonly string[]> = {
  'src:translate': ['translate'],
  'src:lookup': ['lookup', 'read', 'listen'],
  // „Vom Lehrer“: Lehrer-Feedback (`teacher`, ab 28.09.2026) und frühere Preply-Importe (`preply`).
  'src:preply': ['teacher', 'preply'],
  'src:lesson': ['lesson'],
  'src:ai': ['ai', 'claude'],
  'src:pack': ['pack'],
};

export type DeckCtx = { nowMs: number; weekStartMs: number };

export function inBuiltin(c: TrainCard, id: BuiltinDeck, ctx: DeckCtx): boolean {
  if (c.hidden) return false;
  switch (id) {
    case 'inbox':
      return c.isNew;
    case 'hard':
      return isHardCard(c);
    case 'leech':
      return isLeechCard(c);
    case 'job':
      return isJobCard(c);
    case 'phrases':
      return isPhraseCard(c);
    case 'mistakes':
      return histOf(c.doc).some((h) => h.t >= ctx.weekStartMs && h.g === 1);
    default:
      return (SRC_DECK[id] ?? []).includes(c.src ?? '');
  }
}

/** Karten eines Stapels (eingebaut oder eigen); `all` = alle sichtbaren. */
export function deckCards(cards: readonly TrainCard[], deckId: string, decks: DecksDoc, ctx: DeckCtx): TrainCard[] {
  if (deckId === 'all') return cards.filter((c) => !c.hidden);
  if (isBuiltinDeck(deckId)) return cards.filter((c) => inBuiltin(c, deckId, ctx));
  const d = decks.decks[deckId];
  if (!d) return [];
  return cards.filter((c) => matchDeck(c, d.filter, ctx.nowMs));
}

export type DeckCounts = { new: number; learning: number; due: number };

/** Zähler wie in Anki: Neu · Lernen (Lernschritte heute) · Fällig (Wiederholungen heute). */
export function deckCounts(cards: readonly TrainCard[], nowMs: number): DeckCounts {
  const end = learningDayEnd(nowMs);
  const out: DeckCounts = { new: 0, learning: 0, due: 0 };
  for (const c of cards) {
    if (c.hidden) continue;
    if (c.isNew) out.new++;
    else if (c.fsrs.due < end) {
      if (isLearningState(c.fsrs)) out.learning++;
      else out.due++;
    }
  }
  return out;
}

/** Geschätzte Minuten: Aufdecken ≈ 8 s je Wiederholung, ≈ 40 s je neue Karte (Einführung + Abfrage). */
export function estimateMinutes(c: DeckCounts, newCap = Infinity): number {
  const sec = (c.learning + c.due) * 8 + Math.min(c.new, newCap) * 40;
  return sec <= 0 ? 0 : Math.max(1, Math.round(sec / 60));
}

/**
 * Eingangskorb: Anzahl und Reichweite in Tagen (Anzahl ÷ neue Wörter, die wirklich kommen, anki-regeln §5).
 * Wirklich = Kontingent, im Alltag höchstens 3, bei Rückstand 2 (`expectedNewPerDay`) – nicht das Kontingent allein.
 */
export function inboxReach(inbox: number, quota: number, braked = false): { n: number; days: number | null; review: boolean } {
  const rate = expectedNewPerDay(quota, braked);
  const days = rate > 0 ? Math.ceil(inbox / rate) : null;
  return { n: inbox, days, review: days !== null && days >= 30 };
}

/** Wurde die Karte in den letzten `days` Tagen falsch beantwortet? (für „Fehler der Woche“ im Extra-Blatt) */
export const wrongSince = (c: TrainCard, fromMs: number): boolean => histOf(c.doc).some((h) => h.t >= fromMs && h.g === 1);
export const DAYS = (n: number) => n * DAY_MS;

// ------------------------------------------------------------------ Schreiben (Ops für writer.transform)

export type DecksError = 'invalid' | 'limit_decks' | 'limit_ids' | 'limit_flagged' | 'too_big' | 'missing' | 'name';
export type DecksOp = { set: Doc } | { update: Doc } | null;
export type DecksResult = { op: DecksOp; error?: DecksError };

function idsTotal(doc: Doc): number {
  const decks = isObj(doc.decks) ? doc.decks : {};
  let n = 0;
  for (const d of Object.values(decks)) if (isObj(d) && isObj(d.filter) && Array.isArray(d.filter.ids)) n += d.filter.ids.length;
  return n;
}

/** Prüft den vollständigen neuen Stand gegen alle Grenzen, dann `set` (neu) bzw. `update` (Patch). */
function finish(cur: Doc | undefined, patch: Doc): DecksResult {
  if (cur && !validateDoc(DECKS_PATH, cur).ok) return { op: null, error: 'invalid' };
  const base: Doc = cur ?? { v: 1 };
  const next = applyUpdate(base, patch);
  if (!validateDoc(DECKS_PATH, next).ok) return { op: null, error: 'invalid' };
  const decks = isObj(next.decks) ? Object.keys(next.decks).length : 0;
  if (decks > DECK_LIMITS.decks) return { op: null, error: 'limit_decks' };
  if (isObj(next.decks))
    for (const d of Object.values(next.decks)) if (isObj(d) && isObj(d.filter) && Array.isArray(d.filter.ids) && d.filter.ids.length > DECK_LIMITS.idsPerDeck) return { op: null, error: 'limit_ids' };
  if (idsTotal(next) > DECK_LIMITS.idsTotal) return { op: null, error: 'limit_ids' };
  if (Array.isArray(next.flagged) && next.flagged.length > DECK_LIMITS.flagged) return { op: null, error: 'limit_flagged' };
  if (jsonBytes(next) > DECK_LIMITS.bytes) return { op: null, error: 'too_big' };
  if (cur && JSON.stringify(applyUpdate(cur, patch)) === JSON.stringify(cur)) return { op: null };
  return { op: cur ? { update: patch } : { set: next } };
}

const cleanName = (n: string) => n.replace(/\s+/g, ' ').trim().slice(0, DECK_LIMITS.name);

function filterDoc(f: DeckFilter): Doc {
  const out: Doc = {};
  if (f.kinds?.length) out.kinds = [...f.kinds];
  if (f.src?.length) out.src = [...f.src];
  if (f.stage) out.stage = { ...f.stage };
  if (f.due) out.due = true;
  if (f.hard) out.hard = true;
  if (f.query?.trim()) out.query = f.query.trim();
  if (f.ids?.length) out.ids = [...new Set(f.ids)];
  return out;
}

/** Neuer eigener Stapel (versteckte zählen in die 40). */
export function createDeckOp(cur: Doc | undefined, d: { id: string; name: string; filter: DeckFilter; mode?: DeckMode; dir?: FlipDir; size?: number }, created: string): DecksResult {
  const name = cleanName(d.name);
  if (!name) return { op: null, error: 'name' };
  const existing = isObj(cur?.decks) ? Object.values(cur.decks) : [];
  const order = existing.reduce<number>((m, x) => Math.max(m, isObj(x) ? (numOr(x.order) ?? 0) : 0), 0) + 1;
  const deck: Doc = { name, order, created, filter: filterDoc(d.filter) };
  if (d.mode) deck.mode = d.mode;
  if (d.dir) deck.dir = d.dir;
  if (d.size) deck.size = d.size;
  return finish(cur, { decks: { [d.id]: deck } });
}

/** Stapel ändern (Name, Modus, Richtung, Größe, ausblenden = Löschen ohne Grabstein). */
export function updateDeckOp(cur: Doc | undefined, id: string, patch: { name?: string; mode?: DeckMode; dir?: FlipDir; size?: number; hidden?: boolean }): DecksResult {
  if (!cur || !isObj(cur.decks) || !isObj(cur.decks[id])) return { op: null, error: 'missing' };
  const p: Doc = {};
  if (patch.name !== undefined) {
    const n = cleanName(patch.name);
    if (!n) return { op: null, error: 'name' };
    p.name = n;
  }
  if (patch.mode) p.mode = patch.mode;
  if (patch.dir) p.dir = patch.dir;
  if (patch.size !== undefined) p.size = patch.size;
  if (patch.hidden !== undefined) p.hidden = patch.hidden;
  return finish(cur, { decks: { [id]: p } });
}

/** Karten zu einem eigenen Stapel hinzufügen (feste Liste `filter.ids`, ≤ 500 je Stapel, ≤ 2.000 gesamt). */
export function addIdsOp(cur: Doc | undefined, id: string, keys: readonly string[]): DecksResult {
  if (!cur || !isObj(cur.decks) || !isObj(cur.decks[id])) return { op: null, error: 'missing' };
  const d = cur.decks[id];
  const prev = isObj(d.filter) && Array.isArray(d.filter.ids) ? (d.filter.ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const ids = [...new Set([...prev, ...keys])];
  if (ids.length === prev.length) return { op: null };
  return finish(cur, { decks: { [id]: { filter: { ids } } } });
}

/** Gemerkter Modus/Richtung/Größe eines eingebauten Stapels. */
export function builtinPrefOp(cur: Doc | undefined, id: string, patch: BuiltinPrefs): DecksResult {
  return finish(cur, { builtin: { [id]: { ...patch } } });
}

/** Einstellungen „Wortschatz“ (N30): Standard-Modus, Richtung, 4 oder 2 Knöpfe. */
export function prefsOp(cur: Doc | undefined, patch: DeckPrefs): DecksResult {
  return finish(cur, { prefs: { ...patch } });
}

/** Markierung „Mit Lehrer besprechen“ (N33, ≤ 200). */
export function flaggedOp(cur: Doc | undefined, key: string, on: boolean): DecksResult {
  const prev = strs(cur?.flagged) ?? [];
  const next = on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key);
  if (next.length === prev.length && next.every((k, i) => k === prev[i])) return { op: null };
  return finish(cur, { flagged: next });
}

/** Neue Stapel-Kennung (nie ein eingebauter Name). */
export const newDeckId = (nowMs: number, salt = 0): string => `u${(nowMs + salt).toString(36)}`;
