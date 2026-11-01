import type { z } from 'zod';
import { clip, clipped, isWrongLang, langName, type PromptTemplate, type UiLang } from '../shared';
import { locateGap } from '../domain/card';

// Gemeinsames der drei Vorlagen des Wörter-Moduls (Großpaket A Schritt 5; plan.md §7, synthese.md §2.5):
//  - Urteil je Zielwort: ✓ `ok` richtig · ~ `odd` möglich, aber unnatürlich (oder Nebenfehler am Wort, z. B. Präposition) · ✕ `wrong` falsch
//    (falscher Sinn, falsches Wort) · `thin` richtig, aber zu einfach oder zu nah am Beispielsatz (zählt nicht als „benutzt“) · `unused` nicht benutzt.
//  - Fehlerklasse am Wort (`err`) für die Note (domain/apply.ts) und das Fehlerprofil.
//  - Einspruch („War das auch richtig?“): dieselbe Vorlage, `recheck: true`, Stufe `complex`, kein Zwischenspeicher (`asRecheck`).

export type UseVerdict = 'ok' | 'odd' | 'wrong' | 'thin' | 'unused';
export const USE_VERDICTS: readonly UseVerdict[] = ['ok', 'odd', 'wrong', 'thin', 'unused'];

/**
 * Fehlerklasse am Zielwort: `sense` falsche Bedeutung · `word` falsches Wort (Verwechsler, anderes Wort) · `form` Beugung/Wortform ·
 * `prep` Präposition/Muster · `colloc` falscher Wortpartner · `register` Ton passt nicht zur Lage · `other` Sonstiges am Wort.
 */
export type UseErr = 'sense' | 'word' | 'form' | 'prep' | 'colloc' | 'register' | 'other';
export const USE_ERRS: readonly UseErr[] = ['sense', 'word', 'form', 'prep', 'colloc', 'register', 'other'];

/** Ein Zielwort, wie der Prompt es braucht. `key` ist eine kurze Kennung im Prompt (w1, w2 …), nie der Datenbankpfad. */
export type VocabTarget = {
  key: string;
  /** Stichwort in Grundform (*postpone*, *sign off on*). */
  word: string;
  /** Bedeutung in der Oberflächensprache (die gelernte). */
  meaning: string;
  /** `w` Einzelwort · `pv` Phrasal Verb · `col` Kollokation · `ch` Wendung. */
  kind: 'w' | 'pv' | 'col' | 'ch';
  /** Beispielsatz der Karte: ein Satz, der zu nah daran ist, zählt nicht als eigener. */
  example?: string | null;
};

export const WORD_MAX = 60;
export const MEANING_MAX = 120;
export const EXAMPLE_MAX = 200;
export const WHY_MAX = 220;

const VERDICT_ALIASES: ReadonlyArray<[RegExp, UseVerdict]> = [
  [/^(ok|correct|right|good|yes|✓|✔)$/, 'ok'],
  [/^(odd|minor|unnatural|possible|partly|~|partial)$/, 'odd'],
  [/^(wrong|incorrect|error|false|no|✕|✗|x)$/, 'wrong'],
  [/^(thin|trivial|too[\s_-]?close|copied|too[\s_-]?simple|generic)$/, 'thin'],
  [/^(unused|missing|not[\s_-]?used|absent|none)$/, 'unused'],
];

/** Tolerant: „correct“, „Unnatural“, „not used“ → die fünf Werte; Unbekanntes bleibt stehen (das Schema lehnt es ab). */
export function verdictOf(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  for (const [re, out] of VERDICT_ALIASES) if (re.test(s)) return out;
  return v;
}

const ERR_ALIASES: ReadonlyArray<[RegExp, UseErr]> = [
  [/^(sense|meaning|wrong[\s_-]?meaning|semantic)$/, 'sense'],
  [/^(word|wrong[\s_-]?word|word[\s_-]?choice|confusion|false[\s_-]?friend|lexical)$/, 'word'],
  [/^(form|inflection|infl|grammar|word[\s_-]?form|tense|agreement)$/, 'form'],
  [/^(prep|preposition|pattern|complementation)$/, 'prep'],
  [/^(colloc|collocation|partner|word[\s_-]?partner)$/, 'colloc'],
  [/^(register|tone|style|formality)$/, 'register'],
];

/** Tolerant: „Preposition“, „collocation“ → die sieben Werte; Unbekanntes wird `other`; leer/null bleibt `null`. */
export function errOf(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (!s || s === 'none' || s === 'null') return null;
  if ((USE_ERRS as readonly string[]).includes(s)) return s;
  for (const [re, out] of ERR_ALIASES) if (re.test(s)) return out;
  return 'other';
}

/** Fehlerklasse passend zum Urteil: nur bei ~ und ✕; fehlt sie dort, gilt `other` (kein Neuversuch wegen eines Nebenfelds). */
export const errFor = (v: UseVerdict, err: UseErr | null): UseErr | null => (v === 'odd' || v === 'wrong' ? (err ?? 'other') : null);

/** Tolerant: `"true"`/`"yes"` bzw. `"false"`/`"no"` als Wahrheitswert. */
export function looseBool(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (s === 'true' || s === 'yes') return true;
  if (s === 'false' || s === 'no') return false;
  return v;
}

/** Leeres oder fehlendes Textfeld → "". */
export const blank = (v: unknown): unknown => (v === undefined || v === null ? '' : v);

/** Vergleichsform: Kleinschreibung, typografische Apostrophe, Leerraum zusammengefasst. */
export const flat = (s: string): string => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();

/** Steht `part` (wörtlich, ohne Groß-/Kleinschreibung) im Text? */
export const inText = (text: string, part: string): boolean => !!part.trim() && flat(text).includes(flat(part));

/** Kommt das Zielwort (gebeugt; Phrasal Verb auch getrennt) im Text vor? Eigene, lokale Prüfung (Plan §7: Claude prüft den Sinn, nicht nur das Vorkommen). */
export function hasTarget(text: string, t: Pick<VocabTarget, 'word' | 'kind'>): boolean {
  return locateGap(text, t.word, { pv: t.kind === 'pv' }) !== null;
}

/** Erklärung in der Oberflächensprache (Sprachtreue, Kap. 10): Pfad für die Fehlermeldung des einen Neuversuchs. */
export function checkLang(text: string, lang: UiLang, path: PropertyKey[], ctx: z.RefinementCtx): void {
  if (isWrongLang(text, lang)) ctx.addIssue({ code: 'custom', path, message: `must be written in ${langName(lang)}` });
}

/** Erklärung je Zielwort: ein Satz, gekürzt statt abgelehnt. */
export const why = () => clipped(1, WHY_MAX);

/** Zeile eines Zielworts im Prompt. */
export function targetLine(t: VocabTarget): string {
  const kind = t.kind === 'pv' ? 'phrasal verb' : t.kind === 'col' ? 'collocation' : t.kind === 'ch' ? 'fixed phrase' : 'word';
  const ex = t.example ? ` | card example (a sentence too close to it does not count): ${clip(t.example, EXAMPLE_MAX)}` : '';
  return `${t.key}: ${clip(t.word, WORD_MAX)} (${kind}; meaning: ${clip(t.meaning, MEANING_MAX)})${ex}`;
}

/** Hinweis für gesprochene Antworten (Spracherkennung): Satzzeichen, Großschreibung und Hörfehler der Erkennung sind keine Fehler. */
export const SPOKEN_RULE =
  'The text was spoken and transcribed by speech recognition: ignore punctuation, capitalization and obvious recognition slips (wrong homophones); judge the words the learner clearly said.';

/** Gemeinsame Regeln aller drei Vorlagen (synthese.md §2.5): was Claude nie tut. */
export function sharedRules(): string[] {
  return [
    '- American English is the standard; British spelling, British words and other valid alternatives count as correct (never as an error).',
    '- Judge only real errors, never matters of taste. Do not judge the content or the opinion, only the English.',
    '- If a word combination is unnatural, do not call it correct: use "odd" and name the natural partner word.',
    '- Never use generic praise ("Great job!"). When something is right, name the specific thing that works.',
    '- Write every explanation in the explanation language only; quote English words in "…".',
  ];
}

/**
 * Einspruch („War das auch richtig?“, Plan §7): dieselbe Vorlage einmal neu mit `complex`, ohne Zwischenspeicher. Die Variablen tragen `recheck: true`,
 * dadurch ist auch der Prompt ein anderer. Nie automatisch: nur auf Antippen, höchstens einmal je Antwort (die Oberfläche blendet den Knopf danach aus).
 */
export function asRecheck<V, O>(t: PromptTemplate<V, O>): PromptTemplate<V, O> {
  return { ...t, tier: 'complex', cache: false };
}

/** Zeile für den Einspruch im Prompt. */
export const RECHECK_LINE =
  'Second look requested: the learner believes the first check was too strict. Check again very carefully and accept every valid alternative; keep a verdict only if it is clearly right.';
