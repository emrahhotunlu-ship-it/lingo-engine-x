import { addDays } from '../../date';
import type { C1Gate } from '../c1doc';
import { GATE, grammarThreshold, retryFrom } from './trigger';

// Kapitelprüfung, Wertung (Lernplattform 3.0 §4.4, P42). Rein. Bestanden: Grammatik ≥ 85 % (Kapitel 1–2) bzw. ≥ 80 % (3–7) UND Wörter ≥ 80 %.
// Entfällt der Wörterteil (zu wenige eigene Karten, siehe `words.ts`), entscheidet allein die Grammatik; der Eintrag trägt dann `w: [0, 0]`.

export type GateTally = { chapter: number; g: [number, number]; w: [number, number]; topics: Array<{ topic: string; right: number; total: number }> };

export type GateOutcome = {
  ok: boolean;
  /** Anteil richtig (0 bis 1), `null` ohne Aufgaben. */
  gRate: number | null;
  wRate: number | null;
  /** Der Wörterteil hat gefehlt. */
  noWords: boolean;
  /** Themen mit Fehlern (schwächste zuerst, höchstens 2): sie kommen 10 Tage lang öfter. */
  weak: string[];
};

const rate = (p: readonly [number, number]): number | null => (p[1] > 0 ? p[0] / p[1] : null);

/** Wertung eines Versuchs. Gleichstand an der Grenze besteht (≥). */
export function gateOutcome(t: GateTally): GateOutcome {
  const gRate = rate(t.g);
  const wRate = rate(t.w);
  const noWords = t.w[1] === 0;
  const gOk = gRate !== null && gRate >= grammarThreshold(t.chapter) - 1e-9;
  const wOk = noWords || (wRate !== null && wRate >= GATE.passWords - 1e-9);
  const weak = [...t.topics]
    .filter((x) => x.total > 0 && x.right < x.total)
    .sort((a, b) => a.right / a.total - b.right / b.total || a.topic.localeCompare(b.topic))
    .slice(0, 2)
    .map((x) => x.topic);
  return { ok: gOk && wOk, gRate, wRate, noWords, weak };
}

/** Der Eintrag für `app/c1.gates[]`. */
export const gateEntry = (t: GateTally, today: string): C1Gate => ({ d: today, ch: t.chapter, g: t.g, w: t.w, ok: gateOutcome(t).ok });

/** Nach einem Fehlversuch: ab wann es wieder geht (aus den bisherigen Versuchen inklusive des neuen). */
export function nextTryAfter(prev: readonly C1Gate[], entry: C1Gate): string {
  return retryFrom([...prev.filter((g) => g.ch === entry.ch), entry]) ?? addDays(entry.d, GATE.pauseDays);
}
