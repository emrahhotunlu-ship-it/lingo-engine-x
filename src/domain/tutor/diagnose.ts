import { FALSE_FRIENDS } from '../../content/falseFriends';
import { alignWords, splitWords } from '../answer/align';
import { typoBudget } from '../answer/check';
import { editDistance } from '../answer/diff';
import { legacyNorm } from '../grammar/key';
import { foreignSignalPattern, patternOf, patternsOf, whyFor } from '../grammar/patterns';
import { splitTransform } from '../grammar/tasks';
import type { GrammarTask } from '../learn/types';
import { auxFormEvent } from '../text/auxForm';
import { lemmaCandidates } from '../text/lemma';
import { explainOps, type ExplainOp } from './explainOps';
import { l1Matches, l1Text, type L1Entry } from './l1';
import { isUseId, type Cause, type RefId } from './tutorTypes';

// Ursache einer abweichenden Antwort (Tutor-Engine v3 §1.1, §4.1, §6.2). Rein, ohne KI, deterministisch. Läuft erst NACH der „Auch richtig“-Prüfung
// (`judge`): Was hier ankommt, ist weder Lösung noch `accepted`, britische Form, Familie, `task.alt`, `fitAlt` oder `errAlt`.
//
// Die Ursache entscheidet mit, ob „falsch“ gesagt werden darf (Regel 4.1): nur bei `known` (bekannte falsche Form: Übertragungstabelle mit
// kind 'error', falscher Freund, Begründungsregel der Aufgabe, Signalwort-Konflikt) oder bei einer Ursache aus `WRONG_CAUSES`
// (form | auxform | order | span). Alles andere ist eine Vermutung (`likely`/`none`) und trägt allein kein „falsch“.
// Hinweise der Übertragungstabelle (`kind:'note'`) erzeugen nie ein Fehlerurteil: Sie setzen höchstens `l1`, nie `known`.

export type Diagnosis = {
  cause: Cause;
  /** Gegenmuster: das Muster bzw. der Gebrauch, den die Antwort stattdessen zeigt. */
  vs: RefId | null;
  /** Kennung aus `content/tutor/l1.json` (Fehler oder Hinweis). */
  l1: string | null;
  /** Wortbereich der Abweichung in der Antwort (0-basiert, einschließlich). */
  span: [number, number] | null;
  ops: ExplainOp[];
  conf: 'sure' | 'likely' | 'none';
  /**
   * Bekannte falsche Form (Regel 4.1 a): Treffer in der Übertragungstabelle (Fehler), falscher Freund, Begründungsregel der Aufgabe oder
   * Signalwort-Konflikt. Ergänzung gegenüber §6.2 (dort nicht genannt), rückwärtskompatibel.
   */
  known: boolean;
};

const NONE: Diagnosis = { cause: 'unknown', vs: null, l1: null, span: null, ops: [], conf: 'none', known: false };

const GAP_FILL = /_{3,}(\s*\([^)]*\))?/;
const GAP = /_{3,}/;

export const PREPS: ReadonlySet<string> = new Set([
  'about', 'across', 'after', 'against', 'among', 'at', 'before', 'between', 'by', 'during', 'for', 'from', 'in', 'into', 'of', 'on', 'onto',
  'over', 'per', 'since', 'through', 'till', 'to', 'toward', 'towards', 'under', 'until', 'upon', 'via', 'with', 'within', 'without',
]);
/** Funktionswörter: zählen nicht als Inhaltswort (Plausibilität, Wortwahl). */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...PREPS,
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'us', 'them', 'and', 'or', 'but', 'so', 'if', 'when', 'while', 'as', 'than', 'not', 'no', 'do', 'does', 'did', 'be', 'am', 'is', 'are',
  'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'there', 'who',
  'which', 'what', 'whose', 'whom',
]);
/** Wörter, deren Fehlen eine Antwort nicht unvollständig macht (Adverbien des Satzbaus). */
const OPTIONAL_WORDS: ReadonlySet<string> = new Set(['already', 'just', 'still', 'also', 'really', 'always', 'never', 'ever', 'yet', 'even', 'only', 'recently', 'now', 'then', 'that']);
/** Satz-Einleiter, die eine Fehlerstelle umrahmen, ohne den Fehler zu beheben („While walking to work, …“ bleibt ein hängendes Partizip). */
const FRAME_WORDS: ReadonlySet<string> = new Set(['while', 'whilst', 'when', 'as', 'after', 'before', 'on', 'upon', 'by', 'during', 'once', 'since']);
/** Partner eines Gebrauchsmusters, die Grammatik statt Wortverbindung sind (`use:avoid+ing`, `use:agree+subject`). */
const GRAMMAR_PARTNERS: ReadonlySet<string> = new Set(['ing', 'inf', 'to-inf', 'obj', 'subject', 'zero', 'person', 'plural', 'clause', 'period', 'deadline', 'adv-obj', 'would', 'will', 'got', 'not']);

const key = (w: string): string => legacyNorm(w).replace(/^'+|'+$/g, '');
const words = (s: string): string[] => splitWords(legacyNorm(s)).map(key).filter(Boolean);
const isTypo = (a: string, b: string): boolean => a.length >= 4 && editDistance(a, b) <= typoBudget(Math.max(a.length, b.length));
const lemmas = (w: string): readonly string[] => lemmaCandidates(w);
const shareLemma = (a: string, b: string): boolean => {
  const la = lemmas(a);
  return lemmas(b).some((x) => la.includes(x));
};
const isContent = (w: string): boolean => w.length > 1 && !FUNCTION_WORDS.has(w);

/** Der Satz, in dem `s` an der Stelle der Antwort steht: Lücke gefüllt, Fehlerbereich ersetzt (find) bzw. `s` selbst (ganzer Satz). */
export function sentenceWith(task: Pick<GrammarTask, 'type' | 'prompt' | 'x'>, s: string, span?: readonly [number, number] | null): string {
  if (task.type === 'find') {
    const err = span ?? (task.x?.kind === 'find' ? task.x.err : null);
    if (!err) return s;
    const w = splitWords(task.prompt);
    return [...w.slice(0, err[0]), s.trim(), ...w.slice(err[1] + 1)].filter(Boolean).join(' ');
  }
  if (task.type === 'correct') return s;
  const target = task.type === 'transform' ? splitTransform(task.prompt).target : task.prompt;
  return GAP.test(target) ? target.replace(GAP_FILL, s.trim()) : s;
}

/** Der Ausgangsbereich (find: die Wörter der Fehlerstelle; correct: der Satz; sonst leer). Eine Antwort, die ihn nur wiederholt, behebt nichts. */
function originalOf(task: GrammarTask): string {
  if (task.type === 'find' && task.x?.kind === 'find' && task.x.err) return splitWords(task.prompt).slice(task.x.err[0], task.x.err[1] + 1).join(' ');
  if (task.type === 'correct') return task.prompt;
  if (task.type === 'transform' && !GAP.test(splitTransform(task.prompt).target)) return splitTransform(task.prompt).from;
  return '';
}

/** Die Lösungen der Aufgabe (Antwortteil, nicht der Satz): `answer` zuerst, dann `accepted`. */
const targetsOf = (task: GrammarTask): string[] => [task.answer, ...task.accepted].filter((t) => t.trim() !== '');

/** Wortbereich (in der Antwort) aller abweichenden Stellen. */
function spanOf(given: string, target: string): [number, number] | null {
  let i = 0;
  let a = -1;
  let b = -1;
  const n = splitWords(given).length;
  for (const o of alignWords(given, target, { typo: isTypo })) {
    const consumes = o.op !== 'del';
    if (o.op !== 'eq') {
      const at = Math.min(i, Math.max(0, n - 1));
      if (a < 0) a = at;
      b = at;
    }
    if (consumes) i++;
  }
  return a < 0 || n === 0 ? null : [a, b];
}

/** Ursache eines Gebrauchsmusters aus dem Partner der richtigen Verbindung: Präposition → prep, Grammatik-Partner → confuse, sonst colloc. */
function causeOfUse(e: L1Entry): Cause {
  const right = e.use ?? '';
  const partner = right.slice(right.indexOf('+') + 1);
  if (PREPS.has(partner)) return 'prep';
  if (GRAMMAR_PARTNERS.has(partner)) return 'confuse';
  return e.use ? 'colloc' : 'confuse';
}

const unique = (xs: readonly string[]): string[] => [...new Set(xs)];

/**
 * Ursache der Antwort `given` (Antwortteil: Lücke, Ersatz der Fehlerstelle, ganzer Satz). `m` (Lernermodell) hebt eine Vermutung auf `sure`,
 * wenn eine offene Annahme genau diese Verwechslung beschreibt; es ändert nie die Ursache.
 */
export function diagnoseAnswer(
  task: GrammarTask,
  given: string,
  m: { hyps: readonly { from: string; to: string; state: string }[] } | null,
): Diagnosis {
  const raw = given.trim();
  if (!raw || task.type === 'mc' || task.type === 'meaning') return NONE;
  const targets = targetsOf(task);
  if (!targets.length) return NONE;
  const gw = words(raw);
  // Nächste Lösung: die mit den wenigsten Abweichungen.
  let best = targets[0] as string;
  let bestOps = explainOps(raw, best);
  for (const t of targets.slice(1)) {
    const o = explainOps(raw, t);
    if (o.length < bestOps.length) {
      best = t;
      bestOps = o;
    }
  }
  const ops = bestOps;
  const span = spanOf(raw, best);
  const givenS = sentenceWith(task, raw);
  const expectedS = task.type === 'find' && task.x?.kind === 'find' && task.x.fixed && best === task.answer ? task.x.fixed : sentenceWith(task, best);
  const out = (cause: Cause, conf: Diagnosis['conf'], known: boolean, extra: Partial<Pick<Diagnosis, 'vs' | 'l1' | 'span'>> = {}): Diagnosis => {
    const d: Diagnosis = { cause, vs: extra.vs ?? null, l1: extra.l1 ?? null, span: extra.span === undefined ? span : extra.span, ops, conf, known };
    return upgrade(d, task, m);
  };

  // 1. Unverändert: Die Antwort wiederholt die Fehlerstelle bzw. den Ausgangssatz.
  const orig = originalOf(task);
  if (orig && legacyNorm(orig) === legacyNorm(raw)) return out('span', 'sure', true);

  // 2. Nur Tippfehler.
  if (ops.length > 0 && ops.every((o) => o.op === 'typo')) return out('typo', 'sure', false);

  // 3. Verbform nach Hilfsverb (will worked, has went).
  if (auxFormEvent(givenS, expectedS)) return out('auxform', 'sure', true);

  // 4. Übertragung aus dem Deutschen (Tabelle). Hinweise merken nur die Kennung.
  //    Der Treffer muss die Antwort berühren; eine Präpositionslücke („waiting ___ their answer“) mit einer Antwort ganz ohne Präposition
  //    ist keine Übertragung, sondern eine andere Wortart (sonst würde „am working“ dort zu „seit + Verlauf“).
  const marker = '\u0001';
  const withMarker = sentenceWith(task, marker);
  const at = withMarker.indexOf(marker);
  const range: [number, number] | null = at < 0 ? null : [l1Text(withMarker.slice(0, at)).length, l1Text(withMarker.slice(0, at)).length + l1Text(raw).length + 1];
  const prepGap = targets.every((t) => words(t).length > 0 && words(t).every((w) => PREPS.has(w))) && !gw.some((w) => PREPS.has(w));
  const l1 = prepGap ? [] : l1Matches(givenS, expectedS, range);
  const l1err = l1.find((e) => e.kind === 'error');
  if (l1err) return out(l1err.pat ? 'confuse' : causeOfUse(l1err), 'sure', true, { vs: l1err.vs, l1: l1err.id });
  const note = l1.find((e) => e.kind === 'note')?.id ?? null;

  // 5. Andere Form desselben Worts (work statt works).
  const formOf = (t: string): boolean => {
    const tw = words(t);
    if (tw.length !== gw.length) return false;
    let diff = 0;
    for (let k = 0; k < tw.length; k++) {
      const a = gw[k] as string;
      const b = tw[k] as string;
      if (a === b) continue;
      diff++;
      if (!shareLemma(a, b)) return false;
    }
    return diff > 0;
  };
  if (targets.some(formOf)) return out('form', 'sure', false, { l1: note });

  // 6. Fehler finden: Der Ersatz behält den Fehler (nur umgebeugt oder umrahmt: „Walked to work,“, „While walking to work,“).
  if (task.type === 'find' && orig) {
    const ow = words(orig);
    const olem = new Set(ow.flatMap((w) => [...lemmas(w)]));
    const keeps = (ws: readonly string[]): boolean => ws.length > 0 && ws.every((w) => FRAME_WORDS.has(w) || lemmas(w).some((x) => olem.has(x)));
    if (keeps(gw)) {
      const reinflect = targets.some((t) => keeps(words(t)));
      return out(reinflect ? 'form' : 'span', 'sure', true, { l1: note });
    }
  }

  // 7. Gleiche Wörter, andere Reihenfolge.
  const sorted = (ws: readonly string[]): string => [...ws].sort().join(' ');
  if (gw.length > 1 && targets.some((t) => sorted(words(t)) === sorted(gw) && words(t).join(' ') !== gw.join(' '))) return out('order', 'sure', false, { l1: note });

  // 8. Bereich: Es fehlen tragende Wörter der Lösung, oder die Antwort wiederholt Wörter neben der Lücke.
  const dels = ops.filter((o) => o.op === 'del');
  const ins = ops.filter((o) => o.op === 'ins');
  if (ops.length > 0 && dels.length === ops.length && dels.some((o) => !OPTIONAL_WORDS.has(key(o.e)))) return out('span', 'sure', false, { l1: note });
  if (ops.length > 0 && ins.length === ops.length && task.type !== 'find' && task.type !== 'correct') {
    const ctx = new Set(words(task.prompt.replace(GAP_FILL, ' ')));
    if (ins.every((o) => ctx.has(key(o.g)))) return out('span', 'likely', false, { l1: note });
  }

  // 9. Falscher Freund (eindeutiges Muster).
  const ff = FALSE_FRIENDS.find((f) => f.bad !== null && f.bad.test(givenS) && !f.bad.test(expectedS));
  if (ff) return out('lexis', 'sure', true, { l1: note });

  // 10. Begründungsregel der Aufgabe zu genau dieser falschen Antwort.
  const rule = whyFor(task, { given: raw }).rule;
  if (rule && (rule.if?.length || rule.not?.length)) {
    const vs = rule.pat ? (rule.pat.includes(':') ? rule.pat.slice(rule.pat.indexOf(':') + 1) : rule.pat) : null;
    const known = !!rule.if?.length && rule.cat !== 'register';
    if (rule.cat === 'register') return out('unknown', 'likely', false, { l1: note });
    if (rule.cat === 'calque' || rule.cat === 'meaning') return out('lexis', 'likely', known, { l1: note });
    if (rule.cat === 'partner') return out(ops.length === 1 && PREPS.has(key(ops[0]?.g ?? '')) ? 'prep' : 'colloc', 'likely', known, { vs, l1: note });
    return out('confuse', 'likely', known, { vs, l1: note });
  }

  // 11. Signalwort-Konflikt: Die Antwort bringt ein Signalwort eines anderen Musters desselben Themas in den Satz.
  const tp = patternsOf(task.topic);
  const pat = patternOf(task)?.id ?? null;
  if (tp && pat) {
    const f = foreignSignalPattern(tp, pat, givenS);
    if (f && !foreignSignalPattern(tp, pat, expectedS)) return out('confuse', 'likely', true, { vs: f, l1: note });
  }

  // 12. Eine Präposition gegen eine andere getauscht.
  const subs = ops.filter((o) => o.op === 'sub');
  if (ops.length === 1 && subs.length === 1) {
    const g = key(subs[0]?.g ?? '');
    const e = key(subs[0]?.e ?? '');
    if (PREPS.has(g) && PREPS.has(e)) {
      const sw = words(givenS);
      const at = sw.indexOf(g);
      const prev = at > 0 ? (sw[at - 1] as string) : '';
      // Das Wort davor in der getippten Form (keine geratene Grundform: „agreed“ → agre wäre schlimmer als zwei Schlüssel).
      const id = `use:${prev}+${g}`;
      return out('prep', 'likely', false, { vs: prev && isUseId(id) ? id : null, l1: note });
    }
  }

  // 13. Anderes Inhaltswort.
  if (subs.some((o) => isContent(key(o.g)) && isContent(key(o.e)) && !shareLemma(key(o.g), key(o.e)))) return out('lexis', 'likely', false, { l1: note });

  return out('unknown', 'none', false, { l1: note });
}

/** Eine offene Annahme mit genau dieser Verwechslung (Muster der Aufgabe → `vs`) macht aus einer Vermutung ein `sure`. */
function upgrade(d: Diagnosis, task: GrammarTask, m: { hyps: readonly { from: string; to: string; state: string }[] } | null): Diagnosis {
  if (!m || d.conf !== 'likely' || !d.vs) return d;
  const from = unique([task.pat ?? '', patternOf(task)?.id ?? ''].filter(Boolean));
  return m.hyps.some((h) => h.state === 'open' && h.to === d.vs && (from.length === 0 || from.includes(h.from))) ? { ...d, conf: 'sure' } : d;
}

/** Hat die Antwort ein Inhaltswort mit einer Lösung gemeinsam (gleiche Grundform)? Grundlage der Plausibilität in `judge`. */
export function sharesContent(task: Pick<GrammarTask, 'answer' | 'accepted'>, given: string): boolean {
  const gl = new Set(words(given).filter(isContent).flatMap((w) => [...lemmas(w)]));
  if (!gl.size) return false;
  return [task.answer, ...task.accepted].some((t) => words(t).filter(isContent).some((w) => lemmas(w).some((x) => gl.has(x))));
}
