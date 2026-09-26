import { readCollection, readDoc } from '../../data/reads';
import type { Writer } from '../../data/writer';
import { addDays, legacyDayKey } from '../../domain/date';
import { poolIntake, type PoolIntake } from '../../domain/grammar/pool';
import type { GrammarTask } from '../../domain/learn/types';
import { dailyIntake, seenByTopic } from '../../domain/plan/dailyIntake';
import { pflichtFor, pflichtMarked, pflichtSinceGate, pflichtSinceOp, pflichtSinceValue, type PflichtInput } from '../../domain/plan/pflicht';
import type { StoredPlan } from '../../domain/plan/types';
import { logError, logWarn } from '../../platform/diagnostics';
import type { Db } from '../../platform/types';

// Die Schritte von `ensureDay` (phase2-plan §6.4) als eigenständige, testbare Abläufe. Jeder
// Schritt protokolliert und blockiert die folgenden nicht. `acquire` belegt ist ein normales
// Ergebnis: Der nächste Versuch kommt beim nächsten `ensureDay` – nie in einer Schleife.
// Verdrahtet werden sie im Oberflächen-Schritt (Heute), zusammen mit dem Phase-2-Tagesplan.

type Doc = Record<string, unknown>;

export type IntakeResult = { status: 'done' | 'busy' | 'error'; openTasks: GrammarTask[]; createdCards: number; pool: PoolIntake | null };

/** Schritt 1: alle liegengebliebenen `daily/*` → Karten und Pool (§4.10). */
export async function runDailyIntake(i: {
  db: Db;
  writer: Writer;
  nowMs: number;
  tab: string;
  today: string;
  knownVocab: ReadonlySet<string>;
  grammarDocs: ReadonlyMap<string, Readonly<Doc>>;
}): Promise<IntakeResult> {
  let daily: Map<string, Doc>;
  try {
    const read = await readCollection(i.db, 'daily');
    daily = read.valid;
    if (read.possiblyTruncated) {
      // Genau 1.000 Treffer: die letzten 30 Tage zusätzlich einzeln lesen.
      const end = legacyDayKey(i.nowMs);
      for (let k = 0; k < 30; k++) {
        const day = addDays(end, -k);
        if (daily.has(day)) continue;
        const r = await readDoc(i.db, `daily/${day}`);
        if (r.status === 'valid') daily.set(day, r.doc);
      }
    }
  } catch (err) {
    logError('day:daily', err, 'daily lesen');
    return { status: 'error', openTasks: [], createdCards: 0, pool: null };
  }
  let lxDaily: unknown = null;
  try {
    const p = await readDoc(i.db, 'app/pool');
    lxDaily = p.status === 'valid' ? p.doc.lxDaily : null;
  } catch (err) {
    logWarn('day:daily', err, 'app/pool lesen');
  }
  const intake = dailyIntake({ daily, lxDaily, knownVocab: i.knownVocab, grammarDocs: i.grammarDocs, today: i.today, nowMs: i.nowMs });
  if (!intake.batches.length && !intake.words.length) return { status: 'done', openTasks: intake.openTasks, createdCards: 0, pool: null };
  let created = 0;
  try {
    // Eine Sperre für Karten UND Pool: Zwei Tabs legen so nie dieselbe Karte zweimal an.
    const lease = await i.writer.acquire('app/pool', { holder: i.tab, ttlMs: 15_000 });
    if (!lease.acquired) return { status: 'busy', openTasks: intake.openTasks, createdCards: 0, pool: null };
    for (const w of intake.words) {
      try {
        if ((await i.writer.createIfMissing(`vocab/${w.id}`, w.doc)) === 'created') created++;
      } catch (err) {
        logError('day:daily', err, `vocab/${w.id}`);
      }
    }
    if (!intake.batches.length) return { status: 'done', openTasks: intake.openTasks, createdCards: created, pool: null };
    let res: PoolIntake | null = null;
    await i.writer.transform('app/pool', (cur) => {
      res = poolIntake(cur, intake.batches, seenByTopic(i.grammarDocs), i.nowMs);
      return res.op;
    });
    const r = res as PoolIntake | null;
    if (r?.invalid) logError('day:pool', { code: 'invalid_document', message: 'Pool ungültig – nicht überschrieben' }, 'app/pool');
    return { status: 'done', openTasks: intake.openTasks, createdCards: created, pool: r };
  } catch (err) {
    logError('day:pool', err, 'app/pool');
    return { status: 'error', openTasks: intake.openTasks, createdCards: created, pool: null };
  }
}

export type SinceResult = 'set' | 'skipped' | 'busy' | 'conflict' | 'error';

/** Schritt 3: `app/schema.pflichtSince` einmal je Datenbank (§6.3, Regel 2). */
export async function ensurePflichtSince(i: {
  writer: Writer;
  nowMs: number;
  tab: string;
  today: string;
  plan: StoredPlan | null;
  schema: Readonly<Doc> | null | undefined;
  profile: Readonly<Doc>;
  tts: boolean;
  ai: boolean;
  data?: { cloze: number; order: number };
}): Promise<SinceResult> {
  const gate = pflichtSinceGate({ schema: i.schema, plan: i.plan, today: i.today, tts: i.tts, ai: i.ai, data: i.data });
  if (!gate.ok) return 'skipped';
  try {
    const lease = await i.writer.acquire('app/schema', { holder: i.tab, ttlMs: 5000 });
    if (!lease.acquired) return 'busy';
    let conflict = false;
    const out = await i.writer.transform('app/schema', (cur) => {
      const op = pflichtSinceOp(cur, pflichtSinceValue({ nowMs: i.nowMs, cutover: typeof cur?.cutover === 'string' ? cur.cutover : null, profile: i.profile }));
      if (op === 'conflict') {
        conflict = true;
        return null;
      }
      return op;
    });
    if (conflict) {
      logError('day:pflichtSince', { code: 'invalid_value', message: 'pflichtSince hat unerwarteten Wert – nicht geändert' }, 'app/schema');
      return 'conflict';
    }
    return out === 'updated' ? 'set' : 'skipped';
  } catch (err) {
    logError('day:pflichtSince', err, 'app/schema');
    return 'error';
  }
}

/** Schritt 4: Selbstheilung `pflicht[heute]` (Regel 1) – setzt nur, nie 0, nie entfernt. */
export async function healPflicht(writer: Writer, i: Omit<PflichtInput, 'profile' | 'batchActivity'>): Promise<'set' | 'unchanged' | 'error'> {
  try {
    const out = await writer.transform('app/profile', (cur) => {
      if (!cur || pflichtMarked(cur, i.day)) return null;
      return pflichtFor({ ...i, profile: cur, batchActivity: false }) ? { update: { pflicht: { [i.day]: 1 } } } : null;
    });
    return out === 'updated' ? 'set' : 'unchanged';
  } catch (err) {
    logError('day:pflicht', err, 'app/profile');
    return 'error';
  }
}
