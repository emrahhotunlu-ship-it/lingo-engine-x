import { normalizeWord } from '../text/tokenize';

// Ist eine Wortgruppe eine feste Einheit? (Emrahs Meldung 26.10.2026: Karte „adaptive attempts“ = „adaptive Angriffsversuche“ aus einem
// Tagesartikel. Üblich ist „adaptive attacks“; „adaptive attempts“ ist ein zufälliger Ausschnitt mit freier Übersetzung.)
//
// Rein und deterministisch, ohne KI. Die Prüfung sagt nur „ok“ oder „prüfen“ – sie löscht nie etwas. Hohe Trefferquote vor
// Vollständigkeit (wie der Fehlersatz-Wächter `repair/gate.ts`): „prüfen“ nur bei klaren Anzeichen einer freien Gruppe oder eines
// Bruchstücks; alles, was in den Wörterbuch- und Kollokationsdaten belegt ist, gilt als Einheit.
//
//  ok:     single (ein Wort) · known (belegt) · phrasal (Verb + Partikel) · fixed (feste Struktur mit Funktionswort: come to terms with)
//          · verb_phrase (Verb + Ergänzung) · compound (Nomen + Nomen, Bindestrich-Wort + Nomen) · adj_noun (Adjektiv + Nomen, kein Anzeichen)
//          · phrase (sonst)
//  check:  free_combo (Lehrer-Sperrliste `units.json` → `free`; Adjektiv + allgemeines Nomen bzw. allgemeines Adjektiv + Nomen, nicht
//          belegt: „adaptive attempts“, „cheap hardware“)
//          · fragment (enthält eine Zahl wie „15“, mehr als 8 Wörter: ein Satzausschnitt, keine Wendung)
//  Artikel am Anfang zählen nicht („a viable option“ = „viable option“); Rahmen mit Funktionswort („it seems to me that“) bleiben ok.
//
// `better`: eine belegte Fassung mit demselben ersten Wort und ähnlichem zweiten Wort („adaptive attempts“ → „adaptive attacks“), sonst leer.
// `base`: Grundform, wenn die Gruppe mit einem gebeugten Verb beginnt („adds up“ → „add up“); unabhängig vom Urteil.

export type UnitReason = 'single' | 'known' | 'phrasal' | 'fixed' | 'verb_phrase' | 'compound' | 'adj_noun' | 'phrase' | 'free_combo' | 'fragment';
export type UnitVerdict = { verdict: 'ok' | 'check'; reason: UnitReason; detail?: string; better?: string; base?: string };

/** Wortarten, soweit die Prüfung sie braucht. */
export type UPos = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'other';

export type UnitDeps = {
  /** Ist der Schlüssel (`unitKey`) in den Daten belegt? */
  known(key: string): boolean;
  /** Belegte Schlüssel, die mit diesem Wort beginnen (für `better`). */
  startingWith(first: string): readonly string[];
  /** Wortarten eines Worts laut Wörterbuch (gebeugte Formen eingeschlossen); leer = unbekannt. */
  pos(word: string): readonly UPos[];
  /** Mehrwort-Eintrag des eingebauten Wörterbuchs (carry out, according to)? */
  dictPhrase(phrase: string): boolean;
  /**
   * Lehrer-Sperrliste (`units.json` → `free`, Gegenlesung 26.10.2026): `null` = nicht gelistet; sonst die feste Einheit darin bzw. die
   * übliche Fassung (leer, wenn es keine gibt). Geht vor jedem Beleg und jeder Regel.
   */
  free?(key: string): string | null;
};
/** Nur die Wortarten (für `phraseShapeWith`, ohne den Index der belegten Gruppen). */
export type PosDeps = Pick<UnitDeps, 'pos'>;

const ARTICLES: ReadonlySet<string> = new Set(['a', 'an', 'the']);
const DETERMINERS: ReadonlySet<string> = new Set([...ARTICLES, 'this', 'that', 'these', 'those', 'another', 'some', 'any', 'each', 'every', 'my', 'your', 'our', 'their', 'its', 'his', 'her', 'no']);
const POSSESSIVE: ReadonlySet<string> = new Set(['my', 'your', 'our', 'their', 'its', 'his', 'her', "one's", "someone's", "somebody's"]);
const PARTICLES: ReadonlySet<string> = new Set(['up', 'down', 'out', 'off', 'on', 'in', 'over', 'away', 'back', 'through', 'around', 'about', 'along', 'ahead', 'aside', 'forward', 'apart', 'together', 'into', 'onto', 'with', 'for', 'to', 'of', 'at', 'by', 'from', 'after', 'against', 'across']);
const FUNCTION: ReadonlySet<string> = new Set([...DETERMINERS, ...PARTICLES, 'and', 'or', 'but', 'as', 'than', 'own', 'not', 'without', 'within', 'under', 'between', 'before', 'behind', 'beyond', 'upon', 'per', 'via', 'oneself', 'someone', 'something', 'somebody', 'sth', 'sb', 'it', 'them', 'yourself', 'themselves', 'itself']);

/**
 * Nomen mit wenig Eigengewicht: Ein Adjektiv davor bildet fast immer eine freie Gruppe („adaptive attempts“, „new ways“), es sei denn, die
 * Verbindung ist belegt („next step“, „concerted effort“ stehen in `content/lexicon/units.json`).
 */
const GENERAL_NOUNS: ReadonlySet<string> = new Set([
  'attempt', 'try', 'effort', 'way', 'approach', 'step', 'stuff', 'issue', 'matter', 'aspect', 'factor', 'kind', 'type', 'sort', 'area',
  'amount', 'number', 'case', 'change', 'idea', 'situation', 'process', 'measure', 'option', 'example', 'method', 'element', 'item', 'piece',
  'activity', 'move', 'manner', 'instance', 'version', 'feature', 'detail', 'stage',
]);
/**
 * Beschreibende Adjektive ohne Kollokationswert (Größe, Preis, Bewertung, Häufigkeit): vor einem Nomen fast immer frei („cheap hardware“).
 * Bewusst ohne new/other/same/further/significant …, die in festen Wendungen stecken (on the other hand, until further notice).
 */
const GENERAL_ADJS: ReadonlySet<string> = new Set([
  'good', 'bad', 'big', 'small', 'large', 'little', 'important', 'different', 'various', 'several', 'many', 'few', 'simple', 'easy', 'nice',
  'cheap', 'expensive', 'recent', 'modern', 'ordinary', 'typical', 'unfamiliar', 'interesting', 'useful', 'difficult', 'similar', 'relevant',
  'available', 'numerous', 'everyday',
]);
/** Verben, die mit fast jedem Nomen feste Verbindungen bilden (make a good impression): die Ergänzung wird nicht als freie Gruppe gewertet. */
const LIGHT_VERBS: ReadonlySet<string> = new Set(['make', 'take', 'have', 'give', 'do', 'get', 'keep', 'pay', 'set', 'put', 'hold', 'run', 'raise', 'reach', 'draw']);

const ADJ_SUFFIX = /(?:ive|ible|able|ous|ful|less|ical|ic|ary|al|ish|ent|ant)$/;
const NOUN_SUFFIX = /(?:tion|sion|ment|ness|ity|ance|ence|ship|ism|ist|age|ure|ery|ory|er|or)$/;

/** Wort ohne Eigengewicht (Funktionswort, allgemeines Nomen oder Adjektiv): taugt nicht als Einzelkarte anstelle der Gruppe. */
export const isWeakWord = (w: string): boolean => {
  const n = w.toLowerCase();
  return n.length < 3 || FUNCTION.has(n) || GENERAL_NOUNS.has(singular(n)) || GENERAL_ADJS.has(n) || LIGHT_VERBS.has(n);
};

/** Kleine Grundform für Schlüssel: Mehrzahl und 3. Person auf -s fallen weg (companies → company, attacks → attack, adds → add). */
export function singular(w: string): string {
  if (w.length <= 3 || /(?:ss|us|is|ous|'s)$/.test(w)) return w;
  if (/ies$/.test(w) && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(?:ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

const tokensOf = (phrase: string): string[] =>
  normalizeWord(phrase)
    .replace(/[“”"()[\]{}.,;:!?…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/**
 * Vergleichsschlüssel einer Wortgruppe: klein, ohne „to “ am Anfang, ohne Artikel, Possessiva als „one's“, jedes Wort ohne Mehrzahl-s.
 * „to close a deal“, „close the deals“ → „close deal“; „spread on their own“ → „spread on one's own“.
 */
export function unitKey(phrase: string): string {
  let t = tokensOf(phrase);
  if (t[0] === 'to' && t.length > 1) t = t.slice(1);
  return t
    .filter((w) => !ARTICLES.has(w))
    .map((w) => (POSSESSIVE.has(w) ? "one's" : w === 'somebody' || w === 'sb' ? 'someone' : w === 'sth' ? 'something' : singular(w)))
    .join(' ');
}

function posGuess(w: string, deps: PosDeps): ReadonlySet<UPos> {
  const known = deps.pos(w);
  if (known.length) return new Set(known);
  const out = new Set<UPos>();
  if (w.includes('-')) out.add('adj');
  else if (ADJ_SUFFIX.test(w)) out.add('adj');
  if (NOUN_SUFFIX.test(singular(w)) || /s$/.test(w)) out.add('noun');
  if (!out.size) out.add('noun');
  return out;
}

/** Adjektiv, auch Partizip vor dem Nomen (failed attempt, growing number). */
const isAdj = (w: string, deps: PosDeps): boolean => w.includes('-') || posGuess(w, deps).has('adj') || (w.length > 4 && /(?:ed|ing)$/.test(w));
const isNoun = (w: string, deps: PosDeps): boolean => posGuess(w, deps).has('noun');
const isVerb = (w: string, deps: PosDeps): boolean => posGuess(w, deps).has('verb');

/** Grundform eines gebeugten Verbs am Anfang (adds → add, keeps → keep, scheduling → schedule) – nur wenn das Wörterbuch die Grundform als Verb kennt. */
function baseVerb(first: string, deps: PosDeps): string | null {
  const cands: string[] = [];
  if (/[^s]s$/.test(first) && first.length > 3) cands.push(singular(first));
  if (/ing$/.test(first) && first.length > 5) cands.push(first.slice(0, -3), `${first.slice(0, -3)}e`, first.slice(0, -4));
  if (/ed$/.test(first) && first.length > 4) cands.push(first.slice(0, -2), first.slice(0, -1), first.slice(0, -3));
  for (const c of cands) if (c && c !== first && deps.pos(c).includes('verb')) return c;
  return null;
}

/** Belegte Fassung mit demselben ersten Wort und ähnlichem zweiten Wort (gleicher Anfang aus drei Buchstaben), in der Zahl der Vorlage. */
function similarKnown(tokens: readonly string[], deps: UnitDeps): string | undefined {
  if (tokens.length !== 2) return undefined;
  const [a, b] = tokens as [string, string];
  const head = singular(b);
  for (const k of deps.startingWith(a)) {
    const parts = k.split(' ');
    if (parts.length !== 2 || parts[1] === head) continue;
    const other = parts[1] ?? '';
    if (other.slice(0, 3) === head.slice(0, 3)) return `${a} ${b !== head ? (/(?:s|x|z|ch|sh)$/.test(other) ? `${other}es` : /[^aeiou]y$/.test(other) ? `${other.slice(0, -1)}ies` : `${other}s`) : other}`;
  }
  return undefined;
}

/** Freie Adjektiv-Nomen-Gruppe? (`GENERAL_*`, nie bei Bindestrich-Wörtern.) */
function freePair(adj: string, noun: string, deps: UnitDeps): string | null {
  if (adj.includes('-') || !isAdj(adj, deps) || !isNoun(noun, deps)) return null;
  if (deps.known(unitKey(`${adj} ${noun}`))) return null;
  const n = singular(noun);
  if (GENERAL_NOUNS.has(n)) return `general noun "${n}"`;
  if (GENERAL_ADJS.has(adj)) return `general adjective "${adj}"`;
  return null;
}

/** Urteil über eine Wortgruppe (Kartenwort). */
export function lexicalUnitWith(phrase: string, deps: UnitDeps): UnitVerdict {
  let t = tokensOf(phrase);
  if (t[0] === 'to' && t.length > 1) t = t.slice(1);
  while (t.length > 1 && ARTICLES.has(t[0] ?? '')) t = t.slice(1);
  if (t.length <= 1) return { verdict: 'ok', reason: 'single' };
  const base = (() => {
    const b = baseVerb(t[0] ?? '', deps);
    return b ? [b, ...t.slice(1)].join(' ') : undefined;
  })();
  const withBase = (v: UnitVerdict): UnitVerdict => (base ? { ...v, base } : v);

  const listed = deps.free?.(unitKey(phrase)) ?? (base ? (deps.free?.(unitKey(base)) ?? null) : null);
  if (listed !== null) return withBase({ verdict: 'check', reason: 'free_combo', detail: 'teacher list', ...(listed ? { better: listed } : {}) });

  // Wörtlich belegt: das ist schon die Wörterbuchform, keine Grundform ableiten („a growing number of“ bleibt so, nicht „grow number of“).
  if (deps.known(unitKey(phrase))) return { verdict: 'ok', reason: 'known' };
  if (deps.dictPhrase(t.join(' ')) || (base &&(deps.known(unitKey(base)) || deps.dictPhrase(base)))) return withBase({ verdict: 'ok', reason: 'known' });

  // Bruchstücke
  if (t.some((w) => /^\d+(?:[.,]\d+)?%?$/.test(w))) return withBase({ verdict: 'check', reason: 'fragment', detail: 'number' });
  if (t.length > 8) return withBase({ verdict: 'check', reason: 'fragment', detail: 'too long' });

  const first = t[0] ?? '';
  const head = base ? (base.split(' ')[0] ?? first) : first;
  const rest = t.slice(1);

  // Verb + Partikel (carry out, add up, take the guesswork out of)
  if (isVerb(head, deps) && rest.length <= 2 && rest.every((w) => PARTICLES.has(w))) return withBase({ verdict: 'ok', reason: 'phrasal' });

  // Zwei Wörter: Adjektiv + Nomen bzw. Nomen + Nomen
  if (t.length === 2) {
    const [a, b] = t as [string, string];
    const verbFirst = isVerb(head, deps) && !isAdj(a, deps) && !(isNoun(a, deps) && !base && !deps.pos(a).includes('verb'));
    if (!verbFirst || isAdj(a, deps)) {
      const free = freePair(a, b, deps);
      if (free) {
        const better = similarKnown(t, deps);
        return withBase({ verdict: 'check', reason: 'free_combo', detail: free, ...(better ? { better } : {}) });
      }
      if (isAdj(a, deps) && !a.includes('-')) return withBase({ verdict: 'ok', reason: 'adj_noun' });
      if (isNoun(a, deps) || a.includes('-')) return withBase({ verdict: 'ok', reason: 'compound' });
    }
    return withBase({ verdict: 'ok', reason: 'verb_phrase' });
  }

  // Drei Wörter (Adverb/Adjektiv) + Adjektiv + Nomen: das hintere Paar entscheidet.
  if (t.length === 3 && !t.some((w) => FUNCTION.has(w)) && !isVerb(head, deps)) {
    const free = freePair(t[1] ?? '', t[2] ?? '', deps);
    if (free) return withBase({ verdict: 'check', reason: 'free_combo', detail: free });
  }

  // Verb (+ Präposition) + freie Adjektiv-Nomen-Gruppe ohne Artikel (adapt to unfamiliar hardware) – außer nach einem Funktionsverb.
  if (t.length >= 3 && t.length <= 4 && isVerb(head, deps) && !LIGHT_VERBS.has(head) && (t.length === 3 || PARTICLES.has(t[1] ?? ''))) {
    const a = t[t.length - 2] ?? '';
    const n = t[t.length - 1] ?? '';
    const free = !FUNCTION.has(a) ? freePair(a, n, deps) : null;
    if (free) return withBase({ verdict: 'check', reason: 'free_combo', detail: `ends with a free group (${free})` });
  }

  if (t.some((w) => FUNCTION.has(w))) return withBase({ verdict: 'ok', reason: 'fixed' });
  if (isVerb(head, deps)) return withBase({ verdict: 'ok', reason: 'verb_phrase' });
  return withBase({ verdict: 'ok', reason: 'phrase' });
}

/**
 * Bauform eines Kartenworts für Ablenker (Kartenqualität 26.10.2026, Emrahs Meldung „adaptive attempts“ zwischen „keep up with“ und
 * „digitalization“): Optionen sollen dieselbe Bauform haben, sonst verrät die Form die Lösung.
 * `n`: Wortzahl ohne „to“/Artikel am Anfang (höchstens 4). `kind`: Einzelwort mit Wortart, Verb + Partikel, verb-geführt, Adjektiv + Nomen,
 * Nomen + Nomen, Präposition vorn, sonst `group`.
 */
export type PhraseShape = { n: number; kind: 'w-noun' | 'w-verb' | 'w-adj' | 'w-other' | 'phrasal' | 'verb-led' | 'adj-noun' | 'compound' | 'prep-led' | 'group' };

export function phraseShapeWith(phrase: string, deps: PosDeps): PhraseShape {
  let t = tokensOf(phrase);
  const toLed = t[0] === 'to' && t.length > 1;
  if (toLed) t = t.slice(1);
  while (t.length > 1 && ARTICLES.has(t[0] ?? '')) t = t.slice(1);
  const n = Math.min(4, Math.max(1, t.length));
  const first = t[0] ?? '';
  if (t.length <= 1) {
    if (toLed) return { n, kind: 'w-verb' };
    const p = posGuess(first, deps);
    return { n, kind: p.has('verb') && !p.has('noun') ? 'w-verb' : p.has('adj') && !p.has('noun') ? 'w-adj' : p.has('noun') ? 'w-noun' : 'w-other' };
  }
  const rest = t.slice(1);
  const head = baseVerb(first, deps) ?? first;
  const verbish = toLed || deps.pos(head).includes('verb');
  if (verbish && rest.length <= 2 && rest.every((w) => PARTICLES.has(w))) return { n, kind: 'phrasal' };
  if (t.length === 2) {
    const [a, b] = t as [string, string];
    // Partizip oder Adjektiv vor einem Nomen (adaptive attacks, failed attempt) geht vor der Verb-Lesart.
    if (!toLed && !FUNCTION.has(b) && isAdj(a, deps) && isNoun(b, deps) && (!deps.pos(a).includes('verb') || /(?:ed|ing)$/.test(a))) return { n, kind: 'adj-noun' };
    if (!toLed && !verbish && isNoun(a, deps) && isNoun(b, deps)) return { n, kind: 'compound' };
  }
  if (verbish) return { n, kind: 'verb-led' };
  if (PARTICLES.has(first) || first === 'under' || first === 'without' || first === 'beyond') return { n, kind: 'prep-led' };
  return { n, kind: 'group' };
}
