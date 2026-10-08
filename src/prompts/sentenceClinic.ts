import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { keepEdits, normWs, type Edit } from '../domain/tutor/edits';
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
};

export const CLINIC_SENTENCE_MAX = 300;
export const CLINIC_PURPOSE_MAX = 120;
export const CLINIC_CTX_MAX = 200;
export const CLINIC_MAX_EDITS = 3;

const ID = 'sentence-clinic';
const VERSION = 1;

export const CLINIC_EXAMPLE =
  '{"verdict":"minor","fixed":"…","edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"better":"…","register":"neutral","note":"…"}';

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
    })
    .superRefine((o, ctx) => {
      if (o.verdict !== 'correct' && !o.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected sentence' });
      if (o.verdict !== 'correct' && o.fixed.trim() && normWs(o.fixed) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must differ from the learner sentence' });
      if (o.verdict === 'correct' && o.edits.length) ctx.addIssue({ code: 'custom', path: ['edits'], message: 'edits must be empty when the verdict is correct (style ideas go into better)' });
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
      });
    })
    .superRefine(langOf(['note'], v.uiLang));
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
      '- verdict: "correct" = grammatical and natural; "minor" = understandable with a small error or slightly unnatural wording; "wrong" = clearly ungrammatical or misleading.',
      '- fixed: the sentence with only the necessary corrections (empty string if verdict is correct).',
      '- edits: at most 3, each with "from" copied EXACTLY from the learner sentence (no paraphrase, no quote marks added), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" for a mistake, "upgrade" for an optional improvement), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). If the verdict is correct, edits must be an empty list.',
      '- better: a more natural C1 version in American English, or an empty string. Style ideas belong here, never in edits with sev "error".',
      '- register: "formal", "neutral" or "informal" for the learner sentence. note: one short sentence about tone in the explanation language, or an empty string.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => clinicSchema(v),
};
