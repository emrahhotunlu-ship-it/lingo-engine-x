import type { Form, Grade, Outcome, TrackKey } from './types';

// Wörter-Modul V1: Note aus dem Ergebnis (plan.md §5, Grundregeln; V2 verfeinert Zeit, Tippfehler-Regeln (a)–(h) und Kollokationen).
// Keine Selbstbewertung außer im Anki-Modus (A7): `flip` ist die einzige Form mit Selbsturteil und wirkt nur auf Verstehen (F3).

/** Spur und höchste Note je Form (Tabelle „Spur je Form“, plan.md §5). `null` = keine Planwirkung (Auswahl, Einführung). */
export const FORM_SPEC: Readonly<Record<Form, { track: TrackKey | null; max: Grade; free: boolean }>> = {
  intro: { track: null, max: 1, free: false },
  gap: { track: 'b', max: 4, free: true },
  nosent: { track: 'b', max: 4, free: true },
  transfer: { track: 'b', max: 4, free: true },
  gap_hint: { track: 'b', max: 2, free: false },
  meaning: { track: 'u', max: 4, free: false },
  listen: { track: 'u', max: 3, free: false },
  flip: { track: 'u', max: 4, free: false },
  choice: { track: null, max: 1, free: false },
};

export type GradeInput = {
  form: Form;
  outcome: Outcome;
  hint: number;
  /** Zeit-Urteil aus den Median-Zeiten (V2); V1 nimmt es als gegeben. */
  speed?: 'slow' | 'fast' | null;
  /** Easy erlaubt (nur ab Stufe 5, fällig, älter als 21 Tage; plan.md §5). */
  easyOk?: boolean;
  /** Anki-Selbsturteil (nur `flip`). */
  self?: Grade;
  /** Lexem ist selbst eine Kollokation (M56): Kollokationsfehler = Again, sonst Hard. */
  isColloc?: boolean;
};

/** Note 1–4 oder `null` (Auch richtig / Ausweichwort: keine Note, Wiederkehr nach 3–5 Karten). */
export function gradeOf(x: GradeInput): Grade | null {
  const spec = FORM_SPEC[x.form];
  let g: Grade | null;
  if (x.form === 'flip') g = x.self ?? null;
  else
    switch (x.outcome) {
      case 'syn':
      case 'evade':
        g = null;
        break;
      case 'wrong':
      case 'dunno':
      case 'other':
      case 'pos':
        g = 1;
        break;
      case 'colloc':
        g = x.isColloc ? 1 : 2;
        break;
      case 'typo':
      case 'infl':
        g = 2;
        break;
      case 'ok':
        g = x.hint > 0 || x.speed === 'slow' ? 2 : x.speed === 'fast' && x.easyOk ? 4 : 3;
        break;
    }
  if (g === null) return null;
  return Math.min(g, spec.max) as Grade;
}

/** Zählt die Antwort als freier richtiger Abruf (Beleg für den Abstands-Deckel und die Stufen)? Ein reiner Tippfehler zählt mit. */
export function isFreeGood(form: Form, outcome: Outcome, hint: number): boolean {
  return FORM_SPEC[form].free && hint === 0 && (outcome === 'ok' || outcome === 'typo');
}
