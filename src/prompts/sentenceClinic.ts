import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { errorEdits, keepEdits, normWs, type Edit } from '../domain/tutor/edits';
import { patIdsOf } from '../domain/tutor/patList';
import { clip, fenced, header, langName, langOf } from './common';
import { produceVerdict } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// sentence-clinic@1 (Lernplattform 3.0 P46, KI-Tutor T4): „Satz-Klinik“ – Emrahs eigener Satz aus dem Arbeitsalltag. Nur auf Antippen
// (`user`), Stufe `default` (Korrektur, §5.2), 24 h zwischengespeichert, nie automatisch wiederholt. Claude liefert die Fehler als
// ATOMARE Änderungen (`edits`: genau der falsche Ausschnitt, die kleinste Ersetzung, die Begründung); die App behält nur Stellen, die wörtlich im
// Satz stehen (T-R3, `keepEdits`). Fehler (`sev: 'error'`) und Verbesserungen (`'upgrade'`) sind getrennt, Ton ist nie ein Fehler (T-R12).
// Ein Neuversuch nach A6.3 nur bei Schemaverletzung: z. B. `correct` mit Änderungen, `fixed` fehlt oder ist unverändert, falsche Sprache.

export type ClinicVars = {
  /** Emrahs Satz, ≤ 300 Zeichen. */
  sentence: string;
  /** Wofür (z. B. „status update“), ≤ 120; leer = nicht angegeben. */
  purpose: string;
  uiLang: UiLang;
  /** Berufsprofil-Zeile (`tutorCtx`), ≤ 200. */
  ctx: string;
  /** Kurzliste aller Muster (`patListText`), ≈ 2 KB; die erlaubten Kennungen für `pat`. */
  pats: string;
};

export type ClinicVerdict = 'correct' | 'minor' | 'wrong';
export type ClinicRegister = 'formal' | 'neutral' | 'informal';
export type ClinicOut = {
  verdict: ClinicVerdict;
  /** Der Satz mit den kleinsten nötigen Korrekturen (US-Englisch); bei `correct` leer. */
  fixed: string;
  edits: Edit[];
  /** Eine natürlichere C1-Fassung, oder leer. */
  better: string;
  register: ClinicRegister;
  note: string;
  /** Was richtig war (ein Satz, Oberflächensprache), immer gefüllt: auch bei `correct` die Antwort auf „Warum?“. */
  good: string;
};

export const CLINIC_SENTENCE_MAX = 300;
export const CLINIC_PURPOSE_MAX = 120;
export const CLINIC_CTX_MAX = 200;
export const CLINIC_MAX_EDITS = 3;

const ID = 'sentence-clinic';
const VERSION = 1;

export const CLINIC_EXAMPLE =
  '{"verdict":"minor","fixed":"…","edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"better":"…","register":"neutral","note":"…","good":"…"}';

const asList = (v: unknown): unknown => (v === undefined || v === null ? [] : typeof v === 'string' ? [] : v);
const blank = (v: unknown): unknown => (v === undefined || v === null ? '' : v);

export function clinicSchema(v: ClinicVars): z.ZodType<ClinicOut> {
  const ids = patIdsOf(v.pats);
  const given = clip(v.sentence, CLINIC_SENTENCE_MAX);
  return z
    .object({
      verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
      fixed: z.preprocess(blank, clipped(0, 400)),
      edits: z
        .preprocess(asList, z.array(z.unknown()))
        .transform((xs) => keepEdits(xs, given, ids, CLINIC_MAX_EDITS, { sevDefault: 'error' })),
      better: z.preprocess(blank, clipped(0, 400)),
      register: z.enum(['formal', 'neutral', 'informal']).catch('neutral'),
      note: z.preprocess(blank, clipped(0, 140)),
      good: clipped(5, 140),
    })
    .superRefine((o, ctx) => {
      const errs = errorEdits(o.edits).length;
      // Nicht „richtig“ heißt: mindestens eine belegte Fehlerstelle (Stil allein macht einen Satz nie „fast richtig“).
      if (o.verdict !== 'correct' && errs === 0) ctx.addIssue({ code: 'custom', path: ['edits'], message: 'a verdict other than correct needs at least one edit with sev error quoted exactly from the sentence' });
      if (o.verdict !== 'correct' && errs > 0 && !o.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected sentence' });
      if (o.verdict !== 'correct' && errs > 0 && o.fixed.trim() && normWs(o.fixed) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must differ from the learner sentence' });
      // „Richtig“ lässt Verbesserungen (sev upgrade) zu, aber keine Fehlerstelle.
      if (o.verdict === 'correct' && errs > 0) ctx.addIssue({ code: 'custom', path: ['edits'], message: 'no edit with sev error when the verdict is correct (style ideas are sev upgrade or go into better)' });
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
        if (isWrongLang(e.to, 'en')) ctx.addIssue({ code: 'custom', path: ['edits', i, 'to'], message: 'must be written in English' });
      });
      for (const f of ['fixed', 'better'] as const) if (isWrongLang(o[f], 'en')) ctx.addIssue({ code: 'custom', path: [f], message: 'must be written in English' });
    })
    .superRefine(langOf(['note', 'good'], v.uiLang));
}

export const sentenceClinic: PromptTemplate<ClinicVars, ClinicOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You check ONE sentence written by a German-speaking learner (B2, aiming for C1, business English) who wrote it for their real work.',
      'American English is the standard; British spelling and British words count as correct (mention the US form only as a tip, never as an error).',
      'American and British grammar both count as correct (e.g. past simple with already/just/yet, have got, collective nouns with plural verbs).',
      'Tone and register are never errors: comment on them only in "note" and "better".',
      'Do not add facts, names, numbers or product details that are not in the learner text.',
      'First list every error as an atomic edit: copy the exact wrong span from the sentence into "from" and write the smallest possible replacement into "to".',
      'Only then explain each edit. Keep the learner words wherever they are correct. Do not rewrite the sentence just to sound better.',
      v.purpose ? `Purpose: ${clip(v.purpose, CLINIC_PURPOSE_MAX)}` : '',
      v.ctx ? `Learner work context: ${clip(v.ctx, CLINIC_CTX_MAX)}` : '',
      `Explanation language: ${langName(v.uiLang)}`,
      'Learner sentence:',
      fenced(clip(v.sentence, CLINIC_SENTENCE_MAX)),
      'Grammar patterns (topic: ids). "pat" may only be one of these ids, otherwise null:',
      v.pats,
      'Reply with only one JSON object in exactly this shape:',
      CLINIC_EXAMPLE,
      'Rules:',
      '- verdict: "correct" = no mistake, even if a more elegant version exists (put style ideas into "better" or as edits with sev "upgrade"); "minor" = one or two small mistakes (including a wrong collocation or a word a native speaker would not use in this meaning); "wrong" = clearly ungrammatical or misleading. Correct but plain or less elegant wording is never "minor". Style ideas never change the verdict.',
      '- fixed: the sentence with only the necessary corrections (empty string if verdict is correct).',
      '- edits: at most 3 (if there are more than 3 errors, list the 3 most important; "fixed" still corrects all of them), each with "from" copied EXACTLY from the learner sentence (no paraphrase, no quote marks added), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" for a mistake, "upgrade" for an optional improvement; kind register is always sev upgrade), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). If the verdict is correct, there must be no edit with sev "error".',
      '- better: a more natural C1 version in American English, or an empty string. Style ideas belong here, never in edits with sev "error".',
      '- register: "formal", "neutral" or "informal" for the learner sentence. note: one short sentence about tone in the explanation language, or an empty string.',
      '- good: one short sentence in the explanation language naming what the learner did right (a pattern, collocation or register choice), always filled.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => clinicSchema(v),
};
