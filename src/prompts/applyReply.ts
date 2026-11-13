import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { keepEdits, keepUsed, normWs, type Edit, type Used } from '../domain/tutor/edits';
import { patIdsOf } from '../domain/tutor/patList';
import {
  asList,
  GREET_EXAMPLE,
  GREET_RULE,
  greetOf,
  greetTaskLine,
  keepGood,
  POINT_SCALE,
  POINT_WHY_RULE,
  pointsField,
  pointWhyIssues,
  STYLE_EXAMPLE,
  STYLE_RULE,
  styleOf,
  type GreetCheck,
  type GreetVars,
  type Good,
  type PointCheck,
  type StyleTip,
  APPLY_EDIT_RULES,
  GIST_RULE,
  targetWordsLine,
  USED_RULE,
  usedIdsOf,
  usedWhyIn,
  wordAliasOf,
  type TargetWord,
} from './applyCommon';
export { APPLY_EDIT_RULES, GIST_RULE, targetWordsLine, targetWordsOf, USED_RULE, usedIdsOf, usedWhyIn, wordAliasOf, type TargetWord } from './applyCommon';
import { toneFit, type ToneFit } from './c1Mail';
import { block, clip, fenced, header, langName, langOf } from './common';
import { clipped, intIn } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// apply-reply@2 (F3 Anwenden, Disziplin „Auf eine Mail antworten“; Nachtrag learning-scientist Muss 1): wie `c1-mail@1` (GEE: erst atomare Änderungen, dann
// die Erklärung; nur wörtlich belegte Stellen), dazu die eingegangene Mail als EIGENES Feld (`incoming`, nie in einer gekürzten Situation) und die Pflichtpunkte
// einzeln (`points`, je Punkt mit wörtlichem Zitat, sonst `no`). `used` meldet die beiden Zielwörter und die Regel des Tages. Nur auf Antippen, Stufe `default`,
// 24 h zwischengespeichert, nie automatisch wiederholt außer dem einen Neuversuch bei Schemaverletzung (A6.3).
// @2 (W5, Lehrer-Prüfung F3): `style` „So klingt es gehobener“ (K1, 1–2 zitierte Stil-Verbesserungen, getrennt von den Fehlern) und `greet` (K7: Anrede und
// Gruß für den genannten Leser). Beide tolerant: fehlen sie, gelten die Verbesserungen der Liste bzw. kein Urteil.
// W5b (Lehrer-Prüfung): `upgraded` behält oder ergänzt Anrede und Gruß. Gleiche Version: nur eine Regelzeile, Schema unverändert, @2 war noch nie live.
// @3 (Großpaket P „Politur“, P4, 13.11.2026; learning-scientist „Mail-Vorlagen @3“): die Zielwörter gehen mit Kennung und gelernter Bedeutung mit
// („w1: postpone = verschieben“), damit Claude die Verwendung in DIESER Bedeutung beurteilt; `used` nennt das Wort über seine Kennung (der Wortlaut
// gilt weiter) und sagt mit `why` in einem Satz, warum es passt bzw. was falsch ist. Ein `why` in falscher Sprache fällt weg (kein Neuversuch dafür).

export type ReplyVars = {
  /** Die eingegangene Mail (Absender, Betreff, Text), ≤ 1.600 Zeichen. */
  incoming: string;
  /** Pflichtpunkte auf Englisch (2 bis 4). */
  must: readonly string[];
  /** Zielwörter aus der Wörter-App (höchstens 2), mit Kennung und gelernter Bedeutung (@3); ein bloßer Wortlaut bekommt `w1`, `w2` ohne Bedeutung. */
  words: readonly (string | TargetWord)[];
  /** Regel des Tages (englischer Name und Kurzregel), ≤ 240; leer = keine. */
  rule: string;
  /** Emrahs Antwort, ≤ 1.800 Zeichen. */
  text: string;
  uiLang: UiLang;
  /** Berufsprofil-Zeile, ≤ 200. */
  ctx: string;
  /** Kurzliste aller Muster (`patListText`). */
  pats: string;
  /** Leser, passende Anrede und Gruß (K7); fehlt = keine Vorgabe. */
  greet?: GreetVars;
};

export type ApplyReply = {
  points: PointCheck[];
  edits: Edit[];
  used: Used[];
  tone: { fit: ToneFit; why: string };
  good: Good | null;
  /** „So klingt es gehobener“ (K1). */
  style: StyleTip[];
  /** Anrede und Gruß (K7), `null` ohne Urteil. */
  greet: GreetCheck | null;
  upgraded: string;
  summary: string;
  errorCount: number | null;
};

export const INCOMING_MAX = 1_600;
export const APPLY_TEXT_MAX = 1_800;
export const RULE_MAX = 240;
export const APPLY_MAX_EDITS = 12;
export const MUST_MAX = 4;
export { WORDS_MAX } from './applyCommon';
/** Kennung der Regel in `used` (die Zielwörter stehen dort unter ihrem eigenen Wortlaut). */
export const RULE_ID = 'rule';

// @4 (Befund english-teacher, 13.11.2026): `used` mit der milderen Regel aus applyCommon (`USED_RULE`: ok false nur bei klarem Fehler). Ausgabe unverändert.
const ID = 'apply-reply';
const VERSION = 4;

export const REPLY_EXAMPLE = `{"points":[{"i":1,"covered":"yes","quote":"…","why":""}],"edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"used":[{"pat":"w1","ok":true,"quote":"…","why":"…"}],"tone":{"fit":"fits","why":"…"},${GREET_EXAMPLE},"good":{"quote":"…","why":"…"},${STYLE_EXAMPLE},"upgraded":"…","summary":"…","errorCount":0}`;

// Zielwörter mit Kennung und Bedeutung, `used` mit `why`, Kurzurteil: gemeinsam mit c1-mail@3 und apply-summary@3 (applyCommon.ts).
export const usedLine = (words: readonly (string | TargetWord)[], rule: string): string =>
  [targetWordsLine(words), rule.trim() ? `Target rule (id "${RULE_ID}"): ${clip(rule, RULE_MAX)}` : ''].filter(Boolean).join('\n');

export function replySchema(v: ReplyVars): z.ZodType<ApplyReply> {
  const allIds = patIdsOf(v.pats);
  const given = block(v.text, APPLY_TEXT_MAX);
  const n = Math.min(MUST_MAX, v.must.length);
  const base = z
    .object({
      points: pointsField(given, n),
      edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, given, allIds, APPLY_MAX_EDITS, { sevDefault: 'upgrade' })),
      used: z.preprocess(asList, z.array(z.unknown())).transform((xs) => usedWhyIn(keepUsed(xs, given, usedIdsOf(v.words, v.rule), wordAliasOf(v.words)), (s) => isWrongLang(s, v.uiLang))),
      tone: z.object({ fit: z.preprocess(toneFit, z.enum(['fits', 'too-direct', 'too-informal', 'too-stiff']).catch('fits')), why: z.preprocess((x) => x ?? '', clipped(0, 160)) }),
      good: z.unknown().optional().transform((x) => keepGood(x, given)),
      style: z.unknown().optional(),
      greet: z.unknown().optional().transform((x) => (v.greet ? greetOf(x, v.uiLang) : null)),
      upgraded: clipped(20, 2200),
      summary: clipped(5, 200),
      errorCount: z.preprocess((x) => (x === undefined || x === null || x === '' ? null : x), intIn(0, 60).nullable()).catch(null),
    })
    .transform((o): ApplyReply => ({ ...o, style: styleOf(o.style, given, o.edits, v.uiLang) }));
  return base
    .superRefine((o, ctx) => {
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
        if (isWrongLang(e.to, 'en')) ctx.addIssue({ code: 'custom', path: ['edits', i, 'to'], message: 'must be written in English' });
      });
      for (const k of pointWhyIssues(o.points, (s) => isWrongLang(s, v.uiLang))) ctx.addIssue({ code: 'custom', path: ['points', k, 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (o.tone.why && isWrongLang(o.tone.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['tone', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (o.good && isWrongLang(o.good.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['good', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (isWrongLang(o.upgraded, 'en')) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'must be written in English' });
      if (normWs(o.upgraded) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'upgraded must be a rewritten version' });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export const applyReply: PromptTemplate<ReplyVars, ApplyReply> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const must = v.must.slice(0, MUST_MAX).map((m, k) => `${k + 1}. ${clip(m, 160)}`);
    return [
      header({ id: ID, version: VERSION }),
      'You check a reply to a work email, written by a German-speaking learner (B2 to C1, business English).',
      ...APPLY_EDIT_RULES,
      'Do not add facts, names, numbers or product details that are neither in the learner text nor in the incoming email.',
      'Incoming email (the learner answers this):',
      ['<<<MAIL', block(v.incoming, INCOMING_MAX), 'MAIL>>>'].join('\n'),
      `Points the reply must cover:\n${must.join('\n')}`,
      usedLine(v.words, v.rule),
      v.greet ? greetTaskLine(v.greet) : '',
      v.ctx ? `Learner work context: ${clip(v.ctx, 200)}` : '',
      `Explanation language: ${langName(v.uiLang)}`,
      'Learner reply:',
      fenced(block(v.text, APPLY_TEXT_MAX)),
      'Grammar patterns for "pat" in edits (topic: ids). "pat" may only be one of these ids, otherwise null:',
      v.pats,
      'Reply with only one JSON object in exactly this shape:',
      REPLY_EXAMPLE,
      'Rules:',
      `- points: one entry for each point above (i = its number, 1 to ${Math.min(MUST_MAX, v.must.length)}); covered is "yes", "partly" or "no"; quote copies EXACTLY the words of the learner reply that cover the point (empty when "no"). Judge whether the point is there, not the grammar. For a point about tone, judge the whole reply and quote the sentence that shows it best. ${POINT_SCALE} ${POINT_WHY_RULE}`,
      '- edits: at most 12, each with "from" copied EXACTLY from the learner reply (no paraphrase), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" or "upgrade"), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). Tone and register are never errors (kind register is always sev upgrade).',
      USED_RULE,
      '- tone: fit is "fits", "too-direct", "too-informal" or "too-stiff" for this reader and purpose; why is one short sentence in the explanation language.',
      v.greet ? GREET_RULE : '',
      '- good: one strong span copied exactly from the reply ("quote") and one short sentence in the explanation language why it works ("why").',
      STYLE_RULE,
      "- upgraded: the whole reply rewritten at C1 level in American English, keeping the learner's ideas, facts and structure and roughly the same length; it must cover every point above (add one short sentence for a missing point), must not add new facts, must keep or add a fitting salutation and sign-off, and must differ from the learner's reply.",
      GIST_RULE,
      '- errorCount: after writing everything, count the mistakes (sev "error") in the learner reply once more, independently of the list, and give the number.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => replySchema(v),
};
