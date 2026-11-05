import { z } from 'zod';
import { clip, header, type PromptTemplate } from '../shared';

// word-know@1 (Großpaket W2 „Wörter-Wissen“, docs/umbau/wissen/plan.md, Emrah 05.11.2026): Wortpartner und Beispielsätze für bis zu 5 Wörter je
// Anfrage, im Hintergrund. Je Wort 3 feste Wortverbindungen (Kern + Partner, Satz mit genau EINER Klammer um die Verbindung) und 2 Sätze aus dem
// Berufsalltag des Lernenden, jeweils mit deutscher Übersetzung, passend zur GELERNTEN Bedeutung. Das Schema prüft die Einträge NICHT einzeln
// (Vorbild `word-bank@1`): jeder geht durch `acceptKnow` (domain/know.ts), ein schlechter fällt allein weg und löst keinen Neuversuch aus.
// Stufe `default` (Inhaltsqualität vor Tempo), nie zwischengespeichert, Hintergrund-Budget 10 Aufrufe je Tag (KI-Tor).

export type KnowReqCard = {
  id: string;
  head: string;
  pos: string;
  /** Gelernte deutsche Bedeutung. */
  de: string;
  /** Ursprungssatz der Karte. */
  ex: string;
  /** Falsche Verbindungen, die nie vorkommen dürfen (Fallen). */
  avoid: readonly string[];
  /** Vorhandene Sätze (nicht wiederholen), höchstens 3. */
  have: readonly string[];
};
export type KnowVars = { cards: readonly KnowReqCard[]; ctx: string };
export type KnowOut = { items: unknown[] };

export const KNOW_MAX_CARDS = 5;
export const KNOW_BG_PER_DAY = 10;
const CTX_MAX = 300;

/** Beispielantwort im Prompt; muss selbst `acceptKnow` bestehen (Test). */
export const KNOW_EXAMPLE =
  '{"items":[{"id":"w1","col":[' +
  '{"p":"raise an objection","de":"einen Einwand erheben","ex":"The CFO may [raise an objection] to the license costs in the next meeting."},' +
  '{"p":"anticipate an objection","de":"einem Einwand zuvorkommen","ex":"Good sales reps [anticipate an objection] before the client raises it."},' +
  '{"p":"overcome an objection","de":"einen Einwand ausräumen","ex":"We managed to [overcome the objection] about data security with a short audit report."}' +
  '],"sents":[' +
  '{"en":"Her main objection was that the cloud archive would not meet their retention rules.","de":"Ihr Haupteinwand war, dass das Cloud-Archiv ihre Aufbewahrungsregeln nicht erfüllen würde.","sit":"client call"},' +
  '{"en":"If the IT lead has no objection, we can start the pilot next week.","de":"Wenn der IT-Leiter keinen Einwand hat, können wir nächste Woche mit dem Pilotprojekt beginnen.","sit":"project kickoff"}' +
  ']}]}';

const ID = 'word-know';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tolerant lesen: `{items}`, ein nacktes Array, `cards`, `words` oder `data`; höchstens 5 Einträge. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.cards ?? v.words ?? v.data) : v;
  return Array.isArray(list) ? list.slice(0, KNOW_MAX_CARDS) : list;
}

const schema: z.ZodType<KnowOut> = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(KNOW_MAX_CARDS)).transform((items) => ({ items }));

function cardLine(c: KnowReqCard): string {
  const parts = [`id=${clip(c.id, 12)}`, `word=${clip(c.head, 60)}`, `pos=${clip(c.pos, 20) || '-'}`, `meaning (German)=${clip(c.de, 80) || '-'}`, `card sentence=${clip(c.ex, 160) || '-'}`];
  const avoid = c.avoid.slice(0, 4).map((x) => clip(x, 40)).filter(Boolean);
  if (avoid.length) parts.push(`never use (wrong)=${avoid.join(' / ')}`);
  const have = c.have.slice(0, 3).map((x) => clip(x, 140)).filter(Boolean);
  if (have.length) parts.push(`already has=${have.join(' / ')}`);
  return `- ${parts.join(' | ')}`;
}

export const wordKnow: PromptTemplate<KnowVars, KnowOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  budget: { bgPerDay: KNOW_BG_PER_DAY },
  build(vars) {
    const cards = vars.cards.slice(0, KNOW_MAX_CARDS);
    const ctx = clip(vars.ctx, CTX_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English teacher (CELTA/DELTA). For each vocabulary card of a German-speaking business professional (CEFR B2, aiming for C1) give typical collocations and example sentences.',
      'American English only: US spelling and US vocabulary.',
      ctx ? `Learner work context: ${ctx}` : 'Learner work context: (none, use general business life)',
      'Cards:',
      ...cards.map(cardLine),
      'Reply with only one JSON object, no other text, exactly this shape:',
      KNOW_EXAMPLE,
      'Rules:',
      '- One item per card, with the same id. Always use the word with the meaning and part of speech given on the card. Never switch to another sense or part of speech, not even in a collocation (for the noun "approach" never use the verb "approach a client").',
      '- The example answer above only shows the format. Never reuse its sentences or collocations for another card.',
      '- col: exactly 3 collocations the learner can reuse in other conversations: fixed combinations such as verb + noun, adjective + noun, adverb + adjective or a fixed phrase (as listed in a collocations dictionary), each 2 to 5 words and containing the card word. Never a random sentence fragment, never a combination that ends with a preposition, never one listed under "never use".',
      '  - Prefer combinations a C1 learner would not produce alone. No generic partners (help, make, get, give, very, really, efforts, things) and no free combinations of a common verb or adjective with the word.',
      '  - If the word is mainly used with a dependent preposition, give that pattern with sb/sth, for example "complain about sth" or "vulnerable to sth" (at most one such pattern per word). Never end with a bare preposition.',
      '  - For prepositions and linkers (despite, although, whereas) give their usage patterns instead, for example "despite the fact that", "despite + -ing".',
      '  - p: the collocation in base form. de: its natural German equivalent (2 to 6 words), in the same form (verb phrase as infinitive).',
      '  - ex: one natural sentence (6 to 20 words) from business life with the collocation (inflected forms are fine) inside exactly ONE pair of square brackets. Inside the brackets only the words of the collocation (plus an article or our/your if needed), no extra adjectives or adverbs.',
      '- sents: exactly 2 new, natural sentences from the learner work context (meetings, emails, clients, projects, negotiations), each 8 to 20 words, ending with a period or question mark, each containing the word exactly once with the meaning given. One may be a question or have a subordinate clause.',
      '  - de: a natural German translation of the sentence that uses the German meaning given on the card. sit: the situation in 1 to 3 English words.',
      '  - Do not copy a collocation sentence (ex) into sents. Use American business usage (two-factor authentication, public-sector clients, an error in judgment).',
      '- Only give what you are sure is natural, idiomatic American English. If a card word has fewer than 3 real collocations, give fewer.',
      '- Do not repeat or closely copy the card sentence or "already has". Invented names only, never facts about real companies or people, no numbers or statistics presented as real.',
      '- No straight double quotes, no brackets except the one pair in col.ex, no British spelling.',
    ].join('\n');
  },
  schema: () => schema,
};
