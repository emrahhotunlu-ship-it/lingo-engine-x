import { z } from 'zod';
import { fsrsSchema, type FsrsStored } from '../../data/schemas';
import { validateDoc } from '../../data/validate';
import { dayKey } from '../date';
import { naOf } from './actBase';
import { flipStage } from './flip';
import { isFestState } from '../metrics/cardStatus';
import { stageOf, nextStage } from './ladder';
import { freeCorrectDays, freeDaysNeeded } from './variety';
import { exerciseDef } from './modes';
import { readFsrs, reviewFsrs, isFutureFsrs } from './scheduler';
import { noteWeight } from './weight';
import type { AnswerEvent, ExerciseId, LegacyMode } from './types';

// Schreiben je bewerteter Antwort (Daten-Entwurf §1.3/1.4): rein, ohne Seiteneffekte.
// Ausgeführt im Writer per `transform`, also immer auf dem frischen Stand des Dokuments.

type Doc = Record<string, unknown>;

export type SkipReason = 'missing' | 'invalid' | 'hidden' | 'already_applied' | 'stale_answer' | 'future_fsrs' | 'invalid_result';
export type CardWrite = { kind: 'update'; patch: Doc } | { kind: 'create'; doc: Doc } | { kind: 'skip'; reason: SkipReason };

export const HIST_MAX = 12;
export const MAX_CARD_BYTES = 64 * 1024;

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
    ff: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pa: z.number().min(0).max(1).optional(),
    ac: z.number().min(0).max(1).optional(),
    co: z.number().min(0).max(1).optional(),
    colN: z.array(z.number().int().min(0)).optional(),
    // Wörter aktivieren, Stufe 2: geschaffte Aktivierungen (Fahrplan A1–A5). NICHT `ac`: das ist die Fähigkeit „Anwenden“ (0–1, alte App).
    na: z.number().int().min(0).max(99).optional(),
    fsrs: fsrsSchema.extend({ v: z.literal(1), src: z.literal('lx'), last: z.number().int() }),
  })
  .strict()
  .refine((p) => p.fsrs.last === p.last && p.fsrs.due === p.due);

/**
 * Wendungen (phase1-plan §3.3): wie Karten, aber ohne `pa`/`ac`/`co`/`colN`; `modes` nur für die
 * Modi der alten Wendungs-Wiederholung (`cloze`, `produce`), sonst gar nicht.
 */
export const chunkPatchSchema = z
  .object({
    S: z.number().min(0).max(365),
    D: z.number().min(1).max(10),
    due: z.number().int().nonnegative(),
    last: z.number().int().positive(),
    state: z.enum(['learning', 'review']),
    reps: z.number().int().min(1),
    lapses: z.number().int().min(0),
    stage: z.number().int().min(1).max(5),
    modes: z.partialRecord(z.enum(['cloze', 'produce']), countsSchema).optional(),
    xs: z.record(z.string().max(24), countsSchema),
    hist: z.array(z.looseObject({ t: z.number(), g: z.number().optional() })).max(HIST_MAX),
    intro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ff: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fsrs: fsrsSchema.extend({ v: z.literal(1), src: z.literal('lx'), last: z.number().int() }),
  })
  .strict()
  .refine((p) => p.fsrs.last === p.last && p.fsrs.due === p.due);

/** Modus der alten Wendungs-Wiederholung je Übungsart; Auswahlarten zählen nur in `xs`. */
export function chunkMode(ex: ExerciseId): 'cloze' | 'produce' | null {
  if (ex === 'produce') return 'produce';
  const input = exerciseDef(ex).input;
  return input === 'typed' || input === 'tiles' ? 'cloze' : null;
}

export const isChunkPath = (path: string): boolean => path.startsWith('chunk/');

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

type StageAnswer = Pick<AnswerEvent, 't' | 'day' | 'ex' | 'grade' | 'colIndex' | 'interrupted'>;

/**
 * Neue Stufe: Aufdecken (`flip`) nach der Stufenregel aus anki-regeln.md §3 (höchstens bis 2, je
 * Antwort höchstens eine Stufe, nie unter 1), sonst die Leiter (`nextStage`).
 */
function stageAfter(cur: Doc, a: StageAnswer): number {
  return stageStep(cur, a).stage;
}

/** Neue Stufe und, wenn nur das Tor der freien Antworten den Aufstieg verhindert, wie viele freie Tage noch fehlen (für die Erklärung, Lernwissenschaft M1). */
export function stageStep(cur: Doc, a: StageAnswer): { stage: number; missing: number } {
  const now = stageOf(cur);
  const next = a.ex === 'flip' ? flipStage(now, a.grade) : nextStage(now, levelFor(a.ex, now), a.grade);
  // Tagesbremse (phase1-plan §4, Prüfung Lernwissenschaft 02.10.2026): höchstens EIN Aufstieg je Karte und Lerntag. Wiederholungen
  // am selben Tag (Lernschritte, „Nochmal“-Wiedervorlage) beweisen nichts über das Gedächtnis von morgen und heben die Stufe nicht.
  // Abstieg bleibt immer möglich.
  if (next > now && answeredOn(cur, a.day)) return { stage: now, missing: 0 };
  // Eine richtige Antwort nach einer Unterbrechung (> 60 s) ist Note 3, beweist aber kein Können: kein Aufstieg (Lernwissenschaft N1).
  if (next > now && a.interrupted) return { stage: now, missing: 0 };
  // Auswertung 15.10.2026, Punkt 4: Aufstieg auf Stufe 4 nur mit mindestens zwei richtigen FREIEN Antworten (ohne Auswahl und Stütze) an verschiedenen Tagen,
  // auf Stufe 5 mit einem weiteren freien Tag. Nur der Aufstieg wird strenger; Karten, die schon höher stehen, werden nie zurückgestuft (hier wird nur `next` begrenzt).
  if (next > now && next >= 4) {
    const need = freeDaysNeeded(next);
    const have = freeCorrectDays(cur, { t: a.t, ex: a.ex, grade: a.grade, ...(a.colIndex !== undefined ? { ci: a.colIndex } : {}) }, next);
    if (have < need) return { stage: now, missing: need - have };
  }
  return { stage: next, missing: 0 };
}

/** Wurde die Karte an diesem Lerntag schon beantwortet? (`last` = Zeitpunkt der letzten Antwort.) */
const answeredOn = (cur: Doc, day: string): boolean => typeof cur.last === 'number' && Number.isFinite(cur.last) && cur.last > 0 && dayKey(cur.last) === day;

/**
 * Stufe, als die eine Übung zählt. Hör-Lücke (`dictation`, N35 Hör-Modus): höchstens eine Stufe über
 * der eigenen – sie prüft Gehör und Schreibung, nicht die Bedeutung. Auf Stufe 4–5 (Leiter) ändert
 * das nichts; im Hör-Modus hebt eine junge Karte so je Antwort nur um eine Stufe und fällt nie tiefer.
 */
/** Verlaufseintrag; `s` = Schlüssel des gezeigten Satzes (V1, nur wenn die Abfrage einen Satz hatte), `a` = Code der Vorgabe eines eigenen Satzes, `u` = ungeprüfte Aktivierung, `ci` = Index des Partnerworts (Treffer am Partnerwort ist kein freier Beleg für das Hauptwort). */
function histEntry(a: AnswerEvent, mode: LegacyMode): Record<string, unknown> {
  return { t: a.t, m: mode, g: a.grade, x: a.ex, ...(a.sx ? { s: a.sx } : {}), ...(a.act ? { a: a.act } : {}), ...((a.actStep && a.actUnverified) || a.unverified ? { u: 1 } : {}), ...(a.colIndex !== undefined && a.colIndex >= 0 ? { ci: a.colIndex } : {}) };
}

export function levelFor(ex: ExerciseId, stage: number): number {
  const level = exerciseDef(ex).level;
  return ex === 'dictation' ? Math.min(level, Math.max(1, stage) + 1) : level;
}

/** Erster Fest-Tag (`ff`, P22): einmal gesetzt, sobald die Karte nach dieser Antwort fest sitzt (dieselbe Regel wie die Anzeige: Stufe 5, Stabilität ≥ 21 Tage, im neuen Satz gekonnt, Paket ST); nie überschrieben. */
function festPatch(cur: Doc, patch: Doc, day: string): void {
  if (typeof cur.ff === 'string' && cur.ff) return;
  const f = patch.fsrs as FsrsStored | undefined;
  if (typeof patch.stage !== 'number' || !f) return;
  if (isFestState({ isNew: false, stage: patch.stage as 0, fsrs: f, doc: { ...cur, ...patch } })) patch.ff = day;
}

/** Gespeicherter Wert von `lapses` (Feld der alten App), nur um +1 bei einem echten Rückfall erhöht; das Maximum mit `fsrs.lapses` bildet allein der Leser (`lapsesOf`). */
const storedLapses = (cur: Doc): number => Math.max(0, Math.round(num(cur.lapses)));

/** Fehler am Partnerwort einer Kollokation (Index ≥ 0) bei einer Karte, die nicht neu ist. */
export function isPartnerMiss(cur: Doc, a: Pick<AnswerEvent, 'ex' | 'grade' | 'colIndex'>): boolean {
  return cur.state !== 'new' && a.grade === 1 && exerciseDef(a.ex).mode === 'colloc' && a.colIndex !== undefined && a.colIndex >= 0;
}

/** Streng, nur für den Partnerwort-Fehler: Verlauf und Zähler, sonst nichts. */
export const partnerMissPatchSchema = z
  .object({
    modes: z.partialRecord(legacyMode, countsSchema),
    xs: z.record(z.string().max(24), countsSchema),
    hist: z.array(z.looseObject({ t: z.number(), g: z.number().optional() })).max(HIST_MAX),
    co: z.number().min(0).max(1),
  })
  .strict();

function partnerMissPatch(cur: Doc, a: AnswerEvent): Doc {
  const def = exerciseDef(a.ex);
  const modes = isObj(cur.modes) ? cur.modes : {};
  const prevMode = isObj(modes[def.mode]) ? (modes[def.mode] as Doc) : {};
  const xs = isObj(cur.xs) ? cur.xs : {};
  const prevXs = isObj(xs[a.ex]) ? (xs[a.ex] as Doc) : {};
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  const col: unknown[] = Array.isArray(cur.col) ? (cur.col as unknown[]) : [];
  return {
    modes: { [def.mode]: { c: Math.round(num(prevMode.c)), w: Math.round(num(prevMode.w)) + 1 } },
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)), w: Math.round(num(prevXs.w)) + 1 } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
    ...skillPatch(cur, def.mode, 1, a.colIndex, col.length),
  };
}

/** Patch für eine Karte, deren Dokument vorliegt (bzw. aus der Voreinstellung angelegt wird). */
export function cardPatch(cur: Doc, a: AnswerEvent): Doc {
  if (a.kind === 'chunk') return chunkPatch(cur, a);
  const def = exerciseDef(a.ex);
  const wasNew = cur.state === 'new';
  // Auswertung 15.10.2026, Punkt 3 (Prüfung H2): Ein Fehler am Partnerwort einer Kollokation (`col`/`colN`, Index ≥ 0) heißt nicht, dass das Hauptwort vergessen wurde.
  // Es wird NUR der Verlauf geschrieben (`hist`, `modes`, `xs`, `co`): `stage`, `fsrs`, `due`, `reps`, `last`, `lapses`, Stabilität und Schwierigkeit bleiben stehen,
  // auch der Abstand zur letzten Wiederholung (sonst würde die nächste echte Antwort mit falschem Abstand gerechnet). Die schwache Abfrageart wird weiter geübt (Punkt 4).
  if (isPartnerMiss(cur, a)) return partnerMissPatch(cur, a);
  const prevFsrs = readFsrs(cur, a.t);
  const f = reviewFsrs(prevFsrs, a.grade, a.t, noteWeight(a.ex, a.hint ?? 0, a.catchUp === true, a.free === true));
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
    lapses: storedLapses(cur) + (a.grade === 1 && !wasNew ? 1 : 0),
    stage: stageAfter(cur, a),
    modes: { [def.mode]: { c: Math.round(num(prevMode.c)) + ok, w: Math.round(num(prevMode.w)) + (1 - ok) } },
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)) + ok, w: Math.round(num(prevXs.w)) + (1 - ok) } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
    ...skillPatch(cur, def.mode, a.grade, a.colIndex, col.length),
    // Aktivierung geschafft (Note ≥ 2, von Claude geprüft, ohne Hilfe): der Zähler `na` steigt im selben Schreibschritt wie die Antwort. Er ist abgeleitet und aus `act/…` neu berechenbar.
    ...(a.actStep && a.grade >= 2 && !a.actUnverified ? { na: Math.min(99, naOf(cur) + 1) } : {}),
  };
  // Nur ergänzen: ein vorhandenes Einführungsdatum der alten App bleibt stehen (Kap. 9, Regel 2).
  if (wasNew && (typeof cur.intro !== 'string' || !cur.intro)) patch.intro = a.day;
  festPatch(cur, patch, a.day);
  return patch;
}

/** Patch für eine Wendung (§3.3): Planung wie Karten, keine Fähigkeitswerte. */
export function chunkPatch(cur: Doc, a: AnswerEvent): Doc {
  const def = exerciseDef(a.ex);
  const wasNew = cur.state === 'new';
  const f = reviewFsrs(readFsrs(cur, a.t), a.grade, a.t, noteWeight(a.ex, a.hint ?? 0, a.catchUp === true, a.free === true));
  const xs = isObj(cur.xs) ? cur.xs : {};
  const prevXs = isObj(xs[a.ex]) ? (xs[a.ex] as Doc) : {};
  const ok = a.grade > 1 ? 1 : 0;
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  const patch: Doc = {
    fsrs: f,
    S: Math.min(round4(f.stability), 365),
    D: Math.min(10, Math.max(1, round4(f.difficulty))),
    due: f.due,
    last: a.t,
    state: f.state === 2 ? 'review' : 'learning',
    reps: Math.max(0, Math.round(num(cur.reps))) + 1,
    lapses: storedLapses(cur) + (a.grade === 1 && !wasNew ? 1 : 0),
    stage: stageAfter(cur, a),
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)) + ok, w: Math.round(num(prevXs.w)) + (1 - ok) } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
  };
  const mode = chunkMode(a.ex);
  if (mode) {
    const modes = isObj(cur.modes) ? cur.modes : {};
    const prev = isObj(modes[mode]) ? (modes[mode]) : {};
    patch.modes = { [mode]: { c: Math.round(num(prev.c)) + ok, w: Math.round(num(prev.w)) + (1 - ok) } };
  }
  if (wasNew && (typeof cur.intro !== 'string' || !cur.intro)) patch.intro = a.day;
  festPatch(cur, patch, a.day);
  return patch;
}

/**
 * P52 „Welches Wort passt?“ falsch (Kartenwort gewählt): NUR ein Verlaufseintrag `{x: 'contrast', g: 1}`. Er zählt für „schwach“ (Fehler der
 * letzten 14 Tage); Planung und Zähler (`fsrs`, `S`, `D`, `due`, `last`, `lapses`, `stage`, `reps`, `modes`, `xs`) bleiben unberührt.
 * `null` = nichts zu schreiben (kein/ungültiges/ausgeblendetes Dokument, Eintrag mit diesem Zeitstempel schon da, Ergebnis zu groß).
 */
export function contrastMissOp(path: string, cur: Doc | undefined, a: AnswerEvent): { update: Doc } | null {
  if (!cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  if (hist.some((h) => typeof h === 'object' && h !== null && (h as Doc).t === a.t)) return null;
  const patch: Doc = { hist: [...hist, histEntry({ ...a, grade: 1 }, exerciseDef(a.ex).mode)].slice(-HIST_MAX) };
  const merged = applyUpdate(cur, patch);
  if (!validateDoc(path, merged).ok || new TextEncoder().encode(JSON.stringify(merged)).length >= MAX_CARD_BYTES) return null;
  return { update: patch };
}

/**
 * Was mit der Karte geschieht: ergänzen, anlegen (nur Startvokabel ohne Dokument) oder überspringen.
 * Nie wird ein ungültiges, ausgeblendetes oder inzwischen neuer bewertetes Dokument überschrieben.
 */
export function reviewWrite(path: string, current: Doc | undefined, a: AnswerEvent, seedDefault: Doc | null): CardWrite {
  let base: Doc;
  let create = false;
  const chunk = isChunkPath(path);
  // Wendungen werden nie angelegt – nur vorhandene Dokumente bekommen ihre Planung (§3.3).
  if (!current && chunk) return { kind: 'skip', reason: 'missing' };
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
  const miss = !chunk && !create && isPartnerMiss(base, a);
  // Partnerwort-Fehler schreibt `last` nicht neu: Doppelschutz über den Verlauf (Eintrag mit diesem Zeitstempel schon da).
  if (miss && Array.isArray(base.hist) && (base.hist as unknown[]).some((h) => isObj(h) && h.t === a.t)) return { kind: 'skip', reason: 'already_applied' };
  const patch = chunk ? chunkPatch(base, a) : cardPatch(base, a);
  if (!(miss ? partnerMissPatchSchema : chunk ? chunkPatchSchema : cardPatchSchema).safeParse(patch).success) return { kind: 'skip', reason: 'invalid_result' };
  const merged = applyUpdate(base, patch);
  if (!validateDoc(path, merged).ok) return { kind: 'skip', reason: 'invalid_result' };
  if (new TextEncoder().encode(JSON.stringify(merged)).length >= MAX_CARD_BYTES) return { kind: 'skip', reason: 'invalid_result' };
  return create ? { kind: 'create', doc: merged } : { kind: 'update', patch };
}
