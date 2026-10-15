import { FALSE_FRIENDS } from '../../content/falseFriends';
import { germanHints, type GermanHintId } from '../srs/produce';
import { britishSpelling, toUSText } from './british';
import { auxFormErrors } from './auxForm';

// Selbstprüfung der KORRIGIERTEN Fassung (Auswertung 15.10.2026, Punkt 1): Die KI gab manchmal eine „richtige“ Fassung zurück, die selbst noch
// einen Fehler hatte („the list … are needed“, „I suggest absolving“, „you have gut feeling“). Diese Prüfung läuft lokal, rein und ohne KI.
// Sie sucht nur EINDEUTIGE Fehler (hohe Trefferquote vor Vollständigkeit): lieber eine richtige Fassung durchlassen als eine richtige sperren.
// Besteht die Fassung nicht, wird sie nicht als „richtig“ gespeichert oder gezeigt (Hinweis „noch nicht sicher geprüft“).

export type FixedIssueId = 'german' | 'agreement' | 'article' | 'false_friend' | 'aux_form' | 'known_error' | 'british';
export type FixedIssue = { id: FixedIssueId; hit: string; why: string };

/** Deutsch-Fehler aus `produce.ts`, die in einer korrigierten Fassung nie vorkommen dürfen (die unsicheren `if_will`, `want_that`, `since_duration` fehlen bewusst). */
const GERMAN_BLOCK: ReadonlySet<GermanHintId> = new Set<GermanHintId>(['discuss_about', 'depend_from', 'informations', 'am_agree', 'become_get', 'in_the_end_of', 'explain_me']);

const WHY_GERMAN: Readonly<Record<string, string>> = {
  discuss_about: '"discuss about" is wrong: discuss takes no preposition',
  depend_from: '"depend from/of" is wrong: use "depend on"',
  informations: 'plural of an uncountable noun (information, advice, equipment, software are never plural)',
  am_agree: '"I am agree" is wrong: use "I agree"',
  become_get: '"become" is not German "bekommen": use get or receive',
  in_the_end_of: '"in the end of" is wrong: use "at the end of"',
  explain_me: '"explain/say me" is wrong: use "explain it to me" or "tell me"',
};

// ------------------------------------------------------------------ Subjekt und Verb

/** Köpfe, die im Singular stehen, auch wenn danach ein Plural folgt („the list of document types IS“). */
// `majority`, `rest`, `group` fehlen bewusst: „the majority of customers ARE“, „the rest of the documents ARE“ (Verb richtet sich nach dem Nomen hinter „of“).
const SINGULAR_HEADS = 'list|amount|level|lack|quality|cost|price|length|size|range|variety|series|rate|number|result|set|summary|overview|status|review|exchange|schedule|total|average|selection';
// „the number of customers are“ ist falsch, „a number of customers are“ richtig – deshalb steht vor dem Kopf nur ein bestimmter Artikel oder Possessivpronomen.
const HEAD_RE = new RegExp(`\\b(?:the|this|that|our|your|my|his|her|their)\\s+(?:[a-z-]+\\s+)?(${SINGULAR_HEADS})\\s+(?:of|with|for|from|about|on)\\s+((?:[a-z0-9'’,-]+\\s+){1,6}?)(are|were|have|do|don't|aren't|weren't|haven't)\\b`, 'i');
// Wörter, die einen neuen Teilsatz oder einen Relativsatz beginnen: dann gehört das Verb nicht mehr zum Kopf.
// Auch ein Subjektpronomen im Mittelteil zeigt einen Relativsatz ohne „that“ („the list of tasks WE have“, „the quality of the files YOU have“).
const CLAUSE_WORDS = /\b(?:that|which|who|whom|whose|where|when|while|if|because|since|and|but|or|so|as|although|though|whereas|then|after|before|until|i|you|we|they|he|she|it)\b|[,;:()]/i;
const PLURAL_DEM_RE = /\b(?:these|those)\s+(?:[a-z-]+\s+)?[a-z]+s\s+(is|was|has|doesn't|isn't|wasn't|hasn't)\b/i;
// „one of the customers are“ / „each of the steps are“: Kopf ist „one/each/every“.
const ONE_OF_RE = /\b(?:one|each|every one|neither|either)\s+of\s+(?:the|our|my|your|these|those|their)\s+(?:[a-z-]+\s+)?[a-z]+s\s+(are|were|have|don't|aren't|weren't|haven't)\b/i;

export function agreementProblem(text: string): string | null {
  const m = HEAD_RE.exec(text);
  if (m && !CLAUSE_WORDS.test(m[2] ?? '')) return `${m[0].trim()}: "${m[1]}" is singular, so the verb must be singular`;
  const p = PLURAL_DEM_RE.exec(text);
  if (p) return `${p[0].trim()}: the subject is plural, so the verb must be plural`;
  const o = ONE_OF_RE.exec(text);
  if (o) return `${o[0].trim()}: "one of/each of" takes a singular verb`;
  return null;
}

// ------------------------------------------------------------------ a / an

// Wörter, die mit Vokalbuchstaben beginnen, aber mit Konsonantenlaut gesprochen werden („a university“, „a one-off“, „a usable“), und umgekehrt („an hour“).
const A_BEFORE_VOWEL_OK = /^(?:uni[a-z]*|use[a-z]*|usu[a-z]*|usab[a-z]*|uti[a-z]*|ubiq[a-z]*|eu[a-z]*|unan[a-z]*|(?:one|once)(?:-[a-z0-9-]*)?|ukrain[a-z]*|uran[a-z]*|urin[a-z]*|usa|uk|ufo|unesco)$/i;
// Eindeutige Wörter mit Konsonantenlaut („an university“, „an unique“, „an European“, „an used“, „an one“): hier ist „an“ ein Fehler. Bewusst eng: „an unintended“, „an uninterrupted“ sind richtig.
const AN_BEFORE_CONS_ERR = /^(?:univers[a-z]*|uniqu[a-z]*|unicorn[a-z]*|uniform[a-z]*|union[a-z]*|unit(?:s|ed|y|ary)?|unified|unify|unilateral[a-z]*|unanim[a-z]*|usab[a-z]*|use|used|useful|useless|uses|user[a-z]*|usual[a-z]*|usage|utilit[a-z]*|utiliz[a-z]*|utilis[a-z]*|europe[a-z]*|euro|euros|eulog[a-z]*|(?:one|once)(?:-[a-z0-9-]*)?)$/i;
const AN_BEFORE_CONS_OK = /^(?:hour[a-z-]*|honest[a-z-]*|honou?r[a-z-]*|heir[a-z-]*|herb[a-z-]*|hono[a-z-]*)$/i;
// Abkürzungen werden nach dem Buchstabennamen gesprochen: „an HR manager“, „an SLA“, „an MVP“, „a UI“, „a URL“.
// „a“ vor F, H, L, M, N, R, S, X ist uneindeutig („a SQL query“, „a SWOT analysis“, „a SIM card“) und wird nicht gesperrt.
const AN_LETTERS = new Set('FHLMNRSX'.split(''));
const A_LETTERS = new Set('AEIO'.split(''));
// Abkürzungen mit Vokalbuchstaben, vor denen „a“ trotzdem stimmt (Wortaussprache).
const A_ACRONYM_OK = new Set(['EULA']);

export function articleProblem(text: string): string | null {
  const re = /\b(a|an)\s+([A-Za-z][A-Za-z0-9'’&-]*)/gi;
  for (const m of text.matchAll(re)) {
    const artRaw = m[1] ?? '';
    const art = artRaw.toLowerCase();
    const w0 = m[2] ?? '';
    // „&“ gehört nur dann zum Wort, wenn davor ein einzelner Buchstabe steht („R&D“, „M&A“).
    const single = /^[A-Z]&[A-Za-z]/.test(w0);
    const w = single ? w0.charAt(0) : w0.replace(/&.*$/, '');
    const first = w.charAt(0);
    // Ein großes „A“ mitten im Satz ist eine Bezeichnung („Option A is cheaper“, „Plan A“, „Series A“), kein Artikel.
    if (artRaw === 'A') {
      const before = text.slice(0, m.index ?? 0).trimEnd();
      if (before && !/[.!?:;"“(\n]$/.test(before)) continue;
    }
    // Abkürzungen: Großbuchstaben (auch mit Ziffern: S3, M365, B2B) und einzelne Buchstaben vor „&“ (R&D, M&A).
    const acronym = single || (w.length >= 2 && /^[A-Z][A-Z0-9]*$/.test(w));
    if (acronym) {
      if (art === 'a' && A_LETTERS.has(first) && !A_ACRONYM_OK.has(w)) return `"a ${w}": use "an ${w}" (the letter ${first} starts with a vowel sound)`;
      if (art === 'an' && !AN_LETTERS.has(first) && !A_LETTERS.has(first)) return `"an ${w}": use "a ${w}"`;
      continue;
    }
    const vowel = /[aeiou]/i.test(first);
    if (art === 'a' && vowel && !A_BEFORE_VOWEL_OK.test(w)) return `"a ${w}": use "an ${w}" (vowel sound)`;
    if (art === 'an' && !vowel && !AN_BEFORE_CONS_OK.test(w)) return `"an ${w}": use "a ${w}" (consonant sound)`;
    if (art === 'an' && vowel && AN_BEFORE_CONS_ERR.test(w)) return `"an ${w}": use "a ${w}" (consonant sound)`;
  }
  return null;
}

// ------------------------------------------------------------------ Bekannte Fehler (Daten in der Datei, eindeutige Muster)

const KNOWN_ERRORS: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /\blook(?:s|ed|ing)?\s+forward\s+(?:for|on|at)\b/i, why: '"look forward for" is wrong: use "look forward to"' },
  { re: /\blook(?:s|ing)?\s+forward\s+to\s+(?:see|meet|hear|work|talk|discuss|have|get|call|speak|receive|read|welcome|start|go)\b(?!-)/i, why: '"look forward to" takes an -ing form (looking forward to seeing)' },
  { re: /\b(?:I|we|they|he|she|you)\s+used\s+to\s+(?!(?:sing|bring|ring|swing|spring|sting|cling|fling|wring|string|king|thing|ping)\b)[a-z]+ing\b/i, why: '"used to" takes the base form (I used to drive); "used to driving" belongs with "be/get used to"' },
  { re: /\b(?:have|has|had|having|get|got|gets|give|gives)\s+gut\s+feeling\b/i, why: 'the article is missing: "have a gut feeling"' },
  { re: /\b(?:can|could|should|must|might|would|shall)\s+to\s+(?:be|go|do|have|get|make|take|see|send|call|meet|check|work|use|help|find)\b/i, why: 'no "to" after a modal verb' },
  // „I“ nur am Satzanfang oder klein geschrieben: „Phase I is complete“ ist richtig.
  { re: /(?:^|[.!?"“]\s*)I\s+(?:has|is)\b|\bi\s+(?:has|is)\b/, why: 'subject and verb do not agree ("I has")' },
  { re: /\b(?:you|we|they)\s+(?:has|is)\b/i, why: 'subject and verb do not agree ("you is", "they has")' },
  { re: /\bdepends?\s+of\s+(?!course)/i, why: '"depends of" is wrong: use "depends on"' },
  { re: /\bsince\s+\d+\s+(?:years?|months?|weeks?|days?)\b/i, why: '"since 3 years" is German: use "for 3 years" (since + a point in time)' },
  { re: /\bhow\s+(?:it|this|that)\s+looks\s+like\b/i, why: '"how it looks like" is wrong: use "how it looks" or "what it looks like"' },
  { re: /\baccording\s+to\s+me\b/i, why: '"according to me" is wrong: use "in my opinion" or "I think"' },
  { re: /\b(?:make|makes|made|making)\s+a\s+photos?\b(?!\s+(?:book|album|collage|gallery|wall|print|booth|montage|essay))/i, why: '"make a photo" is German: use "take a photo"' },
  { re: /\bin\s+the\s+last\s+years\b(?!\s+of\b)/i, why: '"in the last years" is German: use "in recent years" or "in the past few years"' },
];

// ------------------------------------------------------------------ Gesamtprüfung

/**
 * Alle eindeutigen Probleme einer korrigierten Fassung (Reihenfolge fest, jedes höchstens einmal je Art).
 * `wrong` ist der Satz des Lernenden; ein Fehler, der schon dort stand und im Satz nicht behoben wurde, zählt trotzdem (die Fassung soll alles beheben).
 */
export function fixedProblems(fixed: string): FixedIssue[] {
  const text = fixed.trim();
  if (!text) return [];
  const out: FixedIssue[] = [];
  for (const id of germanHints(text, 20)) {
    if (GERMAN_BLOCK.has(id)) out.push({ id: 'german', hit: id, why: WHY_GERMAN[id] ?? id });
  }
  const agree = agreementProblem(text);
  if (agree) out.push({ id: 'agreement', hit: agree, why: agree });
  const art = articleProblem(text);
  if (art) out.push({ id: 'article', hit: art, why: art });
  for (const f of FALSE_FRIENDS) {
    const m = f.bad?.exec(text);
    if (m) out.push({ id: 'false_friend', hit: m[0], why: `"${m[0]}": "${f.word}" is not German "${f.de}" (use: ${f.en})` });
  }
  const aux = auxFormErrors(text, { strict: true });
  for (const e of aux.slice(0, 2)) out.push({ id: 'aux_form', hit: e.text, why: `"${e.text}": wrong verb form after "${e.aux}"` });
  for (const k of KNOWN_ERRORS) {
    const m = k.re.exec(text);
    if (m) out.push({ id: 'known_error', hit: m[0], why: k.why });
  }
  return out;
}

/** Erstes Problem als Satz für die Fehlerbeschreibung des einen Neuversuchs (A6.3); `null` = bestanden. */
export function fixedProblem(fixed: string): string | null {
  const first = fixedProblems(fixed)[0];
  return first ? `fixed still contains an error: ${first.why}` : null;
}

/** Bestanden = kein eindeutiges Problem. */
export const fixedPasses = (fixed: string): boolean => fixedProblems(fixed).length === 0;

/** US-Schreibweise für ausgegebene KI-Texte (`fixed`, `better`): britische Formen werden still umgeschrieben. */
export function usOutput(text: string): string {
  return britishSpelling(text) || toUSText(text) !== text ? toUSText(text) : text;
}
