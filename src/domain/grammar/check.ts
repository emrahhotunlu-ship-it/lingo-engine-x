import { alignWords, splitWords } from '../answer/align';
import { typoBudget } from '../answer/check';
import { editDistance } from '../answer/diff';
import { toUS } from '../answer/spelling';
import type { GrammarCheck, GrammarTask } from '../learn/types';
import { lemmaCandidates } from '../text/lemma';
import { legacyNorm } from './key';
import { altFamilies } from './rules';

// Lokale Prüfung einer Grammatikantwort (phase2-plan §5.0, D13). Reihenfolge, die erste Regel gilt:
// 1. gleich (nach `legacyNorm`: Kurzformen wie 've, n't, I'm allgemein aufgelöst, ohne `accepted`),
// 2. britische Schreibweise/britisches Wort → richtig, US-Form als Hinweis (CLAUDE.md A7.3),
// 3. „Auch richtig"-Familien des Regelwerks (that weglassen, were/was, will/going to …) → richtig,
// 3b. `task.alt` (richtig, aber anderes Muster: had statt used to have) → „Auch richtig“ (Art `other`), zählt nie als Fehler,
//    aber nicht als Beleg fürs Muster (siehe `GrammarAnswer.alt`). `accepted` dagegen = gleiche Aufgabe richtig gelöst,
// 4. Tippfehler im Budget → fast richtig,
// 5. sonst falsch; bei freien Formen (transform, correct) mit ≥ 3 Wörtern darf das KI-Urteil
//    gefragt werden (`needsJudge`). Eine unveränderte Satzkorrektur ist immer falsch.
// Eine andere Form desselben Worts ist in der Grammatik KEIN „fast richtig": die Form ist hier
// genau der Lernstoff (works statt work). Das gilt nur für die Lückenjagd (Kollokationen).

const usPhrase = (s: string): string => toUS(s);

const DUAL_VERBS = ['start', 'begin', 'continue', 'like', 'love', 'hate', 'prefer', 'intend', 'propose', 'bother'];
/** Haben zwei Wortformen eine gemeinsame Grundform (studied/studying, tried/trying, made/making)? */
const sameLemma = (a: string, b: string): boolean => {
  if (a === b) return true;
  const la = lemmaCandidates(a);
  return lemmaCandidates(b).some((x) => la.includes(x));
};
/** Gleiche Wortzahl, an jeder Stelle gleiches Wort oder dieselbe Grundform. */
const sameLemmas = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((w, i) => sameLemma(w, b[i] as string));

const PLURAL_SUBJECTS: ReadonlySet<string> = new Set(['we', 'you', 'they', 'these', 'those', 'both', 'all', 'many', 'several', 'few', 'people']);
/** Steht vor „were“ ein Subjekt im Singular (I/he/she/it oder ein Nomen ohne Plural-s)? Nur dann ist „was“ eine Variante. */
const singularSubject = (w: string | undefined): boolean => {
  if (!w) return false;
  if (w === 'i' || w === 'he' || w === 'she' || w === 'it' || w === 'this' || w === 'that' || w === 'there') return true;
  if (PLURAL_SUBJECTS.has(w) || !/^[a-z]+$/.test(w)) return false;
  if (/(?:ing|ed|ly)$/.test(w) || w === 'if' || w === 'wish' || w === 'as' || w === 'though') return false;
  return !/[^s]s$/.test(w);
};
/** „were“ → „was“ nur nach einem Subjekt im Singular (`prev` = letztes Wort vor der Lücke, falls die Antwort mit „were“ beginnt). */
const wasify = (ws: readonly string[], prev: string | undefined): string =>
  ws.map((w, i) => (w === 'were' && singularSubject(i === 0 ? prev : ws[i - 1]) ? 'was' : w)).join(' ');

/** Subjekt nach einem weglassbaren Objekt-„that“ (that I sent …). Ein Subjekt-„that“ (that closed …) darf nie wegfallen. */
const THAT_SUBJECT =
  /^that (?:(?:i|you|we|they|he|she|it|the|a|an|our|my|your|their|his|her|this|these|those) |[a-z]+ (?:is|was|are|were|will|would|has|had|have|can|could|did|does|should|might|may|must) )/;
const PREP_BEFORE_REL: ReadonlySet<string> = new Set(['for', 'in', 'on', 'at', 'with', 'to', 'from', 'of', 'by', 'about', 'under', 'through', 'during', 'without', 'into']);

/** „Auch richtig"-Familie der Antwort (Port von `altCheck`, explain.js:174) oder `null`. `accepted` (optional) begrenzt which/who ↔ that. */
export function altFamily(task: Pick<GrammarTask, 'topic' | 'prompt' | 'answer'> & { accepted?: readonly string[] }, given: string): string | null {
  const famOk = (id: string) => altFamilies().some((f) => f.id === id && f.topics.includes(task.topic));
  const g = splitWords(legacyNorm(given));
  const c = splitWords(legacyNorm(task.answer));
  if (!g.length || !c.length) return null;
  const gs = g.join(' ');
  const cs = c.join(' ');
  if (gs === cs) return null;
  const beforeGap = splitWords(legacyNorm(task.prompt.split(/_{2,}/)[0] ?? '')).at(-1);
  // Nur Verlaufsform (Lösung) → einfache Form (Antwort): „have worked“ statt „have been working“. Umgekehrt nie: eine abgeschlossene, gezählte
  // Handlung („will have sent the invoices“) verträgt keine Verlaufsform (Gegenlesung Englischlehrer).
  if (famOk('perfCont') && c.includes('been') && !g.includes('been') && c.some((w) => /ing$/.test(w)) && sameLemmas(g, c.filter((w) => w !== 'been'))) return 'perfCont';
  if (famOk('thatOpt')) {
    const drop = (x: string) => (THAT_SUBJECT.test(x) ? x.replace(/^that /, '') : x);
    if (drop(gs) === drop(cs)) return 'thatOpt';
  }
  if (famOk('wereWas') && wasify(g, beforeGap) === wasify(c, beforeGap)) return 'wereWas';
  if (famOk('willGoing')) {
    const flat = (x: string) => x.replace(/\b(am|is|are) going to\b/g, 'will');
    if (flat(gs) === flat(cs)) return 'willGoing';
  }
  if (famOk('byAgent')) {
    const cut = (x: string) => x.replace(/\s+by\s+.*$/, '');
    if (cut(gs) === cut(cs) && /\bby\b/.test(gs) !== /\bby\b/.test(cs)) return 'byAgent';
  }
  if (famOk('whichThat') && !/,\s*_{2,}/.test(task.prompt) && g.length === c.length) {
    const REL = /^(which|who|that)$/;
    // Nur „that“ ↔ which/who (Hinweis der Familie). which ↔ who ist kein „Auch richtig“: „The sales rep which …“ bleibt falsch (Gold-Liste).
    // which/who statt „that“ nur, wenn genau dieses Wort schon in der Lösung oder in `accepted` steht (Person oder Sache kennt nur die Aufgabe);
    // „that“ statt which/who nie nach einer Präposition („for which“ → „for that“ ist falsch).
    const listed = (w: string) => [task.answer, ...(task.accepted ?? [])].some((t) => new RegExp(`\\b${w}\\b`).test(legacyNorm(t)));
    const ok = g.every((w, i) => {
      const e = c[i] as string;
      if (w === e) return true;
      if (!REL.test(w) || !REL.test(e)) return false;
      if (e === 'that') return listed(w);
      if (w === 'that') return !PREP_BEFORE_REL.has(c[i - 1] ?? (i === 0 ? (beforeGap ?? '') : ''));
      return false;
    });
    if (ok) return 'whichThat';
  }
  if (famOk('gerInf') && beforeGap && lemmaCandidates(beforeGap.replace(/[^a-z]/g, '')).some((l) => DUAL_VERBS.includes(l))) {
    // to + Grundform ↔ -ing über die Grundform (make/making, plan/planning, bring/bringing); `stem` erkannte likes/loved/proposed nicht.
    const strip = (ws: readonly string[]) => (ws[0] === 'to' ? ws.slice(1) : ws);
    const gg = strip(g);
    const cc = strip(c);
    if ((g[0] === 'to') !== (c[0] === 'to') && sameLemmas(gg, cc) && (gg.some((w) => /ing$/.test(w)) || cc.some((w) => /ing$/.test(w)))) return 'gerInf';
  }
  return null;
}

export type GrammarCheckDeps = {
  /** Eigene Tippfehler-Regel (Standard: Zeichen-Levenshtein im Budget von Phase 1). */
  typo?: (a: string, b: string) => boolean;
};

/** Unterscheiden sich die Antworten nur in Wörtern, die Formen derselben Grundform sind? */
function otherForm(given: string, target: string): boolean {
  const g = splitWords(given);
  const t = splitWords(target);
  if (g.length !== t.length) return false;
  let diff = 0;
  for (let k = 0; k < g.length; k++) {
    const a = g[k] as string;
    const b = t[k] as string;
    if (a === b) continue;
    diff++;
    const la = lemmaCandidates(a);
    if (!lemmaCandidates(b).some((x) => la.includes(x))) return false;
  }
  return diff > 0;
}

/** Wörter, die nie als Tippfehler gelten: Artikel, Präpositionen, kurze Funktionswörter (a/an/the, in/on, than/then, were/where). */
const NEVER_TYPO: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beside', 'between',
  'beyond', 'by', 'despite', 'during', 'except', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside',
  'over', 'past', 'per', 'since', 'through', 'throughout', 'till', 'to', 'toward', 'towards', 'under', 'until', 'upon', 'via', 'with', 'within',
  'without', 'than', 'then', 'there', 'their', 'these', 'those', 'this', 'that', 'where', 'were', 'which', 'while', 'whose', 'would', 'should',
  'could', 'might', 'shall', 'will', 'have', 'has', 'had', 'been', 'being', 'does', 'did', 'done', 'although', 'though', 'unless', 'whether',
]);

/**
 * Tippfehler in EINEM Wort (Gegenlesung Englischlehrer): beide Wörter mit mindestens 4 Buchstaben, Abstand im Budget der Wortlänge (`typoBudget`).
 * Nie ein Tippfehler: Artikel, Präpositionen und Funktionswörter (a advice, in Monday) und Endungen (work/works, studied/studies: gleiche Grundform).
 */
export function wordTypo(a: string, b: string): boolean {
  if (a === b || a.length < 4 || b.length < 4) return false;
  if (NEVER_TYPO.has(a) || NEVER_TYPO.has(b) || sameLemma(a, b)) return false;
  const d = editDistance(a, b);
  return d > 0 && d <= typoBudget(b.length);
}

/** Tippfehler-Regel für ganze Antworten: gleiche Wortzahl, höchstens zwei Wörter abweichend, jedes davon ein Tippfehler im Wort (`wordTypo`). */
const defaultTypo = (a: string, b: string): boolean => {
  const g = splitWords(a);
  const t = splitWords(b);
  if (g.length !== t.length) return false;
  let diff = 0;
  for (let k = 0; k < g.length; k++) {
    const x = g[k] as string;
    const y = t[k] as string;
    if (x === y) continue;
    if (!wordTypo(x, y)) return false;
    diff++;
  }
  return diff > 0 && diff <= 2;
};

export function checkGrammar(task: GrammarTask, givenRaw: string, deps: GrammarCheckDeps = {}): GrammarCheck {
  const typo = deps.typo ?? defaultTypo;
  const raw = givenRaw.trim();
  if (!raw) return { verdict: 'wrong', ops: [], needsJudge: false };
  if (task.type === 'mc') {
    const ok = raw === task.answer.trim() || legacyNorm(raw) === legacyNorm(task.answer);
    return { verdict: ok ? 'correct' : 'wrong', ops: [], needsJudge: false };
  }
  const ops = alignWords(raw, task.answer, { typo });
  const g = legacyNorm(raw);
  const targets = [task.answer, ...task.accepted].map(legacyNorm).filter(Boolean);
  if (targets.includes(g)) {
    const plain = (x: string) =>
      x
        .toLowerCase()
        .replace(/[’‘`´]/g, "'")
        .replace(/[.,!?;:"]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    // Gleich erst nach Auflösen der Kurzformen: dann nennt die Rückmeldung die Kurzform-Regel.
    const contraction = ![task.answer, ...task.accepted].map(plain).includes(plain(raw));
    return contraction ? { verdict: 'correct', kind: 'contraction', ops, needsJudge: false } : { verdict: 'correct', ops, needsJudge: false };
  }
  const us = usPhrase(g);
  if (us !== g && targets.some((t) => usPhrase(t) === us)) return { verdict: 'correct', kind: 'uk', us, ops, needsJudge: false };
  if (targets.some((t) => usPhrase(t) === us)) return { verdict: 'correct', ops, needsJudge: false };
  // whichThat nur gegen die Lösung selbst: über ein akzeptiertes „that“ würde sonst which ↔ who durchrutschen.
  if (altFamily(task, raw) || task.accepted.some((a) => ((f) => f !== null && f !== 'whichThat')(altFamily({ ...task, answer: a }, raw)))) return { verdict: 'correct', kind: 'alt', ops, needsJudge: false };
  if ((task.alt ?? []).map(legacyNorm).some((a) => a && (a === g || usPhrase(a) === us))) return { verdict: 'correct', kind: 'other', ops, needsJudge: false };
  if (task.type === 'correct' && g === legacyNorm(task.prompt)) return { verdict: 'wrong', ops, needsJudge: false };
  // Eine andere Form desselben Worts ist ein Formfehler, kein Tippfehler (work statt works).
  if (targets.some((t) => otherForm(g, t))) return { verdict: 'wrong', kind: 'form', ops, needsJudge: false };
  if (targets.some((t) => typo(g, t))) return { verdict: 'near', kind: 'typo', ops, needsJudge: false };
  const free = task.type === 'transform' || task.type === 'correct';
  return { verdict: 'wrong', ops, needsJudge: free && splitWords(raw).length >= 3 };
}

/**
 * Frei formulierte Umformung/Korrektur ohne Treffer: Ist sie der Lösung sehr ähnlich (gleiche Wörter
 * bis auf eine kleine Abweichung), kann sie eine gültige Variante sein → „nicht sicher prüfbar“.
 * Sonst ist sie falsch. Ersetzt das Warten auf Claude (Emrahs Wunsch 27.09.: Bewertung sofort).
 */
export function closeVariant(task: Pick<GrammarTask, 'answer' | 'accepted'>, given: string): boolean {
  const words = (s: string) => splitWords(legacyNorm(s));
  const g = words(given);
  if (!g.length) return false;
  return [task.answer, ...task.accepted].some((t) => {
    const w = words(t);
    if (!w.length || Math.abs(w.length - g.length) > 2) return false;
    const pool = [...w];
    let hit = 0;
    for (const x of g) {
      const i = pool.indexOf(x);
      if (i >= 0) {
        hit++;
        pool.splice(i, 1);
      }
    }
    return hit / Math.max(w.length, g.length) >= 0.75;
  });
}

// ------------------------------------------------------------------ Neue Aufgabenarten (Lernplattform 2.0 §4.7)

/** Zahl der Wahlmöglichkeiten für die Rate-Wahrscheinlichkeit (`guessOf`): meaning a/b/beide = 3, find = Wortzahl, sonst die Optionen. */
export function guessOptions(task: Pick<GrammarTask, 'type' | 'prompt' | 'options'>): number | null {
  if (task.type === 'meaning') return 3;
  if (task.type === 'find') return Math.max(1, splitWords(task.prompt).length);
  return task.options?.length ?? null;
}

/**
 * Umschreibung mit Schlüsselwort: Das Schlüsselwort muss unverändert und ausgeschrieben dastehen (sonst „falsch“, Art `key`),
 * sonst gilt dieselbe Prüfung wie bei einer Lücke (`answer`/`accepted`, Kurzformen, US-Form, Tippfehler). Außerhalb der erlaubten
 * Wortzahl gibt es keinen Treffer (Art `words`). Eine frei formulierte, fast gleiche Lösung darf wie bei Umformungen als „nicht sicher prüfbar“ gelten.
 */
export function checkKwt(task: GrammarTask, given: string): GrammarCheck {
  const x = task.x?.kind === 'kwt' ? task.x : null;
  const base = checkGrammar({ ...task, type: 'gap' }, given);
  const raw = given.trim();
  if (!raw) return base;
  const w = splitWords(raw);
  const hasKey = !x || splitWords(legacyNorm(raw)).includes(x.key.toLowerCase());
  if (!hasKey) return { ...base, verdict: 'wrong', kind: 'key', needsJudge: false };
  if (base.verdict === 'wrong' && x && (w.length < x.words[0] || w.length > x.words[1])) return { ...base, kind: 'words', needsJudge: false };
  return base.verdict === 'wrong' ? { ...base, needsJudge: w.length >= 3 } : base;
}

const overlaps = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] <= b[1] && a[1] >= b[0];

/**
 * „Fehler finden“: Schritt 1 (`tapped`) prüft nur die Stelle (Wort oder Bereich antippen, `'none'` = „Kein Fehler“), Schritt 2 (`replacement`)
 * den Ersatz des Bereichs. `found` sagt, ob die Stelle getroffen ist. Ein fehlerfreier Satz (`err: null`) ist nur mit `'none'` richtig.
 */
export function checkFind(task: GrammarTask, step: { tapped: [number, number] | 'none' } | { replacement: string }): GrammarCheck & { found?: boolean } {
  const x = task.x?.kind === 'find' ? task.x : null;
  const err = x?.err ?? null;
  if ('tapped' in step) {
    const found = step.tapped === 'none' ? err === null : err !== null && overlaps(step.tapped, err);
    return { verdict: found ? 'correct' : 'wrong', ops: [], needsJudge: false, found };
  }
  if (err === null) return { verdict: 'wrong', ops: [], needsJudge: false, found: false };
  const given = step.replacement.trim();
  if (!task.answer.trim()) return { verdict: given ? 'wrong' : 'correct', ops: [], needsJudge: false, found: true };
  return { ...checkGrammar({ ...task, type: 'gap' }, given), needsJudge: false, found: true };
}

/** Bedeutungspaar: `a`, `b` oder `both`. */
export function checkMeaning(task: GrammarTask, pick: 'a' | 'b' | 'both'): GrammarCheck {
  return { verdict: pick === task.answer ? 'correct' : 'wrong', ops: [], needsJudge: false };
}

// ------------------------------------------------------------------ „Auch richtig“ durch Claude (grammar-fit@1)

/**
 * Darf bei dieser abgelehnten Antwort gefragt werden, ob sie im ganzen Satz trotzdem richtig ist? Nur Lücken (`gap`, Umformung mit Lücke) mit
 * Grammatik-Muster und ein echtes, lokal als falsch geprüftes Ergebnis. Nicht bei Schlüsselwort (das Wort ist Pflicht), Auswahl, Fehlersuche,
 * Bedeutungspaaren, Ganzsatz-Eingabe und nicht bei Formfehlern (work statt works: die Form ist der Lernstoff).
 */
export function fitAskable(task: Pick<GrammarTask, 'type' | 'prompt' | 'pat'>, check: Pick<GrammarCheck, 'verdict' | 'kind'>, given: string): boolean {
  if (check.verdict !== 'wrong' || check.kind === 'form' || check.kind === 'key' || check.kind === 'words') return false;
  if (!task.pat) return false;
  const gapPrompt = task.type === 'transform' ? (task.prompt.split('→').pop() ?? '') : task.prompt;
  if (task.type !== 'gap' && task.type !== 'transform') return false;
  if (!/_{3,}/.test(gapPrompt)) return false;
  const words = splitWords(given);
  return words.length >= 1 && words.length <= 8 && given.trim().length <= 80;
}

/** „Ersetze nur die markierte Stelle“: darf der getippte Ersatz von Claude im ganzen Satz geprüft werden? (Lokal falsch, kurz, nicht leer.) */
export function fitAskableReplace(check: Pick<GrammarCheck, 'verdict' | 'kind'>, given: string): boolean {
  if (check.verdict !== 'wrong' || check.kind === 'form') return false;
  const words = splitWords(given);
  return words.length >= 1 && words.length <= 8 && given.trim().length <= 80;
}

/** Aus „falsch“ wird durch das KI-Urteil „Auch richtig“ (nur bei `fits && certain`, das prüft der Aufrufer). */
export function asAlsoRight(check: GrammarCheck): GrammarCheck {
  return { ...check, verdict: 'correct', kind: 'other', needsJudge: false };
}
