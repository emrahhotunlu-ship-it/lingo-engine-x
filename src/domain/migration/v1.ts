import type { Db } from '../../platform/types';
import type { FsrsStored, SchemaDoc } from '../../data/schemas';
import { schemaDocSchema } from '../../data/schemas';
import type { DataSnapshot } from '../../data/snapshot';
import { collectionDocs } from '../../data/snapshot';
import { isReadOnlyPath } from '../../data/paths';
import { validateDoc } from '../../data/validate';
import type { Writer } from '../../data/writer';
import { describeError } from '../../platform/diagnostics';
import { jsonEqual } from '../equal';
import { dayKey } from '../date';
import { computeStreak, legacyStreak } from '../streak';
import { legacyToFsrs } from '../srs/legacyFsrs';
import { SEED_VOCAB, TOPICS, slug } from '../content';

// Umstellung auf Datenversion 1 (Kap. 9, Regel 3): einmalig, versioniert, mit Trockenlauf.
// planMigrationV1 schreibt nichts – es beschreibt genau, was applyMigrationV1 tun würde.
// Es wird nur ergänzt, nie gelöscht:
//   1. Noch nicht übertragene lokale Änderungen der alten App (sw2:__dirty) übernehmen.
//   2. FSRS-Startwerte als neues Feld `fsrs` je Vokabel- und Wendungskarte (alte Felder bleiben).
//   3. `app/schema` mit Version, Umstellungstag und Anzahlen.
// Jeder Schritt ist wiederholbar: bereits ergänzte Karten werden übersprungen.

export const SCHEMA_VERSION = 1;
const APP_ID = 'lingo-engine-x';

type Doc = Record<string, unknown>;

export type LegacyLocalInput = { dirty: Record<string, number>; docs: Record<string, Doc> };

export type MigrationPlan = {
  version: typeof SCHEMA_VERSION;
  already: SchemaDoc | null;
  today: string;
  found: Array<{ name: string; total: number; valid: number }>;
  invalid: Array<{ path: string; issues: string[] }>;
  defaults: { seedVocabNotInDb: number; topicsNotInDb: number };
  rescue: Array<{ path: string; markedAt: number; exists: boolean; data: Doc }>;
  rescueSkipped: Array<{ path: string; reason: 'read_only' | 'invalid' | 'unchanged' | 'missing_local' }>;
  fsrs: Array<{ path: string; value: FsrsStored }>;
  untouched: { daily: number; feed: number };
  streak: { before: number; after: number };
  totals: { vocab: number; grammar: number; lessons: number; lessonsDone: number; logs: number; documents: number };
  writes: number;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const numMap = (v: unknown): Record<string, number> =>
  typeof v === 'object' && v !== null ? (v as Record<string, number>) : {};

export function readSchemaDoc(s: DataSnapshot): SchemaDoc | null {
  const raw = s.raw.get('app/schema');
  if (!raw) return null;
  const res = schemaDocSchema.safeParse(raw);
  return res.success ? res.data : null;
}

export function planMigrationV1(input: { snapshot: DataSnapshot; local: LegacyLocalInput; nowMs: number }): MigrationPlan {
  const { snapshot, local, nowMs } = input;
  const today = dayKey(nowMs);
  const already = readSchemaDoc(snapshot);

  // 1 · lokale, noch nicht übertragene Änderungen der alten App
  const rescue: MigrationPlan['rescue'] = [];
  const rescueSkipped: MigrationPlan['rescueSkipped'] = [];
  for (const [path, markedAt] of Object.entries(local.dirty).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const data = local.docs[path];
    if (!data) rescueSkipped.push({ path, reason: 'missing_local' });
    else if (isReadOnlyPath(path)) rescueSkipped.push({ path, reason: 'read_only' });
    else if (!validateDoc(path, data).ok) rescueSkipped.push({ path, reason: 'invalid' });
    else if (jsonEqual(snapshot.raw.get(path), data)) rescueSkipped.push({ path, reason: 'unchanged' });
    else rescue.push({ path, markedAt, exists: snapshot.raw.has(path), data });
  }
  const effective = new Map<string, Doc>(snapshot.valid);
  for (const r of rescue) effective.set(r.path, r.data);

  // 2 · FSRS-Startwerte, nur wo sie noch fehlen
  const fsrs: MigrationPlan['fsrs'] = [];
  for (const [path, doc] of effective) {
    if (!(path.startsWith('vocab/') || path.startsWith('chunk/'))) continue;
    if (doc.fsrs && typeof doc.fsrs === 'object') continue;
    fsrs.push({ path, value: legacyToFsrs(doc, nowMs) });
  }

  // Anzahlen inkl. Voreinstellungen, wie die alte App sie zählt
  const vocabDocs = collectionDocs(snapshot, 'vocab');
  const vocabIds = new Set([...vocabDocs.keys()]);
  for (const r of rescue) if (r.path.startsWith('vocab/')) vocabIds.add(r.path.slice(6));
  const seedVocabNotInDb = SEED_VOCAB.filter((s) => !vocabIds.has(slug(s.w))).length;
  const grammarIds = new Set(collectionDocs(snapshot, 'grammar').keys());
  const topicsNotInDb = TOPICS.filter((t) => !grammarIds.has(t.id)).length;
  const grammarTotal = new Set([...grammarIds, ...TOPICS.map((t) => t.id)]).size;
  const course = effective.get('app/course');
  const done = course && typeof course.done === 'object' && course.done !== null ? Object.keys(course.done) : [];

  // Serie vorher (Rechenweg der alten App) und nachher (neue Regel ab heute)
  const profileBefore = snapshot.valid.get('app/profile') ?? {};
  const profileAfter = effective.get('app/profile') ?? {};
  const before = legacyStreak(numMap(profileBefore.days), numMap(profileBefore.xpDays), nowMs);
  const after = computeStreak({
    days: numMap(profileAfter.days),
    xpDays: numMap(profileAfter.xpDays),
    cutover: today,
    today,
  }).count;

  const found = Object.entries(snapshot.counts)
    .map(([name, c]) => ({ name, total: c.total, valid: c.valid }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  return {
    version: SCHEMA_VERSION,
    already,
    today,
    found,
    invalid: [...snapshot.invalid],
    defaults: { seedVocabNotInDb, topicsNotInDb },
    rescue,
    rescueSkipped,
    fsrs,
    untouched: { daily: snapshot.counts.daily?.total ?? 0, feed: snapshot.counts.feed?.total ?? 0 },
    streak: { before, after },
    totals: {
      vocab: vocabIds.size + seedVocabNotInDb,
      grammar: grammarTotal,
      lessons: collectionDocs(snapshot, 'lesson').size,
      lessonsDone: done.length,
      logs: collectionDocs(snapshot, 'log').size,
      documents: snapshot.raw.size + rescue.filter((r) => !r.exists).length,
    },
    writes: rescue.length + fsrs.length + 1,
  };
}

export type ApplyResult =
  | { status: 'done'; written: number }
  | { status: 'already'; written: 0 }
  | { status: 'busy'; written: 0; expiresAt?: string }
  | { status: 'failed'; written: number; code: string; message: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function applyMigrationV1(
  plan: MigrationPlan,
  deps: { db: Db; writer: Writer; holder: string; nowMs: () => number; onProgress?: (done: number, total: number) => void },
): Promise<ApplyResult> {
  const { db, writer, holder } = deps;
  const isDone = async () => {
    const snap = await db.doc('app/schema').get();
    const cur = snap.exists ? schemaDocSchema.safeParse(snap.data()) : null;
    return cur?.success === true && cur.data.version >= SCHEMA_VERSION;
  };
  // Erst prüfen (ein anderes Fenster kann schon fertig sein), dann sperren, dann erneut prüfen.
  if (await isDone()) return { status: 'already', written: 0 };
  const lease = await db.doc('app/schema').acquire({ holder, ttlMs: 120_000 });
  if (!lease.acquired) return lease.expiresAt ? { status: 'busy', written: 0, expiresAt: lease.expiresAt } : { status: 'busy', written: 0 };
  if (await isDone()) return { status: 'already', written: 0 };

  let written = 0;
  const total = plan.writes;
  const step = async (op: () => Promise<unknown>) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await op();
        break;
      } catch (err) {
        // Budget erschöpft: langsamer werden statt in schneller Schleife wiederholen (db.d.ts).
        if (describeError(err).code === 'resource_exhausted' && attempt < 4) {
          await sleep(1500 * attempt);
          continue;
        }
        throw err;
      }
    }
    written++;
    deps.onProgress?.(written, total);
    if (written % 50 === 0) await db.doc('app/schema').acquire({ holder, ttlMs: 120_000 });
  };

  try {
    for (const r of plan.rescue) await step(() => writer.set(r.path, r.data, null));
    for (const f of plan.fsrs) await step(() => writer.update(f.path, { fsrs: f.value }));
    const schemaDoc: Doc = {
      version: SCHEMA_VERSION,
      cutover: plan.today,
      migratedAt: deps.nowMs(),
      app: APP_ID,
      counts: {
        vocab: plan.totals.vocab,
        grammar: plan.totals.grammar,
        lessonsDone: plan.totals.lessonsDone,
        logs: plan.totals.logs,
        streak: plan.streak.after,
        fsrsAdded: plan.fsrs.length,
        rescued: plan.rescue.length,
      },
    };
    await step(() => writer.set('app/schema', schemaDoc, null));
    return { status: 'done', written };
  } catch (err) {
    const d = describeError(err);
    return { status: 'failed', written, code: d.code ?? 'unknown', message: d.message };
  }
}

/** Zeitpunkt der letzten Umstellung, falls vorhanden. */
export function migratedAt(s: SchemaDoc | null): number | null {
  return s ? num(s.migratedAt) : null;
}
