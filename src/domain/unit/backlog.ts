import { learningDayStart } from '../date';
import type { TrainCard } from '../srs/types';
import { NEW_MIN } from './block1';

// Rückstand-Steuerung des Tagesplans (Emrah 02.10.2026: „Wie intelligent ist der Anki-Modus wirklich?“).
// Befund aus der Langzeit-Simulation (tests/unit/backlogSim.test.ts, 120 Tage, fester Startstand mit 52 überfälligen
// Karten): Mit dem festen 8-Minuten-Budget wuchs der Berg fälliger Karten von 60 auf 256 bis 370, die Trefferquote reifer
// Karten fiel von 0,89 auf 0,79 bis 0,83. Zwei einfache Regeln halten ihn klein (Berg ≤ 81, Trefferquote ≥ 0,87):
//   1. Je überfälliger Karte (gestern oder früher fällig) kommen 8 Sekunden Wiederholzeit dazu, höchstens +50 %.
//   2. Ab 15 überfälligen Karten kommt nur noch die Mindestzahl neuer Wörter (Kap. 15: nie ganz null).
// Reine Funktionen, keine Daten werden geschrieben: der Umfang wird mit dem Tagesplan eingefroren.

/** Zusätzliche Sekunden Wiederholzeit je überfälliger Karte. */
export const BACKLOG_SEC_PER_CARD = 8;
/** Mehr als +50 % der Grundzeit gibt es nie (Tagesziel, Motivation). */
export const BACKLOG_MAX_SHARE = 0.5;
/** Ab so vielen überfälligen Karten werden neue Wörter auf die Mindestzahl gebremst. */
export const BACKLOG_BRAKE_AT = 15;

/** Im Alltag kommen höchstens so viele neue Wörter am Tag (40 % der Wiederholzeit, `week/review.ts`): Grundlage für „reicht für n Tage“. */
export const NEW_TYPICAL_MAX = 5;

/** Karten, die gestern oder früher fällig waren (Lerntag beginnt um 04:00 Uhr). Neue Karten zählen nie. */
export function overdueCount(cards: readonly TrainCard[], nowMs: number): number {
  const start = learningDayStart(nowMs);
  let n = 0;
  for (const c of cards) if (!c.hidden && !c.isNew && c.fsrs.due < start) n++;
  return n;
}

/** Wiederholzeit in Sekunden: Grundzeit plus Rückstands-Zuschlag. */
export function backlogBudget(baseSec: number, overdue: number): number {
  const base = Number.isFinite(baseSec) && baseSec > 0 ? baseSec : 0;
  const extra = Math.min(Math.round(base * BACKLOG_MAX_SHARE), Math.max(0, overdue) * BACKLOG_SEC_PER_CARD);
  return base + extra;
}

/** Sind so viele Karten überfällig, dass neue Wörter pausieren (bis auf die Mindestzahl)? */
export const backlogBraked = (overdue: number): boolean => overdue >= BACKLOG_BRAKE_AT;

/** Wie viele neue Wörter am Tag wirklich kommen (Kontingent als Obergrenze; bei Rückstand `NEW_MIN` = 2, sonst im Alltag höchstens 3). */
export function expectedNewPerDay(quota: number, braked: boolean): number {
  const q = Number.isFinite(quota) && quota > 0 ? Math.floor(quota) : 0;
  return Math.min(q, braked ? NEW_MIN : NEW_TYPICAL_MAX);
}

// Kapazitätsregel (Methodenplan Lernwissenschaft 02.10.2026): Wie viele neue Wörter heute Platz haben, hängt davon ab, wie viel
// Wiederholarbeit in den nächsten Tagen ohnehin kommt. Budget B Minuten Wortschatz je Tag; ein neues Wort kostet 50 s Einführung
// plus rund 90 s Wiederholungen im ersten Monat (6–8 Wiederholungen, Prüfung Lernwissenschaft: 72 war zu niedrig). Untergrenze `NEW_MIN` (Kap. 15), Obergrenze 5 (mehr ist dauerhaft nicht tragbar).

/** Wortschatz-Zeit je Tag in Sekunden (12 Minuten). */
export const VOCAB_BUDGET_SEC = 720;
/** Sekunden, die ein neues Wort im ersten Monat insgesamt je Tag erzeugt. */
export const NEW_LOAD_SEC = 140;
export const NEW_PER_DAY_MAX = 5;

/** Neue Wörter, die heute Platz haben: aus dem mittleren Wiederholaufwand heute und der folgenden sechs Tage (in Sekunden je Tag). */
export function capacityNew(loadSecPerDay: number): number {
  const load = Number.isFinite(loadSecPerDay) && loadSecPerDay > 0 ? loadSecPerDay : 0;
  return Math.min(NEW_PER_DAY_MAX, Math.max(NEW_MIN, Math.floor((VOCAB_BUDGET_SEC - load) / NEW_LOAD_SEC)));
}

// Aufholmodus (Methodenplan Lernwissenschaft 02.10.2026): ab so vielen überfälligen Karten werden fällige, reife Karten (Stabilität
// ≥ 7 Tage) aufgedeckt statt getippt, jede vierte bleibt getippt (Kontrolle). Das gibt etwa doppelt so viele Karten je Minute.
export const CATCHUP_AT = 40;
export const CATCHUP_MIN_S = 7;
/** Jede so vielte Karte bleibt im Aufholmodus getippt. */
export const CATCHUP_TYPED_EVERY = 4;
export const catchUpOn = (overdue: number): boolean => overdue >= CATCHUP_AT;
