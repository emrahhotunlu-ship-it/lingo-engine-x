import { AUX_PATTERNS } from '../../content/auxForm';
import { hash32, mulberry32, shuffle } from '../random';
import type { ClozeItem } from './cloze';

// Kurze Übung „Verbform nach Hilfsverb“ (Auswertung 15.10.2026, Punkt 5): 5 Muster, je ein Lückensatz. Sie nutzt die Lückenjagd (Eingabe in der Lücke,
// Prüfung `checkCloze` im strengen Modus) und schreibt, wie diese, nichts an Karten (D12). Rein.

/** Anzahl der Muster = Länge einer Runde. */
export const AUX_ROUND = AUX_PATTERNS.length;

/** Kennung der Karten-Ersatzkennung der Übung (kein Wort-Dokument). */
export const AUX_CARD_ID = 'aux';

export function buildAuxDrill(seed: string): ClozeItem[] {
  const rng = mulberry32(hash32(seed));
  const items = AUX_PATTERNS.map((p): ClozeItem => {
    const pick = hash32(`${seed}|${p.id}`) % p.items.length;
    const it = p.items[pick] ?? p.items[0];
    const start = it.sentence.indexOf(it.gap);
    return {
      key: `${AUX_CARD_ID}:${p.id}#${pick}`,
      cardId: AUX_CARD_ID,
      sentence: { sentence: it.sentence, start, end: start + it.gap.length, gap: it.gap },
      gap: it.gap,
      base: it.gap,
      phrase: p.id,
      de: it.de,
      wrongPartners: [],
      strict: true,
      cue: { de: `Verb: ${it.base} (${it.de})`, en: `Verb: ${it.base}` },
      note: p.rule,
    };
  });
  return shuffle(items, rng);
}
