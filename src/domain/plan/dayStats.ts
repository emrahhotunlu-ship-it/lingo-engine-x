import { dayKey, isoWeek } from '../date';
import { topicById } from '../content';
import { displayP } from '../grammar/bkt';
import { liveErrorsOf } from '../grammar/errors';
import { dueFehlersaetze } from '../repair/fehlersaetze';
import { readRepairs } from '../repair/repair';
import { confidenceOf } from '../srs/confidence';
import { quizzable } from '../srs/queue';
import type { Lang, TrainCard } from '../srs/types';
import { overdueCount } from '../unit/backlog';

// Zahlen für den Tag (Gesamtkonzept 3.2 „Abschluss“ und „Schritt entfällt, wenn nichts fällig“). Rein, schreibt nichts.
// Eine Quelle für Planbau und Abschluss: derselbe Zähler für „überfällig“ und „sicher“ am Morgen und am Abend.

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Überfällige und sichere Karten (Wörter und Wendungen): dieselbe Rechnung für den Plan (Morgen) und den Abschluss (Abend). */
export function cardStats(cards: readonly TrainCard[], lang: Lang, nowMs: number): { overdue: number; sure: number } {
  const pool = cards.filter((c) => !c.hidden);
  const act = pool.filter((c) => quizzable(c, lang, pool.length - 1));
  return { overdue: overdueCount(act, nowMs), sure: pool.filter((c) => !c.isNew && confidenceOf(c, nowMs) >= 3).length };
}

/**
 * Fehlersätze, die jetzt fällig sind: aus beiden Speichern (`grammar/<thema>.errors` und `app/repair`), nur von früheren
 * Lerntagen – ein Satz vom Anlegetag zählt nie (er kommt frühestens morgen, verteilt statt massiert).
 */
export function fixesDue(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; nowMs: number; today: string }): number {
  return dueFehlersaetze(i).length;
}

/** Fehlersätze, die „weg“ sind (Box 3 erreicht): heute erledigt und insgesamt. `last` = Zeitpunkt der letzten Wiederholung. */
export function fixedStats(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; today: string }): { today: number; total: number } {
  let today = 0;
  let total = 0;
  const count = (done: unknown, last: unknown): void => {
    if (done !== true) return;
    total++;
    const t = num(last);
    if (t !== null && dayKey(t) === i.today) today++;
  };
  for (const [topic, doc] of i.grammarDocs) for (const e of liveErrorsOf(doc, topic)) count(e.done, e.last);
  for (const r of readRepairs(i.repairDoc ?? undefined)) count(r.done, r.last);
  return { today, total };
}

/** Grammatikthemen, die fest sitzen: Beherrschung (mit Verfall) ≥ 0,8 nach mindestens 15 Aufgaben. */
export function topicsFest(grammarDocs: ReadonlyMap<string, Doc>, nowMs: number): number {
  let n = 0;
  for (const [topic, doc] of grammarDocs) {
    const p0 = topicById(topic)?.p0 ?? 0.5;
    const p = displayP(num(doc.p) ?? p0, p0, num(doc.last), nowMs);
    if (p >= 0.8 && (num(doc.n) ?? 0) >= 15) n++;
  }
  return n;
}

/** Die Wahrheitszeile des Abschlusses: nur Teile, die stimmen und größer als 0 sind (`null` = Teil entfällt). */
export function truthParts(i: { sure: number | null; sure0: number | null; fixed: number; overdue: number | null; overdue0: number | null }): { sure: number | null; fixed: number | null; over: number | null } {
  const diff = (a: number | null, b: number | null): number | null => (a !== null && b !== null && a - b > 0 ? a - b : null);
  return { sure: diff(i.sure, i.sure0), fixed: i.fixed > 0 ? i.fixed : null, over: diff(i.overdue0, i.overdue) };
}

// ------------------------------------------------------------------ Meilensteine (ein Katalog, Lernplattform 3.0 K-14, Motivation §4.2, P42)

/** Wort-Marken über `festUnits` (Wörter und Wendungen). */
export const FEST_STEPS = [100, 250, 500, 750, 1000, 1500] as const;
export const CHAPTER_NUMS = [1, 2, 3, 4, 5, 6, 7] as const;
export type MilestoneId =
  | `fest${(typeof FEST_STEPS)[number]}`
  | 'topic1'
  | 'fix10'
  | 'overdue0'
  | 'place'
  | `ch${(typeof CHAPTER_NUMS)[number]}`
  | 'c1check1'
  | 'c1ready';

export type Milestone = { id: MilestoneId; n?: number };

/** Karten (Aufstieg, Emblem oder Blatt) zählen gegen das Budget; Ein-Satz-Meilensteine (100 Wörter, erstes Thema, 10 Fehlersätze, nichts überfällig) nicht. */
export const isMilestoneCard = (id: string): boolean => id === 'place' || id === 'c1check1' || id === 'c1ready' || /^ch[1-7]$/.test(id) || (/^fest\d+$/.test(id) && Number(id.slice(4)) >= 250);

/** Höchstens so viele Karten je ISO-Woche (und eine je Sitzung). */
export const MS_WEEK_MAX = 2;

export type MilestoneInput = {
  fest: number;
  topicsFest: number;
  fixTotal: number;
  overdue0: number | null;
  overdue: number | null;
  seen: Doc | null | undefined;
  /** Bestandene Kapitelprüfungen (Kapitelnummern 1 bis 7). */
  chapters?: readonly number[];
  /** Einstufung abgeschlossen (`app/c1.place` vorhanden). */
  place?: boolean;
  /** Zahl der gespeicherten C1-Checks. */
  checks?: number;
  /** K1 bis K6 erfüllt (Kriterien kommen mit P44). */
  c1ready?: boolean;
};

/**
 * Erreichte, noch nicht gemerkte Meilensteine (`seen` = `app/profile.ms`), nach Wichtigkeit: C1 bereit · Kapitel (das höchste zuerst) · erster
 * C1-Check · Einstufung · Wort-Marke (die höchste zuerst) · erstes Thema · 10 Fehlersätze · „überfällig 0 nach einer Pause“. Mehrere auf einmal
 * (z. B. beim ersten Mal mit altem Bestand) werden alle gemerkt, gezeigt wird nur der erste (`pickMilestone`).
 */
export function newMilestones(i: MilestoneInput): Milestone[] {
  const seen = i.seen ?? {};
  const out: Milestone[] = [];
  if (i.c1ready && !seen.c1ready) out.push({ id: 'c1ready' });
  for (const n of [...CHAPTER_NUMS].reverse()) if (i.chapters?.includes(n) && !seen[`ch${n}`]) out.push({ id: `ch${n}` as MilestoneId, n });
  if ((i.checks ?? 0) >= 1 && !seen.c1check1) out.push({ id: 'c1check1' });
  if (i.place && !seen.place) out.push({ id: 'place' });
  for (const n of [...FEST_STEPS].reverse()) if (i.fest >= n && !seen[`fest${n}`]) out.push({ id: `fest${n}` as MilestoneId, n });
  if (i.topicsFest >= 1 && !seen.topic1) out.push({ id: 'topic1' });
  if (i.fixTotal >= 10 && !seen.fix10) out.push({ id: 'fix10', n: 10 });
  if (i.overdue === 0 && (i.overdue0 ?? 0) >= 15 && !seen.overdue0) out.push({ id: 'overdue0' });
  return out;
}

/** Eintrag in `ms`: `JJJJ-MM-TT` = als Karte oder Satz gezeigt, `JJJJ-MM-TT~` = still gemerkt (zählt nicht gegen das Budget). Ältere Einträge sind Tage. */
export const quietMark = (day: string): string => `${day}~`;
const dayOfMark = (v: unknown): { day: string; quiet: boolean } | null => {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})(~?)$/.exec(v);
  return m ? { day: m[1] as string, quiet: m[2] === '~' } : null;
};

/** Karten, die diese Woche (ISO) schon gezeigt wurden. */
export function cardsThisWeek(seen: Doc | null | undefined, today: string): number {
  const wk = isoWeek(today);
  let n = 0;
  for (const [id, v] of Object.entries(seen ?? {})) {
    const m = dayOfMark(v);
    if (m && !m.quiet && isMilestoneCard(id) && isoWeek(m.day) === wk) n++;
  }
  return n;
}

export type MilestonePick = {
  /** Der Meilenstein, der heute gezeigt wird (höchstens einer); `null` = keiner (nichts Neues oder das Budget ist erschöpft). */
  show: Milestone | null;
  /** Still gemerkt (nie gezeigt). */
  quiet: MilestoneId[];
  /** Einmalige Umstellung auf `festUnits`: alle schon erreichten Wort-Marken still merken, `fu` setzen. */
  migrate: boolean;
};

/**
 * Welcher Meilenstein wird gezeigt? REIN. Budget: höchstens EINE Karte je Sitzung (`cardShown`) und `MS_WEEK_MAX` je ISO-Woche; was am Budget scheitert,
 * bleibt offen (kommt in einer späteren Sitzung/Woche). Alle anderen gleichzeitig erreichten werden still gemerkt (nie eine Folge von Feiern).
 * Ein Ein-Satz-Meilenstein verbraucht kein Kartenbudget. Die Umstellung auf `festUnits` (`ms.fu` fehlt) merkt die erreichten Wort-Marken still.
 */
export function pickMilestone(i: { candidates: readonly Milestone[]; seen: Doc | null | undefined; today: string; cardShown: boolean }): MilestonePick {
  const seen = i.seen ?? {};
  const migrate = !seen.fu;
  const quiet: MilestoneId[] = [];
  let cands = [...i.candidates];
  if (migrate) {
    for (const m of cands) if (m.id.startsWith('fest')) quiet.push(m.id);
    cands = cands.filter((m) => !m.id.startsWith('fest'));
  }
  const cardBlocked = i.cardShown || cardsThisWeek(seen, i.today) >= MS_WEEK_MAX;
  const show = cands.find((m) => !(isMilestoneCard(m.id) && cardBlocked)) ?? null;
  if (show) {
    // Gleichzeitig erreichte, aber nicht gezeigte: still gemerkt. Am Budget Gescheiterte (Karten, die warten) bleiben offen.
    for (const m of cands) if (m.id !== show.id && !(isMilestoneCard(m.id) && cardBlocked)) quiet.push(m.id);
  }
  return { show, quiet, migrate };
}

/**
 * Profil-Patch „Meilensteine gemerkt“ (`app/profile.ms[id]`); `null`, wenn nichts Neues. Nur ergänzend, nie überschrieben.
 * Alte Fassung (ohne `quiet`): alle IDs als Tag.
 */
export function milestonePatch(cur: Doc, ids: readonly MilestoneId[], day: string, quiet: readonly MilestoneId[] = [], migrate = false): Doc | null {
  const ms = cur.ms && typeof cur.ms === 'object' && !Array.isArray(cur.ms) ? (cur.ms as Doc) : {};
  const add: Record<string, string> = {};
  for (const id of ids) if (!ms[id]) add[id] = day;
  for (const id of quiet) if (!ms[id] && !add[id]) add[id] = quietMark(day);
  if (migrate && !ms.fu) add.fu = day;
  return Object.keys(add).length ? { ms: add } : null;
}

/**
 * Anspruch auf dem frischen Stand (zwei Geräte): nur was in `cur.ms` noch fehlt, wird gezeigt oder gemerkt. Liefert den Patch und den Meilenstein, den DIESES
 * Gerät zeigen darf (ein anderes Gerät war schneller: `show: null`, es gibt keine zweite Karte).
 */
export function claimMilestones(cur: Doc, pick: MilestonePick, day: string): { patch: Doc | null; show: Milestone | null } {
  const ms = cur.ms && typeof cur.ms === 'object' && !Array.isArray(cur.ms) ? (cur.ms as Doc) : {};
  // Das Wochenbudget gilt auch auf dem frischen Stand: hat ein anderes Gerät inzwischen die zweite Karte der Woche gezeigt, wartet diese.
  const budgetGone = !!pick.show && isMilestoneCard(pick.show.id) && cardsThisWeek(ms, day) >= MS_WEEK_MAX;
  const show = pick.show && !ms[pick.show.id] && !budgetGone ? pick.show : null;
  const quiet = pick.quiet.filter((id) => !ms[id]);
  return { patch: milestonePatch(cur, show ? [show.id] : [], day, quiet, pick.migrate), show };
}
