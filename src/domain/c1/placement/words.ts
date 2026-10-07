import { hash32, mulberry32, shuffle } from '../../random';
import { VT_PSEUDO, VT_WORDS } from '../../vtest/build';

// Einstufung, Teil 1 „Wörter“ (Lernplattform 3.0 §4.2, P34): „Kenne ich / Kenne ich nicht“ zu echten Wörtern der Bänder 2 bis 6 (je Band 6 Wörter) und
// 8 Pseudowörtern. Gerechnet wird wie beim Wortschatztest (Fehlalarmquote korrigiert die Treffer), aber nur grob: Ergebnis ist eine Spanne in
// hundert Wörtern, nie eine genaue Zahl. Band 1 (die 1.000 häufigsten Wörter) gilt als bekannt. Rein: kein Zufall außer dem festen Startwert.

export const WORD_BANDS: readonly number[] = [2, 3, 4, 5, 6];
export const PER_BAND = 6;
export const PSEUDO_SHOWN = 8;
/** Die Spanne gilt für die so vielen häufigsten Wörter. */
export const WORD_SCOPE = 6000;

export type WordProbe = { w: string; pseudo: boolean; band: number | null };

/** Die Wörter des Teils, gemischt, mit festem Startwert (z. B. dem Lerntag). */
export function buildWordProbe(seed: string): WordProbe[] {
  const rng = mulberry32(hash32(`place-words|${seed}`));
  const real = WORD_BANDS.flatMap((band) =>
    shuffle(
      VT_WORDS.filter((w) => w.band === band),
      rng,
    )
      .slice(0, PER_BAND)
      .map((w) => ({ w: w.w, pseudo: false, band })),
  );
  const pseudo = shuffle(VT_PSEUDO, rng)
    .slice(0, PSEUDO_SHOWN)
    .map((w) => ({ w, pseudo: true, band: null }));
  return shuffle<WordProbe>([...real, ...pseudo], rng);
}

const round100 = (x: number): number => Math.round(x / 100) * 100;
const clamp = (x: number): number => Math.max(1000, Math.min(WORD_SCOPE, x));

/** Spanne `[von, bis]` bekannter Wörter unter den häufigsten `WORD_SCOPE`. */
export function wordSpan(probe: readonly WordProbe[], yes: ReadonlySet<string>): [number, number] {
  const pseudo = probe.filter((p) => p.pseudo);
  const f = pseudo.length ? pseudo.filter((p) => yes.has(p.w)).length / pseudo.length : 0;
  let total = 1000;
  let variance = 0;
  for (const band of WORD_BANDS) {
    const ws = probe.filter((p) => p.band === band);
    if (!ws.length) continue;
    const h = ws.filter((p) => yes.has(p.w)).length / ws.length;
    const k = f >= 1 ? 0 : Math.max(0, Math.min(1, (h - f) / (1 - f)));
    total += 1000 * k;
    variance += (1000 * 1000 * k * (1 - k)) / ws.length;
  }
  const se = Math.sqrt(variance);
  return [round100(clamp(total - 1.64 * se)), round100(clamp(total + 1.64 * se))];
}
