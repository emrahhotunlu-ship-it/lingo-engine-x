// Wortart als i18n-Schlüssel (Trainer, Einführung, Nachschlagen). Der frühere „Warum"-Absatz
// ist nach Emrahs Rückmeldung (CLAUDE.md A7) durch Bedeutung, Formhinweis und Beispiele ersetzt.

const POS_KEYS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'phrase', 'phrasal', 'pron', 'det']);

export function posKey(pos: string | null): string | null {
  if (!pos) return null;
  const p = pos.toLowerCase();
  const k = p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p;
  return POS_KEYS.has(k) ? `pos_${k}` : null;
}
