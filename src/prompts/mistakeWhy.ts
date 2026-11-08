import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header } from './common';
import type { PromptTemplate, UiLang } from './types';

// mistake-why@1 „Warum genau meine Antwort?“ (Emrah 08.11.2026: „ich checke meinen Fehler nicht, weil du ihn nicht erklärst, sondern mir generelle Regeln gibst“; Lehrer-Stichprobe:
// Erklärungen zu echten Fehlern 3,5/10, 13 von 15 erklären nicht seine Antwort). Bei einer falschen Antwort sagt Claude in EINEM Satz, warum genau
// diese Form nicht passt, und schreibt EINEN neuen Lückensatz zum selben Punkt („Gleich nochmal“). „Du → richtig“ rechnet die App selbst (alignWords),
// Claude bekommt die Stelle mitgeteilt. Gibt es eine hinterlegte Erklärung zu genau dieser falschen Antwort (`known`), nutzt Claude sie.
// `quick`, 24 h zwischengespeichert, nie automatisch wiederholt; genau ein Neuversuch nur bei Schemafehler (A6.3).

export type MistakeWhyVars = {
  /** Aufgabe: Satz mit ___ (Verb-Vorgabe in Klammern) oder Auftrag, ≤ 300. */
  task: string;
  /** Antwort des Lernenden, ≤ 160. */
  given: string;
  answer: string;
  accepted: readonly string[];
  /** Die abweichende Stelle (von der App berechnet). */
  du: string;
  richtig: string;
  /** Hinterlegte Erklärung zu genau dieser falschen Antwort (Deutsch), sonst null. */
  known: string | null;
  pattern: { name: string; form: string } | null;
  uiLang: UiLang;
};

export type MistakeWhyOut = {
  warum: { de: string; en: string };
  /** Prüfer 08.11.2026: Die Antwort ist hier vielleicht auch richtig – dann sagt `warum` das, statt einen Grund zu erfinden. */
  alsoOk: boolean;
  /** Neuer Lückensatz (genau einmal ___), Lösung und weitere gültige Lösungen; null, wenn Claude keinen brauchbaren lieferte. */
  nochmal: { en: string; answer: string; accepted: string[] } | null;
};

const ID = 'mistake-why';
const VERSION = 1;
export const MISTAKE_WHY_EXAMPLE_JSON = '{"warum":{"de":"…","en":"…"},"alsoOk":false,"nochmal":{"en":"…","answer":"…","accepted":[]}}';

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
// Abkürzungen („z. B.“, „u. a.“, „e.g.“) zählen nicht als Satzende (english-teacher 08.11.2026).
const ABBR = /\b(?:z\.\s?B|u\.\s?a|d\.\s?h|bzw|ca|etc|e\.g|i\.e|vs)\./gi;
const sentences = (s: string): number => (s.replace(ABBR, '').trim().match(/[.!?](?=\s|$)/g) ?? []).length;
const low = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
// Zweibuchstabige Wörter zählen nur als Hinweis, wenn sie ein echtes Signal sind („if“); Füllwörter nie.
const STOP = new Set(['on', 'in', 'at', 'to', 'of', 'we', 'it', 'is', 'an', 'he', 'me', 'my', 'us', 'be', 'do', 'so', 'or', 'by', 'up', 'as', 'no', 'go', 'am', 'the', 'and', 'you', 'your', 'that', 'this', 'with', 'for', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'not', 'from', 'but', 'our', 'their', 'they', 'she', 'his', 'her', 'its', 'key', 'word']);
/** Inhaltswörter der Aufgabe außer der eigenen und der richtigen Form: der „Hinweis im Satz“ (Signalwort, Zeit, Bedeutung). */
function clueWords(v: MistakeWhyVars): string[] {
  const own = new Set(`${v.du} ${v.richtig}`.toLowerCase().split(/[^a-z']+/));
  return [...new Set(v.task.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z']+/))].filter((w) => w.length >= 2 && !STOP.has(w) && !own.has(w));
}

/** Ein Satz, höchstens 26 Wörter; nennt die eigene Form oder die richtige (sonst wäre es wieder eine allgemeine Regel). */
const oneSentence = (lang: 'de' | 'en', v: MistakeWhyVars) =>
  z
    .string()
    .trim()
    .min(10)
    .max(260)
    .superRefine((s, ctx) => {
      if (words(s) > 26) ctx.addIssue({ code: 'custom', message: 'at most 26 words' });
      if (sentences(s) > 1 || s.includes('\n')) ctx.addIssue({ code: 'custom', message: 'exactly one sentence' });
      if (isWrongLang(s, lang)) ctx.addIssue({ code: 'custom', message: lang === 'de' ? 'must be written in German' : 'must be written in English' });
      const t = low(s);
      // Kurze eigene Form (1–4 Wörter): sie muss genannt sein – sonst wäre es wieder eine Regel über die Lösung (english-teacher 08.11.2026).
      const du = low(v.du);
      const needDu = du.length > 0 && words(du) <= 4;
      const named = needDu ? t.includes(du) : [v.du, v.richtig].map(low).filter((x) => x.length > 0).some((x) => t.includes(x));
      if (!named) ctx.addIssue({ code: 'custom', message: needDu ? `must quote the learner form "${v.du}"` : 'must quote the learner form or the correct form' });
    });

/** Kein Zirkelschluss („der Satz verlangt X“): mindestens ein Inhaltswort der Aufgabe (Signalwort, Zeit, Bedeutung) steht im deutschen oder englischen Satz. */
function hasClue(w: { de: string; en: string }, v: MistakeWhyVars): boolean {
  const clues = clueWords(v);
  if (!clues.length) return true;
  const t = ` ${low(w.de)} ${low(w.en)} `.replace(/[^a-z' ]+/g, ' ');
  return clues.some((c) => t.includes(` ${c} `));
}

/** „Gleich nochmal“: fällt still weg statt Neuversuch, wenn es nicht passt (keine Lücke, Aufgabe wiederholt, zu lang, Lösung leer). */
function acceptNochmal(x: unknown, v: MistakeWhyVars): MistakeWhyOut['nochmal'] {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const en = typeof o.en === 'string' ? o.en.trim() : '';
  const answer = typeof o.answer === 'string' ? o.answer.trim() : '';
  if (!en || !answer || answer.length > 60) return null;
  if ((en.match(/_{3,}/g) ?? []).length !== 1) return null;
  // Umformung (Schlüsselwort): Ausgangssatz → Rahmen, deshalb länger erlaubt.
  if (words(en) < 5 || words(en) > (en.includes('→') ? 40 : 24)) return null;
  if (low(en) === low(v.task)) return null;
  const accepted = Array.isArray(o.accepted) ? o.accepted.filter((a): a is string => typeof a === 'string' && !!a.trim() && a.length <= 60).map((a) => a.trim()).slice(0, 3) : [];
  return { en, answer, accepted };
}

export function mistakeWhySchema(v: MistakeWhyVars): z.ZodType<MistakeWhyOut> {
  return z
    .object({
      warum: z.object({ de: oneSentence('de', v), en: oneSentence('en', v) }),
      alsoOk: z.boolean().optional().default(false),
      nochmal: z.unknown().transform((x) => acceptNochmal(x, v)),
    })
    .superRefine((o, ctx) => {
      if (!o.alsoOk && !hasClue(o.warum, v))
        ctx.addIssue({ code: 'custom', path: ['warum'], message: 'name the concrete clue word from the task sentence that rules out the learner form ("the sentence needs X" is not a reason)' });
    })
    .transform((o) => ({ ...o, nochmal: o.alsoOk ? null : o.nochmal }));
}

const line = (label: string, text: string): string => `${label}: ${text}`;

export const mistakeWhy: PromptTemplate<MistakeWhyVars, MistakeWhyOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You diagnose ONE answer of a German-speaking learner (B2, aiming for C1, business English) that the app graded as wrong.',
      'Explain why exactly the learner form does not work HERE. Do not state a general rule without naming the learner form. American English is the standard; British forms count as correct.',
      'If the learner form is in fact also correct, natural English for this task, set "alsoOk": true and say so in warum instead of inventing a reason. Otherwise "alsoOk": false.',
      line('Task', clip(v.task, 300)),
      line('Learner answer', clip(v.given, 160)),
      line('Correct answer', clip(v.answer, 160)),
      v.accepted.length > 1 ? line('Also accepted', v.accepted.slice(0, 4).map((a) => clip(a, 80)).join(' | ')) : '',
      line('Wrong part (learner)', clip(v.du, 80)),
      line('Correct part', clip(v.richtig, 80)),
      v.pattern ? line('Grammar point', `${clip(v.pattern.name, 100)} (${clip(v.pattern.form, 120)})`) : '',
      v.known ? line('Known explanation for exactly this mistake (German; keep its content)', clip(v.known, 240)) : '',
      'Reply with only one JSON object in exactly this shape:',
      MISTAKE_WHY_EXAMPLE_JSON,
      'Rules:',
      // Wortlaut nach english-teacher 08.11.2026. Das Schema erlaubt 26 Wörter als Puffer für die 22 im Prompt.
      `- warum: ONE sentence, max 22 words, German "de" and English "en". Start with the learner form in quotes ("${clip(v.du || v.richtig, 60)}"), say what it signals or means, then quote the word in THIS sentence that rules it out (signal word, key word, meaning); "the sentence needs X" is not a reason. Name the German habit only if this is a real German transfer (seit + Präsens, gestern habe ich …, Wenn … wird, Informationen); never invent one. Tense names (Past Simple) are fine; no other grammar terms, no abbreviations, no "always/never" rules.`,
      '- If the learner form is only a typo, say so and nothing else.',
      '- nochmal: ONE new business sentence (8 to 18 words). Keep the SAME trigger (same signal word, conjunction or key word) and the same answer form; change only the topic. Exactly one gap ___; exactly one natural solution; base verb in English in brackets. "answer" is the gap text; put contractions or other equally correct gap texts in "accepted" (at most 3).',
      '- Key word transformation task: nochmal is again a transformation in one line: "<new source sentence> → <frame with ___> (KEYWORD)". In warum, say what the learner version changes (meaning, missing word around the key word, key word changed).',
      '- Choice task: nochmal is a gap to type, not a choice. Never reuse the task sentence.',
      '- If alsoOk is true, nochmal is null.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => mistakeWhySchema(v),
};
