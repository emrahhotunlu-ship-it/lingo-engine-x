import { dayKey, daysBetween } from '../date';
import { activationReady, recallDays } from './brief';
import { activationUnitsOn, lastActivation, naOf } from './actBase';
import type { ActStep } from './actBrief';
import { CORE_SRC, isCoreWord } from './coreWord';
import type { QueueItem, TrainCard } from './types';

// Fahrplan der Aktivierung (Wörter aktivieren, Stufe 2; docs/umbau/aktivierung.md). Rein, ohne Zufall und ohne Schreiben.
// Jedes Wort bekommt der Reihe nach A1 gestützt → A2 neue Lage → A3 umformen → A4 ohne gezeigtes Wort (→ A5 bei Kernwörtern). Wann ein Schritt dran ist,
// bestimmt die Karte selbst: Stufe, richtige Abrufe an verschiedenen Tagen und der Mindestabstand zur vorigen Aktivierung. Es gibt keinen zweiten Zeitplan:
// Eine Aktivierung ERSETZT die fällige Wiederholung der Karte (FSRS bewertet die Antwort wie jede andere), sie kommt nie zusätzlich.

// Das Tagesbudget zählt Satz-Einheiten, nicht Aufgaben (Lernwissenschaft M3): Kundenmail 2, Kombi-Satz 1,5, alles andere 1 (`unitsOfCode`).
// Eine Mini-Szene dauert am Handy etwa eine Minute, eine Kundenmail mit drei Schichten Rückmeldung etwa drei.
/** Satz-Einheiten am Tag (ohne Rückstand). */
export const ACT_DAY_UNITS = 4;
/** Kosten eines Schritts bei der Planung: A5 ist Kombi-Satz (1,5) oder Kundenmail (2), das Format steht erst beim Bauen fest – geplant wird mit dem Höchstwert. */
export const STEP_UNITS: Readonly<Record<ActStep, number>> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 };
/** Ab so vielen überfälligen Karten gibt es höchstens `ACT_BACKLOG_UNITS` Einheiten am Tag, und nur noch A4 (keine Kundenmail, kein Kombi-Satz). */
export const ACT_BACKLOG_HIGH = 40;
export const ACT_BACKLOG_UNITS = 2;
/** Ab so vielen überfälligen Karten gibt es keine Aktivierung mehr (die Zeit gehört dem Wiederholen). */
export const ACT_BACKLOG_NONE = 80;

/** Mindestabstand (Tage) zur vorigen Aktivierung derselben Karte, je Schritt. A1 braucht keinen. */
export const MIN_GAP_DAYS: Readonly<Record<ActStep, number>> = { 1: 0, 2: 5, 3: 10, 4: 14, 5: 14 };
/** Nach einer gescheiterten Aktivierung (Note 1) wird derselbe Schritt frühestens nach so vielen Tagen wiederholt. */
export const RETRY_GAP_DAYS = 3;
/** Nach dem vollen Fahrplan hält eine A4-Aktivierung das Wort „einsatzbereit“: frühestens nach so vielen Tagen. */
export const MAINTENANCE_GAP_DAYS = 45;

/** Freigabe je Schritt: Stufe der Karte und richtige Abrufe an verschiedenen Tagen (Antworten mit Note ≥ 2, Aufdecken zählt nicht). */
export const STEP_RULES: Readonly<Record<ActStep, { stage: number; recallDays: number }>> = {
  1: { stage: 3, recallDays: 2 },
  2: { stage: 4, recallDays: 3 },
  3: { stage: 4, recallDays: 3 },
  4: { stage: 5, recallDays: 4 },
  5: { stage: 5, recallDays: 4 },
};

/** Vorrang bei knappem Platz: A4 und A5 vor A3 vor A2 vor A1. */
export const STEP_RANK: Readonly<Record<ActStep, number>> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };

/** Kernwörter bekommen A5: Wörter aus Lektionen, Startwortschatz und den C1-Paketen (oder ausdrücklich `core: true` auf der Karte). */
export { CORE_SRC, isCoreWord };

/** Der nächste Schritt nach `na` geschafften Aktivierungen; `null` = Fahrplan durch. */
export function nextStep(na: number, core: boolean): ActStep | null {
  if (na <= 0) return 1;
  if (na === 1) return 2;
  if (na === 2) return 3;
  if (na === 3) return 4;
  return na === 4 && core ? 5 : null;
}

export type DueStep = { step: ActStep; /** Erhaltungs-Aktivierung (A4) nach dem vollen Fahrplan. */ maintenance: boolean };

/** Lerntage (Wechsel 04:00) zwischen der letzten Aktivierung und heute: Abstände zählen in Lerntagen, nicht in Stunden. */
const gapDays = (lastT: number, day: string): number => daysBetween(dayKey(lastT), day);

/**
 * Welcher Schritt wäre für diese Karte heute dran, wenn Platz ist? `null`, wenn nicht (Wendung, ausgeblendet, zu früh, Stufe zu niedrig, heute schon
 * aktiviert, Abstand nicht erreicht, Fahrplan durch). `day` = Lerntag (Wechsel 04:00).
 */
export function dueStep(card: Pick<TrainCard, 'kind' | 'hidden' | 'stage' | 'src' | 'doc'>, day: string): DueStep | null {
  if (card.kind !== 'vocab' || card.hidden) return null;
  const na = naOf(card.doc);
  const last = lastActivation(card.doc);
  if (last && dayKey(last.t) === day) return null;
  let step = nextStep(na, isCoreWord(card));
  let maintenance = false;
  if (step === null) {
    // Fahrplan durch: alle 45 Tage eine A4-Aktivierung, damit das Wort „einsatzbereit“ bleibt.
    if (!last || gapDays(last.t, day) < MAINTENANCE_GAP_DAYS) return null;
    step = 4;
    maintenance = true;
  }
  const rule = STEP_RULES[step];
  if (card.stage < rule.stage || (step === 1 ? !activationReady({ stage: card.stage, doc: card.doc }) : recallDays(card.doc) < rule.recallDays)) return null;
  if (last) {
    const gap = last.g < 2 ? RETRY_GAP_DAYS : MIN_GAP_DAYS[step];
    if (gapDays(last.t, day) < gap) return null;
  }
  return { step, maintenance };
}

/** Wie viele Satz-Einheiten sind heute noch erlaubt? Tagesgrenze 4, bei Rückstand weniger (ab 40 höchstens 2, ab 80 keine). `doneUnits` = schon gemachte Einheiten. */
export function remainingToday(doneUnits: number, overdue: number): number {
  const max = overdue >= ACT_BACKLOG_NONE ? 0 : overdue >= ACT_BACKLOG_HIGH ? ACT_BACKLOG_UNITS : ACT_DAY_UNITS;
  return Math.max(0, max - doneUnits);
}

export type PlanIn = {
  /** Reihenfolge der Runde (nur `due` + `quiz` kommen in Frage). */
  queue: readonly QueueItem[];
  cards: ReadonlyMap<string, TrainCard>;
  pool: readonly TrainCard[];
  day: string;
  /** Anzahl überfälliger Karten (Rückstand, `overdueCount`). */
  overdue: number;
  /** Claude muss erreichbar sein: ohne Prüfung zählt keine Aktivierung (Noten höchstens „Schwer“, „ungeprüft“). */
  ai: boolean;
  /** Optional: Nur Karten, die in dieser Runde getippt abgefragt werden, bekommen einen Platz (Aufdeckkarten im Aufholmodus lassen ihn sonst verfallen, Lernwissenschaft N1). */
  allow?: (key: string) => boolean;
};

/**
 * Plan der Runde: welche fälligen Karten bekommen eine Aktivierung statt der gewöhnlichen Wiederholung (Schlüssel → Schritt)? Feste Reihenfolge
 * (Vorrang A4/A5 > A3 > A2 > A1, dann die am längsten fällige Karte), Obergrenze in Satz-Einheiten (`remainingToday`), bei Rückstand ab 40 nur A4. Gleicher Stand, gleicher
 * Plan: Beim Neuzeichnen würfelt nichts.
 */
export function planActivations(i: PlanIn): Map<string, DueStep> {
  const out = new Map<string, DueStep>();
  if (!i.ai) return out;
  let room = remainingToday(activationUnitsOn(i.pool.map((c) => c.doc), i.day), i.overdue);
  if (room <= 0) return out;
  const high = i.overdue >= ACT_BACKLOG_HIGH;
  const cands: Array<{ key: string; due: DueStep; at: number }> = [];
  const seen = new Set<string>();
  for (const q of i.queue) {
    if (q.reason !== 'due' || q.phase !== 'quiz' || seen.has(q.key) || (i.allow && !i.allow(q.key))) continue;
    seen.add(q.key);
    const card = i.cards.get(q.key);
    if (!card) continue;
    const due = dueStep(card, i.day);
    if (!due || (high && due.step !== 4)) continue;
    cands.push({ key: q.key, due, at: card.fsrs.due });
  }
  cands.sort((a, b) => STEP_RANK[b.due.step] - STEP_RANK[a.due.step] || a.at - b.at || a.key.localeCompare(b.key));
  for (const c of cands) {
    const cost = STEP_UNITS[c.due.step];
    if (cost > room) continue;
    out.set(c.key, c.due);
    room -= cost;
    if (room <= 0) break;
  }
  return out;
}
