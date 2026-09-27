import vtestJson from '../../content/legacy/vtest.json';
import vtestEn from '../../content/vtest-en.json';
import { hash32, mulberry32, shuffle } from '../random';

// Aufbau des Wortschatztests (Plan §8.1, E17): 100 Wörter in 10 Häufigkeitsbändern
// (je 1.000 Wörter) und 12 der 30 Pseudowörter, gemischt mit festem Startwert je Lerntag.
// Danach Bedeutungsproben (2 „Ja"-Wörter je Band, höhere Bänder zuerst, ≤ 20) und aktive
// Proben (1 „Ja"-Wort je Band). Bedeutungen in der Oberflächensprache (`vtest-en.json` für EN).

export type VtWord = { w: string; pos: string; de: string; band: number };
export type YesNoItem = { w: string; band: number | null; pseudo: boolean };
export type MeaningItem = { w: string; band: number; options: Array<{ id: string; label: string; correct: boolean }> };
export type ActiveItem = { w: string; band: number; meaning: string };

type Band = { band: number; words: Array<{ w: string; pos: string; de: string }> };

export const VT_WORDS: readonly VtWord[] = (vtestJson.bands as Band[]).flatMap((b) => b.words.map((w) => ({ ...w, band: b.band })));
export const VT_PSEUDO: readonly string[] = vtestJson.pseudo;
export const VT_BANDS = 10;
export const PSEUDO_N = 12;
const EN = (vtestEn as { meanings: Record<string, string> }).meanings;

export const meaningOf = (w: VtWord, lang: 'de' | 'en'): string => (lang === 'en' ? (EN[w.w] ?? w.de) : w.de);

export function rngFor(seed: string): () => number {
  return mulberry32(hash32(seed));
}

/** Ja/Nein-Teil: alle 100 Wörter und 12 Pseudowörter, gemischt. */
export function buildYesNo(seed: string): YesNoItem[] {
  const rng = rngFor(`vt|${seed}`);
  const pseudo = shuffle(VT_PSEUDO, rng).slice(0, PSEUDO_N);
  return shuffle([...VT_WORDS.map((w) => ({ w: w.w, band: w.band, pseudo: false })), ...pseudo.map((w) => ({ w, band: null, pseudo: true }))], rng);
}

/** Bedeutungsproben: 2 „Ja"-Wörter je Band, höhere Bänder zuerst, 4 Optionen gleicher Wortart. */
export function buildMeaning(yes: ReadonlySet<string>, lang: 'de' | 'en', seed: string): MeaningItem[] {
  const rng = rngFor(`vtm|${seed}`);
  const out: MeaningItem[] = [];
  for (let band = VT_BANDS; band >= 1 && out.length < 20; band--) {
    const inBand = shuffle(
      VT_WORDS.filter((w) => w.band === band && yes.has(w.w)),
      rng,
    ).slice(0, 2);
    for (const w of inBand) {
      const pool = shuffle(
        VT_WORDS.filter((x) => x.w !== w.w && x.pos === w.pos && meaningOf(x, lang) !== meaningOf(w, lang)),
        rng,
      ).slice(0, 3);
      const options = shuffle(
        [{ id: w.w, label: meaningOf(w, lang), correct: true }, ...pool.map((x) => ({ id: x.w, label: meaningOf(x, lang), correct: false }))],
        rng,
      );
      out.push({ w: w.w, band, options });
    }
  }
  return out;
}

/** Aktive Proben: je Band ein „Ja"-Wort (nach Möglichkeit keines aus den Bedeutungsproben). */
export function buildActive(yes: ReadonlySet<string>, used: ReadonlySet<string>, lang: 'de' | 'en', seed: string): ActiveItem[] {
  const rng = rngFor(`vta|${seed}`);
  const out: ActiveItem[] = [];
  for (let band = 1; band <= VT_BANDS; band++) {
    const cand = VT_WORDS.filter((w) => w.band === band && yes.has(w.w));
    if (!cand.length) continue;
    const fresh = cand.filter((w) => !used.has(w.w));
    const w = shuffle(fresh.length ? fresh : cand, rng)[0];
    if (w) out.push({ w: w.w, band, meaning: meaningOf(w, lang) });
  }
  return out;
}
