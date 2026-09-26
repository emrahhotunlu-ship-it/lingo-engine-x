import { dayKey } from '../../domain/date';
import { articleFromDoc, LEGACY_ARTICLES, LEGACY_LISTENING, listeningFromDoc } from '../../domain/input/items';
import { pickItem } from '../../domain/input/select';
import type { ArticleItem, Cefr, Domain, ListeningItem } from '../../domain/input/types';

// Abgeleitete Sichten auf Bibliothek und Profil (keine Schreibvorgänge): Inhalte, bereits
// Genutztes und die Wahl des Tages je Einheit.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function dbArticles(articles: ReadonlyMap<string, Doc>): ArticleItem[] {
  const out: ArticleItem[] = [];
  for (const [id, doc] of articles) {
    const a = articleFromDoc(id, doc, 'db');
    if (a) out.push(a);
  }
  return out;
}

export function dbListening(lpool: ReadonlyMap<string, Doc>): ListeningItem[] {
  const out: ListeningItem[] = [];
  for (const [id, doc] of lpool) {
    const l = listeningFromDoc(id, doc, 'db');
    if (l) out.push(l);
  }
  return out;
}

export type ReadingRow = { id: string; doc: Doc };

/** Lese-Ergebnisse, neueste zuerst. */
export function readingRows(reading: ReadonlyMap<string, Doc>): ReadingRow[] {
  return [...reading.entries()].map(([id, doc]) => ({ id, doc })).sort((a, b) => num(b.doc.t) - num(a.doc.t) || (a.id < b.id ? 1 : -1));
}

/** Artikel-Kennungen, die vor `day` gelesen wurden (Tageswahl bleibt nach dem Abschluss stabil). */
export function readDoneBefore(reading: ReadonlyMap<string, Doc>, day: string): Set<string> {
  const out = new Set<string>();
  for (const doc of reading.values()) {
    const d = str(doc.date) || (num(doc.t) ? dayKey(num(doc.t)) : '');
    if (d && d < day && str(doc.articleId)) out.add(str(doc.articleId));
  }
  return out;
}

export function readAll(reading: ReadonlyMap<string, Doc>): Set<string> {
  const out = new Set<string>();
  for (const doc of reading.values()) if (str(doc.articleId)) out.add(str(doc.articleId));
  return out;
}

/** Heute abgeschlossene Lese-Einheiten, neueste zuerst. */
export function readingsOn(reading: ReadonlyMap<string, Doc>, day: string): ReadingRow[] {
  return readingRows(reading).filter((r) => str(r.doc.date) === day);
}

export type ListenRow = { id: string; level: string; n: number; ok: number; plays: number; rate: number; help: boolean; t: number };

export function listenRows(profile: Doc | null | undefined): ListenRow[] {
  const list = Array.isArray(profile?.listen) ? (profile.listen as unknown[]) : [];
  const out: ListenRow[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Doc;
    if (!str(r.id)) continue;
    out.push({ id: str(r.id), level: str(r.level), n: num(r.n), ok: num(r.ok), plays: num(r.plays), rate: num(r.rate) || 1, help: r.help === true, t: num(r.t) });
  }
  return out.sort((a, b) => b.t - a.t);
}

export function listenDoneBefore(rows: readonly ListenRow[], day: string): Set<string> {
  return new Set(rows.filter((r) => r.t > 0 && dayKey(r.t) < day).map((r) => r.id));
}

export function listensOn(rows: readonly ListenRow[], day: string): ListenRow[] {
  return rows.filter((r) => r.t > 0 && dayKey(r.t) === day);
}

export type PickContext = { day: string; target: Cefr; domain: Domain };

export function pickArticle(ctx: PickContext, db: readonly ArticleItem[], done: ReadonlySet<string>, salt = ''): ArticleItem | null {
  return pickItem({ day: ctx.day, kind: 'read', db, legacy: LEGACY_ARTICLES, done, target: ctx.target, domain: ctx.domain, salt });
}

export function pickListening(ctx: PickContext, db: readonly ListeningItem[], done: ReadonlySet<string>, salt = ''): ListeningItem | null {
  return pickItem({ day: ctx.day, kind: 'listen', db, legacy: LEGACY_LISTENING, done, target: ctx.target, domain: ctx.domain, salt });
}

/** Artikel nach Kennung (Datenbank vor Startbestand). */
export function findArticle(id: string, db: readonly ArticleItem[]): ArticleItem | null {
  return db.find((a) => a.id === id) ?? LEGACY_ARTICLES.find((a) => a.id === id) ?? null;
}

export function findListening(id: string, db: readonly ListeningItem[]): ListeningItem | null {
  return db.find((a) => a.id === id) ?? LEGACY_LISTENING.find((a) => a.id === id) ?? null;
}
