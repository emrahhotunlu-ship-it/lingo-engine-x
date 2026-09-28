import { z } from 'zod';
import { header, langName, lenientArray } from '../../common';
import { britishCount, englishText, uiText } from '../../inputCommon';
import { intIn } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// listening-dialog@1 (Backlog B6, Lehrer H3/H4): ein kurzes Meeting oder Telefonat mit 2–3
// Stimmen und je eigenem Akzent-Etikett (us/gb/in/au). Die App spielt jede Zeile mit einer
// passenden Stimme ab (sonst Rückfall auf eine Stimme). `points` sind die Vereinbarungen, die in
// die Follow-up-Mail gehören (geprüft mit followup-check@1).

export const ACCENTS = ['us', 'gb', 'in', 'au'] as const;
export type Accent = (typeof ACCENTS)[number];

export type ListeningDialogVars = { scenario: string; level: 'B2' | 'C1'; uiLang: UiLang };
export type DialogSpeaker = { name: string; role: string; accent: Accent };
export type DialogLine = { s: number; text: string };
export type ListeningDialogOut = { title: string; setting: string; speakers: DialogSpeaker[]; lines: DialogLine[]; points: string[] };

const ID = 'listening-dialog';
const VERSION = 1;

/** Akzent tolerant: „British“, „en-GB“, „UK“ → gb; Unbekanntes → us. */
export function accentOf(v: unknown): Accent {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (/(^|[^a-z])(gb|uk|brit|england|english \(uk\))/.test(s) || s.includes('british')) return 'gb';
  if (/(^|[^a-z])(in|india)/.test(s) || s.includes('indian')) return 'in';
  if (/(^|[^a-z])(au|aus)/.test(s) || s.includes('australia')) return 'au';
  return 'us';
}

const speaker = z.object({
  name: z.string().trim().min(1).max(30),
  role: englishText(2, 60),
  accent: z.preprocess(accentOf, z.enum(ACCENTS)),
});

const line = z.object({ s: intIn(0, 2), text: englishText(2, 260) });

export const listeningDialog: PromptTemplate<ListeningDialogVars, ListeningDialogOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 24 * 60 * 60 * 1000 },
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      `Write a realistic business ${vars.scenario} between 2 or 3 people for a German-speaking professional (CEFR ${vars.level}, aiming for C1) to listen to.`,
      '- About 90 seconds when spoken (150 to 220 words), natural speed: short turns, fillers, one polite disagreement, one interruption.',
      '- Each speaker has a different accent label: "us", "gb", "in" or "au". Use American spelling everywhere.',
      '- By the end, the group agrees on 2 to 4 concrete points (who does what by when).',
      '- points: those agreements in short English sentences, exactly what a good follow-up email must contain.',
      `- setting: one short ${langName(vars.uiLang)} sentence: who talks and why (no spoilers about the result).`,
      '- lines: every line has "s" = index of the speaker in "speakers" and "text" (at most 240 characters).',
      'Reply with only one JSON object, no other text: {"title": "<English title>", "setting": "<sentence>", "speakers": [{"name": "<first name>", "role": "<role>", "accent": "us|gb|in|au"}], "lines": [{"s": 0, "text": "<what they say>"}], "points": ["<agreement>"]}',
    ].join('\n');
  },
  schema: (vars) =>
    z
      .object({
        title: englishText(3, 90),
        setting: uiText(vars.uiLang, 8, 240),
        speakers: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 3) : v), z.array(speaker).min(2).max(3)),
        lines: lenientArray(line, 6, 24),
        points: lenientArray(englishText(5, 180), 2, 4),
      })
      .superRefine((v, ctx) => {
        v.lines.forEach((l, i) => {
          if (l.s >= v.speakers.length) ctx.addIssue({ code: 'custom', path: ['lines', i, 's'], message: 's must be the index of a speaker' });
        });
        v.speakers.forEach((_, s) => {
          if (!v.lines.some((l) => l.s === s)) ctx.addIssue({ code: 'custom', path: ['speakers', s], message: 'every speaker needs at least one line' });
        });
        if (britishCount(v.lines.map((l) => l.text).join(' ')) > 2) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'use American spelling' });
      }),
};
