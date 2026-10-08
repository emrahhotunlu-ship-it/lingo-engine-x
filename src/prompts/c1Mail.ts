import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { keepEdits, keepUsed, normWs, type Edit, type Used } from '../domain/tutor/edits';
import { patIdsOf } from '../domain/tutor/patList';
import { block, clip, fenced, header, langName, langOf } from './common';
import { intIn, clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// c1-mail@1 (Lernplattform 3.0 P47, KI-Tutor T6): die Wochen-Mail der Schreibwerkstatt (Laptop). Nur auf Antippen (`user`), Stufe `default`, 24 h
// zwischengespeichert, nie automatisch wiederholt. Zweistufig nach GEE (Song u. a. 2024): ERST alle Fehler als atomare Änderungen (genau der falsche Ausschnitt,
// die kleinste Ersetzung), DANN die Erklärung. Die App behält nur wörtlich belegte Stellen (`keepEdits`, T-R3). Stil ist `upgrade`, nie `error` (T-R12);
// Ton/Register ist nie ein Fehler. `errorCount` ist Claudes zweite, unabhängige Zählung der Fehler (K7 nimmt den Mittelwert aus Liste und Nachzählung).
// Ein Neuversuch nach A6.3 nur bei Schemaverletzung (fehlende Fassung, falsche Sprache).

export type MailVars = {
  /** Anlass und Gegenüber, ≤ 400 Zeichen. */
  situation: string;
  /** Die drei Kapitelmuster der Situation (Kennung, englischer Name, englische Formel). */
  patterns: ReadonlyArray<{ id: string; name: string; form: string }>;
  /** Die vier Wendungen der Situation. */
  phrases: readonly string[];
  /** Emrahs Text, ≤ 1.800 Zeichen. */
  text: string;
  uiLang: UiLang;
  /** Berufsprofil-Zeile (`tutorCtx`), ≤ 200. */
  ctx: string;
  /** Kurzliste aller Muster (`patListText`), die erlaubten Kennungen für `pat` einer Änderung. */
  pats: string;
};

export type ToneFit = 'fits' | 'too-direct' | 'too-informal' | 'too-stiff';
export type C1Mail = {
  edits: Edit[];
  used: Used[];
  tone: { fit: ToneFit; why: string };
  /** Eine ganze C1-Fassung der Mail (US-Englisch). */
  upgraded: string;
  summary: string;
  /** Claudes unabhängige Nachzählung der Fehler; `null`, wenn sie fehlt. */
  errorCount: number | null;
};

export const MAIL_TEXT_MAX = 1_800;
export const MAIL_SITUATION_MAX = 400;
export const MAIL_PATTERNS_MAX = 3;
export const MAIL_PHRASES_MAX = 4;
export const MAIL_MAX_EDITS = 12;

const ID = 'c1-mail';
const VERSION = 1;

export const MAIL_EXAMPLE =
  '{"edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"used":[{"pat":"…","ok":true,"quote":"…"}],"tone":{"fit":"fits","why":"…"},"upgraded":"…","summary":"…","errorCount":0}';

const asList = (v: unknown): unknown => (v === undefined || v === null ? [] : typeof v === 'string' ? [] : v);

const TONE_ALIASES: ReadonlyArray<[RegExp, ToneFit]> = [
  [/^(fits?|fitting|appropriate|ok|okay|good|suitable|right)$/, 'fits'],
  [/^too[\s_-]?(direct|blunt|abrupt|curt)$/, 'too-direct'],
  [/^too[\s_-]?(informal|casual|relaxed|chatty)$/, 'too-informal'],
  [/^too[\s_-]?(stiff|formal|rigid|stilted|wordy)$/, 'too-stiff'],
];
const toneFit = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  for (const [re, out] of TONE_ALIASES) if (re.test(s)) return out;
  return v;
};

export function mailSchema(v: MailVars): z.ZodType<C1Mail> {
  const allIds = patIdsOf(v.pats);
  const chapterIds = new Set(v.patterns.map((p) => p.id));
  const given = block(v.text, MAIL_TEXT_MAX);
  return z
    .object({
      edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, given, allIds, MAIL_MAX_EDITS, { sevDefault: 'upgrade' })),
      used: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepUsed(xs, given, chapterIds)),
      tone: z.object({ fit: z.preprocess(toneFit, z.enum(['fits', 'too-direct', 'too-informal', 'too-stiff']).catch('fits')), why: z.preprocess((x) => x ?? '', clipped(0, 160)) }),
      upgraded: clipped(20, 2200),
      summary: clipped(5, 200),
      errorCount: z.preprocess((x) => (x === undefined || x === null || x === '' ? null : x), intIn(0, 60).nullable()).catch(null),
    })
    .superRefine((o, ctx) => {
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
      });
      if (o.tone.why && isWrongLang(o.tone.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['tone', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (normWs(o.upgraded) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'upgraded must be a rewritten version' });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export const c1Mail: PromptTemplate<MailVars, C1Mail> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const pats = v.patterns.slice(0, MAIL_PATTERNS_MAX).map((p) => `${p.id}: ${clip(p.name, 80)} (${clip(p.form, 100)})`);
    return [
      header({ id: ID, version: VERSION }),
      'You check a short work email written by a German-speaking learner (B2, aiming for C1, business English) for a writing task.',
      'First list every error as an atomic edit: copy the exact wrong span from the text into "from", write the minimal replacement into "to". Only then explain each edit.',
      'Keep the learner words wherever they are correct. Style improvements are sev "upgrade", never "error". American English is the standard; British spelling and British words are correct (mention the US form only as an upgrade).',
      `Task: ${clip(v.situation, MAIL_SITUATION_MAX)}`,
      v.ctx ? `Learner work context: ${clip(v.ctx, 200)}` : '',
      `Target patterns (id: name (form)):\n${pats.join('\n')}`,
      `Target phrases: ${v.phrases.slice(0, MAIL_PHRASES_MAX).map((p) => clip(p, 60)).join(' | ')}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Learner text:',
      fenced(block(v.text, MAIL_TEXT_MAX)),
      'Grammar patterns for "pat" in edits (topic: ids). "pat" may only be one of these ids, otherwise null:',
      v.pats,
      'Reply with only one JSON object in exactly this shape:',
      MAIL_EXAMPLE,
      'Rules:',
      '- edits: at most 12, each with "from" copied EXACTLY from the learner text (no paraphrase), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" or "upgrade"), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). Tone and register are never errors.',
      '- used: for each target pattern id that the learner tried to use, one entry with ok (true if used correctly) and a "quote" copied exactly from the text. Skip patterns the learner did not try.',
      '- tone: fit is "fits", "too-direct", "too-informal" or "too-stiff" for this reader and purpose; why is one short sentence in the explanation language.',
      '- upgraded: the whole email rewritten at C1 level in American English, keeping the learner ideas and structure; it must differ from the learner text.',
      '- summary: one short sentence in the explanation language: what works and what to work on next.',
      '- errorCount: after writing everything, count the mistakes (sev "error") in the learner text once more, independently of the list, and give the number.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => mailSchema(v),
};
