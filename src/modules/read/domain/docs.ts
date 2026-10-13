import { logWarn } from '../shared';
import { articleItemSchema, dayDocSchema, indexItemSchema, monthDocSchema, prefsSchema, VIEWS } from '../schemas';
import type { ArticleItem, IndexItem, ReadPrefs, ReadView } from '../schemas';

// Lesen der drei Dokumentarten (docs/umbau/lesen-plan.md §4.1), rein. Gelesen wird tolerant:
// ein kaputter Eintrag wird ausgeblendet und gemeldet, nie gelöscht und nie als Grund genommen, das Dokument zu verwerfen.

type Doc = Record<string, unknown>;

export type DayDoc = { ok: true; day: string | null; items: ArticleItem[]; hidden: string[] } | { ok: false; reason: 'invalid_doc' };
export type MonthDoc = { ok: true; items: IndexItem[]; hidden: string[] } | { ok: false; reason: 'invalid_doc' };

const idOf = (x: unknown): string => (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : '?');

/** Tagesdokument lesen. `ok:false` heißt: Aufbau unbrauchbar – dann nie darauf schreiben (Plan §4.4). */
export function parseDayDoc(data: Doc | undefined | null): DayDoc {
  if (!data) return { ok: true, day: null, items: [], hidden: [] };
  const head = dayDocSchema.safeParse(data);
  if (!head.success) return { ok: false, reason: 'invalid_doc' };
  const items: ArticleItem[] = [];
  const hidden: string[] = [];
  for (const raw of head.data.items ?? []) {
    const r = articleItemSchema.safeParse(raw);
    if (r.success) items.push(r.data as ArticleItem);
    else {
      hidden.push(idOf(raw));
      logWarn('read:doc', { code: 'item_hidden', message: r.error.issues[0]?.message ?? 'invalid article' }, idOf(raw));
    }
  }
  return { ok: true, day: head.data.day ?? null, items, hidden };
}

/** Monatsindex lesen (gleiche Regeln). */
export function parseMonthDoc(data: Doc | undefined | null): MonthDoc {
  if (!data) return { ok: true, items: [], hidden: [] };
  const head = monthDocSchema.safeParse(data);
  if (!head.success) return { ok: false, reason: 'invalid_doc' };
  const items: IndexItem[] = [];
  const hidden: string[] = [];
  for (const raw of head.data.items ?? []) {
    const r = indexItemSchema.safeParse(raw);
    if (r.success) items.push(r.data);
    else hidden.push(idOf(raw));
  }
  return { ok: true, items, hidden };
}

export const PER_DAY_DEFAULT = 3;
export const PER_DAY_MAX = 8;
export const DEFAULT_VIEW: ReadView = 'b';
export const CUSTOM_TOPICS_MAX = 5;

export type Prefs = {
  topics: Record<string, number>;
  custom: string[];
  perDay: number;
  view: ReadView;
  autoSpeak: boolean;
  gen: { d: string; n: number } | null;
  lastTopics: string[];
};

/** Einstellungen mit Voreinstellungen: Standardansicht B, 3 Artikel am Tag, Vorlesen aus (Entscheidung 13.10.2026). */
export function parsePrefs(data: Doc | undefined | null): Prefs {
  const r = data ? prefsSchema.safeParse(data) : null;
  const p: ReadPrefs = r?.success ? (r.data) : {};
  const topics: Record<string, number> = {};
  for (const [k, w] of Object.entries(p.topics ?? {})) if (typeof w === 'number' && Number.isFinite(w)) topics[k] = Math.max(0, Math.min(3, Math.round(w)));
  const view = VIEWS.find((v) => v === p.view) ?? DEFAULT_VIEW;
  const perDay = typeof p.perDay === 'number' && Number.isFinite(p.perDay) ? Math.max(1, Math.min(PER_DAY_MAX, Math.round(p.perDay))) : PER_DAY_DEFAULT;
  const gen = p.gen && typeof p.gen.d === 'string' && typeof p.gen.n === 'number' ? { d: p.gen.d, n: Math.max(0, Math.floor(p.gen.n)) } : null;
  const last = Array.isArray(p.lastTopics) ? p.lastTopics.filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
  const custom = (p.custom ?? []).filter((c) => c.trim().length > 0).slice(0, CUSTOM_TOPICS_MAX);
  return { topics, custom, perDay, view, autoSpeak: p.autoSpeak === true, gen, lastTopics: last };
}
