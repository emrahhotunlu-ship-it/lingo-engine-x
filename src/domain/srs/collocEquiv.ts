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

const FILLER = new Set(['not', 'never', 'always', 'also', 'still', 'just', 'already', 'really', 'definitely', 'probably', 'only', 'even', 'ever', 'usually', 'often', 'finally', 'actually', 'then', 'now', 'soon', 'both', 'all']);
const BASE_BEFORE = new Set(['to', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must', "'ll", "won't", "can't", 'cannot', "don't", "doesn't", "didn't", "wouldn't", "couldn't", "shouldn't", "mustn't", 'please']);
const PARTICIPLE_BEFORE = new Set(['have', 'has', 'had', 'having', "'ve", "haven't", "hasn't", "hadn't", 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', "isn't", "aren't", "wasn't", "weren't"]);

/** Welche Form steht an der Lücke? Aus dem Wort davor: to/will/Modalverb → Grundform (0), have/has/had/be → Partizip (3). `null`, wenn der Satz es nicht sagt. */
function formFromSentence(ctx: { sentence: string; start: number } | undefined): number | null {
  if (!ctx) return null;
  const before = words(ctx.sentence.slice(0, Math.max(0, ctx.start)));
  for (let i = before.length - 1; i >= 0; i--) {
    const w = before[i] as string;
    if (FILLER.has(w)) continue;
    if (BASE_BEFORE.has(w)) return 0;
    if (PARTICIPLE_BEFORE.has(w)) return 3;
    return null;
  }
  return null;
}

/**
 * Andere Partner, die in dieser Kollokation genauso richtig sind (in der Form der Lücke). Leer, wenn die Kollokation in keiner Gruppe steht
 * oder die Lücke kein Verb der Gruppe ist. `phrase` = die Wendung („meet a deadline“), `gap` = das Lösungswort, `ctx` = der Satz und die Stelle der Lücke.
 *
 * Die Form wird nicht geraten: Bei Verben mit gleich aussehenden Formen (hit, beat, run, set) gilt die Form aus dem Satz (nach to/will/Modalverb die Grundform,
 * nach have/has/had das Partizip), sonst – steht das Wort so in der Wendung – die Grundform, sonst die Vergangenheit. Lässt sich das nicht bestimmen, zählt eine
 * Alternative nur, wenn ihre Form an allen möglichen Stellen gleich ist (Prüfung A1: „hit the deadline“ darf nie „met/made“ als richtig annehmen).
 */
export function collocAlternatives(phrase: string, gap: string, ctx?: { sentence: string; start: number }): string[] {
  const ws = words(phrase);
  const found = formOf(gap);
  if (!ws.length || !found.length) return [];
  // Die eine Form, die an der Lücke steht (falls bestimmbar).
  let idx: number | null = null;
  if (found.length === 1) idx = (found[0] as { idx: number }).idx;
  else {
    const fromSentence = formFromSentence(ctx);
    if (fromSentence !== null && found.some((f) => f.idx === fromSentence)) idx = fromSentence;
    else if (ws[0] === gap.toLowerCase().trim() && found.some((f) => f.idx === 0)) idx = 0;
  }
  const out = new Set<string>();
  for (const g of COLLOC_GROUPS) {
    const hasNoun = ws.some((w) => g.nouns.some((n) => w === n || w === `${n}s`));
    if (!hasNoun) continue;
    for (const f of found) {
      if (!g.verbs.includes(f.verb)) continue;
      for (const v of g.verbs) {
        if (v === f.verb) continue;
        const forms = VERB_FORMS[v];
        if (!forms) continue;
        // Bestimmte Form → deren Entsprechung; sonst nur, wenn alle möglichen Formen des Verbs dieselbe Alternative ergeben.
        const cands = idx !== null ? [forms[idx]] : found.filter((x) => x.verb === f.verb).map((x) => forms[x.idx]);
        const first = cands[0];
        if (!first || cands.some((c) => c !== first)) continue;
        if (first !== gap.toLowerCase().trim()) out.add(first);
      }
    }
  }
  return [...out];
}

/** Ist `word` ein gleichwertiger Partner zur Lücke (nicht die Lücke selbst)? */
export const isEquivalentPartner = (phrase: string, gap: string, word: string, ctx?: { sentence: string; start: number }): boolean => {
  const w = toUS(word.toLowerCase().trim());
  return collocAlternatives(phrase, gap, ctx).some((a) => a === w);
};
