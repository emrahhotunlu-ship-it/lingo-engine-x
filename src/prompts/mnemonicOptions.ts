import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// mnemonic-options@1 (Wort-Lernen 2, Wort-Werkstatt): je hakendem Wort ZWEI Merkhilfen zur Auswahl – eine Eselsbrücke (echter Wortteil, echte
// Klang-/Schreibähnlichkeit oder ein Bild der Bedeutung; nie ein erfundener Gleichklang, Lehrer-Prüfung 21.10.2026) und eine kurze Szene aus dem
// Berufsalltag des Lernenden. Gebündelt: höchstens 2 Wörter je Aufruf (so viele Werkstatt-Wörter gibt es je Tag).
// `quick`, einen Tag zwischengespeichert. Automatisch nur mit beantwortetem Nutzeraufruf (`sampleConfirmed`) und in der Tutor-Tagesbremse; sonst per Knopf.
// Die Texte stehen in der Oberflächensprache (Sprachtreue, Kap. 10). Gespeichert wird nur, was Emrah auswählt (`mnemo.own = 1`).

export type MnemonicOptionsWord = {
  id: string;
  en: string;
  /** Bedeutung in der Oberflächensprache. */
  meaning: string;
  sentence: string;
  /** Diagnose der Werkstatt: confusion | false_friend | partner | form | sound | meaning. */
  issue: string;
  /** Verwechseltes Wort bzw. zuletzt falsch Getipptes; bei `partner` die verfehlte Wortpartner-Verbindung; sonst leer. */
  other: string;
};
export type MnemonicOptionsVars = { words: readonly MnemonicOptionsWord[]; uiLang: UiLang; ctx: string };
export type MnemonicOptionsItem = { id: string; options: [string, string] };
export type MnemonicOptionsOut = { items: MnemonicOptionsItem[] };

export const MNEMO_OPT_MAX_WORDS = 2;
export const MNEMO_OPT_MIN = 12;
export const MNEMO_OPT_MAX = 220;
const W_ID = 40;
const W_EN = 60;
const W_MEANING = 120;
const W_SENT = 200;
const W_OTHER = 60;
const CTX_MAX = 300;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const MNEMONIC_OPTIONS_EXAMPLE =
  '{"items":[{"id":"v_leverage","options":["In leverage steckt lever – der Hebel. Du setzt etwas, das du schon hast, als Hebel ein.","Im Preisgespräch sagst du: „Let\'s leverage last quarter\'s numbers.“ Du setzt die guten Zahlen als Hebel für den besseren Preis ein."]}]}';

const ID = 'mnemonic-options';
const VERSION = 1;

const core = (w: string) => w.replace(/^to\s+/i, '').trim().toLowerCase();
/** Wortanfang (≤ 5 Zeichen) des ersten Wortes: auch gebeugte Formen zählen. */
const stem = (w: string): string => {
  const first = core(w).split(/\s+/)[0] ?? '';
  return first.slice(0, Math.min(first.length, 5));
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tolerant lesen: `{items}`, ein nacktes Array oder `words`; höchstens 2 Einträge. */
function looseItems(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (v.items ?? v.words) : v;
  return Array.isArray(list) ? { items: list.slice(0, MNEMO_OPT_MAX_WORDS) } : v;
}

const trimText = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);

const schemaFor = (vars: MnemonicOptionsVars): z.ZodType<MnemonicOptionsOut> => {
  const byId = new Map(vars.words.map((w) => [w.id, w]));
  const option = z.preprocess(trimText, z.string().min(MNEMO_OPT_MIN).max(MNEMO_OPT_MAX));
  const item = z
    .object({ id: z.string(), options: z.tuple([option, option]) })
    .superRefine((it, ctx) => {
      const w = byId.get(it.id);
      if (!w) {
        ctx.addIssue({ code: 'custom', path: ['id'], message: 'unknown id' });
        return;
      }
      const s = stem(w.en);
      it.options.forEach((o, i) => {
        if (s && !o.toLowerCase().includes(s)) ctx.addIssue({ code: 'custom', path: ['options', i], message: 'must mention the word' });
        langOf(['text'], vars.uiLang)({ text: o }, ctx);
      });
      if (it.options[0].toLowerCase() === it.options[1].toLowerCase()) ctx.addIssue({ code: 'custom', path: ['options', 1], message: 'options must differ' });
    });
  return z.preprocess(looseItems, z.object({ items: z.array(item).min(1).max(MNEMO_OPT_MAX_WORDS) }));
};

const ISSUE_TEXT: Record<string, string> = {
  confusion: 'mixes it up with another English word',
  false_friend: 'falls into a German false friend',
  partner: 'forgets its typical partner word',
  form: 'misspells it',
  sound: 'does not recognize it when hearing it',
  meaning: 'does not recall the meaning',
};

function wordLine(w: MnemonicOptionsWord): string {
  const parts = [`id=${clip(w.id, W_ID)}`, `word=${clip(w.en, W_EN)}`, `meaning=${clip(w.meaning, W_MEANING) || '-'}`, `card sentence=${clip(w.sentence, W_SENT) || '-'}`, `problem=${ISSUE_TEXT[w.issue] ?? ISSUE_TEXT.meaning}`];
  const other = clip(w.other, W_OTHER);
  if (other) parts.push(w.issue === 'partner' ? `missed partner phrase=${other}` : `typed or confused with=${other}`);
  return `- ${parts.join(' | ')}`;
}

export const mnemonicOptions: PromptTemplate<MnemonicOptionsVars, MnemonicOptionsOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const words = v.words.slice(0, MNEMO_OPT_MAX_WORDS);
    const ctx = clip(v.ctx, CTX_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking business professional (CEFR B2, aiming for C1) keeps forgetting these English words. Write TWO different memory aids per word.',
      ctx ? `Learner work context: ${ctx}` : 'Learner work context: (none, use general business life)',
      `Language of the memory aids: ${langName(v.uiLang)}`,
      'Words:',
      ...words.map(wordLine),
      'Reply with only one JSON object, no other text, exactly this shape:',
      MNEMONIC_OPTIONS_EXAMPLE,
      'Rules:',
      '- One item per word, with the same id. options: exactly 2 strings, each one or two short sentences (max. 35 words), in the language given above.',
      '- Option 1 (hook): use a REAL sound or spelling link only if the English word truly sounds or looks like the German word you name; otherwise use a real word part (e.g. "lever" in leverage) or a vivid image of the meaning. Never invent a sound-alike.',
      '- Option 2 (scene): a short scene from the learner work context in which the word is used with its meaning; it may contain one short English phrase with the word.',
      '- Each option mentions the English word exactly once. If the problem is a confusion or a false friend, make the difference to the other word clear.',
      '- For a confusion, the other word is not wrong in general: say in which situation each one is used.',
      '- If the problem is the partner word, build both options around the missed partner phrase.',
      '- If the problem is spelling, the hook must target the tricky letters; if it is hearing, the sound (US pronunciation).',
      '- Never invent etymology. Only state a word origin if it is true.',
      '- Never equate the English word with a German word whose meaning is wider or different (e.g. not "nutzen = leverage"); describe the exact meaning given above.',
      '- Any English phrase must be natural American English with its typical collocation and a business register; British forms are not errors.',
      '- No lists, no quotes around the whole text.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
