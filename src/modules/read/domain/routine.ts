import { logWarn } from '../shared';
import { TOPIC_KEYS } from '../schemas';
import type { ArticleItem, IndexItem, TopicKey } from '../schemas';
import { acceptArticle } from './accept';
import { indexEntryOf } from './day';
import { isRoutineId, routineArticleId } from './paths';
import { normalizeDashes } from './text';

// Artikel der geplanten Claude-Routine (docs/umbau/lesen-routine.md). Die Routine schreibt `read/r-<JJJJ-MM-TT>` im Format des Lesers;
// die App liest nur. Rein: nichts hier liest oder schreibt die Datenbank.
//
// Regeln (jede mit eigenem Test):
// - Jeder Artikel wird einzeln mit den bestehenden Prüftoren (`acceptArticle`, nachsichtig) geprüft. Ein fehlerhafter Artikel wird
//   ausgeblendet und im Diagnose-Protokoll gemeldet, nie gelöscht und nie als Grund genommen, das ganze Dokument zu verwerfen.
// - Dazu kommen die Pflichtfelder der Routine: eigene Kennung `r-<Tag>-<Nr.>`, Thema aus der festen Liste, Quelle (Name) und https-Link.
// - Den Lesestand schreibt die App selbst in den Monatsindex `read/m-…` (Eintrag mit `src: 'routine'`); die Routine schreibt nie in App-Dokumente.

type Doc = Record<string, unknown>;

/** Wortgrenzen einer Routine-Meldung: Ziel 300-450, hier mit Luft (Artikel der App haben 380-800). */
export const ROUTINE_WORDS = [280, 700] as const;
/** Wie viele Tage zurück die Liste Routine-Dokumente lädt (heute und die zwei Tage davor). */
export const ROUTINE_DAYS_BACK = 2;
/** Höchstens so viele Artikel je Routine-Dokument werden angezeigt (Schutz der Liste; die Routine schreibt 4-5). */
export const ROUTINE_ITEMS_MAX = 8;
export const SOURCE_MAX_CHARS = 60;
export const URL_MAX_CHARS = 500;

const ROUTINE_TOPICS = TOPIC_KEYS.filter((k): k is Exclude<TopicKey, 'custom'> => k !== 'custom');

/** Nur ein https-Link ohne Zugangsdaten und mit Rechnername (`javascript:`, `http:`, `data:` und Ähnliches fallen weg). */
export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > URL_MAX_CHARS || /\s/.test(s)) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
  return u.href;
}

const clean = (v: unknown, max: number): string => Array.from(typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '').slice(0, max).join('').trimEnd();

export type RoutineHidden = { id: string; reason: string };
export type RoutineDoc =
  | { ok: true; day: string; items: ArticleItem[]; hidden: RoutineHidden[] }
  | { ok: false; reason: 'invalid_doc' };

const idOf = (x: unknown): string => (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : '?');

/** Ein Artikel der Routine prüfen. Liefert den fertigen Artikel (Kennung, Quelle, Link, `by: 'routine'`) oder den Grund. */
export function checkRoutineItem(raw: unknown, day: string, position: number): { ok: true; item: ArticleItem } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' };
  const o = raw as Doc;
  // Kennung: die Routine vergibt `r-<Tag>-<Nr.>`; fehlt sie oder passt der Tag nicht, wird sie aus Tag und Reihenfolge gebildet.
  const wanted = routineArticleId(day, position + 1);
  const id = typeof o.id === 'string' && isRoutineId(o.id) && o.id.startsWith(`r-${day}-`) ? o.id : wanted;
  if (!ROUTINE_TOPICS.some((k) => k === o.topic)) return { ok: false, reason: 'topic must be one of the fixed topic keys' };
  const topic = o.topic as TopicKey;
  const source = clean(o.source, SOURCE_MAX_CHARS);
  if (!source) return { ok: false, reason: 'source (name of the publisher) is missing' };
  const url = safeUrl(o.url);
  if (!url) return { ok: false, reason: 'url must be an https link' };
  const res = acceptArticle(o, { lenient: true, topic, words: ROUTINE_WORDS });
  if (!res.ok) return { ok: false, reason: res.issues.map((i) => `${i.gate}: ${i.message}`).slice(0, 3).join('; ') };
  const a = res.article;
  const pub = typeof o.pub === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.pub.trim()) ? o.pub.trim() : null;
  const item: ArticleItem = {
    id,
    topic,
    kind: a.kind,
    level: a.level,
    title: a.title,
    summary: a.summary,
    asOf: a.asOf,
    paras: a.paras,
    keyWords: a.keyWords,
    ...(a.check ? { check: a.check } : {}),
    by: 'routine',
    source: normalizeDashes(source),
    url,
    ...(pub ? { pub } : {}),
    pv: 1,
  };
  return { ok: true, item };
}

/**
 * Routine-Dokument eines Tages lesen. `ok:false` = Aufbau unbrauchbar (nicht lesbar, nie darauf schreiben; die App schreibt hier ohnehin nie).
 * Fehlerhafte Artikel stehen in `hidden` und bleiben unverändert in der Datenbank.
 */
export function parseRoutineDoc(data: Doc | undefined | null, day: string): RoutineDoc {
  if (!data) return { ok: true, day, items: [], hidden: [] };
  if (!Array.isArray(data.items)) return { ok: false, reason: 'invalid_doc' };
  const items: ArticleItem[] = [];
  const hidden: RoutineHidden[] = [];
  const seen = new Set<string>();
  data.items.slice(0, ROUTINE_ITEMS_MAX).forEach((raw: unknown, i: number) => {
    const r = checkRoutineItem(raw, day, i);
    if (!r.ok) {
      hidden.push({ id: idOf(raw), reason: r.reason });
      logWarn('read:routine', { code: 'item_hidden', message: r.reason }, `${day}/${idOf(raw)}`);
      return;
    }
    if (seen.has(r.item.id)) {
      hidden.push({ id: r.item.id, reason: 'duplicate id' });
      return;
    }
    seen.add(r.item.id);
    items.push(r.item);
  });
  return { ok: true, day, items, hidden };
}

/** Eintrag der Liste zu einem Routine-Artikel (noch ohne gespeicherten Lesestand). */
export function routineEntryOf(item: ArticleItem, day: string): IndexItem {
  return { ...indexEntryOf(item, day), src: 'routine', ...(item.source ? { source: item.source } : {}) };
}

export type LoadedRoutineDay = { day: string; items: ArticleItem[] };

/**
 * Liste aus Monatsindex und Routine-Dokumenten zusammenführen.
 * - Routine-Artikel ohne Indexeintrag erscheinen mit leerem Lesestand (der Eintrag entsteht erst, wenn der Leser Fortschritt schreibt).
 * - Mit Indexeintrag gilt dessen Lesestand; Titel, Thema und Quelle kommen aus dem aktuellen Artikel.
 * - Indexeinträge von Routine-Artikeln, die für einen GELADENEN Tag nicht (mehr) gültig sind, werden nicht angezeigt (nichts wird gelöscht).
 * - Innerhalb eines Tages stehen die Routine-Artikel vor den eigenen; die Reihenfolge beider bleibt erhalten.
 */
export function mergeRoutine(index: readonly IndexItem[], loaded: readonly LoadedRoutineDay[]): IndexItem[] {
  const days = new Map(loaded.map((l) => [l.day, l] as const));
  const validIds = new Set(loaded.flatMap((l) => l.items.map((i) => i.id)));
  const byId = new Map(index.map((e) => [e.id, e] as const));
  const rest = index.filter((e) => !(e.src === 'routine' && e.day && days.has(e.day) && !validIds.has(e.id)));
  const routineIdsLoaded = new Set<string>();
  const routine: IndexItem[] = [];
  for (const l of loaded) {
    for (const item of l.items) {
      routineIdsLoaded.add(item.id);
      const fresh = routineEntryOf(item, l.day);
      const old = byId.get(item.id);
      routine.push(old ? { ...old, ...fresh, st: old.st ?? fresh.st } : fresh);
    }
  }
  const others = rest.filter((e) => !routineIdsLoaded.has(e.id));
  const all = [...routine, ...others];
  // Stabil nach Tag (aufsteigend, wie der Index), am selben Tag Routine zuerst.
  return all
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.day ?? '').localeCompare(b.e.day ?? '') || Number(b.e.src === 'routine') - Number(a.e.src === 'routine') || a.i - b.i)
    .map(({ e }) => e);
}

/** Wie viele Einträge eines Tages sind eigene (selbst geholte) Artikel? Routine-Artikel zählen nicht zum Tagesdokument `read/d-…`. */
export const isOwn = (e: IndexItem): boolean => e.src !== 'routine';
