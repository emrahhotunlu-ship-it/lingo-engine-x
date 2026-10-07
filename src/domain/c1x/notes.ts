import type { GradeKey } from '../grade';
import type { C1Kind } from './types';

// Notenschlüssel und Gewichte der Aufgabenarten (Lernplattform 3.0 §3.4). Die Zeitgrenzen stehen in `domain/grade/index.ts`
// (`GRADE_TABLE`, Schlüssel `c1_<name>`); hier steht, welcher Schlüssel zu welcher Art und Eingabeform gehört, und das Gewicht der
// Note für FSRS (`srs/weight.ts`, nur Lexik-Buchung). Auswahl und Bausteine geben nie „Leicht“ (Tabelle: `easy: null`).

export type C1NoteName =
  | 'mcc' | 'ocl' | 'wf' | 'kwt' | 'kwt_tiles' | 'kwt_part' | 'err_tap' | 'err_tapfix' | 'err_fix' | 'pair' | 'cnet' | 'reg_chips' | 'reg' | 'para_pick' | 'para';

/** Eingabeform je Art: bestimmt den Schlüssel. */
export type C1Form = 'default' | 'tiles' | 'part' | 'typed' | 'tap' | 'tapfix' | 'chips' | 'pick';

export const C1_WEIGHT: Readonly<Record<C1NoteName, number>> = {
  mcc: 0.55,
  ocl: 1,
  wf: 1,
  kwt: 1,
  kwt_tiles: 0.8,
  kwt_part: 1,
  err_tap: 0.55,
  err_tapfix: 1,
  err_fix: 1,
  pair: 0.55,
  cnet: 0.55,
  reg_chips: 0.55,
  reg: 1,
  para_pick: 0.55,
  para: 1.1,
};

/**
 * Der Notenname einer Aufgabe in ihrer Eingabeform.
 * kwt: `tiles` (Handy, Bausteine), `part` (Handy p > 0,7: Teil B getippt), sonst getippt (Laptop). err: `tap` (Chips), `tapfix` (Handy, Korrektur getippt), sonst Laptop.
 * reg: `chips` (Handy) oder Text (Laptop). para: `pick` (Handy) oder Text (Laptop).
 */
export function noteNameOf(kind: C1Kind, form: C1Form = 'default'): C1NoteName {
  switch (kind) {
    case 'kwt':
      return form === 'tiles' ? 'kwt_tiles' : form === 'part' ? 'kwt_part' : 'kwt';
    case 'err':
      return form === 'tap' ? 'err_tap' : form === 'tapfix' ? 'err_tapfix' : 'err_fix';
    case 'reg':
      return form === 'chips' ? 'reg_chips' : 'reg';
    case 'para':
      return form === 'pick' ? 'para_pick' : 'para';
    default:
      return kind;
  }
}

/** Schlüssel der Notentabelle (`GRADE_TABLE`). */
export const gradeKeyOf = (name: C1NoteName): GradeKey => `c1_${name}` as GradeKey;
/** Gewicht der Note für FSRS (Lexik-Buchung). */
export const weightOf = (name: C1NoteName): number => C1_WEIGHT[name];
