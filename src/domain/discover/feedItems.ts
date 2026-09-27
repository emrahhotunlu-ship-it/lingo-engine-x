import { feedDomain } from '../input/mix';
import { normalizeFeedQuestion } from '../input/questions';
import type { FeedChunk, FeedItem, Question } from '../input/types';

// Beiträge des Claude-Tagesauftrags (`feed/<datum>`, `feed/<datum>-own-<b36>`) als flache Liste
// (Plan §4.4). Das Format bleibt unangetastet, hier wird nur gelesen: ungültige Beiträge fallen
// weg, Links nur mit http(s), selbst hinzugefügte Beiträge werden erkannt.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

const KINDS = new Set(['article', 'listen', 'watch']);
const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

/** Nur absolute http(s)-Adressen; alles andere (javascript:, data:, relativ) → `null`. */
export function safeUrl(v: unknown): string | null {
  const s = str(v);
  // Schema http(s), ein Hostname mit Punkt, keine Leerzeichen, keine Steuerzeichen.
  // eslint-disable-next-line no-control-regex -- Steuerzeichen werden bewusst ausgeschlossen
  return /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#][^\s\u0000-\u001f"<>]*)?$/i.test(s) ? s : null;
}

export const isOwnFeed = (feedId: string): boolean => feedId.includes('-own-');

function pair(doc: Doc, base: string): { de?: string; en?: string } {
  const out: { de?: string; en?: string } = {};
  if (str(doc[`${base}_de`])) out.de = str(doc[`${base}_de`]);
  if (str(doc[`${base}_en`])) out.en = str(doc[`${base}_en`]);
  return out;
}

function chunks(v: unknown): FeedChunk[] {
  if (!Array.isArray(v)) return [];
  const out: FeedChunk[] = [];
  for (const raw of v) {
    const c = obj(raw);
    const en = str(c.en);
    if (!en) continue;
    const ch: FeedChunk = { en };
    if (str(c.de)) ch.de = str(c.de);
    if (str(c.note_de)) ch.note_de = str(c.note_de);
    if (str(c.note_en)) ch.note_en = str(c.note_en);
    out.push(ch);
  }
  return out;
}

export function feedItem(feedId: string, feedDoc: Doc, raw: unknown, uiLang: 'de' | 'en'): FeedItem | null {
  const it = obj(raw);
  const itemId = str(it.id);
  const kindRaw = str(it.kind) || 'article';
  const title = str(uiLang === 'en' ? it.title_en || it.title : it.title) || str(it.title_en);
  const gist = str(it.gist);
  if (!itemId || !KINDS.has(kindRaw) || !title || !gist) return null;
  const kind = kindRaw as FeedItem['kind'];
  const d = DAY_RE.exec(str(feedDoc.d))?.[0] ?? DAY_RE.exec(feedId)?.[0] ?? '';
  const questions: Question[] =
    kind === 'article' && Array.isArray(it.questions)
      ? it.questions.map((q, i) => normalizeFeedQuestion(q, `${itemId}#${i}`, uiLang)).filter((q): q is Question => q !== null)
      : [];
  const item: FeedItem = {
    feedId,
    itemId,
    own: isOwnFeed(feedId),
    d,
    kind,
    title,
    url: safeUrl(it.url),
    domain: feedDomain(it.cat),
    gist,
    excerpt: kind === 'article' ? str(it.excerpt) || null : null,
    excerptBy: kind === 'article' ? str(it.excerptBy) || null : null,
    topic: pair(it, 'topic'),
    why: pair(it, 'why'),
    task: pair(it, 'task'),
    taskChunks: strList(it.taskChunks),
    chunks: chunks(it.chunks),
    questions,
    guide: { de: strList(it.guide_de), en: strList(it.guide_en) },
  };
  if (str(it.source)) item.source = str(it.source);
  if (str(it.level)) item.level = str(it.level);
  if (typeof it.mins === 'number' && Number.isFinite(it.mins) && it.mins > 0) item.mins = Math.round(it.mins);
  return item;
}

/**
 * Alle gültigen Beiträge, neueste zuerst (nach `d`, dann Dokumentkennung). Derselbe Beitrag in
 * mehreren Dokumenten erscheint nur einmal (der neueste gewinnt).
 */
export function flattenFeed(docs: ReadonlyArray<{ id: string; doc: Doc }>, uiLang: 'de' | 'en'): FeedItem[] {
  const out: FeedItem[] = [];
  const seen = new Set<string>();
  const dateOf = (x: { id: string; doc: Doc }) => DAY_RE.exec(str(x.doc.d))?.[0] ?? DAY_RE.exec(x.id)?.[0] ?? '';
  const sorted = [...docs].sort((a, b) => {
    const da = dateOf(a);
    const db = dateOf(b);
    return da < db ? 1 : da > db ? -1 : a.id < b.id ? 1 : -1;
  });
  for (const { id, doc } of sorted) {
    if (!Array.isArray(doc.items)) continue;
    for (const raw of doc.items) {
      const item = feedItem(id, doc, raw, uiLang);
      if (!item || seen.has(item.itemId)) continue;
      seen.add(item.itemId);
      out.push(item);
    }
  }
  return out;
}
