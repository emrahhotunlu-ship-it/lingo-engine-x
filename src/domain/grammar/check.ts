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
// 4. Tippfehler im Budget → fast richtig,
// 5. sonst falsch; bei freien Formen (transform, correct) mit ≥ 3 Wörtern darf das KI-Urteil
//    gefragt werden (`needsJudge`). Eine unveränderte Satzkorrektur ist immer falsch.
// Eine andere Form desselben Worts ist in der Grammatik KEIN „fast richtig": die Form ist hier
// genau der Lernstoff (works statt work). Das gilt nur für die Lückenjagd (Kollokationen).

const usPhrase = (s: string): string => toUS(s);

const DUAL_VERBS = ['start', 'begin', 'continue', 'like', 'love', 'hate', 'prefer', 'intend', 'propose', 'bother'];
const isIng = (w: string) => /ing$/.test(w) && w.length > 4;
const isEd = (w: string) => /ed$/.test(w) && w.length > 3;
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
const aspectCanon = (arr: readonly string[]) =>
  arr
    .filter((w) => w !== 'been')
    .map((w) => (isIng(w) || isEd(w) ? stem(w) : w))
    .join(' ');

/** „Auch richtig"-Familie der Antwort (Port von `altCheck`, explain.js:174) oder `null`. */
export function altFamily(task: Pick<GrammarTask, 'topic' | 'prompt' | 'answer'>, given: string): string | null {
  const famOk = (id: string) => altFamilies().some((f) => f.id === id && f.topics.includes(task.topic));
  const g = splitWords(legacyNorm(given));
  const c = splitWords(legacyNorm(task.answer));
  if (!g.length || !c.length) return null;
  const gs = g.join(' ');
  const cs = c.join(' ');
  if (gs === cs) return null;
  if (famOk('perfCont') && g.includes('been') !== c.includes('been') && aspectCanon(g) === aspectCanon(c)) return 'perfCont';
  if (famOk('thatOpt') && gs.replace(/^that /, '') === cs.replace(/^that /, '')) return 'thatOpt';
  if (famOk('wereWas') && gs.replace(/\bwere\b/g, 'was') === cs.replace(/\bwere\b/g, 'was')) return 'wereWas';
  if (famOk('willGoing')) {
    const flat = (x: string) => x.replace(/\b(am|is|are) going to\b/g, 'will');
    if (flat(gs) === flat(cs)) return 'willGoing';
  }
  if (famOk('byAgent')) {
    const cut = (x: string) => x.replace(/\s+by\s+.*$/, '');
    if (cut(gs) === cut(cs) && /\bby\b/.test(gs) !== /\bby\b/.test(cs)) return 'byAgent';
  }
  if (famOk('whichThat') && !/,\s*_{2,}/.test(task.prompt)) {
    const unify = (x: string) => x.replace(/\b(which|who|that)\b/g, 'that');
    if (unify(gs) === unify(cs)) return 'whichThat';
  }
  if (famOk('gerInf')) {
    const before = (task.prompt.split(/_{2,}/)[0] ?? '').trim().split(/\s+/).pop() ?? '';
    const bs = stem(legacyNorm(before).replace(/[^a-z]/g, ''));
    if (DUAL_VERBS.includes(bs)) {
      const flat = (x: string) => x.replace(/^to /, '').replace(/ing\b/g, '');
      if (flat(gs) === flat(cs)) return 'gerInf';
    }
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

const defaultTypo = (a: string, b: string): boolean => {
  const d = editDistance(a, b);
  return d > 0 && d <= typoBudget(b.length);
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
  if (altFamily(task, raw) || task.accepted.some((a) => altFamily({ ...task, answer: a }, raw))) return { verdict: 'correct', kind: 'alt', ops, needsJudge: false };
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
