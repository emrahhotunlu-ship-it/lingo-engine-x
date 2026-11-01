import { z } from 'zod';
import { clipped } from '../shared';
import { attempted, nearCopy } from '../domain/used';
import {
  blank,
  checkLang,
  errFor,
  errOf,
  flat,
  hasTarget,
  inText,
  USE_ERRS,
  USE_VERDICTS,
  verdictOf,
  why,
  WHY_MAX,
  type UseErr,
  type UseVerdict,
  type VocabTarget,
} from './common';
import { isWrongLang, type UiLang } from '../shared';

// Urteil je Zielwort, gemeinsam für `vocab-transfer@1` (3–5 Wörter) und `vocab-own-sentence@1` (ein Wort).
// Lokale Gegenprüfung (Plan §7, Kap. 2 „keine Widersprüche“): Claude prüft den Sinn, die App prüft das Vorkommen (`domain/used.ts`).
//  - ok/odd/thin verlangen das Zielwort im Text (gebeugt, mit Einschüben, Kollokation auch im Passiv); bei Kollokation, Wendung und Phrasal Verb
//    reicht ein Versuch am Wort (`attempted`: *hold a presentation* für *give a presentation*). Sonst Schemaverletzung (der eine Neuversuch),
//    im Neuversuch → `unused` (keine Note).
//  - `wrong` gilt nur, wenn die Fundstelle ein Versuch am Zielwort ist; ein richtiges Ausweichwort (*delay* für *postpone*) ist `unused` mit
//    Fundstelle (= ausgewichen, english-teacher Befund 3, learning-scientist Befund 2): nie eine Strafnote ohne Versuch. `wrong` ohne Versuch →
//    Schemaverletzung; im Neuversuch `unused` ohne Folgen.
//  - `unused`, obwohl das Wort oder ein Versuch daran im Text steht → Schemaverletzung; im Neuversuch `unused` ohne Folgen (nie „ausgewichen“).
//  - Urteil und Fehlerklasse müssen zusammenpassen (odd + sense/word → wrong, wrong + form/prep/colloc/register → odd); im Neuversuch angeglichen.
//  - `ok`, aber fast der Beispielsatz der Karte (zusammenhängend bis auf 20 % bzw. 2 Wörter) → `thin` (abgeschrieben zählt nicht, Synthese §2.5).
//  - Gesprochen: Abweichungen beim Vorkommen lösen nie einen Neuversuch aus (Hörfehler der Erkennung), sie fallen sicher auf „keine Note“.
//  - `at` (Fundstelle) wird geleert, wenn sie nicht wörtlich im Text steht.

export type WordJudgement = {
  key: string;
  v: UseVerdict;
  /** Fehlerklasse am Wort, nur bei `odd`/`wrong`. */
  err: UseErr | null;
  /** Fundstelle im Text (wörtlich), sonst "". Bei `unused` das Ausweichwort (dann ausgewichen), sonst "". */
  at: string;
  /** Ein Satz in der Oberflächensprache; "" bei `unused` ohne Ausweichwort. */
  why: string;
};

/** Ein weiterer klarer Fehler außerhalb der Zielwörter (höchstens einer; Synthese §2.5: nie mehr als 2 Korrekturen). */
export type ExtraFix = { from: string; to: string; why: string };

export const AT_MAX = 80;

const verdictEnum = z.enum(USE_VERDICTS as unknown as [UseVerdict, ...UseVerdict[]]);
const errEnum = z.enum(USE_ERRS as unknown as [UseErr, ...UseErr[]]);

/** Ein Urteil, wie Claude es schreibt (tolerant gelesen). */
export const rawJudgement = {
  v: z.preprocess(verdictOf, verdictEnum),
  err: z.preprocess(errOf, errEnum.nullable()),
  at: z.preprocess(blank, clipped(0, AT_MAX)),
  why: z.preprocess(blank, clipped(0, WHY_MAX)),
};
export type RawJudgement = { v: UseVerdict; err: UseErr | null; at: string; why: string };

export const rawExtra = z.preprocess(
  (v: unknown): unknown => (v === undefined || v === '' || (Array.isArray(v) && !v.length) ? null : Array.isArray(v) ? (v as unknown[])[0] : v),
  z.object({ from: clipped(1, AT_MAX), to: z.preprocess(blank, clipped(0, AT_MAX)), why: why() }).nullable(),
);

type Ctx = z.RefinementCtx;
type Opts = { text: string; lang: UiLang; lenient: boolean; spoken?: boolean; path: PropertyKey[] };

/** Fehlerklassen, die ein Urteil `wrong` bzw. `odd` verlangen (Befund E: Urteil und Fehlerklasse passen zusammen). */
const WRONG_ERRS: readonly UseErr[] = ['sense', 'word'];
const ODD_ERRS: readonly UseErr[] = ['form', 'prep', 'colloc', 'register'];

/** Urteil an die Fehlerklasse angleichen; `null` = passt schon. */
function pairFix(v: UseVerdict, err: UseErr | null): UseVerdict | null {
  if (v === 'odd' && err && WRONG_ERRS.includes(err)) return 'wrong';
  if (v === 'wrong' && err && ODD_ERRS.includes(err)) return 'odd';
  return null;
}

/** Ausgewichen: nicht benutzt, aber ein Ersatzwort im Text (`at`). Die App zählt es als `evade` (domain/apply.ts). */
export const isEvade = (w: Pick<WordJudgement, 'v' | 'at'>): boolean => w.v === 'unused' && !!w.at;

/** Urteil über ein Zielwort mit lokaler Gegenprüfung (siehe Kopf). */
export function judgeOne(t: VocabTarget, r: RawJudgement, ctx: Ctx, o: Opts): WordJudgement {
  const at = r.at && inText(o.text, r.at) ? r.at : '';
  const found = hasTarget(o.text, t);
  const tried = !!at && attempted(at, t.word);
  // Gesprochen: Vorkommen-Abweichungen nie als Neuversuch (Hörfehler), sondern sicher wie im Neuversuch.
  const soft = o.lenient || !!o.spoken;
  const issue = (field: string, message: string) => ctx.addIssue({ code: 'custom', path: [...o.path, field], message });
  const quote = `quote in "at" the exact words where "${t.word}" (${t.key}) or the attempt stands; use "unused" only if the learner did not attempt this target at all`;
  let v = r.v;
  let err = r.err;
  // Aus einem widersprüchlichen „benutzt“ abgeleitet: nie als „ausgewichen“ werten (keine Folgen ohne klares Urteil).
  let coerced = false;
  const pair = pairFix(v, err);
  if (pair) {
    if (!o.lenient) issue('err', `err "${err ?? ''}" does not fit v "${v}" for ${t.key}: use "${pair}" or another err`);
    v = pair;
  }
  if (v === 'ok' || v === 'thin' || v === 'odd') {
    // Versuch am Wort reicht bei mehrteiligen Einträgen (falscher Partner, falsche Partikel); ein Einzelwort muss selbst dastehen.
    const present = found || (t.kind !== 'w' && tried) || (v === 'odd' && tried);
    if (!present) {
      if (!soft) issue('at', quote);
      v = 'unused';
      coerced = true;
    }
  } else if (v === 'wrong') {
    // Falsch nur mit Versuch am Wort; ein richtiges Ausweichwort ist kein Fehler (ausgewichen, keine Strafnote ohne Beleg).
    // Strikt: Neuversuch mit klarer Anweisung (sonst stünde die Begründung eines „falsch“ unter „ausgewichen“, Kap. 2 Nr. 2); sonst sicher ohne Folgen.
    if (!found && !tried) {
      if (!soft) issue('v', `the learner did not attempt "${t.word}" (${t.key}): use "unused" and put the replacement in "at"`);
      v = 'unused';
      err = null;
      coerced = true;
    }
  } else if (v === 'unused' && (found || tried)) {
    // Ein Versuch am Wort (*effect* für *affect*) ist kein Ausweichen: beurteilen lassen; im Neuversuch sicher ohne Folgen.
    if (!soft) issue('v', found ? `"${t.word}" (${t.key}) appears in the text: judge how it is used` : `the learner attempted "${t.word}" (${t.key}) with "${at}": judge the attempt`);
    coerced = true;
  }
  if (v === 'ok' && t.example && (inText(o.text, t.example) || nearCopy(o.text, t.example))) v = 'thin';
  const evade = v === 'unused' && !!at && !coerced;
  let whyText = v === 'unused' && !evade ? '' : r.why;
  if (coerced) whyText = '';
  if (v !== 'unused' && !whyText && !o.lenient) issue('why', 'give one short reason');
  if (whyText && isWrongLang(whyText, o.lang)) {
    // Sprachtreue (Kap. 10): im Neuversuch lieber keine Erklärung als eine in falscher Sprache (die Oberfläche zeigt dann einen festen Text).
    if (!o.lenient) checkLang(whyText, o.lang, [...o.path, 'why'], ctx);
    else whyText = '';
  }
  return { key: t.key, v, err: errFor(v, err), at: v === 'unused' && !evade ? '' : at, why: whyText };
}

/** Fehler an den Zielwörtern (zählen als Korrektur). */
export const isError = (w: Pick<WordJudgement, 'v'>): boolean => w.v === 'odd' || w.v === 'wrong';

/**
 * Zusatzfehler prüfen: muss wörtlich im Text stehen und etwas ändern; fällt weg, sobald ein Zielwort einen Fehler hat
 * (nie mehr als 2 Korrekturen auf einmal, Synthese §2.5; english-teacher Befund 11: die Zielwörter gehen vor).
 */
export function checkExtra(x: ExtraFix | null, words: readonly WordJudgement[], ctx: Ctx, o: Opts): ExtraFix | null {
  if (!x) return null;
  if (!inText(o.text, x.from) || flat(x.from) === flat(x.to)) return null;
  if (words.some(isError)) return null;
  if (isWrongLang(x.why, o.lang)) {
    if (!o.lenient) checkLang(x.why, o.lang, [...o.path, 'why'], ctx);
    return o.lenient ? null : x;
  }
  return x;
}

/**
 * Korrigierte Fassung: leer, wenn nichts zu korrigieren ist (sonst Widerspruch zum Urteil); muss jedes richtig oder fast richtig benutzte Zielwort
 * behalten. Im Neuversuch wird eine Fassung ohne diese Wörter geleert (die Nachprüfung meldet dann „noch nicht sicher geprüft“).
 */
export function checkFixed(fixed: string, targets: readonly VocabTarget[], words: readonly WordJudgement[], needs: boolean, ctx: Ctx, o: Opts): string {
  if (!needs) return '';
  if (!fixed.trim()) return '';
  const lost = targets.filter((t, i) => (words[i]?.v === 'ok' || words[i]?.v === 'odd') && !hasTarget(fixed, t));
  if (!lost.length) return fixed;
  if (!o.lenient) ctx.addIssue({ code: 'custom', path: [...o.path], message: `keep the target words the learner used: ${lost.map((t) => t.word).join(', ')}` });
  return '';
}
