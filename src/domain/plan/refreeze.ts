import type { GrammarDay, PatState } from './types';

// Kapitel-Arbeit (K2/K5): Wählt Emrah ein anderes Kapitel, darf der Grammatikschritt von heute EINMAL neu festgelegt werden, aber nur solange
// er unberührt ist. Neu gerechnet werden allein `u.gt` und `u.ps`; Pflichtschritte, Mengen, Minuten und alles andere bleiben, wie sie sind
// (Kap. 15: kein neu gewürfelter Plan). Rein; der Aufrufer schreibt.

type Raw = Record<string, unknown>;

export type RefreezeCheck = {
  /** Das neu gewählte Kapitel (1 bis 7). */
  n: number;
  /** `u.gt` des gespeicherten Plans von heute (`null`: kein Plan mit Grammatikthema). */
  gt: GrammarDay | null;
  /** Schritt 2 (Grammatik) im Plan: erledigt? Fortschritt? `null`, wenn der Plan keinen Schritt 2 hat. */
  step2: { done: boolean; progress: number } | null;
  /** Läuft gerade Schritt 2 der Einheit oder eine Pflicht-Grammatikrunde? */
  running: boolean;
  /** Wurde heute schon ein Kapitel gewählt (vor dieser Wahl, `app/c1.chh`)? */
  choseToday: boolean;
};

/** Darf der Grammatikschritt von heute neu festgelegt werden? Nur einmal je Tag, nur unberührt, nur bei einem anderen Kapitel. */
export function refreezeAllowed(c: RefreezeCheck): boolean {
  if (!c.gt || c.gt.ch === c.n) return false;
  if (c.choseToday || c.running) return false;
  if (c.step2 && (c.step2.done || c.step2.progress > 0)) return false;
  return true;
}

/**
 * Neuer roher Plan: nur `u.gt` und `u.ps` ersetzt, unbekannte Felder bleiben erhalten (Datenregel: nie strippen). `null`, wenn der Plan keine
 * Tageseinheit (`u`) hat.
 */
export function refreezePlan<T extends Raw>(plan: T, gt: GrammarDay, ps: Record<string, PatState>): T | null {
  const u = plan.u;
  if (!u || typeof u !== 'object' || Array.isArray(u)) return null;
  const nextU: Raw = { ...(u as Raw), gt };
  if (Object.keys(ps).length) nextU.ps = ps;
  else delete nextU.ps;
  return { ...plan, u: nextU };
}
