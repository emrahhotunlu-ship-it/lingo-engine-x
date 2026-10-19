// „Auch richtig“ (Art `other`): Text der Zeile „Gesucht war: … – weil …“. Rein, ohne React.

/** Erster Satz der Begründung, höchstens `max` Zeichen (ohne Abschluss-Punkt), sonst leer. */
export function shortWhy(text: string | null | undefined, max = 110): string {
  // Vorspann „Richtig:“ / „Right:“ der Aufgabenbegründung fällt weg (steht dort, weil die Antwort die Lösung ist).
  const t = (text ?? '').trim().replace(/^(?:richtig|right|correct)\s*[:–-]\s*/i, '');
  if (!t) return '';
  const first = (/^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t).replace(/[.!?]+$/, '').trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trimEnd()} …`;
}
