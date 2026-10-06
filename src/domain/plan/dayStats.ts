import { dayKey } from '../date';
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

// ------------------------------------------------------------------ Meilensteine (einmalig, ein Satz)

export const FEST_STEPS = [100, 250, 500, 1000, 1500] as const;
export type MilestoneId = `fest${(typeof FEST_STEPS)[number]}` | 'topic1' | 'fix10' | 'overdue0';

export type Milestone = { id: MilestoneId; n?: number };

/**
 * Erreichte, noch nicht gemerkte Meilensteine (`seen` = `app/profile.ms`). Mehrere auf einmal (z. B. beim ersten Mal mit
 * altem Stand) werden alle gemerkt, gezeigt wird nur der wichtigste: die höchste Fest-Marke, dann erstes Thema,
 * 10 Fehlersätze, zuletzt „überfällig 0 nach einer Pause“ (Morgenwert ≥ 15 und jetzt 0).
 */
export function newMilestones(i: { fest: number; topicsFest: number; fixTotal: number; overdue0: number | null; overdue: number | null; seen: Doc | null | undefined }): Milestone[] {
  const seen = i.seen ?? {};
  const out: Milestone[] = [];
  for (const n of [...FEST_STEPS].reverse()) if (i.fest >= n && !seen[`fest${n}`]) out.push({ id: `fest${n}` as MilestoneId, n });
  if (i.topicsFest >= 1 && !seen.topic1) out.push({ id: 'topic1' });
  if (i.fixTotal >= 10 && !seen.fix10) out.push({ id: 'fix10', n: 10 });
  if (i.overdue === 0 && (i.overdue0 ?? 0) >= 15 && !seen.overdue0) out.push({ id: 'overdue0' });
  return out;
}

/** Profil-Patch „Meilensteine gemerkt“ (`app/profile.ms[id] = Lerntag`); `null`, wenn nichts Neues. Nur ergänzend, nie überschrieben. */
export function milestonePatch(cur: Doc, ids: readonly MilestoneId[], day: string): Doc | null {
  const ms = cur.ms && typeof cur.ms === 'object' && !Array.isArray(cur.ms) ? (cur.ms as Doc) : {};
  const add: Record<string, string> = {};
  for (const id of ids) if (!ms[id]) add[id] = day;
  return Object.keys(add).length ? { ms: add } : null;
}
