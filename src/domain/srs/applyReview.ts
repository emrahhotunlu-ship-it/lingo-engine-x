import { z } from 'zod';
import { fsrsSchema, type FsrsStored } from '../../data/schemas';
import { validateDoc } from '../../data/validate';
import { dayKey, isDayKey } from '../date';
import { naOf } from './actBase';
import { flipStage } from './flip';
import { wordFest } from '../tutor/learnerWords';
import { chargeColPatch, COL_MAX } from './collocs';
import { findContext } from './context';
import { stageOf, nextStage } from './ladder';
import { freeCorrectDays, freeDaysNeeded } from './variety';
import { exerciseDef } from './modes';
import { readFsrs, reviewFsrs, isFutureFsrs } from './scheduler';
import { capDaysOf, capDue, dayStartOf, day0Grade, evidenceDays, freshFreeGood, holdOnDay0, introDayOf, knownConfirmed, longGapNow, longGapProven, type FreshAnswer } from './spacing';
import { noteWeight } from './weight';
import { nextWk, restDay, WRONG_MAX } from './werkstatt';
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
/** Wortpartner aus der geprüften Charge, mit der ersten Wortpartner-Antwort ergänzt (nur wenn die Karte noch keine hatte). */
const chargeCollocSchema = z
  .object({ p: z.string().min(3).max(40), de: z.string().min(2).max(80), gap: z.string().min(2).max(20), opts: z.array(z.string().min(2).max(20)).min(2).max(3), ex: z.string().min(15).max(170) })
  .strict();
const chargeColSchema = z.array(chargeCollocSchema).min(1).max(COL_MAX);
/** Wort-Werkstatt (`werkstatt.ts`): Runden, Zeitpunkt, Lerntag. `p` (pausiert) schreibt nur „pausieren“, nie eine Antwort. */
const wkSchema = z.object({ n: z.number().int().min(1).max(99), t: z.number().int().positive(), d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), p: z.literal(1).optional() }).strict();

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
    lg: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pa: z.number().min(0).max(1).optional(),
    ac: z.number().min(0).max(1).optional(),
    co: z.number().min(0).max(1).optional(),
    colN: z.array(z.number().int().min(0)).optional(),
    // Wörter aktivieren, Stufe 2: geschaffte Aktivierungen (Fahrplan A1–A5). NICHT `ac`: das ist die Fähigkeit „Anwenden“ (0–1, alte App).
    na: z.number().int().min(0).max(99).optional(),
    col: chargeColSchema.optional(),
    wk: wkSchema.optional(),
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
    lg: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // Wort-Lernen 2: Aktivierung A1/A2 auch für Wendungen.
    na: z.number().int().min(0).max(99).optional(),
    wk: wkSchema.optional(),
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

type StageAnswer = Pick<AnswerEvent, 't' | 'day' | 'ex' | 'grade' | 'colIndex' | 'interrupted'> & Partial<Pick<AnswerEvent, 'hint' | 'unverified' | 'actStep' | 'actUnverified'>>;

/** Die Antwort in der Form der Abstands-Regeln (`spacing.ts`). Ungeprüfte Antworten (wie `u: 1` im Verlauf) sind kein freier Beleg. */
const freshOf = (a: StageAnswer): FreshAnswer => ({
  t: a.t,
  ex: a.ex,
  grade: a.grade,
  ...(a.colIndex !== undefined ? { colIndex: a.colIndex } : {}),
  ...(a.hint ? { hint: a.hint } : {}),
  ...((a.actStep && a.actUnverified) || a.unverified ? { unverified: true } : {}),
});

/** Einführungstag der Karte: bei einer neuen Karte der Tag dieser Antwort. */
const introDayFor = (cur: Doc, a: Pick<AnswerEvent, 'day'>): string | null => (cur.state === 'new' ? a.day : introDayOf(cur));

/**
 * FSRS-Stand nach der Antwort mit der Tag-0-Regel (Wort-Lernen 2, `spacing.ts`): Am Einführungstag zählt „Leicht“ als „Gut“, und nur ein guter
 * freier Abruf beendet die Lernphase. Die Dämpfung (`weight.ts`) gilt auch beim Übergang aus der Lernphase (`reviewFsrs`).
 */
function plannedFsrs(cur: Doc, a: AnswerEvent): FsrsStored {
  const onIntro = introDayFor(cur, a) === a.day;
  const f = reviewFsrs(readFsrs(cur, a.t), day0Grade(a.grade, onIntro), a.t, noteWeight(a.ex, a.hint ?? 0, a.catchUp === true, a.free === true));
  return onIntro ? holdOnDay0(f, a.t, freshFreeGood(freshOf(a))) : f;
}

/**
 * Abstands-Deckel (Wort-Lernen 2): Nach FSRS wird die Fälligkeit höchstens gekürzt – ≤ 1/3/7/21 Tage je nach Zahl der späteren Tage mit freiem Abruf
 * (mindestens, was die Stufe garantiert), bis die Karte nach dieser Antwort „Fest“ ist oder der freie Abruf nach ≥ 21 Tagen Pause belegt ist. `fsrs.due` und `due` bleiben gleich (Schema); Stabilität und Schwierigkeit bleiben unberührt.
 */
function capPatch(cur: Doc, patch: Doc, a: AnswerEvent): void {
  const f = patch.fsrs as FsrsStored;
  if (f.state !== 2 || festAfter(cur, patch) || longGapProven({ ...cur, ...patch })) return;
  const capped = capDue(f, a.t, capDaysOf(evidenceDays(cur, freshOf(a), introDayFor(cur, a))));
  if (capped === f) return;
  patch.fsrs = capped;
  patch.due = capped.due;
}

/**
 * Wort-Werkstatt (`werkstatt.ts`): Nach dem GELUNGENEN verzögerten Abruf der Werkstatt ruht die Karte 2–3 Lerntage (die FSRS-Fälligkeit gilt, wenn sie
 * dazwischen liegt). Nach einem Fehler (Note 1) bleibt die Fälligkeit, wie FSRS sie rechnet (Lernwissenschaft S5). Stabilität und Schwierigkeit bleiben,
 * wie FSRS sie rechnet; `wk` zählt die Runde (eine je Lerntag).
 */
function wkPatch(cur: Doc, patch: Doc, a: AnswerEvent): void {
  if (!a.wk) return;
  patch.wk = nextWk(cur, a.t, a.day);
  if (a.grade < 2) return;
  const f = patch.fsrs as FsrsStored;
  const day = restDay(dayKey(f.due), a.day);
  const due = dayStartOf(day);
  if (due !== f.due) {
    patch.fsrs = { ...f, due, scheduledDays: Math.max(1, Math.round((due - a.t) / 86_400_000)) };
    patch.due = due;
  }
}

/**
 * Neue Stufe: Aufdecken (`flip`) nach der Stufenregel aus anki-regeln.md §3 (höchstens bis 2, je
 * Antwort höchstens eine Stufe, nie unter 1), sonst die Leiter (`nextStage`).
 */
function stageAfter(cur: Doc, a: StageAnswer): number {
  return stageStep(cur, a).stage;
}

/** Neue Stufe und, wenn nur das Tor der freien Antworten den Aufstieg verhindert, wie viele freie Tage noch fehlen (für die Erklärung, Lernwissenschaft M1). */
export function stageStep(cur: Doc, a: StageAnswer): { stage: number; missing: number } {
  const step = ladderStep(cur, a);
  // Wort-Lernen 2: „Kenne ich“ zählt erst am nächsten Lerntag. Gelingt dann der freie Abruf, gilt die Karte als bekannt (Stufe 3).
  if (step.stage < KNOWN_CONFIRMED_STAGE && knownConfirmed(cur, freshOf(a))) return { stage: KNOWN_CONFIRMED_STAGE, missing: 0 };
  return step;
}

/** Stufe nach „Kenne ich“ und bestandenem freiem Abruf am nächsten Lerntag (wie früher die Prüffrage allein). */
export const KNOWN_CONFIRMED_STAGE = 3;

function ladderStep(cur: Doc, a: StageAnswer): { stage: number; missing: number } {
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
    const fresh = freshOf(a);
    const have = freeCorrectDays(cur, { t: a.t, ex: a.ex, grade: a.grade, ...(a.colIndex !== undefined ? { ci: a.colIndex } : {}), ...(fresh.hint ? { hint: fresh.hint } : {}), ...(fresh.unverified ? { unverified: true } : {}) }, next);
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
/**
 * Verlaufseintrag; `s` = Schlüssel des gezeigten Satzes (V1, nur wenn die Abfrage einen Satz hatte), `a` = Code der Vorgabe eines eigenen Satzes, `u` = ungeprüfte Aktivierung,
 * `ci` = Index des Partnerworts (Treffer am Partnerwort ist kein freier Beleg für das Hauptwort), `h` = Zahl der Tipps (1–2; Korrektur 21.10.2026: mit Tipp kein freier Beleg).
 */
function histEntry(a: AnswerEvent, mode: LegacyMode): Record<string, unknown> {
  const v = a.grade === 1 && a.wrong ? a.wrong.trim().slice(0, WRONG_MAX) : '';
  return { t: a.t, m: mode, g: a.grade, x: a.ex, ...(a.sx ? { s: a.sx } : {}), ...(a.act ? { a: a.act } : {}), ...((a.actStep && a.actUnverified) || a.unverified ? { u: 1 } : {}), ...(a.colIndex !== undefined && a.colIndex >= 0 ? { ci: a.colIndex } : {}), ...(a.hint ? { h: a.hint } : {}), ...(v ? { v } : {}) };
}

export function levelFor(ex: ExerciseId, stage: number): number {
  const level = exerciseDef(ex).level;
  return ex === 'dictation' ? Math.min(level, Math.max(1, stage) + 1) : level;
}

/** Erster Fest-Tag (`ff`, P22): einmal gesetzt, sobald die Karte nach dieser Antwort fest sitzt (dieselbe Regel wie die Anzeige: Stufe 5, Stabilität ≥ 21 Tage, im neuen Satz gekonnt, Paket ST); nie überschrieben. */
function festPatch(cur: Doc, patch: Doc, day: string): void {
  if (typeof cur.ff === 'string' && cur.ff) return;
  if (festAfter(cur, patch)) patch.ff = day;
}

/** Sitzt die Karte nach dieser Antwort fest (Stand `cur` + `patch`, ohne Uhrzeit)? Dieselbe Regel wie die Anzeige (`wordFest`). */
function festAfter(cur: Doc, patch: Doc): boolean {
  const f = patch.fsrs as FsrsStored | undefined;
  if (typeof patch.stage !== 'number' || !f) return false;
  // Ursprungssatz wie in der Anzeige: Vokabel = Satz in `ex`, Wendung = aufgewertete Fassung (`src.upgraded`).
  const up = (cur.src as { upgraded?: unknown } | undefined)?.upgraded;
  const hit = typeof cur.ex === 'string' && typeof cur.word === 'string' ? findContext(cur.ex, cur.word) : null;
  const context = hit ? { sentence: hit.sentence } : typeof up === 'string' && up ? { sentence: up } : null;
  return wordFest({ isNew: false, stage: patch.stage as 0, fsrs: f, doc: { ...cur, ...patch }, context });
}

/** Gespeicherter Wert von `lapses` (Feld der alten App), nur um +1 bei einem echten Rückfall erhöht; das Maximum mit `fsrs.lapses` bildet allein der Leser (`lapsesOf`). */
const storedLapses = (cur: Doc): number => Math.max(0, Math.round(num(cur.lapses)));

/** Echter Rückfall: „Nochmal“ bei einer Karte, die nicht neu ist, und nicht am Einführungstag (dort ist ein Fehler Teil des Lernens, Korrektur 21.10.2026). */
const isLapse = (cur: Doc, a: AnswerEvent): boolean => a.grade === 1 && cur.state !== 'new' && introDayFor(cur, a) !== a.day;

/**
 * Pausenbeleg `lg` (Korrektur 21.10.2026): beim ersten guten freien Abruf nach ≥ 21 Lerntagen Pause der Lerntag dieser Antwort; einmal gesetzt, nie überschrieben.
 * Vor `capPatch` und `festPatch`, damit dieselbe Antwort den Deckel aufhebt und „Fest“ möglich macht.
 */
function lgPatch(cur: Doc, patch: Doc, a: AnswerEvent): void {
  if (isDayKey(cur.lg)) return;
  if (longGapNow(cur, freshOf(a))) patch.lg = a.day;
}

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
    col: chargeColSchema.optional(),
  })
  .strict();

function partnerMissPatch(cur: Doc, a: AnswerEvent): Doc {
  const def = exerciseDef(a.ex);
  const modes = isObj(cur.modes) ? cur.modes : {};
  const prevMode = isObj(modes[def.mode]) ? (modes[def.mode] as Doc) : {};
  const xs = isObj(cur.xs) ? cur.xs : {};
  const prevXs = isObj(xs[a.ex]) ? (xs[a.ex] as Doc) : {};
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  const charge = chargeColPatch(cur, a.colIndex);
  const col: unknown[] = charge ?? (Array.isArray(cur.col) ? (cur.col as unknown[]) : []);
  return {
    modes: { [def.mode]: { c: Math.round(num(prevMode.c)), w: Math.round(num(prevMode.w)) + 1 } },
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)), w: Math.round(num(prevXs.w)) + 1 } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
    ...skillPatch(cur, def.mode, 1, a.colIndex, col.length),
    ...(charge ? { col: charge } : {}),
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
  const f = plannedFsrs(cur, a);
  const modes = isObj(cur.modes) ? cur.modes : {};
  const prevMode = isObj(modes[def.mode]) ? (modes[def.mode] as Doc) : {};
  const xs = isObj(cur.xs) ? cur.xs : {};
  const prevXs = isObj(xs[a.ex]) ? (xs[a.ex] as Doc) : {};
  const ok = a.grade > 1 ? 1 : 0;
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  // Charge `col`: Die Übung zeigte die geprüften Wortpartner der Charge (Karte ohne eigene); mit dieser Antwort werden sie ergänzt, damit `colIndex`/`colN` dazu passen.
  const charge = def.mode === 'colloc' ? chargeColPatch(cur, a.colIndex) : null;
  const col: unknown[] = charge ?? (Array.isArray(cur.col) ? (cur.col as unknown[]) : []);
  const patch: Doc = {
    fsrs: f,
    S: Math.min(round4(f.stability), 365),
    D: Math.min(10, Math.max(1, round4(f.difficulty))),
    due: f.due,
    last: a.t,
    state: f.state === 2 ? 'review' : 'learning',
    reps: Math.max(0, Math.round(num(cur.reps))) + 1,
    lapses: storedLapses(cur) + (isLapse(cur, a) ? 1 : 0),
    stage: stageAfter(cur, a),
    modes: { [def.mode]: { c: Math.round(num(prevMode.c)) + ok, w: Math.round(num(prevMode.w)) + (1 - ok) } },
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)) + ok, w: Math.round(num(prevXs.w)) + (1 - ok) } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
    ...skillPatch(cur, def.mode, a.grade, a.colIndex, col.length),
    // Aktivierung geschafft (Note ≥ 2, von Claude geprüft, ohne Hilfe): der Zähler `na` steigt im selben Schreibschritt wie die Antwort. Er ist abgeleitet und aus `act/…` neu berechenbar.
    ...(a.actStep && a.grade >= 2 && !a.actUnverified ? { na: Math.min(99, naOf(cur) + 1) } : {}),
    ...(charge ? { col: charge } : {}),
  };
  // Nur ergänzen: ein vorhandenes Einführungsdatum der alten App bleibt stehen (Kap. 9, Regel 2).
  if (wasNew && (typeof cur.intro !== 'string' || !cur.intro)) patch.intro = a.day;
  lgPatch(cur, patch, a);
  capPatch(cur, patch, a);
  wkPatch(cur, patch, a);
  festPatch(cur, patch, a.day);
  return patch;
}

/** Patch für eine Wendung (§3.3): Planung wie Karten, keine Fähigkeitswerte. */
export function chunkPatch(cur: Doc, a: AnswerEvent): Doc {
  const def = exerciseDef(a.ex);
  const wasNew = cur.state === 'new';
  const f = plannedFsrs(cur, a);
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
    lapses: storedLapses(cur) + (isLapse(cur, a) ? 1 : 0),
    stage: stageAfter(cur, a),
    xs: { [a.ex]: { c: Math.round(num(prevXs.c)) + ok, w: Math.round(num(prevXs.w)) + (1 - ok) } },
    hist: [...hist, histEntry(a, def.mode)].slice(-HIST_MAX),
    ...(a.actStep && a.grade >= 2 && !a.actUnverified ? { na: Math.min(99, naOf(cur) + 1) } : {}),
  };
  const mode = chunkMode(a.ex);
  if (mode) {
    const modes = isObj(cur.modes) ? cur.modes : {};
    const prev = isObj(modes[mode]) ? (modes[mode]) : {};
    patch.modes = { [mode]: { c: Math.round(num(prev.c)) + ok, w: Math.round(num(prev.w)) + (1 - ok) } };
  }
  if (wasNew && (typeof cur.intro !== 'string' || !cur.intro)) patch.intro = a.day;
  lgPatch(cur, patch, a);
  capPatch(cur, patch, a);
  wkPatch(cur, patch, a);
  festPatch(cur, patch, a.day);
  return patch;
}

/**
 * P52 „Welches Wort passt?“ falsch (Kartenwort gewählt): NUR ein Verlaufseintrag `{x: 'contrast', g: 1}`. Er zählt für „schwach“ (Fehler der
 * letzten 14 Tage); Planung und Zähler (`fsrs`, `S`, `D`, `due`, `last`, `lapses`, `stage`, `reps`, `modes`, `xs`) bleiben unberührt.
 * `null` = nichts zu schreiben (kein/ungültiges/ausgeblendetes Dokument, Eintrag mit diesem Zeitstempel schon da, Ergebnis zu groß).
 */
export function contrastMissOp(path: string, cur: Doc | undefined, a: AnswerEvent): { update: Doc } | null {
  return noteOnlyOp(path, cur, { ...a, grade: 1 });
}

/**
 * Nur ein Verlaufseintrag, Planung und Zähler bleiben unberührt (wie `contrastMissOp`). „Sag es“ ohne erkanntes Zielwort (Lernwissenschaft S7):
 * `{x: 'say_it', g: 2, u: 1}` – die Spracherkennung kann das Wort verhört haben; kein Fehler, kein Beleg, keine FSRS-Änderung.
 */
export function noteOnlyOp(path: string, cur: Doc | undefined, a: AnswerEvent): { update: Doc } | null {
  if (!cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  const hist: unknown[] = Array.isArray(cur.hist) ? (cur.hist as unknown[]) : [];
  if (hist.some((h) => typeof h === 'object' && h !== null && (h as Doc).t === a.t)) return null;
  const patch: Doc = { hist: [...hist, histEntry(a, exerciseDef(a.ex).mode)].slice(-HIST_MAX) };
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
