import { z } from 'zod';
import { clip, header, langName } from './common';
import type { PromptTemplate, UiLang } from './types';

// listen-q@1: Hörübung mit Frage im Reiter „Anwenden“ (Plan docs/umbau/anwenden-plan.md, Übung 3). Claude schreibt kurze
// englische Texte mit je einem Wort aus Emrahs Wortschatz; die Sprachausgabe liest sie vor (kein Audio, keine Messung
// echter Hörfähigkeit). Das Schema prüft die Einträge bewusst NICHT einzeln: jeder Eintrag wird danach mit `acceptListen`
// (domain/apply/listenQ.ts) geprüft; was nicht besteht, fällt weg (ein Neuversuch würde das Kontingent verbrauchen).

export type ListenQVars = {
  /** Wörter aus Emrahs Wortschatz (höchstens 8; die schwächsten zuerst). */
  words: readonly string[];
  /** Zuletzt gehörte Texte, nicht wiederholen. */
  avoid: readonly string[];
  n: number;
  uiLang: UiLang;
};
export type ListenQOut = { items: unknown[] };

export const LISTEN_Q_MAX_ITEMS = 4;

export const LISTEN_Q_EXAMPLE =
  '{"items":[{"word":"deadline","text":"Thanks for the update. We will not meet the deadline on Friday, because the supplier is late. Could we move it to Tuesday?","question":"Why can the team not meet the deadline?","options":["The supplier is late.","The budget is too small.","The client changed the plan."],"answer":0,"quote":"because the supplier is late","why":"Der Grund steht direkt nach because."}]}';

const ID = 'listen-q';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tolerant lesen: `{items}`, ein nacktes Array, `texts` oder `data`. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.texts ?? v.data) : v;
  return Array.isArray(list) ? list.slice(0, LISTEN_Q_MAX_ITEMS) : list;
}

const schema: z.ZodType<ListenQOut> = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(LISTEN_Q_MAX_ITEMS)).transform((items) => ({ items }));

export const listenQ: PromptTemplate<ListenQVars, ListenQOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const words = v.words.slice(0, 8).map((w) => clip(w, 40)).filter(Boolean);
    const avoid = v.avoid.slice(0, 4).map((s) => clip(s, 100)).filter(Boolean);
    return [
      header({ id: ID, version: VERSION }),
      'You write short listening exercises for a German-speaking business professional (CEFR B2 aiming for C1). A text-to-speech voice reads each text aloud; the learner then answers one question without seeing the text.',
      'American English only (US spelling, US vocabulary).',
      `Number of texts: ${Math.max(1, Math.min(LISTEN_Q_MAX_ITEMS, Math.round(v.n)))}`,
      `Learner vocabulary (use a different word in each text): ${words.join('; ') || '(none)'}`,
      `Do not repeat these texts: ${avoid.join(' | ') || '(none)'}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      LISTEN_Q_EXAMPLE,
      'Rules:',
      '- word: the vocabulary word the text is about; it must appear in the text exactly as written in the vocabulary list or in a normal inflected form.',
      '- text: 3 to 5 short sentences, 35–70 words in total, a realistic work situation (a call, a short voicemail, a meeting remark) or an everyday situation. Natural spoken English, no lists, no brackets.',
      '- question: one question about the content (a reason, a number, a decision, who does what). It must be answerable only by listening to the text. Never ask about spelling or pronunciation, and never ask what a word means.',
      '- options: exactly 3 short answers. Exactly one is right. The two wrong ones are plausible but clearly contradicted or not mentioned in the text. Put the right answer at a random position.',
      '- answer: the index (0, 1 or 2) of the right option.',
      '- quote: the exact words from the text (at least 3 words, copied letter for letter) that make the answer right.',
      '- why: one sentence in the explanation language, pointing to the place in the text.',
      '- No straight double quotes anywhere inside the strings.',
    ].join('\n');
  },
  schema: () => schema,
};
