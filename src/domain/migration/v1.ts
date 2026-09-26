import type { Db } from '../../platform/types';
import type { FsrsStored, SchemaDoc } from '../../data/schemas';
import { schemaDocSchema } from '../../data/schemas';
import type { DataSnapshot } from '../../data/snapshot';
import { collectionDocs } from '../../data/snapshot';
import { validateDoc } from '../../data/validate';
import type { Writer } from '../../data/writer';
import { describeError } from '../../platform/diagnostics';
import { dayKey, legacyDayKey } from '../date';
import { computeStreak, legacyStreak } from '../streak';
import { legacyToFsrs } from '../srs/legacyFsrs';
import { LESSONS, SEED_VOCAB, TOPICS, slug } from '../content';
import { classifyLegacyPath, type RescueItem, type RescueSkipReason } from './rescue';
import { applyRescueItem } from './applyRescue';

export type { RescueSkipReason };

// Umstellung auf Datenversion 1 (Kap. 9, Regel 3): einmalig, versioniert, mit Trockenlauf.
// planMigrationV1 schreibt nichts – es beschreibt genau, was applyMigrationV1 tun würde.
// Es wird nur ergänzt, nie gelöscht:
//   1. Noch nicht übertragene lokale Änderungen der alten App (sw2:__dirty) ERGÄNZEN (rescue.ts):
//      Die Datenbank kann neuer sein; beim Ausführen wird deshalb frisch gelesen und abgeglichen.
//   2. FSRS-Startwerte als neues Feld `fsrs` je Vokabel- und Wendungskarte (alte Felder bleiben).
//   3. `app/schema` mit Version, Umstellungstag und Anzahlen.
// Jeder Schritt ist wiederholbar: bereits ergänzte Karten werden übersprungen.

export const SCHEMA_VERSION = 1;
const APP_ID = 'lingo-engine-x';

type Doc = Record<string, unknown>;

export type LegacyLocalInput = { dirty: Record<string, number>; docs: Record<string, Doc> };

/** Warum die Umstellung gesperrt ist (dann gibt es keinen Knopf, nur die Sicherung). */
export type BlockReason = 'profile_invalid' | 'possibly_truncated';

export type MigrationPlan = {
  version: typeof SCHEMA_VERSION;
  already: SchemaDoc | null;
  today: string;
  blocked: BlockReason[];
  found: Array<{ name: string; total: number; valid: number }>;
  invalid: Array<{ path: string; issues: string[] }>;
  possiblyTruncated: string[];
  defaults: { seedVocabNotInDb: number; topicsNotInDb: number };
  /** Kopien der alten App, die ergänzt werden (`local` = die Kopie; beim Ausführen frisch abgeglichen). */
  rescue: RescueItem[];
  rescueSkipped: Array<{ path: string; markedAt: number; reason: RescueSkipReason }>;
  fsrs: Array<{ path: string; value: FsrsStored }>;
  untouched: { daily: number; feed: number };
  streak: { before: number; after: number };
  totals: { vocab: number; vocabHidden: number; grammar: number; lessons: number; lessonsTotal: number; lessonsDone: number; logs: number; documents: number };
  writes: number;
};

const numMap = (v: unknown): Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, number>) : {};

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

  // 1 · lokale, noch nicht übertragene Änderungen der alten App – nur ergänzen (rescue.ts)
  const rescue: MigrationPlan['rescue'] = [];
  const rescueSkipped: MigrationPlan['rescueSkipped'] = [];
  const effective = new Map<string, Doc>(snapshot.valid);
  for (const [path, markedAt] of Object.entries(local.dirty).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const c = classifyLegacyPath(path, markedAt, Object.hasOwn(local.docs, path) ? local.docs[path] : undefined, snapshot.raw.get(path));
    if ('skip' in c) rescueSkipped.push({ path, markedAt, reason: c.skip });
    else {
      rescue.push(c.item);
      effective.set(path, c.merged);
    }
  }

  // 2 · FSRS-Startwerte, nur wo sie noch fehlen (ungültige Karten bleiben unangetastet)
  const fsrs: MigrationPlan['fsrs'] = [];
  for (const [path, doc] of effective) {
    if (!(path.startsWith('vocab/') || path.startsWith('chunk/'))) continue;
    if (doc.fsrs && typeof doc.fsrs === 'object') continue;
    fsrs.push({ path, value: legacyToFsrs(doc, nowMs) });
  }

  // Anzahlen inkl. Voreinstellungen, wie die alte App sie zählt
  const vocabDocs = [...effective].filter(([p]) => p.startsWith('vocab/'));
  const vocabIds = new Set(vocabDocs.map(([p]) => p.slice(6)));
  const vocabHidden = vocabDocs.filter(([, d]) => d.hidden === true).length;
  const seedVocabNotInDb = SEED_VOCAB.filter((s) => !vocabIds.has(slug(s.w))).length;
  const grammarIds = new Set(collectionDocs(snapshot, 'grammar').keys());
  const topicsNotInDb = TOPICS.filter((t) => !grammarIds.has(t.id)).length;
  const grammarTotal = new Set([...grammarIds, ...TOPICS.map((t) => t.id)]).size;
  const course = effective.get('app/course');
  const doneMap = course && typeof course.done === 'object' && course.done !== null ? (course.done as Doc) : {};
  const lessonsDone = LESSONS.filter((l) => Object.hasOwn(doneMap, l.id)).length;

  // Serie vorher (Rechenweg der alten App, aus den Rohdaten) und nachher (mit ergänzten Kopien).
  // Die Pflicht-Regel beginnt erst mit Phase 1 (`pflichtSince`); bis dahin gilt die alte Regel.
  const profileBefore = snapshot.raw.get('app/profile') ?? {};
  const profileAfter = rescue.some((r) => r.path === 'app/profile') ? (effective.get('app/profile') ?? profileBefore) : profileBefore;
  const before = legacyStreak(numMap(profileBefore.days), numMap(profileBefore.xpDays), nowMs);
  const after = computeStreak({
    days: numMap(profileAfter.days),
    xpDays: numMap(profileAfter.xpDays),
    today,
    legacyToday: legacyDayKey(nowMs),
  }).count;

  const blocked: BlockReason[] = [];
  if (snapshot.raw.has('app/profile') && !snapshot.valid.has('app/profile')) blocked.push('profile_invalid');
  if (snapshot.possiblyTruncated.length) blocked.push('possibly_truncated');

  const found = Object.entries(snapshot.counts)
    .map(([name, c]) => ({ name, total: c.total, valid: c.valid }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  return {
    version: SCHEMA_VERSION,
    already,
    today,
    blocked,
    found,
    invalid: [...snapshot.invalid],
    possiblyTruncated: [...snapshot.possiblyTruncated],
    defaults: { seedVocabNotInDb, topicsNotInDb },
    rescue,
    rescueSkipped,
    fsrs,
    untouched: { daily: snapshot.counts.daily?.total ?? 0, feed: snapshot.counts.feed?.total ?? 0 },
    streak: { before, after },
    totals: {
      vocab: vocabIds.size + seedVocabNotInDb,
      vocabHidden,
      grammar: grammarTotal,
      lessons: collectionDocs(snapshot, 'lesson').size,
      lessonsTotal: LESSONS.length,
      lessonsDone,
      logs: collectionDocs(snapshot, 'log').size,
      documents: snapshot.raw.size + rescue.filter((r) => r.action === 'create').length,
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
  if (plan.blocked.length) return { status: 'failed', written: 0, code: 'blocked', message: plan.blocked.join(', ') };
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
    for (const r of plan.rescue) await step(() => applyRescueItem(r, writer));
    // FSRS aus dem frischen Stand jeder Karte berechnen (sie kann sich seit dem Trockenlauf geändert haben).
    for (const f of plan.fsrs) {
      await step(async () => {
        const snap = await db.doc(f.path).get();
        const doc = snap.exists ? snap.data() : undefined;
        if (!doc || (doc.fsrs && typeof doc.fsrs === 'object') || !validateDoc(f.path, doc).ok) return;
        await writer.update(f.path, { fsrs: legacyToFsrs(doc, deps.nowMs()) });
      });
    }
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

