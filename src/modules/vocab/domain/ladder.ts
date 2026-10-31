import type { Lex } from './types';

// Stufen 1–7 (plan.md §3.3; Emrahs Antworten 3 und 4). V1 setzt die Aufstiegs- und Abstiegsregeln; die Formen je Stufe baut V2.
// Gruppen: „erkennst du“ (1–2), „auf dem Weg“ (3–5), „bildest du selbst“ (6–7).

export const LV_MIN_AFTER_ERROR = 2;

export function groupOf(lv: number): 'recognize' | 'onway' | 'produce' {
  return lv <= 2 ? 'recognize' : lv <= 5 ? 'onway' : 'produce';
}

/** Ist die Schwelle für den Aufstieg von `lex.lv` auf `lex.lv + 1` erreicht (Spur-Stand NACH der Buchung)? Am Einführungstag regeln die Lernschritte 1→2→3; danach führt jeder freie richtige Abruf an einem Aufstiegs-Tag von 1/2 auf die nächste Stufe. */
export function canAscend(lex: Lex): boolean {
  const bs = lex.b?.s ?? 0;
  switch (lex.lv) {
    case 1:
    case 2:
      // 2 → 3: freier richtiger Abruf (wie Schritt B) an einem Aufstiegs-Tag; auch nach einem Abstieg auf 2.
      return true;
    case 3:
      return lex.ev.f.length >= 2;
    case 4:
      return lex.ev.f.length >= 3 && bs >= 7;
    case 5:
      return bs >= 21;
    case 6:
      // Stufe 7: 2 eigene, geprüfte Sätze ab Stufe 5; bei Kernwörtern einer gesprochen (Emrahs Antwort 4). Belege kommen ab V4.
      return lex.ev.o >= 2 && (lex.pri !== 'core' || lex.ev.s >= 1);
    default:
      return false;
  }
}

/** Abstieg bei einem Fehler: eine Stufe, nie unter 2. */
export function descend(lv: number): number {
  return lv <= LV_MIN_AFTER_ERROR ? lv : lv - 1;
}
