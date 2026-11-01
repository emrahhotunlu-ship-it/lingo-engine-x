import type { z } from 'zod';
import { clip, clipped, FALSE_FRIEND_NOTE, falseFriendLines, isWrongLang, langName, type PromptTemplate, type UiLang } from '../shared';
import { usedIn } from '../domain/used';

// Gemeinsames der drei Vorlagen des Wörter-Moduls (Großpaket A Schritt 5; plan.md §7, synthese.md §2.5):
//  - Urteil je Zielwort: ✓ `ok` richtig · ~ `odd` möglich, aber unnatürlich (oder Nebenfehler am Wort, z. B. Präposition) · ✕ `wrong` falsch
//    (falscher Sinn, falsches Wort) · `thin` richtig, aber zu einfach oder zu nah am Beispielsatz (zählt nicht als „benutzt“) · `unused` nicht benutzt.
//  - Fehlerklasse am Wort (`err`) für die Note (domain/apply.ts) und das Fehlerprofil.
//  - Einspruch („War das auch richtig?“): dieselbe Vorlage mit dem ersten Urteil (`first`, Pflicht), Stufe `complex`, kein Zwischenspeicher (`asRecheck`).

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

/**
 * Kommt das Zielwort im Text vor (gebeugt, britisch geschrieben, Kollokation mit Einschüben oder im Passiv; `domain/used.ts`)? Eigene, lokale
 * Prüfung (Plan §7: Claude prüft den Sinn, nicht nur das Vorkommen).
 */
export function hasTarget(text: string, t: Pick<VocabTarget, 'word' | 'kind'>): boolean {
  return usedIn(text, t.word, t.kind);
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

/**
 * Gesprochene Antworten (english-teacher Befund 10, learning-scientist Befund 10): Satzzeichen, Füllwörter, Fehlstarts und Hörfehler der Erkennung
 * sind nie Fehler; ein echter Formfehler am Zielwort bleibt einer.
 */
export const SPOKEN_RULE = [
  'The text was dictated and transcribed by speech recognition. Ignore punctuation, capitalization, missing sentence breaks, fillers (um, so, you know) and false starts; if the learner corrected themselves, judge the last version.',
  'Spoken style is fine (contractions, short fragments). Never comment on pronunciation.',
  'If a target appears as a word that recognition may have produced instead (affect/effect, accept/except, advice/advise), do not count it as an error and say so in "why"; but do not excuse a wrong word form at the target (missing -ed or -s). Never use a recognition slip as "extra". In "fixed", add punctuation silently.',
].join(' ');

/**
 * Urteilsregeln je Zielwort, gemeinsam für Anwenden (`text`) und eigenen Satz (`sentence`) (english-teacher Befunde 1, 4–8, 12;
 * learning-scientist Befunde 2, 3, 7): klare Grenzen ok/odd/wrong/thin, Ausweichen ist kein Fehler, Fehlerklasse passend zum Urteil.
 */
export function verdictRules(where: 'text' | 'sentence'): string[] {
  const src = where === 'text' ? 'learner text' : 'learner sentence';
  return [
    '- v: "ok" = used in the meaning given, correct and natural here. "odd" = the meaning is right, but there is a small error at the word (form, preposition or pattern, partner word, tone) or a fluent American professional would clearly not say it this way. "wrong" = the learner tried to use the target but in a wrong meaning, or confused it with another word that is wrong here (affect/effect, lend/borrow, a German false friend). "thin" = see below. "unused" = the learner did not use the target.',
    '- "odd" only if a fluent American professional would clearly not say it this way. If it is less common but natural, it is "ok"; you may name the more common option in "why".',
    '- If the learner avoided the target and wrote a different word or phrase that is correct here (e.g. "delay" for "postpone"), use "unused", put the replacement in "at" and say in "why" which word was used and what the target would add.',
    '- If the word is used correctly but in a different meaning than the one given, it is "thin": not wrong, but it does not show the learned meaning; say in "why" which meaning was used.',
    `- "thin" also if the ${where} gives no context that shows the meaning, so it would work for almost any word of the same kind ("I like leverage.", "Leverage is important.", "This is a deadline."), or if it repeats the card example with only names, numbers or one or two words changed. A short sentence that shows the meaning in a real context is "ok".`,
    '- For a collocation, phrasal verb or fixed phrase, articles, determiners, inflection and word order (passive) may change ("meet a deadline" → "met all our deadlines" is a use of the target). If the learner used it with a wrong partner word or particle ("hold a presentation" for "give a presentation", "sign off for" for "sign off on"), it is "odd" with err "colloc" or "prep", and "at" is the attempt.',
    `- If a target appears more than once, judge the weakest use and point "at" to it.`,
    '- err for "wrong": "sense" (wrong meaning, incl. a German false friend, or a preposition or particle that changes the meaning: "result from" for "result in") or "word" (confused with another word).',
    '- err for "odd": "form" (inflection, tense, plural incl. uncountables like "informations", wrong word class like "the postpone"), "prep" (wrong preposition or pattern that keeps the meaning: "discuss about", "explain me"), "colloc" (wrong partner word: "do a mistake"), "register", "other". For "ok", "thin" and "unused", err is null.',
    '- Watch for typical errors of German speakers at the target and name them precisely: false friends used in the German sense (eventually ≠ eventuell, actual ≠ aktuell, become ≠ bekommen) → "wrong"/"sense"; uncountables in the plural (informations, advices, feedbacks) → "odd"/"form"; patterns copied from German (discuss about, explain me, look forward to meet) → "odd"/"prep" or "form"; make/do, say/tell, lend/borrow → "wrong"/"word", or "odd"/"colloc" when the target is the noun of the collocation.',
    `- at: the exact words of the ${src} where the target, the attempt or the replacement stands, copied character by character; "" if the learner wrote nothing for this target.`,
    '- why: one short sentence. ok: name what exactly works (meaning, partner word, pattern). odd/wrong: give the right form in "…" and the reason; for prep the right preposition or pattern, for colloc the natural partner, for word what the used word actually means. thin: say why it does not count and how a real use would look. unused: "" unless "at" holds a replacement (then say which word was used).',
  ];
}

/** Gemeinsame Regeln aller drei Vorlagen (synthese.md §2.5): was Claude nie tut. */
export function sharedRules(): string[] {
  return [
    '- American English is the standard; British spelling, British words and other valid alternatives count as correct (never as an error).',
    '- Judge only real errors, never matters of taste. Do not judge the content or the opinion, only the English.',
    '- If a word combination is unnatural, do not call it correct: use "odd" and name the natural partner word.',
    "- Judge only the learner's own choices. If the target word itself is more formal or casual than the text type, do not count that against the learner; use err \"register\" only when the way the learner used it clashes with the text type (e.g. \"Hey, kindly postpone …\").",
    '- Never use generic praise ("Great job!"). When something is right, name the specific thing that works.',
    '- Write every explanation in the explanation language only; quote English words in "…".',
  ];
}

/** Typische Falsche Freunde (english-teacher Befund 9): gemeinsame Liste der App, Kurzfassung. */
export function falseFriendRule(): string {
  return `- German false friends (${FALSE_FRIEND_NOTE}): ${falseFriendLines(10).join('; ')}.`;
}

/**
 * Einspruch („War das auch richtig?“, Plan §7): dieselbe Vorlage einmal neu mit `complex`, ohne Zwischenspeicher. Die Variablen tragen das erste
 * Urteil (`first`, im Typ Pflicht), dadurch ist auch der Prompt ein anderer. Nie automatisch: nur auf Antippen, höchstens einmal je Antwort (die Oberfläche blendet den Knopf danach aus).
 */
export function asRecheck<V, O, F>(t: PromptTemplate<V, O>): PromptTemplate<V & { first: F }, O> {
  return { ...t, tier: 'complex', cache: false };
}

/** Erstes Urteil, das der Einspruch mitbekommt (learning-scientist Befund 4: `sample` hat kein Gedächtnis). */
export type FirstVerdict = { key: string; v: UseVerdict; err: UseErr | null; why: string };

/** Zeilen für den Einspruch im Prompt: unabhängige zweite Prüfung, das erste Urteil steht dabei, keine Lenkung zum Umkippen. */
export function recheckLines(first: readonly FirstVerdict[]): string[] {
  return [
    'Independent second check: the learner asked for a second look. Judge again from scratch. Accept British forms and every valid alternative; if the first verdict was right, keep it and explain more clearly why.',
    ...first.map((f) => `First check: ${f.key}: ${f.v}${f.err ? `/${f.err}` : ''}${f.why ? ` – "${clip(f.why, WHY_MAX)}"` : ''}`),
  ];
}

/** Erlaubte Übergänge im Einspruch: nur milder und nur zu einem klaren Urteil (learning-scientist Nachprüfung 1). */
const MILDER: Readonly<Record<UseVerdict, readonly UseVerdict[]>> = { wrong: ['odd', 'ok'], odd: ['ok'], thin: ['ok'], unused: [], ok: [] };

/**
 * Ergebnis des Einspruchs (learning-scientist Befund 4): nur ein milderes Urteil ersetzt das erste (wrong → odd/ok, odd → ok, thin → ok);
 * alles andere (gleich, härter, oder ein unsicheres „nicht benutzt“) behält das erste Urteil.
 */
export function milder<T extends { v: UseVerdict }>(first: T, second: T): T {
  return MILDER[first.v].includes(second.v) ? second : first;
}
