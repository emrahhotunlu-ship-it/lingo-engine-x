import { z } from 'zod';
import { clip, header } from './common';
import type { PromptTemplate } from './types';

// order-gen@1: neue Sätze für die Übung „Satzbau“ nach den C1-Mustern des festen Pools (Emrah 02.10.2026).
// Eine Anfrage je Runde, höchstens 8 Sätze. Das Schema prüft die Sätze bewusst NICHT einzeln: ein fehlerhafter
// Satz darf die anderen nicht mitreißen und keinen Neuversuch auslösen (Kontingent). Jeder Satz wird danach mit
// `acceptGenerated` (domain/drills/orderPool.ts) geprüft; was nicht besteht, fällt weg.

export type OrderGenVars = {
  /** Themen, auf die der Schwerpunkt liegt (zuerst die, bei denen Emrah zuletzt Fehler hatte). */
  topics: readonly string[];
  /** Aktuelle Wörter aus Emrahs Wortschatz, optional als Kontext. */
  words: readonly string[];
  /** Zuletzt gesehene Sätze, nicht wiederholen. */
  avoid: readonly string[];
  n: number;
};
export type OrderGenOut = { items: unknown[] };

export const ORDER_GEN_MAX_ITEMS = 8;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const ORDER_GEN_EXAMPLE =
  '{"items":[{"topic":"c1-emphasis","en":"What we need is a partner who understands compliance.","de":"Was wir brauchen, ist ein Partner, der Compliance versteht.","chunks":["what","we","need","is","a partner","who understands compliance"],"alt":["A partner who understands compliance is what we need."],"why":["Der What-Satz ist das Subjekt, deshalb steht kein Komma vor is.","The what-clause is the subject, so there is no comma before is."],"bad":"What we need, is a partner who understands compliance."},{"topic":"c1-hedging","en":"It might be worth revisiting the timeline before we sign.","de":"Es könnte sich lohnen, den Zeitplan vor der Unterschrift noch einmal anzusehen. (vorsichtig vorgeschlagen)","chunks":["it","might","be worth","revisiting","the timeline","before we sign"],"alt":["Before we sign, it might be worth revisiting the timeline."],"why":["Nach worth steht die -ing-Form, nicht ein to-Infinitiv.","After worth comes the -ing form, not a to-infinitive."]}]}';

const ID = 'order-gen';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v.trim() : undefined);

/** Ein Eintrag in die Form des Pools bringen: `alt` als Text, `why` als Objekt, Alternativnamen. */
function looseItem(x: unknown): unknown {
  if (!isObj(x)) return x;
  const alt = x.alt ?? x.alts ?? x.alternatives;
  const why = x.why ?? x.explanation;
  const w: unknown = isObj(why) ? [why.de ?? why.german, why.en ?? why.english] : why;
  return {
    topic: str(x.topic ?? x.theme),
    en: str(x.en ?? x.sentence),
    de: str(x.de ?? x.german),
    chunks: Array.isArray(x.chunks) ? x.chunks.map((c) => (typeof c === 'string' ? c.trim() : c)) : x.chunks,
    ...(alt === undefined || alt === null ? {} : { alt: typeof alt === 'string' ? (alt.trim() ? [alt.trim()] : []) : alt }),
    ...(typeof x.single === 'string' ? { single: x.single.trim() } : {}),
    why: Array.isArray(w) ? w.map((t) => (typeof t === 'string' ? t.trim() : t)) : w,
    ...(typeof x.bad === 'string' ? { bad: x.bad.trim() } : {}),
  };
}

/** Tolerant lesen: `{items}`, ein nacktes Array, `sentences` oder `data`. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.sentences ?? v.data) : v;
  return Array.isArray(list) ? list.slice(0, ORDER_GEN_MAX_ITEMS).map(looseItem) : list;
}

const schema: z.ZodType<OrderGenOut> = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(ORDER_GEN_MAX_ITEMS)).transform((items) => ({ items }));

export const orderGen: PromptTemplate<OrderGenVars, OrderGenOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(vars) {
    const words = vars.words.slice(0, 12).map((w) => clip(w, 40)).filter(Boolean);
    const avoid = vars.avoid.slice(0, 6).map((s) => clip(s, 120)).filter(Boolean);
    return [
      header({ id: ID, version: VERSION }),
      'You write sentence-building exercises for a German-speaking business professional (CEFR B2 aiming for C1).',
      'The learner sees the German meaning and builds the English sentence from shuffled tiles. American English only (US spelling, US vocabulary).',
      `Topics (focus first): ${vars.topics.map((t) => clip(t, 20)).join(', ')}`,
      `Number of sentences: ${Math.max(1, Math.min(ORDER_GEN_MAX_ITEMS, Math.round(vars.n)))}`,
      `Learner vocabulary: ${words.join('; ') || '(none)'}`,
      `Do not repeat these sentences: ${avoid.join(' | ') || '(none)'}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      ORDER_GEN_EXAMPLE,
      'Topics explained: c1-emphasis (inversion, cleft sentences, emphatic do), c1-discourse (linking phrases such as that said, on the other hand, all in all), c1-hedging (softening: might, seems, slightly), c1-diplomacy (polite requests and disagreement), c1-precision (exact time, place and quantity words), c1-nominal (noun style such as the approval of, upon receipt of), c1-participle (participle clauses such as Having seen the demo, …).',
      'Rules:',
      '- en: one natural business sentence, 8–18 words, a pattern that German speakers often get wrong. Always end with . ? or !',
      '- de: the German meaning, natural German, never a word-for-word copy. For c1-hedging and c1-diplomacy add the tone in brackets at the end, for example (vorsichtig) or (höflich, an einen Kunden).',
      '- chunks: 5–9 tiles in the order of the sentence, lowercase except I and names, no punctuation, at most 5 words each. Fixed phrases (on the other hand, a bit of a stretch) are ONE tile. Every tile belongs to the sentence, no distractors. Together the tiles must give exactly the sentence.',
      '- alt: ALL other natural sentences that use exactly the same tiles in another order (full sentences, with the same wording). If there are none, leave alt empty and put one short English reason in single (why there is no second natural order). Never give both.',
      '- why: two lines, [German, English]. Explain the pattern the learner has to place correctly, not vocabulary. Each line at least one full sentence.',
      '- bad: optional typical mistake of a German speaker (a full wrong sentence), never equal to a correct order.',
      '- Use a word from the learner vocabulary only if it fits naturally.',
      '- Spread the sentences over the topics. Vary subjects and situations (meetings, contracts, projects, customers). No brackets in en. No straight double quotes anywhere.',
    ].join('\n');
  },
  schema: () => schema,
};
