// „Auch richtig“ (Art `other`): Text der Zeile „Gesucht war: … – weil …“. Rein, ohne React.

/**
 * Erster Satz der Begründung (ohne Abschluss-Punkt), sonst leer. Nie mitten im Satz mit „…“ abgeschnitten (Emrah 05.11.2026: „die Erklärung
 * ist ab der Hälfte mit … gekürzt“): ein langer erster Satz steht ganz da.
 */
export function shortWhy(text: string | null | undefined): string {
  // Vorspann „Richtig:“ / „Right:“ der Aufgabenbegründung fällt weg (steht dort, weil die Antwort die Lösung ist).
  const t = (text ?? '').trim().replace(/^(?:richtig|right|correct)\s*[:–-]\s*/i, '');
  if (!t) return '';
  let first = (/^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t).replace(/[.!?]+$/, '').trim();
  // „früher so, heute nicht mehr: used to + Grundform (have)“ → nur der Teil vor dem Doppelpunkt (die Lösung steht schon davor in der Zeile).
  const colon = first.indexOf(': ');
  if (colon >= 8) first = first.slice(0, colon).trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}
