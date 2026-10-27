// Abgleich-Prüfungen (E1a). Rein.
// - `duplicates`: gleiche Inhalte unter verschiedenen Kennungen (normalisiert).
// - `deEnMismatch`: Wortart oder Einzahl/Mehrzahl passen zwischen Deutsch und Englisch nicht zusammen (vorsichtige Heuristik:
//   nur eindeutige Signale wie „to + Verb“ gegen ein deutsches Hauptwort oder „a/an + Wort“ gegen eine deutsche Mehrzahl mit „die“).

export const dupNorm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Gruppen von Kennungen mit gleichem (normalisiertem) Text; nur Gruppen ab zwei Einträgen. */
export function duplicates(items: ReadonlyArray<{ id: string; text: string }>): string[][] {
  const by = new Map<string, string[]>();
  for (const it of items) {
    const k = dupNorm(it.text);
    if (!k) continue;
    by.set(k, [...(by.get(k) ?? []), it.id]);
  }
  return [...by.values()].filter((g) => g.length > 1);
}

export type DeEnIssue = 'pos' | 'number';

const DE_ARTICLE_SG = /^(ein|eine|einen|einem|einer|der|das|den|dem)\s/i;
const DE_PLURAL = /^die\s+\p{Lu}\p{Ll}+(en|er|e|s|n)\b/u;
/** Deutscher Infinitiv als ganze Angabe oder deren erste Variante („etw. erledigen“, „sich kümmern um“). */
const DE_VERB = /^(?:(?:etw\.|jdn\.|jdm\.|sich|etwas|jemanden|jemandem)\s+)*[\p{Ll}][\p{L}-]*(en|ern|eln|n)(\s|$|,|;|\/)/u;
const DE_NOUN = /^(?:(?:der|die|das|ein|eine)\s+)?\p{Lu}[\p{L}-]+$/u;

export function deEnMismatch(de: string, en: string): DeEnIssue[] {
  const d = de.split(/[,;/]/)[0]!.trim();
  const e = en.trim();
  const out: DeEnIssue[] = [];
  if (/^to\s+\p{L}/u.test(e) && DE_NOUN.test(d) && !DE_VERB.test(d)) out.push('pos');
  if (/^(a|an)\s+\p{L}+$/iu.test(e) && DE_PLURAL.test(d)) out.push('number');
  if (/^(ein|eine)\s/i.test(d) && /^\p{L}+s$/u.test(e) && !/(ss|us|is|ics|ness)$/i.test(e) && !DE_ARTICLE_SG.test(e)) out.push('number');
  return out;
}
