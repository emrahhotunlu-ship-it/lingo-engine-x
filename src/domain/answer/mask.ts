// Buchstaben-Platzhalter der Lücke (CLAUDE.md A7: je Buchstabe ein Platzhalter).
// Die Maske verrät nur Länge und Trennzeichen (Leerzeichen, Bindestrich, Apostroph …),
// nie die Buchstaben – so bleibt die Lösung vor dem Prüfen außerhalb des DOM (Plan §5.1).
// Einzige Ausnahme: der erste Buchstabe, wenn die Stufe oder der „Tipp" ihn ausdrücklich zeigt.

export type MaskCell = { kind: 'slot'; hint?: string } | { kind: 'fixed'; ch: string };

const LETTER = /[\p{L}\p{N}]/u;

/** Eine Zelle je Zeichen der Lösung; `firstLetter` zeigt den ersten Buchstaben als Hilfe. */
export function maskOf(answer: string, opts: { firstLetter?: boolean } = {}): MaskCell[] {
  const chars = Array.from(answer.trim());
  let firstDone = false;
  return chars.map((ch): MaskCell => {
    if (!LETTER.test(ch)) return { kind: 'fixed', ch };
    if (opts.firstLetter && !firstDone) {
      firstDone = true;
      return { kind: 'slot', hint: ch };
    }
    firstDone = true;
    return { kind: 'slot' };
  });
}

/** Anzahl der Buchstaben-Platzhalter. */
export const slotCount = (mask: readonly MaskCell[]): number => mask.filter((c) => c.kind === 'slot').length;
