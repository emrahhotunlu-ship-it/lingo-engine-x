import { z } from 'zod';
import { fsrsSchema } from '../../data/schemas';
import { validateDoc } from '../../data/validate';
import { stageOf, nextStage } from './ladder';
import { exerciseDef } from './modes';
import { readFsrs, reviewFsrs, isFutureFsrs } from './scheduler';
import type { AnswerEvent, LegacyMode } from './types';

// Schreiben je bewerteter Antwort (Daten-Entwurf §1.3/1.4): rein, ohne Seiteneffekte.
// Ausgeführt im Writer per `transform`, also immer auf dem frischen Stand des Dokuments.

type Doc = Record<string, unknown>;

export type SkipReason = 'missing' | 'invalid' | 'hidden' | 'already_applied' | 'stale_answer' | 'future_fsrs' | 'invalid_result';
export type CardWrite = { kind: 'update'; patch: Doc } | { kind: 'create'; doc: Doc } | { kind: 'skip'; reason: SkipReason };

export const HIST_MAX = 12;
const MAX_CARD_BYTES = 64 * 1024;

const legacyMode = z.enum(['recog', 'cloze', 'type', 'colloc', 'listen', 'produce']);
const countsSchema = z.object({ c: z.number().int().min(0), w: z.number().int().min(0) });

/** Streng, nur für die geschriebenen Felder (Daten-Entwurf §1.5). Die Lese-Schemas bleiben locker. */
export const cardPatchSchema = z
  .object({
    S: z.number().min(0).max(365),
    D: z.number().min(1).max(10),
    due: z.number().int().nonnegative(),
    last: z.number().int().positive(),
    state: z.enum(['learning', 'review']),
    reps: z.number().int().min(1),
    lapses: z.number().int().min(0),
    stage: z.number().int().min(1).max(5),
    modes: z.partialRecord(legacyMode, countsSchema),
    xs: z.record(z.string().max(24), countsSchema),
    hist: z.array(z.looseObject({ t: z.number(), g: z.number().optional() })).max(HIST_MAX),
    intro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pa: z.number().min(0).max(1).optional(),
    ac: z.number().min(0).max(1).optional(),
    co: z.number().min(0).max(1).optional(),
    colN: z.array(z.number().int().min(0)).optional(),
    fsrs: fsrsSchema.extend({ v: z.literal(1), src: z.literal('lx'), last: z.number().int() }),
  })
  .strict()
  .refine((p) => p.fsrs.last === p.last && p.fsrs.due === p.due);

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;
const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Wie `db.update`: verschachtelte Objekte verschmelzen, alles andere ersetzt. */
export function applyUpdate(cur: Doc, patch: Doc): Doc {
  const out: Doc = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    const c = out[k];
    out[k] = isObj(v) && isObj(c) ? applyUpdate(c, v) : v;
  }
  return out;
}

/** Fähigkeitswerte pa/ac/co nach der Formel der alten App (`updateSkill`). */
function skillPatch(cur: Doc, mode: LegacyMode, grade: number, colIndex: number | undefined, colLen: number): Doc {
  const v = grade >= 3 ? 1 : grade === 2 ? 0.6 : 0;
  const upd = (k: string) => {
    const c = cur[k];
    return typeof c !== 'number' || !Number.isFinite(c) ? (v ? 0.45 + 0.3 * v : 0.15) : +(c * 0.6 + v * 0.4).toFixed(3);
  };
  const out: Doc = {};
  const pa = typeof cur.pa === 'number' && Number.isFinite(cur.pa) ? cur.pa : 0;
  if (mode === 'recog' || mode === 'listen') {
    out.pa = upd('pa');
  } else if (mode === 'colloc') {
    out.co = upd('co');
    if (v > 0) {
      out.pa = Math.max(pa, 0.6);
      if (colIndex !== undefined && colIndex >= 0 && colIndex < colLen) {
        const prev: unknown[] = Array.isArray(cur.colN) ? (cur.colN as unknown[]) : [];
        const colN = Array.from({ length: Math.max(colLen, prev.length) }, (_, i) => Math.max(0, Math.round(num(prev[i]))));
        colN[colIndex] = (colN[colIndex] ?? 0) + 1;
        out.colN = colN;
      }
    }
  } else {
    const ac = upd('ac');
    out.ac = ac;
    if (v >= 0.6) out.pa = Math.max(pa, ac);
  }
  return out;
}

/** Patch für eine Karte, deren Dokument vorliegt (bzw. aus der Voreinstellung angelegt wird). */
export function cardPatch(cur: Doc, a: AnswerEvent): Doc {
  const def = exerciseDef(a.ex);
  const wasNew = cur.state === 'new';
  const f = reviewFsrs(readFsrs(cur, a.t), a.grade, a.t);
  const modes = isObj(cur.modes) ? cur.modes : {};
  const prevMode = isObj(modes[def.mode]) ? (modes[def.mode] as Doc) : {};
  const xs = isObj(cur.xs) ? cur.xs : {};
  const prevXs = isObj(xs[a.ex]) ? (xs[a.ex] as Doc) : {};
  const ok = a.grade > 1 ? 1 : 0;
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  const col: unknown[] = Array.isArray(cur.col) ? (cur.col as unknown[]) : [];
  const patch: Doc = {
    fsrs: f,
    S: Math.min(round4(f.stability), 365),
    D: Math.min(10, Math.max(1, round4(f.difficulty))),
    due: f.due,
    last: a.t,
    state: f.state === 2 ? 'review' : 'learning',
    reps: Math.max(0, Math.round(num(cur.reps))) + 1,
    lapses: Math.max(0, Math.round(num(cur.lapses))) + (a.grade === 1 && !wasNew ? 1 : 0),
    stage: nextStage(stageOf(cur), def.level, a.grade),
    modes: { [def.mode]: { c: Math.round(num(prevMode.c)) + ok, w: Math.round(num(prevMode.w)) + (1 - ok) } },
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)) + ok, w: Math.round(num(prevXs.w)) + (1 - ok) } },
    hist: [...hist, { t: a.t, m: def.mode, g: a.grade }].slice(-HIST_MAX),
    ...skillPatch(cur, def.mode, a.grade, a.colIndex, col.length),
  };
  if (wasNew) patch.intro = a.day;
  return patch;
}

/**
 * Was mit der Karte geschieht: ergänzen, anlegen (nur Startvokabel ohne Dokument) oder überspringen.
 * Nie wird ein ungültiges, ausgeblendetes oder inzwischen neuer bewertetes Dokument überschrieben.
 */
export function reviewWrite(path: string, current: Doc | undefined, a: AnswerEvent, seedDefault: Doc | null): CardWrite {
  let base: Doc;
  let create = false;
  if (!current) {
    if (!seedDefault) return { kind: 'skip', reason: 'missing' };
    base = seedDefault;
    create = true;
  } else {
    if (!validateDoc(path, current).ok) return { kind: 'skip', reason: 'invalid' };
    if (current.hidden === true) return { kind: 'skip', reason: 'hidden' };
    const last = num(current.last);
    if (last === a.t) return { kind: 'skip', reason: 'already_applied' };
    if (last > a.t) return { kind: 'skip', reason: 'stale_answer' };
    if (isFutureFsrs(current)) return { kind: 'skip', reason: 'future_fsrs' };
    base = current;
  }
  const patch = cardPatch(base, a);
  if (!cardPatchSchema.safeParse(patch).success) return { kind: 'skip', reason: 'invalid_result' };
  const merged = applyUpdate(base, patch);
  if (!validateDoc(path, merged).ok) return { kind: 'skip', reason: 'invalid_result' };
  if (new TextEncoder().encode(JSON.stringify(merged)).length >= MAX_CARD_BYTES) return { kind: 'skip', reason: 'invalid_result' };
  return create ? { kind: 'create', doc: merged } : { kind: 'update', patch };
}
