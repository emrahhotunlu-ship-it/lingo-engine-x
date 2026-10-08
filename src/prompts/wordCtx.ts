import { z } from 'zod';
import { clip, header } from './common';
import type { PromptTemplate } from './types';

// word-ctx@1 (Lernplattform 3.0 P52, KI-Tutor T3): zwei neue Sätze je schwachem Wort (einer bei der Arbeit, einer in einem anderen Rahmen, je eine
// andere Kollokation, lückentauglich: das Wort genau einmal), und – nur wenn er zwei eigene
// Wörter verwechselt hat und beide schon sitzen – ein Kontrast-Satz für das andere Wort mit kurzer Begründung auf Deutsch und Englisch.
// Hintergrund (`priority: 'background'`), `quick`, nie zwischengespeichert, höchstens 1 Aufruf je Tag (`budget`), ausgelöst am Ende einer Wörter-Runde.
// Das Schema prüft die Einträge bewusst NICHT einzeln (Vorbild `order-gen@1`): jeder wird mit `acceptWordCtx` (domain/tutor/acceptWordCtx.ts) geprüft,
// ein schlechter reißt die anderen nicht mit und löst keinen Neuversuch aus.

export type WordCtxVarsWord = {
  id: string;
  en: string;
  pos: string;
  de: string;
  ex: string;
  other: { en: string; de: string } | null;
};
export type WordCtxVars = {
  words: readonly WordCtxVarsWord[];
  ctx: string;
  avoid: readonly string[];
};
export type WordCtxOut = { items: unknown[] };

export const WORD_CTX_MAX_WORDS = 6;
export const WORD_CTX_MAX_AVOID = 8;
export const WORD_CTX_CTX_MAX = 300;
const W_EN = 60;
const W_POS = 20;
const W_DE = 60;
const W_EX = 160;
const W_ID = 40;
const AVOID_LEN = 140;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const WORD_CTX_EXAMPLE =
  '{"items":[{"id":"v_current","sents":[{"en":"The current contract runs until March, so we still have time to renegotiate.","de":"Der aktuelle Vertrag läuft bis März, also haben wir noch Zeit für Nachverhandlungen.","sit":"contract review"},{"en":"Is this the current schedule, or did the trains change again this week?","de":"Ist das der aktuelle Fahrplan, oder haben sich die Züge diese Woche wieder geändert?","sit":"train station"}],"contrast":{"en":"The actual cost of the move was twice as high as the first estimate.","why":{"de":"actual heißt tatsächlich (actual cost = tatsächliche Kosten), current heißt aktuell (current situation = aktuelle Lage): gemeint sind die echten Kosten, nicht die von heute.","en":"Actual means real (actual cost) and current means happening now (current situation): the sentence is about the real cost, not today\'s cost."}}},{"id":"v_reliable","sents":[{"en":"We need a reliable supplier who can deliver the parts on time every month.","de":"Wir brauchen einen zuverlässigen Lieferanten, der die Teile jeden Monat pünktlich liefert.","sit":"supplier choice"},{"en":"My old car is still surprisingly reliable, so we drove it to the coast again.","de":"Mein altes Auto ist immer noch erstaunlich zuverlässig, also sind wir wieder damit an die Küste gefahren.","sit":"weekend trip"}],"contrast":null}]}';

const ID = 'word-ctx';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tolerant lesen: `{items}`, ein nacktes Array, `words` oder `data`; höchstens 6 Einträge. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.words ?? v.data) : v;
  return Array.isArray(list) ? list.slice(0, WORD_CTX_MAX_WORDS) : list;
}

const schema: z.ZodType<WordCtxOut> = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(WORD_CTX_MAX_WORDS)).transform((items) => ({ items }));

function wordLine(w: WordCtxVarsWord): string {
  const parts = [`id=${clip(w.id, W_ID)}`, `word=${clip(w.en, W_EN)}`, `pos=${clip(w.pos, W_POS) || '-'}`, `meaning=${clip(w.de, W_DE) || '-'}`, `card sentence=${clip(w.ex, W_EX) || '-'}`];
  if (w.other) parts.push(`confused with=${clip(w.other.en, W_EN)} (${clip(w.other.de, W_DE) || '-'})`);
  return `- ${parts.join(' | ')}`;
}

export const wordCtx: PromptTemplate<WordCtxVars, WordCtxOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: false,
  budget: { bgPerDay: 1 },
  build(vars) {
    const words = vars.words.slice(0, WORD_CTX_MAX_WORDS);
    const avoid = vars.avoid
      .slice(0, WORD_CTX_MAX_AVOID)
      .map((s) => clip(s, AVOID_LEN))
      .filter(Boolean);
    const ctx = clip(vars.ctx, WORD_CTX_CTX_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'You write new example sentences for words a German-speaking business professional (CEFR B2, aiming for C1) keeps forgetting.',
      'American English only: US spelling and US vocabulary.',
      ctx ? `Learner work context: ${ctx}` : 'Learner work context: (none, use general business life)',
      'Words:',
      ...words.map(wordLine),
      `Do not repeat these sentences: ${avoid.join(' | ') || '(none)'}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      WORD_CTX_EXAMPLE,
      'Rules:',
      '- One item per word, with the same id.',
      '- sents: exactly 2 new, natural sentences, each 8 to 18 words, ending with a period or question mark, each containing the word (inflected forms are fine) with the meaning given.',
      '- Each sentence is later shown with the word replaced by a gap. Use the word exactly once. Do not define, paraphrase or translate it inside the sentence. The context must make the word the clear best fit, so a learner who knows it could fill the gap.',
      '- Sentence 1: a real work situation of the learner (meetings, emails, clients, projects, negotiations). Sentence 2: a clearly different setting, preferably everyday life if the word is common there, otherwise a clearly different work situation. One sentence sounds spoken, the other written.',
      '- Use a different typical collocation of the word in each sentence. Keep the rest of each sentence at B2 level. Use invented names only, never facts about real companies.',
      '- de: a natural German translation of the sentence. sit: the situation in 1 to 3 English words.',
      '- contrast: only for a word with "confused with", otherwise null. One sentence (8 to 18 words) that uses the OTHER word correctly, does NOT contain the word itself, and in which using the word itself instead would be clearly wrong or change the meaning (not just less natural). If no such sentence exists, set contrast to null.',
      '- why: one short sentence each in German (de) and English (en) explaining why the other word fits THIS sentence and the word does not: name both words with their meaning and one typical partner each (e.g. current situation / actual cost).',
      '- No brackets in sentences, no straight double quotes, no British spelling.',
    ].join('\n');
  },
  schema: () => schema,
};
