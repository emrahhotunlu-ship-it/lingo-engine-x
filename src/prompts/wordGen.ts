import { z } from 'zod';
import { editDistance } from '../domain/answer/diff';
import { isWrongLang } from '../domain/lang/detect';
import { locate, lemmaOf } from '../domain/srs/context';
import { lemmaCandidates } from '../domain/text/lemma';
import { cefrLoose, clip, header } from './common';
import type { PromptTemplate } from './types';

// word-gen@2 (Funktionsabgleich M2): neue Wörter auf Knopfdruck – „Neue Wörter von Claude"
// (allgemein, B2–C1) und „Fachwörter für meinen Beruf" – sowie das Ergänzen eines selbst
// eingegebenen Worts (Bedeutung, Wortart, Beispielsatz). Nie im Hintergrund (sample.d.ts).
// Jede Karte bekommt einen Beispielsatz mit dem Wort (Kap. 15: keine Karte ohne Ursprungssatz).
// `de` ist Deutsch, `def` Englisch – in beiden Oberflächensprachen gleich gespeichert wie bisher.

export type WordGenMode = 'general' | 'job' | 'fill';
export type WordGenVars = {
  mode: WordGenMode;
  count: number;
  /** Bekannte Wörter (≤ 200), die nicht vorkommen dürfen. */
  known: readonly string[];
  /** Nur bei `fill`: das Wort, das ergänzt werden soll. */
  word?: string;
};
export type GenWord = { word: string; pos: string; de: string; def: string; ex: string; level: string };
export type WordGenOut = { words: GenWord[] };

export const GEN_KNOWN_MAX = 200;
export const GEN_WORD_MAX = 60;

export const WORD_GEN_EXAMPLE =
  '{"words":[{"word":"stakeholder","pos":"noun","de":"Interessengruppe, Beteiligte(r)","def":"a person or group with an interest in a project or business","ex":"We invited every stakeholder to the kickoff meeting on Monday.","level":"B2"}]}';

const ID = 'word-gen';
const VERSION = 2;

const PLACEHOLDER = /\b(something|someone|somebody|sth|sb|one's|someone's)\b|\[[^\]]*\]/gi;
const core = (w: string) =>
  w
    .replace(/^to\s+/i, '')
    .replace(PLACEHOLDER, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const stem = (w: string) => w.replace(/(ies|es|s|ed|ing|e|y)$/, '');

/**
 * Kommt das Wort im Beispiel vor (W4)? Wie `acceptExamples`: ganze Wendung auch gebeugt (`locate`),
 * sonst das erste Inhaltswort in irgendeiner Form, auch unregelmäßig (undertake → undertook).
 */
export function exampleHasWord(ex: string, word: string): boolean {
  const lemma = lemmaOf(word).replace(PLACEHOLDER, ' ').replace(/\s+/g, ' ').trim();
  if (lemma && locate(ex, lemma)) return true;
  const head = core(word).split(' ')[0] ?? '';
  if (!head) return true;
  const lower = ex.toLowerCase();
  if (lower.includes(stem(head))) return true;
  const tokens = lower.match(/[a-z]+(?:['’][a-z]+)?/g) ?? [];
  return tokens.some((t) => lemmaCandidates(t).includes(head));
}

const wordSchema = z
  .object({
    word: z.string().trim().min(1).max(GEN_WORD_MAX),
    pos: z.string().trim().min(1).max(20),
    de: z.string().trim().min(1).max(120),
    def: z.string().trim().min(3).max(200),
    ex: z.string().trim().min(12).max(220),
    // „B2+“, „b2“, „B2–C1“ → erste Stufe; A1/A2 kommen bei Alltagswörtern vor.
    level: z.preprocess(cefrLoose, z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])),
  })
  .superRefine((w, ctx) => {
    if (!exampleHasWord(w.ex, w.word)) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'the example must contain the word' });
    if (isWrongLang(w.ex, 'en')) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'must be written in English' });
    if (isWrongLang(w.def, 'en')) ctx.addIssue({ code: 'custom', path: ['def'], message: 'must be written in English' });
  });

/** Nur ein Tippfehler (recieve → receive)? Kurze Wörter höchstens 1, sonst höchstens 2 Zeichen Abstand. */
export function isSpellingFix(typed: string, got: string): boolean {
  const a = core(typed);
  const b = core(got);
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return editDistance(a, b) <= (Math.min(a.length, b.length) <= 6 ? 1 : 2);
}

/** Korrigierte Schreibweise aus dem Ergänzen (fill), wenn Claude einen Tippfehler behoben hat; sonst `null`. */
export function spellingCorrection(typed: string, got: string): string | null {
  return core(typed) !== core(got) && isSpellingFix(typed, got) ? got.trim() : null;
}

/** Mindestens so viele gültige Wörter müssen übrig bleiben (sonst Fehler), wie bisher eines. */
const NEEDED = 1;

const schemaFor = (v: WordGenVars): z.ZodType<WordGenOut> =>
  z
    .object({
      // W4: Ungültige Einzelwörter fallen weg, statt den ganzen Stapel abzulehnen.
      words: z.array(z.unknown()).transform((arr, ctx) => {
        const ok: GenWord[] = [];
        const bad: Array<{ i: number; path: PropertyKey[]; message: string }> = [];
        arr.forEach((raw, i) => {
          const r = wordSchema.safeParse(raw);
          if (r.success) ok.push(r.data);
          else r.error.issues.forEach((iss) => bad.push({ i, path: iss.path, message: iss.message }));
        });
        if (ok.length < NEEDED) {
          if (!bad.length) ctx.addIssue({ code: 'custom', message: `at least ${NEEDED} words are required` });
          bad.slice(0, 5).forEach((b) => ctx.addIssue({ code: 'custom', path: [b.i, ...b.path], message: b.message }));
          return z.NEVER;
        }
        return ok.slice(0, Math.max(1, v.count) + 2);
      }),
    })
    .superRefine((out, ctx) => {
      if (v.mode === 'fill' && v.word && !isSpellingFix(v.word, out.words[0]?.word ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['words', 0, 'word'], message: `must be exactly "${v.word}"` });
      }
    });

export const wordGen: PromptTemplate<WordGenVars, WordGenOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const known = v.known.slice(0, GEN_KNOWN_MAX).map((k) => clip(k, 40));
    const task =
      v.mode === 'fill'
        ? `Complete the card for the word: ${clip(v.word ?? '', GEN_WORD_MAX)} (exactly this word, 1 item; if it is misspelled, use the correct spelling).`
        : v.mode === 'job'
          ? `Suggest ${v.count} useful words or fixed phrases for the learner's job (B2–C1): business development and sales of cloud software for documents and processes (DMS/ECM), meetings with partners and customers.`
          : `Suggest ${v.count} useful general words or fixed phrases at B2–C1 level for everyday and work conversations.`;
    return [
      header({ id: ID, version: VERSION }),
      'You create vocabulary cards for ONE learner: German native speaker, English level B2 aiming for C1, head of business development at a German DMS/ECM cloud vendor.',
      'American English only (US spelling). Invented names only, never facts about a real company.',
      task,
      `Mode: ${v.mode}`,
      `Do not suggest: ${known.join(', ') || '(none)'}`,
      'Reply with only one JSON object of this shape (one item shown):',
      WORD_GEN_EXAMPLE,
      'Rules:',
      '- word: base form (verbs without "to"), or a fixed phrase. pos: noun, verb, adjective, adverb, phrase or phrasal verb.',
      '- de: short German translation(s), comma-separated. def: short English definition.',
      '- ex: one natural sentence (10–18 words) that contains the word; work or everyday context.',
      '- level: CEFR level of the word: exactly one of A1, A2, B1, B2, C1, C2 (no "+").',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
