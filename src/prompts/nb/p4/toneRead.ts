import { z } from 'zod';
import { block, header, langName } from '../../common';
import { uiText } from '../../inputCommon';
import type { PromptTemplate, UiLang } from '../../types';

// tone-read@1 (Backlog B9, Markt GR2 „Ton-Erkennung“): Wie wirkt der eigene englische Text?
// 1–3 Etiketten aus einer festen Liste (die App übersetzt sie selbst), ein Satz Begründung und
// höchstens ein Tipp. Nur auf Tipp, nie automatisch.

export const TONES = ['friendly', 'polite', 'formal', 'neutral', 'confident', 'direct', 'tentative', 'casual', 'warm', 'urgent', 'apologetic', 'salesy', 'stiff', 'abrupt'] as const;
export type Tone = (typeof TONES)[number];

export type ToneReadVars = { text: string; uiLang: UiLang };
export type ToneReadOut = { tones: Tone[]; note: string; tip: string };

const ID = 'tone-read';
const VERSION = 1;

/** Etiketten tolerant: klein, bekannte Synonyme abbilden, Unbekanntes und Doppeltes fallen weg. */
export function tonesOf(v: unknown): unknown {
  if (!Array.isArray(v)) return typeof v === 'string' ? tonesOf(v.split(/[,/]/)) : v;
  const alias: Record<string, Tone> = { assertive: 'confident', blunt: 'abrupt', harsh: 'abrupt', rude: 'abrupt', courteous: 'polite', professional: 'formal', informal: 'casual', hesitant: 'tentative', unsure: 'tentative', pushy: 'salesy', stiff: 'stiff', wooden: 'stiff', sorry: 'apologetic' };
  const out: Tone[] = [];
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim().toLowerCase();
    const t = (TONES as readonly string[]).includes(s) ? (s as Tone) : alias[s];
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 3);
}

export const toneRead: PromptTemplate<ToneReadVars, ToneReadOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 24 * 60 * 60 * 1000 },
  build(vars) {
    const L = langName(vars.uiLang);
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking professional (CEFR B2, aiming for C1) wrote this English text for work. How does it come across to an American reader?',
      'Text:',
      block(vars.text, 3000),
      `- tones: 1 to 3 labels, only from this list: ${TONES.join(', ')}.`,
      `- note: one short ${L} sentence why, pointing to concrete words.`,
      `- tip: one short ${L} sentence how to shift the tone if it might not fit a business context, otherwise "".`,
      'Reply with only one JSON object, no other text: {"tones": ["<label>"], "note": "<sentence>", "tip": "<sentence or empty>"}',
    ].join('\n');
  },
  schema: (vars) =>
    z.object({
      tones: z.preprocess(tonesOf, z.array(z.enum(TONES)).min(1).max(3)),
      note: uiText(vars.uiLang, 3, 240),
      tip: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.union([z.literal(''), uiText(vars.uiLang, 3, 240)])),
    }),
};
