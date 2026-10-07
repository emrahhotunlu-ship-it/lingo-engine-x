import { topicP } from '../grammar/bkt';
import { liveErrorsOf } from '../grammar/errors';
import { readRepairs } from '../repair/repair';

// Grammatikzahlen für „Fortschritt“ (Gesamtkonzept 3.5, K5 und K6). Rein, nur Lesen, nichts wird gespeichert.

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type TopicStage = 'new' | 'learning' | 'safe' | 'firm';
export const TOPIC_STAGES: readonly TopicStage[] = ['new', 'learning', 'safe', 'firm'];

/** Schwellen (03-lernmodell 1.2): Neu n = 0 · Lernt p ≤ 0,6 oder n < 4 · Sicher p ≤ 0,8 · Fest p > 0,8, n ≥ 15, Belege an ≥ 3 Tagen. */
export const SAFE_P = 0.6;
export const FIRM_P = 0.8;
export const FIRM_N = 15;
export const FIRM_DAYS = 3;
const LEARN_N = 4;

/** Zustand eines Themas aus seinem Dokument; `p` ist die Anzeige-Beherrschung mit Verfall. */
export function topicStage(p: number, doc: Doc | undefined): TopicStage {
  const n = num(doc?.n);
  if (n === 0) return 'new';
  if (p <= SAFE_P || n < LEARN_N) return 'learning';
  const days = new Set((Array.isArray(doc?.hist) ? (doc.hist as unknown[]) : []).map((h) => (h && typeof h === 'object' ? (h as Doc).d : null)).filter((d) => typeof d === 'string')).size;
  return p > FIRM_P && n >= FIRM_N && days >= FIRM_DAYS ? 'firm' : 'safe';
}

export type GrammarDistribution = {
  counts: Record<TopicStage, number>;
  total: number;
  /** „sicher z von 47“: Sicher und Fest zusammen. */
  safe: number;
  perTopic: Array<{ id: string; stage: TopicStage; p: number }>;
};

/** Verteilung Neu · Lernt · Sicher · Fest über alle Themen; p kommt mit Verfall (sinkt ohne Übung zur Startbeherrschung). */
export function grammarDistribution(topicIds: readonly string[], grammar: ReadonlyMap<string, Doc>, nowMs: number): GrammarDistribution {
  const counts: Record<TopicStage, number> = { new: 0, learning: 0, safe: 0, firm: 0 };
  const perTopic = topicIds.map((id) => {
    const doc = grammar.get(id);
    const p = topicP(id, doc, nowMs);
    const stage = topicStage(p, doc);
    counts[stage]++;
    return { id, stage, p };
  });
  return { counts, total: topicIds.length, safe: counts.safe + counts.firm, perTopic };
}

export type ErrorSentenceStats = {
  /** Noch nicht fest (Box 0 bis 2). */
  open: number;
  /** Fest: dreimal richtig (Box 3, neun Tage Abstand). */
  firm: number;
  /** Offen und zuletzt wieder falsch (nach einer Wiederholung zurück auf Box 0). */
  recurring: number;
  /** Heute oder früher fällig und noch offen („überfällig“). */
  due: number;
};

type Item = { done: boolean; box: number; due: number | null; reviewed: boolean };

const asItem = (e: Doc): Item => ({
  done: e.done === true,
  box: num(e.box),
  due: typeof e.due === 'number' ? e.due : null,
  reviewed: typeof e.last === 'number' && e.last > 0,
});

/**
 * Fehlersätze: Reparatur-Sätze (`app/repair`) und die Fehlerlisten der Themen (`grammar/<id>.errors`) in einer Zählung.
 * „Wiederkehrend“ = offen, schon einmal wiederholt und wieder falsch (Box 0), also derselbe Fehler kam zurück.
 */
export function errorSentenceStats(repairDoc: Doc | null | undefined, grammar: ReadonlyMap<string, Doc>, nowMs: number): ErrorSentenceStats {
  const items: Item[] = [...readRepairs(repairDoc ?? undefined).map((e) => asItem(e as unknown as Doc))];
  for (const [topic, d] of grammar) for (const e of liveErrorsOf(d, topic)) items.push(asItem(e));
  const out: ErrorSentenceStats = { open: 0, firm: 0, recurring: 0, due: 0 };
  for (const i of items) {
    if (i.done) {
      out.firm++;
      continue;
    }
    out.open++;
    if (i.reviewed && i.box === 0) out.recurring++;
    if (i.due !== null && i.due <= nowMs) out.due++;
  }
  return out;
}
