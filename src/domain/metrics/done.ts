import type { C1Doc } from '../c1/c1doc';
import { cardStats, fixedStats, newMilestones, topicsFest, truthParts, type Milestone } from '../plan/dayStats';
import type { StoredPlan } from '../plan/types';
import type { Lang, TrainCard } from '../srs/types';
import { festUnits } from './vocab';

// Zahlen der Erledigt-Karte von Heute (P5 S1-ZAHL, Nacharbeit): Wahrheitszeile, Meilensteine und die Fest-Zahlen für das nächste Ziel.
// Vorher in `features/today/doneFacts.ts` zusammengesetzt; dieselbe Rechnung, jetzt aus einer Quelle. Rein, nichts wird gespeichert.

type Doc = Readonly<Record<string, unknown>>;

export type DoneDay = {
  /** Wahrheitszeile „Heute neu sicher: n · Fehler weg: n · überfällig −n“ (`null` = Teil entfällt). */
  parts: { sure: number | null; fixed: number | null; over: number | null };
  /** Erreichte, noch nicht gemerkte Meilensteine (wichtigster zuerst). */
  milestones: Milestone[];
  /** Feste Einheiten (Wörter und Wendungen) und feste Wörter allein, für die Zeile „nächstes Ziel“. */
  festUnits: number;
  vocabFest: number;
};

/**
 * Abschluss des Tages: Morgenwerte aus dem eingefrorenen Plan (`u.ov`, `u.sure`) gegen den Stand jetzt. `cards` = Wortkarten,
 * `chunkCards` = Wendungen; `seen` = `app/profile.ms`; `c1` = gelesenes `app/c1`.
 */
export function doneDay(i: {
  cards: readonly TrainCard[];
  chunkCards: readonly TrainCard[];
  grammarDocs: ReadonlyMap<string, Doc>;
  repairDoc: Doc | null | undefined;
  c1: Pick<C1Doc, 'gates' | 'place' | 'checks'>;
  seen: unknown;
  plan: StoredPlan | null;
  lang: Lang;
  nowMs: number;
  today: string;
}): DoneDay {
  const all = [...i.cards, ...i.chunkCards];
  const st = cardStats(all, i.lang, i.nowMs);
  const fixed = fixedStats({ grammarDocs: i.grammarDocs, repairDoc: i.repairDoc, today: i.today });
  const ov = i.plan?.u?.ov ?? null;
  const sure0 = i.plan?.u?.sure ?? null;
  const parts = truthParts({ sure: st.sure, sure0, fixed: fixed.today, overdue: st.overdue, overdue0: ov });
  // Wort-Marken zählen Wörter UND Wendungen (`festUnits`, K-14); die Umstellung merkt schon erreichte Marken still (`pickMilestone`).
  const fest = festUnits(all, i.nowMs);
  const milestones = newMilestones({
    fest,
    topicsFest: topicsFest(i.grammarDocs, i.nowMs),
    fixTotal: fixed.total,
    overdue0: ov,
    overdue: ov === null ? null : st.overdue,
    seen: i.seen as Doc | undefined,
    chapters: i.c1.gates.filter((g) => g.ok).map((g) => g.ch),
    place: !!i.c1.place,
    checks: i.c1.checks.length,
  });
  return { parts, milestones, festUnits: fest, vocabFest: festUnits(i.cards, i.nowMs) };
}

/** Überfällige Karten (Wörter und Wendungen) für die Willkommens-Karte der Neustart-Woche: dieselbe Zählung wie Plan und Abschluss. */
export const overdueUnits = (cards: readonly TrainCard[], lang: Lang, nowMs: number): number => cardStats(cards, lang, nowMs).overdue;
