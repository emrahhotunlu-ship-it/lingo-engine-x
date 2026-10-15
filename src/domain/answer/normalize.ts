// Getippte Antworten vergleichbar machen (Lern-Entwurf §2.2, Architektur-Entwurf §5.6).

export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…|\.\.\./g, ' ')
    // Anführungszeichen und Klammern drumherum sind keine Antwort („make“ = make, Auswertung 15.10.2026, Punkt 2)
    .replace(/["“”„«»]/g, '')
    .replace(/^[([]+|[)\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:]+$/, '')
    .trim();
}

/** Ohne führendes „to " (Verben dürfen ohne Infinitiv-Partikel getippt werden). */
export function withoutTo(s: string): string {
  return s.replace(/^to\s+/, '');
}
