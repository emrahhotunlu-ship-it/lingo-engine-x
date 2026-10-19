import { z } from 'zod';
import { SB_MAX_WORDS, SB_MIN_WORDS, SB_PER_REQUEST } from '../domain/tutor/sentenceBank';
import { clip, header } from './common';
import type { PromptTemplate } from './types';

// word-bank@1 (Satzbank SB, wort-lernen-plan.md; Tutor-Engine v3 E6): gebündelt 6–8 Karten je Anfrage, je Karte 4 neue Beispielsätze – 2 Beruf,
// 1 Alltag, 1 andere Satzform (Frage, Verneinung, Nebensatz). Wendungen mit sb/sth bekommen in jedem Satz eine andere Füllung. Die Sätze landen in
// `vocab/<id>.sb[]` und sind in den ersten 4 Wochen nur GESAMMELT (Quarantäne, `sentenceBank.ts`). Hintergrund, `quick`, nie zwischengespeichert,
// höchstens 3 Aufrufe je Tag. Das Schema prüft die Einträge NICHT einzeln (Vorbild `word-ctx@1`): jeder geht durch `acceptBankItem`, ein schlechter
// Satz fällt allein weg und löst keinen Neuversuch aus. Ein Neuversuch nur, wenn gar keine Liste lesbar ist (A6.3).

export type WordBankCard = {
  id: string;
  en: string;
  pos: string;
  de: string;
  /** Ursprungssatz der Karte. */
  ex: string;
  /** `word` oder `phrase` (Wendung mit sb/sth). */
  kind: 'word' | 'phrase';
  /** Vorhandene Sätze der Karte (nicht wiederholen), höchstens 3 je Karte im Prompt. */
  have: readonly string[];
};
export type WordBankVars = { cards: readonly WordBankCard[]; ctx: string };
export type WordBankOut = { items: unknown[] };

export const WORD_BANK_MAX_CARDS = 8;
export const WORD_BANK_BG_PER_DAY = 3;
const CTX_MAX = 300;
const HAVE_MAX = 3;

/** Beispielantwort im Prompt; muss selbst `acceptBankItem` bestehen (Test). */
export const WORD_BANK_EXAMPLE =
  '{"items":[{"id":"v_reliable","sents":[' +
  '{"en":"We need a reliable supplier who can deliver the parts on time every month.","de":"Wir brauchen einen zuverlässigen Lieferanten, der die Teile jeden Monat pünktlich liefert.","sit":"supplier choice","k":"work"},' +
  '{"en":"Her forecasts were reliable enough that the board approved the budget without changes.","de":"Ihre Prognosen waren so verlässlich, dass der Vorstand das Budget ohne Änderungen genehmigte.","sit":"budget meeting","k":"work"},' +
  '{"en":"My old car is still surprisingly reliable, so we drove it to the coast again.","de":"Mein altes Auto ist immer noch erstaunlich zuverlässig, also sind wir wieder damit an die Küste gefahren.","sit":"weekend trip","k":"life"},' +
  '{"en":"Is the train to the airport reliable in winter, or does it break down and run late?","de":"Ist der Zug zum Flughafen im Winter zuverlässig, oder fällt er aus und hat Verspätung?","sit":"travel planning","k":"form"}' +
  ']}]}';

const ID = 'word-bank';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tolerant lesen: `{items}`, ein nacktes Array, `cards`, `words` oder `data`; höchstens 8 Einträge. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.cards ?? v.words ?? v.data) : v;
  return Array.isArray(list) ? list.slice(0, WORD_BANK_MAX_CARDS) : list;
}

const schema: z.ZodType<WordBankOut> = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(WORD_BANK_MAX_CARDS)).transform((items) => ({ items }));

function cardLine(c: WordBankCard): string {
  const have = c.have
    .slice(0, HAVE_MAX)
    .map((s) => clip(s, 140))
    .filter(Boolean);
  const parts = [`id=${clip(c.id, 40)}`, `${c.kind === 'phrase' ? 'phrase' : 'word'}=${clip(c.en, 60)}`, `pos=${clip(c.pos, 20) || '-'}`, `meaning=${clip(c.de, 60) || '-'}`, `card sentence=${clip(c.ex, 160) || '-'}`];
  if (have.length) parts.push(`already has=${have.join(' / ')}`);
  return `- ${parts.join(' | ')}`;
}

export const wordBank: PromptTemplate<WordBankVars, WordBankOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: false,
  budget: { bgPerDay: WORD_BANK_BG_PER_DAY },
  build(vars) {
    const cards = vars.cards.slice(0, WORD_BANK_MAX_CARDS);
    const ctx = clip(vars.ctx, CTX_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'You write example sentences for the vocabulary cards of a German-speaking business professional (CEFR B2, aiming for C1).',
      'American English only: US spelling and US vocabulary.',
      ctx ? `Learner work context: ${ctx}` : 'Learner work context: (none, use general business life)',
      'Cards:',
      ...cards.map(cardLine),
      'Reply with only one JSON object, no other text, exactly this shape:',
      WORD_BANK_EXAMPLE,
      'Rules:',
      '- One item per card, with the same id.',
      `- sents: exactly ${SB_PER_REQUEST} new, natural sentences per card, each ${SB_MIN_WORDS} to ${SB_MAX_WORDS} words, ending with a period or question mark, each containing the word (inflected forms are fine) with the meaning given.`,
      '- k: two sentences "work" (meetings, emails, clients, projects, negotiations), one "life" (everyday life outside work), one "form" (a question, a negative sentence or a sentence with a subordinate clause).',
      '- Each sentence is later shown with the word replaced by a gap. Use the word exactly once. Do not define, paraphrase or translate it inside the sentence. The context must make the word the clear best fit.',
      '- Use a different typical collocation in each sentence. For a phrase with sb/sth, fill sb/sth differently in each sentence. Do not repeat or closely copy the card sentence or "already has".',
      '- Keep the rest of each sentence at B2 level. Invented names only, never facts about real companies or people.',
      '- de: a natural German translation of the sentence. sit: the situation in 1 to 3 English words.',
      '- No brackets in sentences, no straight double quotes, no British spelling.',
    ].join('\n');
  },
  schema: () => schema,
};
