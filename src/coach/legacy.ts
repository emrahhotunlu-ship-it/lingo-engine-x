import { bank } from '../bank/words';
import { validateDoc } from '../data/validate';
import { readOnce } from '../data/snapshot';
import { addDays, dayKey, isDayKey } from '../domain/date';
import { readFsrs } from '../domain/srs/scheduler';
import { legacyActive, pflichtDays } from '../domain/streak';
import { logError, logWarn } from '../platform/diagnostics';
import type { Db } from '../platform/types';
import type { CardRec, LegacyImport } from './types';

// Übernahme der Daten der alten App (docs/neustart.md §9): Wörter und Wendungen mit Lernstand,
// Grammatikwerte, aktive Tage (Serie) und die letzte Einschätzung. Die alten Dokumente werden nur
// gelesen. Eine Karte, die es im Trainer schon gibt, wird nie überschrieben (neuere Übung gewinnt).

type Doc = Record<string, unknown>;

export type LegacyData = {
  vocab: ReadonlyMap<string, Doc>;
  chunks: ReadonlyMap<string, Doc>;
  grammar: ReadonlyMap<string, Doc>;
  profile: Doc | null;
  assess: Doc | null;
  /** Abfragen, die genau 1.000 Dokumente lieferten (möglicherweise gekappt). */
  truncated: string[];
};

/** Feld, nach dem eine große Sammlung seitenweise gelesen wird (get() liefert höchstens 1.000 Dokumente). */
const PAGE_FIELD: Readonly<Record<string, string>> = { vocab: 'word', chunk: 'en' };
const MAX_PAGES = 30;

type DocsSnap = Awaited<ReturnType<ReturnType<Db['collection']>['get']>>;

async function readCollection(db: Db, name: string, truncated: string[]): Promise<Map<string, Doc>> {
  const out = new Map<string, Doc>();
  const add = (q: DocsSnap): number => {
    let fresh = 0;
    for (const d of q.docs) {
      const data = d.exists ? d.data() : undefined;
      if (!data || out.has(d.id)) continue;
      const v = validateDoc(`${name}/${d.id}`, data);
      if (v.ok) {
        out.set(d.id, v.value);
        fresh++;
      }
    }
    return fresh;
  };
  const q = await readOnce(name, () => db.collection(name).get());
  add(q);
  if (q.size < 1000) return out;
  // Genau 1.000 Treffer sehen nach einer Kappung aus: seitenweise nach einem Feld nachlesen.
  const field = PAGE_FIELD[name];
  if (!field) {
    truncated.push(name);
    return out;
  }
  let last: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = last;
    const base = db.collection(name);
    const query = (from === null ? base : base.where(field, '>=', from)).orderBy(field).limit(1000);
    const snap = await readOnce(`${name}@${page}`, () => query.get());
    const fresh = add(snap);
    const lastDoc = snap.docs[snap.docs.length - 1];
    const next: unknown = lastDoc?.exists ? lastDoc.data()?.[field] : undefined;
    if (snap.size < 1000) return out;
    if ((fresh === 0 && page > 0) || typeof next !== 'string') break;
    last = next;
  }
  truncated.push(name);
  return out;
}

async function readDoc(db: Db, path: string): Promise<Doc | null> {
  const snap = await readOnce(path, () => db.doc(path).get());
  const data = snap.exists ? snap.data() : undefined;
  if (!data) return null;
  const v = validateDoc(path, data);
  return v.ok ? v.value : null;
}

export async function readLegacy(db: Db): Promise<LegacyData> {
  const truncated: string[] = [];
  const [vocab, chunks, grammar, profile, assess] = await Promise.all([
    readCollection(db, 'vocab', truncated),
    readCollection(db, 'chunk', truncated),
    readCollection(db, 'grammar', truncated),
    readDoc(db, 'app/profile'),
    readDoc(db, 'app/assess'),
  ]);
  if (truncated.length) logWarn('legacy:read', { code: 'possibly_truncated', message: truncated.join(', ') });
  return { vocab, chunks, grammar, profile, assess, truncated };
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const numMap = (v: unknown): Record<string, number> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : {});

function addedMs(doc: Doc, fallback: number): number {
  const a = doc.added;
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  if (typeof a === 'string') {
    const t = Date.parse(a);
    if (Number.isFinite(t)) return t;
  }
  return fallback;
}

function levelFrom(assess: Doc | null): string | undefined {
  if (!assess) return undefined;
  const data = (assess.data && typeof assess.data === 'object' ? assess.data : assess) as Doc;
  const l = str(data.cefr) || str(data.level);
  return l ? l.slice(0, 12) : undefined;
}

export type ImportPlan = { cards: Array<[string, CardRec]>; imported: LegacyImport };

/** Reine Berechnung: was aus den alten Daten übernommen wird. */
export function planImport(legacy: LegacyData, existing: ReadonlyMap<string, CardRec>, nowMs: number): ImportPlan {
  const b = bank();
  const cards: Array<[string, CardRec]> = [];
  const take = (id: string, doc: Doc, word: string, de: string, ex: string) => {
    if (!id || existing.has(id) || doc.hidden === true) return;
    const f = readFsrs(doc, nowMs);
    const stage = typeof doc.stage === 'number' ? doc.stage : 0;
    const inBank = b.byId.has(id);
    const rec: CardRec = { src: inBank ? 'bank' : 'legacy', f, lv: Math.max(0, Math.min(4, Math.round(stage))), add: addedMs(doc, nowMs) };
    if (!inBank) {
      rec.w = word;
      if (de) rec.de = de;
      if (ex) rec.ex = ex.slice(0, 300);
    }
    cards.push([id, rec]);
  };
  for (const [id, doc] of legacy.vocab) take(id, doc, str(doc.word), str(doc.de), str(doc.ex));
  for (const [id, doc] of legacy.chunks) {
    const en = str(doc.en);
    if (en) take(b.byId.has(id) ? id : `ch-${id}`, doc, en, str(doc.de), '');
  }

  // Aktive Tage der letzten 120 Tage: alte Regel (Antworten oder XP), ab pflichtSince die Pflicht.
  const p = legacy.profile ?? {};
  const daysMap = numMap(p.days);
  const xpMap = numMap(p.xpDays);
  const since = isDayKey(p.pflichtSince) ? p.pflichtSince : null;
  const pflicht = pflichtDays(p.pflicht);
  const today = dayKey(nowMs);
  const days: string[] = [];
  for (let i = 0; i < 120; i++) {
    const k = addDays(today, -i);
    const legacyOk = legacyActive(daysMap, xpMap, k);
    const ok = since && k >= since ? pflicht.has(k) || (k === since && legacyOk) : legacyOk;
    if (ok) days.push(k);
  }

  const grammar: Record<string, number> = {};
  for (const [id, doc] of legacy.grammar) {
    if (typeof doc.p === 'number' && Number.isFinite(doc.p)) grammar[id] = Math.round(Math.max(0, Math.min(1, doc.p)) * 100) / 100;
  }
  const imported: LegacyImport = { at: nowMs, cards: cards.length, days: days.sort(), grammar };
  const level = levelFrom(legacy.assess);
  if (level) imported.level = level;
  return { cards, imported };
}

/** Einmal lesen und übernehmen. Fehler werden protokolliert; die App läuft ohne Altdaten weiter. */
export async function importLegacy(
  db: Db,
  existing: ReadonlyMap<string, CardRec>,
  save: (plan: ImportPlan) => Promise<void>,
): Promise<ImportPlan | null> {
  try {
    const legacy = await readLegacy(db);
    const plan = planImport(legacy, existing, Date.now());
    await save(plan);
    return plan;
  } catch (err) {
    logError('legacy:import', err);
    return null;
  }
}
