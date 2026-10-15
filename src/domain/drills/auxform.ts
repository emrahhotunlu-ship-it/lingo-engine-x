import { AUX_KIND_CUE, AUX_PATTERNS, type AuxPattern, type AuxSentence } from '../../content/auxForm';
import { hash32, mulberry32, shuffle } from '../random';
import type { ClozeItem } from './cloze';

// Kurze Übung „Verbform nach Hilfsverb“ (Auswertung 15.10.2026, Punkt 5): 5 Muster, je ein Lückensatz (bei „been“ ein Paar: Dauer und Passiv), zum Schluss ein
// eigener Satz. Sie nutzt die Lückenjagd (Eingabe in der Lücke, Prüfung `checkCloze` im strengen Modus) und schreibt an Karten nichts (D12); falsche
// Antworten werden als Fehlersatz in `app/repair` gemerkt (Prüfung M6). Rein.

/** Anzahl der Lückensätze einer Runde: ein Satz je Muster, „been“ mit Dauer und Passiv. */
export const AUX_GAP_ROUND = AUX_PATTERNS.length + 1;
/** Länge einer Runde: die Lückensätze plus der abschließende eigene Satz. */
export const AUX_ROUND = AUX_GAP_ROUND + 1;

/** Kennung der Karten-Ersatzkennung der Übung (kein Wort-Dokument). */
export const AUX_CARD_ID = 'aux';
/** Schlüssel des abschließenden freien Satzes. */
export const AUX_FREE_KEY = `${AUX_CARD_ID}:free`;

const pickOf = (seed: string, p: AuxPattern, pool: readonly AuxSentence[]): AuxSentence => pool[hash32(`${seed}|${p.id}`) % pool.length] ?? (pool[0] as AuxSentence);

function itemOf(p: AuxPattern, it: AuxSentence, key: string): ClozeItem {
  const start = it.sentence.indexOf(it.gap);
  // „modal“: Die falsche Form steht im Hinweis, die richtige wird eingetippt (genau sein Fehlerbild). Sonst: das Verb in der Grundform, bei „been“ dazu Dauer oder Passiv.
  const extra = it.kind ? AUX_KIND_CUE[it.kind] : null;
  const cue = it.wrong
    ? { de: `Falsche Form: „${it.wrong}“ (${it.de}). Welche Form steht richtig?`, en: `Wrong form: "${it.wrong}". Which form is right here?` }
    : { de: `Verb: ${it.base} (${it.de})${extra ? ` · ${extra.de}` : ''}`, en: `Verb: ${it.base}${extra ? ` · ${extra.en}` : ''}` };
  return {
    key,
    cardId: AUX_CARD_ID,
    sentence: { sentence: it.sentence, start, end: start + it.gap.length, gap: it.gap },
    gap: it.gap,
    base: it.gap,
    phrase: p.id,
    de: it.de,
    wrongPartners: [],
    strict: true,
    cue,
    note: p.rule,
  };
}

export function buildAuxDrill(seed: string): ClozeItem[] {
  const rng = mulberry32(hash32(seed));
  const items: ClozeItem[] = [];
  for (const p of AUX_PATTERNS) {
    if (p.id === 'been') {
      // Gegensatzpaar im selben Durchgang: Dauer (has been working) und Passiv (has been signed).
      for (const kind of ['ongoing', 'passive'] as const) {
        const pool = p.items.filter((x) => x.kind === kind);
        if (!pool.length) continue;
        const it = pickOf(`${seed}|${kind}`, p, pool);
        items.push(itemOf(p, it, `${AUX_CARD_ID}:${p.id}:${kind}#${p.items.indexOf(it)}`));
      }
      continue;
    }
    const it = pickOf(seed, p, p.items);
    items.push(itemOf(p, it, `${AUX_CARD_ID}:${p.id}#${p.items.indexOf(it)}`));
  }
  const free: ClozeItem = {
    key: AUX_FREE_KEY,
    cardId: AUX_CARD_ID,
    sentence: { sentence: '', start: 0, end: 0, gap: '' },
    gap: '',
    base: '',
    phrase: 'free',
    de: '',
    wrongPartners: [],
    strict: true,
    free: true,
  };
  return [...shuffle(items, rng), free];
}
