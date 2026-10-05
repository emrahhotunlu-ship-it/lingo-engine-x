import type { WeekTargets } from './types';

// `UnitCtx.phrases` (Prüfbefund M8): Die Wendungen, die Block 3 benutzen soll. Geräteübergreifend
// aus den Daten: Karten mit Herkunft Lesen/Hören von heute, sonst die 5 Wendungen der Woche.
// Dazu bis zu zwei schwache Wörter aus dem Wortschatz (Englischlehrer 02.10.2026): Wer ein Wort, das ihm immer wieder
// entfällt, auch noch in eigenen Sätzen benutzen muss, wiederholt es mit einer zweiten Methode (Produktion statt Erkennen).

export type PhraseCardLike = { word: string; src: string | null; added: string; hidden?: boolean };
/** Karte mit den Angaben, die für „schwach“ nötig sind (nur Lesen, `TrainCard` passt strukturell). */
export type WeakCardLike = PhraseCardLike & { isNew: boolean; stage: number; doc: Readonly<Record<string, unknown>> };

const INPUT_SRC = new Set(['read', 'listen']);
export const PHRASES_MAX = 5;
/** Höchstens so viele der fünf Plätze gehören schwachen Wörtern. */
export const WEAK_MAX = 2;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Schwache Wörter: nicht neu, nicht ausgeblendet, mindestens zwei Fehler – oder noch auf Stufe 1–2 trotz mindestens drei
 * Wiederholungen („will nicht hängen bleiben“). Die schlimmsten zuerst (Fehler, dann niedrigere Stufe, dann Wort), fest je Datenstand.
 */
export function weakWords(cards: readonly WeakCardLike[], max: number = WEAK_MAX): string[] {
  const rows = cards
    .filter((c) => !c.hidden && !c.isNew && c.word.trim() && (num(c.doc.lapses) >= 2 || (c.stage <= 2 && num(c.doc.reps) >= 3)))
    .map((c) => ({ w: c.word.trim(), lapses: num(c.doc.lapses), stage: c.stage }))
    .sort((a, b) => b.lapses - a.lapses || a.stage - b.stage || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));
  return [...new Set(rows.map((r) => r.w))].slice(0, Math.max(0, max));
}

export function unitPhrases(cards: readonly PhraseCardLike[], day: string, targets: WeekTargets, weak: readonly string[] = []): string[] {
  const today = cards
    .filter((c) => !c.hidden && c.src !== null && INPUT_SRC.has(c.src) && c.added.slice(0, 10) === day && c.word.trim())
    .map((c) => c.word.trim());
  const uniq = [...new Set(today)].slice(0, PHRASES_MAX);
  const base = uniq.length ? uniq : targets.phrases.slice(0, PHRASES_MAX);
  // Schwache Wörter ersetzen die letzten Plätze; was schon in der Liste steht, kommt nie doppelt.
  const have = new Set(base.map((p) => p.toLowerCase()));
  const extra = [...new Set(weak.map((w) => w.trim()).filter(Boolean))].filter((w) => !have.has(w.toLowerCase())).slice(0, WEAK_MAX);
  return [...base.slice(0, PHRASES_MAX - extra.length), ...extra];
}
