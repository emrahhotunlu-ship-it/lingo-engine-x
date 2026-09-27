import type { Situation } from '../../content/say/situations';
import { sentenceSplit } from '../input/textStats';
import { hash32 } from '../random';
import type { NewRepair } from '../repair/repair';
import type { SayCorrection } from './sayDoc';

// „Sag es“ (Lernberatung 27.09., V1/V2): reine Logik – Situation des Tages und Reparatur-Sätze
// aus den Korrekturen des ERSTEN Durchgangs.

/**
 * Situation des Lerntags: fest je Tag (gleiche Wahl bei jedem Neuzeichnen und auf jedem Gerät),
 * `shift` = wie oft „Andere Situation“ getippt wurde.
 */
export function situationFor(list: readonly Situation[], day: string, shift = 0): Situation | null {
  if (!list.length) return null;
  const base = hash32(`say|${day}`) % list.length;
  return list[(base + Math.max(0, Math.floor(shift))) % list.length] ?? null;
}

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Korrekturen → Reparatur-Sätze. Steht der Ausschnitt `wrong` wörtlich in einem Satz der Antwort,
 * wird der ganze eigene Satz gemerkt („Damals hast du gesagt: …“) und die Korrektur darin ersetzt;
 * sonst bleibt es beim Ausschnitt. `ctx` = Situation.
 */
export function repairsFromCorrections(text: string, corrections: readonly SayCorrection[], ctx: string): NewRepair[] {
  const sentences = sentenceSplit(text).map((s) => s.text.replace(/\s+/g, ' ').trim());
  const out: NewRepair[] = [];
  for (const c of corrections) {
    const wrong = c.wrong.replace(/\s+/g, ' ').trim();
    const right = c.right.replace(/\s+/g, ' ').trim();
    if (!wrong || !right) continue;
    const sentence = sentences.find((s) => norm(s).includes(norm(wrong)));
    let full: { wrong: string; right: string } = { wrong, right };
    if (sentence && sentence.length <= 300) {
      const at = norm(sentence).indexOf(norm(wrong));
      // Gleiche Länge nach `norm` (nur Anführungszeichen und Leerraum vereinheitlicht, Satz schon einfach getrennt).
      const fixed = `${sentence.slice(0, at)}${right}${sentence.slice(at + wrong.length)}`;
      if (at >= 0 && norm(fixed) !== norm(sentence)) full = { wrong: sentence, right: fixed };
    }
    out.push({ wrong: full.wrong, right: full.right, why: c.why, src: 'say', ctx });
  }
  return out;
}
