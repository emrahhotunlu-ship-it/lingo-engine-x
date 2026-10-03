import { lemmaCandidates } from '../text/lemma';
import { tokenize } from '../text/tokenize';

// „x % neu“ je Text (Neubau N50, LingQ LQ1): Anteil der Inhaltswörter, die weder im eigenen
// Wortschatz noch im eingebauten Wörterbuch stehen. Rein und lokal, ohne KI. Das Wörterbuch
// (4.226 Wörter der alten App) deckt den Grundwortschatz bis B2/C1 ab; was darüber hinausgeht und
// nicht im Wortschatz steht, gilt als neu. Funktionswörter fehlen im Wörterbuch und zählen nie.
// Eigennamen (groß geschrieben mitten im Satz) und Zahlen zählen nicht mit.

/** Funktionswörter und Kurzformen (stehen nicht im Wörterbuch, sind nie „neu“). */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  (
    'a an the and or but nor if of to in on at by for with from as into onto upon than then so too very ' +
    'is are was were be been being am do does did done has have had having will would shall should can could may might must ' +
    'i me my mine myself you your yours yourself yourselves he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves ' +
    'this that these those what which who whom whose when where why how whether there here not no yes any some ' +
    "don't doesn't didn't isn't aren't wasn't weren't won't wouldn't can't couldn't shouldn't haven't hasn't hadn't " +
    "i'm you're he's she's it's we're they're i've you've we've they've i'd you'd he'd she'd we'd they'd i'll you'll he'll she'll we'll they'll " +
    "let's that's there's here's what's who's where's how's cannot ok okay hi hello " +
    'one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand million billion ' +
    'first second third fourth fifth once twice'
  ).split(' '),
);

export type KnownFn = (form: string) => boolean;
/** Wortschatz (Karten) und Wörterbuch als Prüf-Funktionen (Tests setzen Attrappen ein). */
export type Knowledge = { vocab: KnownFn; dict: KnownFn };

export type NewShare = {
  /** Verschiedene gezählte Wörter (ohne Funktionswörter, Namen, Zahlen). */
  total: number;
  /** Davon neu. */
  fresh: number;
  /** Ganzzahliger Anteil in Prozent (0 bei leerem Text). */
  pct: number;
  /** Die neuen Wörter (klein, in Textreihenfolge, höchstens 40). */
  words: string[];
};

const SENTENCE_END = /[.!?:;“”"«»(—–-]\s*$/;

const norm = (w: string): string => w.toLowerCase().replace(/[’‘]/g, "'").replace(/^'+|'+$/g, '');

/**
 * Verschiedene Wortformen eines Texts (klein), ohne Eigennamen mitten im Satz (`names: false`,
 * Standard). Ein großes Wort am Satzanfang zählt klein („Walk me through…“ → walk).
 */
export function textForms(text: string, names = false): string[] {
  const tokens = tokenize(text);
  const out: string[] = [];
  const seen = new Set<string>();
  let prev = '';
  for (const t of tokens) {
    if (t.kind === 'space') continue;
    if (t.kind === 'word') {
      const start = !prev || SENTENCE_END.test(prev);
      const capital = /^[A-Z]/.test(t.text);
      const allCaps = t.text.length > 1 && t.text === t.text.toUpperCase();
      if (names || (!(capital && !start) && !allCaps)) {
        const w = norm(t.text);
        if (w.length > 1 && !seen.has(w)) {
          seen.add(w);
          out.push(w);
        }
      }
    }
    prev = t.text;
  }
  return out;
}

/** Steht die Form oder eine ihrer Grundformen in einer Liste? („negotiated“ → negotiate) */
export function knownBy(form: string, fn: KnownFn): boolean {
  if (fn(form)) return true;
  const base = form.replace(/'s$/, '');
  if (base !== form && fn(base)) return true;
  for (const c of lemmaCandidates(base)) if (fn(c)) return true;
  // Bindestrich-Wörter: bekannt, wenn jeder Teil bekannt ist (follow-up, well-known).
  if (base.includes('-')) {
    const parts = base.split('-').filter(Boolean);
    if (parts.length > 1 && parts.every((p) => FUNCTION_WORDS.has(p) || fn(p) || lemmaCandidates(p).some(fn))) return true;
  }
  return false;
}

const MAX_WORDS = 40;

export function newShare(text: string, known: Knowledge): NewShare {
  let total = 0;
  const words: string[] = [];
  for (const w of textForms(text)) {
    if (FUNCTION_WORDS.has(w) || /\d/.test(w)) continue;
    total++;
    if (knownBy(w, known.vocab) || knownBy(w, known.dict)) continue;
    words.push(w);
  }
  const fresh = words.length;
  return { total, fresh, pct: total ? Math.round((fresh / total) * 100) : 0, words: words.slice(0, MAX_WORDS) };
}
