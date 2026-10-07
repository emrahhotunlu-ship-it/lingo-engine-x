// Funktionsschalter (Lernplattform 3.0 §10.0 Nr. 7). Ein Paket schaltet seine Funktion erst im letzten Schritt ein.
// Alle Schalter sind zunächst `false`; die Pakete von Release 1 setzen `c1xKinds.<art>` auf `true`, sobald Rahmen, Wertung,
// Buchung und Inhalte der Art stehen.
import type { C1Kind } from '../domain/c1x/types';
import { local } from '../platform/storage';

export type Flags = {
  c1xKinds: Record<C1Kind, boolean>;
  /** Schritt 2 über `slotPlan()` (Prioritätstabelle) statt der Themenwahl von LP2 (P15). */
  slotPlan: boolean;
  tempo: boolean;
  c1check: boolean;
  tutor: { explain: boolean; gen: boolean; diagnose: boolean; clinic: boolean };
  fx: { moments: boolean; rings: boolean; sparks: boolean; field: boolean; sky: boolean; film: boolean };
};

export const flags: Flags = {
  c1xKinds: { mcc: false, ocl: false, wf: false, kwt: true, err: true, pair: false, cnet: false, reg: false, para: false },
  slotPlan: false,
  tempo: false,
  c1check: false,
  tutor: { explain: false, gen: false, diagnose: false, clinic: false },
  fx: { moments: false, rings: false, sparks: false, field: false, sky: false, film: false },
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
      }
      return;
    }
    const o = JSON.parse(t) as { c1xKinds?: Record<string, unknown>; tempo?: unknown; slotPlan?: unknown; c1check?: unknown };
    for (const k of kinds) if (typeof o.c1xKinds?.[k] === 'boolean') flags.c1xKinds[k] = o.c1xKinds[k];
    if (typeof o.slotPlan === 'boolean') flags.slotPlan = o.slotPlan;
    if (typeof o.tempo === 'boolean') flags.tempo = o.tempo;
    if (typeof o.c1check === 'boolean') flags.c1check = o.c1check;
  } catch {
    // Ungültige Übersteuerung: die eingebauten Schalter gelten.
  }
}

applyFlagOverrides(local.get('lx:flags'));
