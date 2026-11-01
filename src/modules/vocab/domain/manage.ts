import { addDays, dayKey, dayStartOf } from '../shared';
import { emptyLex } from './planner';
import type { Lex } from './types';

// Großpaket A S6: „Verwalten“ auf der Wort-Seite (plan.md §11 Nr. 55–60). Eigene Aktionen des Moduls, weil die alten Aktionen
// (features/vocab/list/actions.ts) die alten Planfelder schreiben. Rein; geschrieben wird über store.ts `writeManage`.

/**
 * „Morgen wieder“: Beide Spuren sind spätestens am nächsten Lerntag fällig. Ein früherer Termin bleibt; die FSRS-Werte bleiben unverändert
 * (keine Buchung). Nur für eingeführte Lexeme, sonst `null` (ein neues Wort kommt über „neue Wörter“).
 */
export function againTomorrow(lex: Lex, nowMs: number): Lex | null {
  if (lex.intro === null) return null;
  const tomorrow = dayStartOf(addDays(dayKey(nowMs), 1));
  const u = lex.u.due > tomorrow ? { ...lex.u, due: tomorrow } : lex.u;
  const b = lex.b && lex.b.due > tomorrow ? { ...lex.b, due: tomorrow } : lex.b;
  if (u === lex.u && b === lex.b) return null;
  return { ...lex, u, b };
}

/**
 * „Von vorn“: Lernstand wie ein neues Wort (Stufe 1, nicht eingeführt, ohne Termine und Belege). Bleibt: Art, Kern/Familie, Bedeutung,
 * Grammatik, Register, Paar, Umrechnungs-Marke, Ankersätze und „Deine Sätze“ (sie gehören dir). Der Verlauf in `vlog` bleibt unberührt.
 */
export function restartLex(lex: Lex, nowMs: number): Lex {
  const fresh = emptyLex(lex.k, lex.pri, nowMs);
  return {
    ...fresh,
    of: lex.of,
    core: lex.core,
    sense: lex.sense,
    gr: lex.gr,
    reg: lex.reg,
    pair: lex.pair,
    mig: lex.mig,
    sn: lex.sn,
    sync: lex.sync,
    ...(lex.os ? { os: lex.os } : {}),
  };
}
