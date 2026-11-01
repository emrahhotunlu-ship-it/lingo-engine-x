import { z } from 'zod';
import { clipped } from '../shared';
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
import type { UiLang } from '../shared';

// Urteil je Zielwort, gemeinsam für `vocab-transfer@1` (3–5 Wörter) und `vocab-own-sentence@1` (ein Wort).
// Lokale Gegenprüfung (Plan §7, Kap. 2 „keine Widersprüche“): Claude prüft den Sinn, die App prüft das Vorkommen.
//  - „benutzt“ (ok/odd/thin) ohne das Zielwort selbst im Text (eine Fundstelle mit einem anderen Wort reicht nicht) → Schemaverletzung (der eine Neuversuch); im Neuversuch (`lenient`) → `unused` (keine Note).
//  - „falsch“ ohne jede Fundstelle im Text → `unused`: ohne Beleg nie eine Strafnote.
//  - „nicht benutzt“, obwohl das Wort im Text steht → Schemaverletzung; im Neuversuch bleibt `unused` (keine Note, sicher).
//  - „richtig“, aber der Beispielsatz der Karte steht wörtlich im Text → `thin` (abgeschrieben zählt nicht als benutzt, Synthese §2.5).
//  - `at` (Fundstelle) wird geleert, wenn sie nicht wörtlich im Text steht.

export type WordJudgement = {
  key: string;
  v: UseVerdict;
  /** Fehlerklasse am Wort, nur bei `odd`/`wrong`. */
  err: UseErr | null;
  /** Fundstelle im Text (wörtlich), sonst "". */
  at: string;
  /** Ein Satz in der Oberflächensprache; "" bei `unused`. */
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
type Opts = { text: string; lang: UiLang; lenient: boolean; path: PropertyKey[] };

/** Urteil über ein Zielwort mit lokaler Gegenprüfung (siehe Kopf). */
export function judgeOne(t: VocabTarget, r: RawJudgement, ctx: Ctx, o: Opts): WordJudgement {
  const at = r.at && inText(o.text, r.at) ? r.at : '';
  const found = hasTarget(o.text, t);
  let v = r.v;
  // ok/odd/thin verlangen das Zielwort selbst (gebeugt oder getrennt): eine Fundstelle mit einem anderen Wort ist kein „benutzt“.
  if ((v === 'ok' || v === 'odd' || v === 'thin') && !found) {
    if (!o.lenient) ctx.addIssue({ code: 'custom', path: [...o.path, 'v'], message: `"${t.word}" (${t.key}) does not appear in the text: use "unused"` });
    v = 'unused';
  }
  if (v === 'wrong' && !found && !at) v = 'unused';
  if (v === 'unused' && found && !o.lenient) {
    ctx.addIssue({ code: 'custom', path: [...o.path, 'v'], message: `"${t.word}" (${t.key}) appears in the text: judge how it is used` });
  }
  if (v === 'ok' && t.example && inText(o.text, t.example)) v = 'thin';
  const whyText = v === 'unused' ? '' : r.why;
  if (v !== 'unused' && !whyText && !o.lenient) ctx.addIssue({ code: 'custom', path: [...o.path, 'why'], message: 'give one short reason' });
  if (whyText && !o.lenient) checkLang(whyText, o.lang, [...o.path, 'why'], ctx);
  return { key: t.key, v, err: errFor(v, r.err), at: v === 'unused' ? '' : at, why: whyText };
}

/** Fehler an den Zielwörtern (zählen als Korrektur). */
export const isError = (w: Pick<WordJudgement, 'v'>): boolean => w.v === 'odd' || w.v === 'wrong';

/**
 * Zusatzfehler prüfen: muss wörtlich im Text stehen und etwas ändern; fällt weg, sobald schon zwei Zielwörter Fehler haben
 * (nie mehr als 2 Korrekturen auf einmal, Synthese §2.5).
 */
export function checkExtra(x: ExtraFix | null, words: readonly WordJudgement[], ctx: Ctx, o: Opts): ExtraFix | null {
  if (!x) return null;
  if (!inText(o.text, x.from) || flat(x.from) === flat(x.to)) return null;
  if (words.filter(isError).length >= 2) return null;
  if (!o.lenient) checkLang(x.why, o.lang, [...o.path, 'why'], ctx);
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
