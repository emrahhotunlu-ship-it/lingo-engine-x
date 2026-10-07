// Funktionsschalter (Lernplattform 3.0 §10.0 Nr. 7). Ein Paket schaltet seine Funktion erst im letzten Schritt ein.
// Alle Schalter sind zunächst `false`; die Pakete von Release 1 setzen `c1xKinds.<art>` auf `true`, sobald Rahmen, Wertung,
// Buchung und Inhalte der Art stehen.
import type { C1Kind } from '../domain/c1x/types';

export type Flags = {
  c1xKinds: Record<C1Kind, boolean>;
  tempo: boolean;
  c1check: boolean;
  tutor: { explain: boolean; gen: boolean; diagnose: boolean; clinic: boolean };
  fx: { moments: boolean; rings: boolean; sparks: boolean; field: boolean; sky: boolean; film: boolean };
};

export const flags: Flags = {
  c1xKinds: { mcc: false, ocl: false, wf: false, kwt: false, err: false, pair: false, cnet: false, reg: false, para: false },
  tempo: false,
  c1check: false,
  tutor: { explain: false, gen: false, diagnose: false, clinic: false },
  fx: { moments: false, rings: false, sparks: false, field: false, sky: false, film: false },
};

/** Ist die Aufgabenart angeboten? (Rahmen, Auswahl und Registry fragen nur diese Funktion.) */
export const kindEnabled = (kind: C1Kind): boolean => flags.c1xKinds[kind];
