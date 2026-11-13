import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { keepEdits, keepUsed, normWs, type Edit, type Used } from '../domain/tutor/edits';
import { patIdsOf } from '../domain/tutor/patList';
import { asList, keepGood, POINT_SCALE, POINT_WHY_RULE, pointsField, pointWhyIssues, STYLE_EXAMPLE, STYLE_RULE, styleOf, type Good, type PointCheck, type StyleTip } from './applyCommon';
import { APPLY_EDIT_RULES, APPLY_MAX_EDITS, APPLY_TEXT_MAX, GIST_RULE, USED_RULE, usedIdsOf, usedLine, usedWhyIn, wordAliasOf, type TargetWord } from './applyReply';
import { block, clip, fenced, header, langName, langOf } from './common';
import { clipped, intIn } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// apply-summary@2 (F3 Anwenden, Disziplin „Artikel zusammenfassen“; Nachtrag learning-scientist Muss 2): Kernpunkte EINMAL je Artikel festgelegt (apply-keypoints@1,
// gespeichert) und hier als fester Maßstab übergeben. Geprüft werden: Kernpunkte getroffen (je Punkt mit wörtlichem Zitat), richtig wiedergegeben (`faithful`: nichts
// erfunden, keine eigene Meinung), Fehlerstellen (`keepEdits`), Zielwörter und Regel (`keepUsed`), eine bessere Fassung. Ob in eigenen Worten geschrieben, misst
// die App selbst (domain/copy im Modul Anwenden), nicht Claude. Stufe `default`, 24 h zwischengespeichert, Neuversuch nur bei Schemaverletzung (A6.3).
// @2 (W5 K1): `style` „So klingt es gehobener“ (1–2 zitierte Stil-Verbesserungen, getrennt von den Fehlern; tolerant wie in apply-reply@2).
// @3 (Großpaket P, P4, 13.11.2026): Zielwörter mit Kennung und gelernter Bedeutung, `used` mit Kennung und `why` (wie apply-reply@3); `summary` ist
// das Kurzurteil („Kurz gesagt“), das die App zuerst zeigt.

export type SummaryVars = {
  /** Titel des Artikels, ≤ 160. */
  title: string;
  /** Text des Artikels, ≤ 6.000 Zeichen. */
  article: string;
  /** Die festgelegten Kernpunkte (3 bis 4, Englisch). */
  keyPoints: readonly string[];
  /** Ziel der Länge (Prüfbefund T4): Sätze (von–bis) und höchstens so viele Wörter, wie die Aufgabe sie nennt. */
  goal: { sentences: readonly [number, number]; maxWords: number };
  /** Zielwörter (höchstens 2), mit Kennung und gelernter Bedeutung (@3). */
  words: readonly (string | TargetWord)[];
  rule: string;
  text: string;
  uiLang: UiLang;
  ctx: string;
  pats: string;
};

export type ApplySummary = {
  points: PointCheck[];
  /** Nichts erfunden, keine Meinung: `ok`; sonst ein wörtliches Zitat der Stelle (oder leer) und der Grund. */
  faithful: { ok: boolean; quote: string; why: string };
  edits: Edit[];
  used: Used[];
  good: Good | null;
  /** „So klingt es gehobener“ (K1). */
  style: StyleTip[];
  upgraded: string;
  summary: string;
  errorCount: number | null;
};

export const ARTICLE_MAX = 6_000;
export const TITLE_MAX = 160;
export const KEYPOINTS_MAX = 4;

// @4 (Befund english-teacher, 13.11.2026): `used` mit der milderen Regel aus applyCommon (`USED_RULE`: ok false nur bei klarem Fehler). Ausgabe unverändert.
const ID = 'apply-summary';
const VERSION = 4;

export const SUMMARY_EXAMPLE = `{"points":[{"i":1,"covered":"yes","quote":"…","why":""}],"faithful":{"ok":true,"quote":"","why":"…"},"edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"used":[{"pat":"w1","ok":true,"quote":"…","why":"…"}],"good":{"quote":"…","why":"…"},${STYLE_EXAMPLE},"upgraded":"…","summary":"…","errorCount":0}`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `faithful` tolerant: ohne Angabe gilt es als richtig wiedergegeben; ein Zitat zählt nur wörtlich. */
export function faithfulOf(v: unknown, text: string): ApplySummary['faithful'] {
  if (typeof v === 'boolean') return { ok: v, quote: '', why: '' };
  if (!isObj(v)) return { ok: true, quote: '', why: '' };
  const ok = typeof v.ok === 'boolean' ? v.ok : v.ok !== 'false' && v.ok !== 'no';
  const raw = typeof v.quote === 'string' ? normWs(v.quote) : '';
  const quote = raw && normWs(text).includes(raw) ? clip(raw, 200) : '';
  const why = typeof v.why === 'string' ? clip(v.why, 200) : '';
  return { ok, quote: ok ? '' : quote, why };
}

export function summarySchema(v: SummaryVars): z.ZodType<ApplySummary> {
  const allIds = patIdsOf(v.pats);
  const given = block(v.text, APPLY_TEXT_MAX);
  const n = Math.min(KEYPOINTS_MAX, v.keyPoints.length);
  const base = z
    .object({
      points: pointsField(given, n),
      faithful: z.unknown().optional().transform((x) => faithfulOf(x, given)),
      edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, given, allIds, APPLY_MAX_EDITS, { sevDefault: 'upgrade' })),
      used: z.preprocess(asList, z.array(z.unknown())).transform((xs) => usedWhyIn(keepUsed(xs, given, usedIdsOf(v.words, v.rule), wordAliasOf(v.words)), (s) => isWrongLang(s, v.uiLang))),
      good: z.unknown().optional().transform((x) => keepGood(x, given)),
      style: z.unknown().optional(),
      upgraded: clipped(20, 1400),
      summary: clipped(5, 200),
      errorCount: z.preprocess((x) => (x === undefined || x === null || x === '' ? null : x), intIn(0, 60).nullable()).catch(null),
    })
    .transform((o): ApplySummary => ({ ...o, style: styleOf(o.style, given, o.edits, v.uiLang) }));
  return base
    .superRefine((o, ctx) => {
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
        if (isWrongLang(e.to, 'en')) ctx.addIssue({ code: 'custom', path: ['edits', i, 'to'], message: 'must be written in English' });
      });
      for (const k of pointWhyIssues(o.points, (s) => isWrongLang(s, v.uiLang))) ctx.addIssue({ code: 'custom', path: ['points', k, 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (o.faithful.why && isWrongLang(o.faithful.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['faithful', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (o.good && isWrongLang(o.good.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['good', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (isWrongLang(o.upgraded, 'en')) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'must be written in English' });
      if (normWs(o.upgraded) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'upgraded must be a rewritten version' });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export const applySummary: PromptTemplate<SummaryVars, ApplySummary> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const kps = v.keyPoints.slice(0, KEYPOINTS_MAX).map((p, k) => `${k + 1}. ${clip(p, 200)}`);
    const [s0, s1] = v.goal.sentences;
    const sentences = s0 === s1 ? String(s0) : `${s0} to ${s1}`;
    return [
      header({ id: ID, version: VERSION }),
      'You check a short English summary of a news article, written by a German-speaking learner (B2 to C1).',
      ...APPLY_EDIT_RULES,
      `Article: ${clip(v.title, TITLE_MAX)}`,
      ['<<<ARTICLE', block(v.article, ARTICLE_MAX), 'ARTICLE>>>'].join('\n'),
      `Key points of the article (fixed; judge the summary only against these):\n${kps.join('\n')}`,
      usedLine(v.words, v.rule),
      v.ctx ? `Learner work context: ${clip(v.ctx, 200)}` : '',
      `Explanation language: ${langName(v.uiLang)}`,
      'Learner summary:',
      fenced(block(v.text, APPLY_TEXT_MAX)),
      'Grammar patterns for "pat" in edits (topic: ids). "pat" may only be one of these ids, otherwise null:',
      v.pats,
      'Reply with only one JSON object in exactly this shape:',
      SUMMARY_EXAMPLE,
      'Rules:',
      `- points: one entry for each key point (i = its number, 1 to ${Math.min(KEYPOINTS_MAX, v.keyPoints.length)}); covered is "yes", "partly" or "no"; quote copies EXACTLY the words of the summary that cover it (empty when "no"). Judge whether the point is there, not the grammar. ${POINT_SCALE} ${POINT_WHY_RULE}`,
      '- faithful: ok is false if the summary states something the article does not say (an invented fact, a wrong number, a wrong cause) or adds the learner\'s own opinion; then quote copies EXACTLY that span and why says in one short sentence in the explanation language what is wrong. Otherwise ok is true, quote is empty and why is one short sentence why it is accurate.',
      '- edits: at most 12, each with "from" copied EXACTLY from the summary (no paraphrase), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" or "upgrade"), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). Register is never an error.',
      USED_RULE,
      '- good: one strong span copied exactly from the summary ("quote") and one short sentence in the explanation language why it works ("why").',
      STYLE_RULE,
      `- upgraded: a better summary in American English with ${sentences} sentences and at most ${v.goal.maxWords} words, in the learner's own words where they are correct; it must cover every key point, must not copy long phrases from the article and must differ from the learner's summary.`,
      GIST_RULE,
      '- errorCount: after writing everything, count the mistakes (sev "error") in the summary once more, independently of the list, and give the number.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => summarySchema(v),
};
