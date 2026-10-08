// Funktionsschalter (Lernplattform 3.0 §10.0 Nr. 7). Ein Paket schaltet seine Funktion erst im letzten Schritt ein.
// Die Schalter sind zunächst `false`; die Pakete von Release 1 setzen `c1xKinds.<art>` auf `true`, sobald Rahmen, Wertung, Buchung und Inhalte der Art
// stehen. `program` (R3 „Dein Weg“) und `way` (R4 „Weg zu C1“, assess@4) stehen seit 08.10.2026 auf `true`; `lx:flags` = `{"program":false}` bzw. `{"way":false}` schaltet sie je Gerät wieder ab.
// `c1check` (R4 C1-Check, P40) steht seit 08.10.2026 auf `true`; `lx:flags` = `{"c1check":false}` schaltet ihn je Gerät ab.
// `tutor.talk` (R5 P51 Rollenspiel+: turn-analysis@3, Kapitelziel, „Sag's nochmal“, K7 aus dem Gespräch) steht seit 08.10.2026 auf `true`; `{"tutor":{"talk":false}}` schaltet es je Gerät ab.
import type { C1Kind } from '../domain/c1x/types';
import { local } from '../platform/storage';

export type Flags = {
  c1xKinds: Record<C1Kind, boolean>;
  /** Schritt 2 über `slotPlan()` (Prioritätstabelle) statt der Themenwahl von LP2 (P15). */
  slotPlan: boolean;
  tempo: boolean;
  c1check: boolean;
  /** Programmkarte „Dein Weg zu C1“ im Grammatik-Reiter (P32). */
  program: boolean;
  /** „Weg zu C1“ im Fortschritt (Slot `progress.head`) und die Einschätzung assess@4 (P44/P45). */
  way: boolean;
  tutor: { explain: boolean; gen: boolean; diagnose: boolean; clinic: boolean; write: boolean; talk: boolean };
  fx: { moments: boolean; rings: boolean; sparks: boolean; field: boolean; sky: boolean; film: boolean };
};

export const flags: Flags = {
  c1xKinds: { mcc: true, ocl: true, wf: true, kwt: true, err: true, pair: false, cnet: false, reg: false, para: false },
  slotPlan: false,
  tempo: true,
  c1check: true,
  program: true,
  way: true,
  tutor: { explain: false, gen: false, diagnose: false, clinic: true, write: true, talk: true },
  fx: { moments: false, rings: false, sparks: false, field: false, sky: true, film: true },
};

/** Ist die Aufgabenart angeboten? (Rahmen, Auswahl und Registry fragen nur diese Funktion.) */
export const kindEnabled = (kind: C1Kind): boolean => flags.c1xKinds[kind];

/**
 * Schalter je Gerät übersteuern (Tests und gestufte Freigabe): `localStorage` `lx:flags` = `{"c1xKinds":{"kwt":true},"tempo":true}` oder kurz `kwt,err`
 * (Aufgabenarten). Nur bekannte Schlüssel, nur Wahrheitswerte; alles andere wird ignoriert. Wird beim Laden einmal gelesen.
 */
export function applyFlagOverrides(raw: string | null): void {
  if (!raw) return;
  const kinds = Object.keys(flags.c1xKinds) as C1Kind[];
  try {
    const t = raw.trim();
    if (!t.startsWith('{')) {
      for (const k of t.split(',').map((x) => x.trim())) {
        if ((kinds as string[]).includes(k)) flags.c1xKinds[k as C1Kind] = true;
        if (k === 'slots') flags.slotPlan = true;
        if (k === 'program') flags.program = true;
        if (k === 'way') flags.way = true;
        if (k === 'sky' || k === 'film') flags.fx[k] = true;
        if (k === 'clinic' || k === 'write' || k === 'talk') flags.tutor[k] = true;
      }
      return;
    }
    const o = JSON.parse(t) as { c1xKinds?: Record<string, unknown>; tempo?: unknown; slotPlan?: unknown; c1check?: unknown; program?: unknown; way?: unknown; fx?: Record<string, unknown>; tutor?: Record<string, unknown> };
    for (const k of kinds) if (typeof o.c1xKinds?.[k] === 'boolean') flags.c1xKinds[k] = o.c1xKinds[k];
    if (typeof o.slotPlan === 'boolean') flags.slotPlan = o.slotPlan;
    if (typeof o.tempo === 'boolean') flags.tempo = o.tempo;
    if (typeof o.c1check === 'boolean') flags.c1check = o.c1check;
    if (typeof o.program === 'boolean') flags.program = o.program;
    if (typeof o.way === 'boolean') flags.way = o.way;
    for (const k of Object.keys(flags.fx) as (keyof Flags['fx'])[]) if (typeof o.fx?.[k] === 'boolean') flags.fx[k] = o.fx[k];
    for (const k of Object.keys(flags.tutor) as (keyof Flags['tutor'])[]) if (typeof o.tutor?.[k] === 'boolean') flags.tutor[k] = o.tutor[k];
  } catch {
    // Ungültige Übersteuerung: die eingebauten Schalter gelten.
  }
}

applyFlagOverrides(local.get('lx:flags'));
