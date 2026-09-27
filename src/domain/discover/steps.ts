import type { FeedItem } from '../input/types';

// Schritte eines Beitrags (Kap. 6.9, Plan F12): Artikel in vier Schritten, Podcasts und Videos in
// drei (ohne Prüfen – keine Zitate, keine Verständnisfragen). Der Stand steht in
// `app/profile.disc[beitrag] = {prep, take, check, use}` (Datum je Schritt, Altformat).

export type DiscStep = 'prep' | 'take' | 'check' | 'use';

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export function stepsFor(kind: FeedItem['kind'], hasQuestions = true): DiscStep[] {
  return kind === 'article' && hasQuestions ? ['prep', 'take', 'check', 'use'] : ['prep', 'take', 'use'];
}

export type StepState = { done: ReadonlySet<DiscStep>; current: DiscStep | null; complete: boolean };

export function stepState(disc: unknown, itemId: string, steps: readonly DiscStep[]): StepState {
  const rec = obj(obj(disc)[itemId]);
  const done = new Set<DiscStep>(steps.filter((s) => typeof rec[s] === 'string' && !!rec[s]));
  const current = steps.find((s) => !done.has(s)) ?? null;
  return { done, current, complete: current === null };
}

/** Beitrag erledigt: alle seine Schritte gesetzt (Anwenden ist immer der letzte). */
export function isItemDone(disc: unknown, item: Pick<FeedItem, 'itemId' | 'kind' | 'questions'>): boolean {
  return stepState(disc, item.itemId, stepsFor(item.kind, item.questions.length > 0)).complete;
}

/** Anzahl der `disc`-Einträge (Diagnose, Plan §3.10). */
export function discCount(disc: unknown): number {
  return Object.keys(obj(disc)).length;
}
