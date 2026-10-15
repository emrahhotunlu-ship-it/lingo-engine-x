import { COLLOC_GROUPS, VERB_FORMS } from '../../content/collocEquiv';
import { toUS } from '../answer/spelling';

// Gleichwertige Wortpartner einer Kollokation in derselben Form wie die Lücke (Auswertung 15.10.2026, Punkt 2). Rein.
// „meet a deadline“ mit Lücke „meet“ → hit, make, beat; mit Lücke „met“ → hit, made, beat. Britische Schreibweisen (organise) prüft die Antwortprüfung selbst.

const words = (s: string): string[] => s.toLowerCase().replace(/[’‘]/g, "'").split(/[^a-z']+/).filter(Boolean);

/** Welches Verb und welche Form ist das Wort? (`null`, wenn es kein Verb der Tabelle ist.) */
function formOf(word: string): { verb: string; idx: number }[] {
  const w = toUS(word.toLowerCase().trim());
  const out: { verb: string; idx: number }[] = [];
  for (const [verb, forms] of Object.entries(VERB_FORMS)) {
    forms.forEach((f, idx) => {
      if (f === w) out.push({ verb, idx });
    });
  }
  return out;
}

/**
 * Andere Partner, die in dieser Kollokation genauso richtig sind (in der Form der Lücke). Leer, wenn die Kollokation in keiner Gruppe steht
 * oder die Lücke kein Verb der Gruppe ist. `phrase` = die Wendung („meet a deadline“), `gap` = das Lösungswort.
 */
export function collocAlternatives(phrase: string, gap: string): string[] {
  const ws = words(phrase);
  const found = formOf(gap);
  if (!ws.length || !found.length) return [];
  const out = new Set<string>();
  for (const g of COLLOC_GROUPS) {
    const hasNoun = ws.some((w) => g.nouns.some((n) => w === n || w === `${n}s`));
    if (!hasNoun) continue;
    for (const f of found) {
      if (!g.verbs.includes(f.verb)) continue;
      for (const v of g.verbs) {
        if (v === f.verb) continue;
        const form = VERB_FORMS[v]?.[f.idx];
        if (form && form !== gap.toLowerCase()) out.add(form);
      }
    }
  }
  return [...out];
}

/** Ist `word` ein gleichwertiger Partner zur Lücke (nicht die Lücke selbst)? */
export const isEquivalentPartner = (phrase: string, gap: string, word: string): boolean => {
  const w = toUS(word.toLowerCase().trim());
  return collocAlternatives(phrase, gap).some((a) => a === w);
};
