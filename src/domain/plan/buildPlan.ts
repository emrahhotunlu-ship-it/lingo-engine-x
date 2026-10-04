import { lessonDoneOn } from '../course/courseDone';
import { entryCardKey } from '../progress/logPatch';
import type { DutyChannel } from '../learn/types';
import type { RoundPlan } from '../srs/queue';
import { DUTY_CH_MINUTES, DUTY_MINUTES, DUTY_ROUND, isPickableDuty, isUnitDutyChannel, PHASE2_EXECUTABLE, STORED_DUTY_CHANNELS, UNIT_CH_MINUTES, type RankedChannel } from './channels';
import { readUnitMeta } from './unitMeta';
import type { DutyId, DutyState, StoredPlan, TodayState, WhyKey } from './types';

// Ein Plan je Lerntag, nie neu gewürfelt (Kap. 15). Der Plan ist eine reine Funktion der Daten.
//
// Phase 2 (phase2-plan §6.1): Mit `phase2` entsteht ein neuer Plan mit Pflicht
// „Wiederholen + Lektion + 1 Pflichtkanal" und zwei Angeboten. Ein schon gespeicherter Plan
// von heute bleibt IMMER unverändert – auch ein Phase-1-Plan nach einem Update mitten am Tag.
// Die neue Pflicht gilt damit erst ab dem nächsten Lerntag (R4).

type Doc = Record<string, unknown>;

/** Kanäle, die die Phase-1-Ausbaustufe ausführen kann (keine – nur „Wiederholen"). */
export const EXECUTABLE_CHANNELS: readonly string[] = [];

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const nonNeg = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined);

/** Gespeicherten Plan lesen; `null`, wenn er nicht von diesem Tag oder nicht von dieser App ist. */
export function readPlan(v: unknown, today: string): StoredPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Doc;
  if (p.d !== today || p.v !== 1) return null;
  const goal = p.goal && typeof p.goal === 'object' ? (p.goal as Doc) : {};
  const g: StoredPlan['goal'] = { review: nonNeg(goal.review) ?? 0 };
  for (const k of ['due', 'new', 'ahead', 'ch'] as const) {
    const x = nonNeg(goal[k]);
    if (x !== undefined) g[k] = x;
  }
  const out: StoredPlan = {
    d: today,
    ids: isStrArr(p.ids) ? p.ids : [],
    why: Array.isArray(p.why) ? (p.why as WhyKey[][]) : [],
    v: 1,
    duty: isStrArr(p.duty) ? (p.duty as StoredPlan['duty']) : [],
    goal: g,
    lesson: typeof p.lesson === 'string' ? p.lesson : null,
    at: typeof p.at === 'number' ? p.at : 0,
  };
  // Neubau (P1, additiv): eingefrorene Eckdaten der Tageseinheit, tolerant gelesen.
  const u = readUnitMeta(p.u);
  if (u) out.u = u;
  return out;
}

/** Ist das ein Plan mit Phase-2-Pflicht (Pflichtkanal)? Nur dann darf `pflichtSince` gesetzt werden. */
export const isPhase2Plan = (p: StoredPlan | null): boolean => !!p && p.duty.some((d) => d.startsWith('ch:'));

/** Pflichtkanal eines Plans (`ch:<id>`), sonst `null`. */
export function dutyChannelOf(p: StoredPlan | null): string | null {
  const d = p?.duty.find((x) => x.startsWith('ch:'));
  return d ? d.slice(3) : null;
}

export type Phase2PlanInput = {
  /** Machbare Kanäle nach Punktzahl (`rankChannels`). */
  ranked: readonly RankedChannel[];
  /** Nächste offene Lektion (`pickLesson`); `null` = Kurs abgeschlossen. */
  lesson: { lid: string } | null;
  /** Phase 6 (Plan E11, §5.3): Tagesziel in Minuten; bestimmt das Budget des Pflichtkanals. */
  goalMin?: number;
  /**
   * „Sag es“ (Lernberatung V1/V2): heute ist ein Sag-es-Tag (`isSayDay`) UND Claude ist verfügbar.
   * Dann ist „Sag es“ der Pflichtkanal, die beiden bestplatzierten Kanäle bleiben Angebote.
   */
  say?: boolean;
};

/** Minuten je Pflichtkanal-Runde (Plan §5.1). */
const DUTY_CH_MIN = DUTY_CH_MINUTES;
/** Sekunden je Karte beim Wiederholen (Plan §5.3). */
const REVIEW_SEC_PER_CARD = 27;

/**
 * Pflichtkanal (Plan §5.3): der am höchsten eingestufte Pflichtkanal, der ins Minutenbudget passt
 * (`goalMin − Lektion − Wiederholen`), sonst der kürzeste. Ohne `goalMin` der erste nach Rang.
 */
export function pickDutyChannel(ranked: readonly RankedChannel[], i: { goalMin?: number; lesson: boolean; reviewCards: number }): RankedChannel | null {
  const duties = ranked.filter((r) => isPickableDuty(r.id));
  if (!duties.length) return null;
  if (i.goalMin === undefined) return duties[0] ?? null;
  const budget = i.goalMin - (i.lesson ? DUTY_MINUTES.lesson : 0) - Math.ceil((i.reviewCards * REVIEW_SEC_PER_CARD) / 60);
  const fits = duties.find((r) => DUTY_CH_MIN[r.id as DutyChannel] <= budget);
  if (fits) return fits;
  return [...duties].sort((a, b) => DUTY_CH_MIN[a.id as DutyChannel] - DUTY_CH_MIN[b.id as DutyChannel])[0] ?? null;
}

function phase2Plan(today: string, round: RoundPlan, nowMs: number, p2: Phase2PlanInput, fromLegacy: { ids: string[]; why: WhyKey[][] } | null): StoredPlan {
  let ids: string[];
  let why: WhyKey[][];
  if (fromLegacy) {
    ids = fromLegacy.ids;
    why = fromLegacy.why;
  } else {
    const duty: { id: string; why: WhyKey[] } = p2.say
      ? { id: 'say', why: [['whySay']] }
      : (pickDutyChannel(p2.ranked, { goalMin: p2.goalMin, lesson: !!p2.lesson, reviewCards: round.target }) ?? { id: 'gram', why: [['whyRotation']] });
    const offers = p2.ranked.filter((r) => r.id !== duty.id).slice(0, 2);
    ids = [duty.id, ...offers.map((o) => o.id)];
    why = [duty.why, ...offers.map((o) => o.why)];
  }
  const ch = ids[0] as DutyChannel;
  const dutyIds: DutyId[] = [];
  if (round.target > 0) dutyIds.push('review');
  // Lektion 2–3× je Woche statt täglich (Lernberatung 27.09.): an „Sag es"-Tagen ist sie Angebot.
  const lessonDuty = !!p2.lesson && !p2.say;
  if (lessonDuty) dutyIds.push('lesson');
  dutyIds.push(`ch:${ch}`);
  return {
    d: today,
    ids,
    why,
    v: 1,
    duty: dutyIds,
    goal: { review: round.target, due: round.due, new: round.new, ahead: round.ahead, ch: DUTY_ROUND[ch] },
    lesson: p2.lesson?.lid ?? null,
    at: nowMs,
  };
}

/**
 * Plan für heute:
 * - schon ein Plan dieser App von heute → unverändert (auch nach einem Update mitten am Tag);
 * - Plan der alten App von heute, alle Kanäle ausführbar (Phase 2: und `ids[0]` ist Pflichtkanal) → übernehmen;
 * - sonst ein neuer, vollständiger Plan (fester Schlüsselsatz, weil `update` verschmilzt).
 */
export function buildPlan(i: { today: string; existing: unknown; round: RoundPlan; nowMs: number; phase2?: Phase2PlanInput }): { plan: StoredPlan; changed: boolean } {
  const kept = readPlan(i.existing, i.today);
  if (kept) return { plan: kept, changed: false };
  const ex = i.existing && typeof i.existing === 'object' ? (i.existing as Doc) : null;
  const legacyToday = ex && ex.d === i.today && ex.v === undefined && isStrArr(ex.ids) ? { ids: ex.ids, why: Array.isArray(ex.why) ? (ex.why as WhyKey[][]) : [] } : null;
  if (i.phase2) {
    const ok = legacyToday && legacyToday.ids.length > 0 && legacyToday.ids.every((id) => (PHASE2_EXECUTABLE as readonly string[]).includes(id)) && isPickableDuty(legacyToday.ids[0] ?? '');
    return { plan: phase2Plan(i.today, i.round, i.nowMs, i.phase2, ok ? legacyToday : null), changed: true };
  }
  const duty: StoredPlan['duty'] = i.round.target > 0 ? ['review'] : [];
  const base = { v: 1 as const, duty, goal: { review: i.round.target }, lesson: null, at: i.nowMs };
  if (legacyToday && legacyToday.ids.every((id) => EXECUTABLE_CHANNELS.includes(id))) {
    return { plan: { d: i.today, ...legacyToday, ...base }, changed: true };
  }
  return { plan: { d: i.today, ids: [], why: [], ...base }, changed: true };
}

/** Minuten eines Pflichtkanals (`say` 8, sonst 5; Blöcke der Tageseinheit laut `UNIT_CH_MINUTES`). */
export const dutyChannelMinutes = (ch: string): number =>
  isUnitDutyChannel(ch) ? UNIT_CH_MINUTES[ch] : (STORED_DUTY_CHANNELS as readonly string[]).includes(ch) ? DUTY_CH_MINUTES[ch as DutyChannel] : 5;

/** Minuten der Pflicht laut Plan (D4, P-06; Tageseinheit: eingefrorene Minuten). */
export function dutyMinutes(p: StoredPlan): number {
  if (p.u) return p.u.min;
  let m = 0;
  for (const d of p.duty) m += d === 'review' ? 10 : d === 'lesson' ? 12 : dutyChannelMinutes(d.slice(3));
  return m;
}

export type DayEntry = { t?: unknown; id?: unknown; k?: unknown; ok?: unknown; ctx?: unknown; q?: unknown; type?: unknown; n?: unknown };

/** Einträge von Datenbank und Puffer zusammenführen, doppelte (gleiches t|id) nur einmal. */
export function mergeEntries(live: readonly DayEntry[], pending: readonly DayEntry[]): DayEntry[] {
  const k = (e: DayEntry) => `${String(e.t)}|${String(e.id ?? e.q)}`;
  const seen = new Set(live.map(k));
  return [...live, ...pending.filter((e) => !seen.has(k(e)))];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

export type DeriveInput = {
  day: string;
  plan: StoredPlan | null;
  entries: readonly DayEntry[];
  minutes: number;
  /** `app/profile.pflicht[tag]` ist gesetzt: alle Punkte gelten als erledigt. */
  pflichtMarked?: boolean;
  /** Die Pflichtrunde „Wiederholen" ist erschöpft (nichts mehr abzufragen). */
  exhausted?: boolean;
  course?: Readonly<Obj> | null;
  /** `app/profile.act` (live). */
  act?: unknown;
  /** Noch nicht bestätigt Gespeichertes (live ⊕ Puffer, Kap. 2.2). */
  pending?: { lessonDays: readonly string[]; rounds: ReadonlyArray<{ day: string; act: string; partial: boolean }> };
};

/**
 * Die EINE Ableitung für Statuszeile, Zähler, Häkchen, Heldenkarte und Knopf (Kap. 2.2):
 * - review: verschiedene Karten (Vokabeln `k:'v'`, Wendungen `type:'chunk'`) mit `ctx:'rev'` im Tagesprotokoll, gedeckelt;
 * - lesson: irgendeine Lektion heute abgeschlossen (D10), live ⊕ Puffer;
 * - ch:<id>: `act[tag][id] ≥ 1` ohne `~` (D9), live ⊕ Puffer.
 * Freiwillige Extra-Antworten und Einträge ohne `ctx` zählen nie zur Pflicht (Kap. 15).
 */
export function deriveToday(i: DeriveInput): TodayState {
  const reviewed = new Set<string>();
  let extra = 0;
  let correct = 0;
  let answers = 0;
  let talks = 0;
  let biz = 0;
  let repaired = 0;
  for (const e of i.entries) {
    // Phase 3 (Plan §3.7): Gespräche und Business-Einheiten sind keine Antworten der Trefferquote.
    if (e.type === 'speak') {
      talks++;
      continue;
    }
    if (e.type === 'biz') {
      biz++;
      continue;
    }
    // „Sag es“: eine freie Antwort, keine Antwort der Trefferquote (Pflicht zählt über `act.say`).
    if (e.type === 'say' || e.type === 'fluency') continue;
    // „Eine Botschaft, drei Tonlagen“: freiwillig, keine Antwort der Trefferquote.
    if (e.type === 'tones') continue;
    answers++;
    if (e.ok === true) correct++;
    if (e.type === 'repair' && e.ok === true) repaired++;
    const cardKey = entryCardKey(e);
    if (e.ctx === 'rev' && cardKey) reviewed.add(cardKey);
    if (e.ctx === 'xtra') extra++;
  }
  const balance = { answers, correct, minutes: Math.max(0, Math.round(i.minutes)), talks, biz, repaired };
  const noDuties = { done: 0, total: 0, missing: [] as DutyId[], items: [] as DutyState[] };
  if (!i.plan) return { day: i.day, status: 'noPlan', duties: noDuties, review: { done: 0, total: 0 }, extra, balance };

  const total = i.plan.duty.includes('review') ? i.plan.goal.review : 0;
  const reviewDone = Math.min(total, reviewed.size);
  const dayAct = obj(obj(i.act)[i.day]);
  const pendingRounds = i.pending?.rounds ?? [];
  const items: DutyState[] = i.plan.duty.map((id): DutyState => {
    let done: boolean;
    let progress: DutyState['progress'] = null;
    if (id === 'review') {
      done = reviewDone >= total || !!i.exhausted;
      progress = { done: reviewDone, total };
    } else if (id === 'lesson') {
      done = lessonDoneOn(i.course, i.day) || !!i.pending?.lessonDays.includes(i.day);
    } else {
      const ch = id.slice(3);
      const live = typeof dayAct[ch] === 'number' && (dayAct[ch]) >= 1;
      done = live || pendingRounds.some((r) => r.day === i.day && r.act === ch && !r.partial);
    }
    if (i.pflichtMarked) done = true;
    return { id, state: done ? 'done' : 'open', progress };
  });
  const doneN = items.filter((x) => x.state === 'done').length;
  const duties = { done: doneN, total: items.length, missing: items.filter((x) => x.state === 'open').map((x) => x.id), items };
  const status: TodayState['status'] = items.length === 0 ? 'nothing' : doneN >= items.length ? 'allDone' : 'open';
  return { day: i.day, status, duties, review: { done: reviewDone, total }, extra, balance };
}
