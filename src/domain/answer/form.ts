import irregularJson from '../../content/irregular.json';
import { normalize, withoutTo } from './normalize';

// Welche Form des Worts verlangt die Lücke? Für den Formhinweis nach dem Prüfen
// („Vergangenheit: persuaded"). Unregelmäßige Formen aus content/irregular.json, sonst Endungen.

export type FormKind = 'past' | 'pastPart' | 'ing' | 'third' | 'plural' | 'comparative' | 'superlative' | 'misc';

type Lists = Readonly<Record<string, readonly string[]>>;
const IRR = irregularJson as unknown as { verbs: Readonly<Record<string, Lists>>; nouns: Lists; adjectives: Readonly<Record<string, Lists>> };

const has = (list: readonly string[] | undefined, w: string) => !!list && list.includes(w);

/**
 * Form von `solution` gegenüber der Grundform `lemma`; `null`, wenn beide gleich sind
 * (dann gibt es keinen Formhinweis). Mehrwortig: verglichen wird das erste abweichende Wort.
 */
export function formKind(solution: string, lemma: string, pos: string | null): FormKind | null {
  const sw = withoutTo(normalize(solution)).split(' ');
  const lw = withoutTo(normalize(lemma)).split(' ');
  if (sw.join(' ') === lw.join(' ')) return null;
  const i = sw.findIndex((w, k) => w !== lw[k]);
  const s = sw[i] ?? '';
  const l = lw[i] ?? lw[0] ?? '';
  if (!s || !l) return 'misc';
  const verb = IRR.verbs[l];
  if (verb) {
    if (has(verb.past, s)) return 'past';
    if (has(verb.pp, s)) return 'pastPart';
    if (has(verb.pres, s)) return 'third';
  }
  if (has(IRR.nouns[l], s)) return 'plural';
  const adj = IRR.adjectives[l];
  if (adj) {
    if (has(adj.cmp, s)) return 'comparative';
    if (has(adj.sup, s)) return 'superlative';
  }
  const p = (pos ?? '').toLowerCase();
  if (s.endsWith('ing')) return 'ing';
  if (s.endsWith('ed')) return 'past';
  if (s.endsWith('est')) return 'superlative';
  if (s.endsWith('er') && p.startsWith('adj')) return 'comparative';
  if (s.endsWith('s')) return p.startsWith('noun') ? 'plural' : p.startsWith('verb') || p.startsWith('phrasal') ? 'third' : 'misc';
  return 'misc';
}
