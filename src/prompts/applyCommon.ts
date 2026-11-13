import { z } from 'zod';
import { clip } from './common';
import { isWrongLang } from '../domain/lang/detect';
import { normWs, type Edit, type Used } from '../domain/tutor/edits';
import type { UiLang } from './types';

// Gemeinsame Bausteine der Anwenden-Vorlagen (F3, docs/umbau/fokus2/anwenden-plan.md, Nachtrag learning-scientist Muss 1/2/5). Rein.
// - `keepPoints`: Pflicht- bzw. Kernpunkte einzeln: je Punkt `yes`/`partly`/`no` mit Zitat. Ein Zitat, das nicht WÖRTLICH im Text steht, macht den
//   Punkt zu `no` (wie `keepUsed`): die App glaubt nur Belegtes. Fehlende Punkte gelten als `no`. Bei `partly`/`no` dazu `why` (ein kurzer Satz in der
//   Erklärsprache: was fehlt oder unklar ist; Pflichtfrage „Warum“, Prüfbefund T2); bei `yes` leer.
// - `keepGood`: „Das sitzt“ – eine gelungene Stelle mit Grund, nur mit wörtlichem Zitat (sonst `null`, die Oberfläche nimmt dann ein anderes Zitat).
// - `styleOf` (W5 K1 „So klingt es gehobener“): 1–2 Stil-Verbesserungen, je mit wörtlichem Zitat (`from`), besserer Fassung (`to`) und einem Satz Warum. Getrennt
//   von den Fehlern: eine Stelle, die eine Fehlerstelle berührt, fällt weg (kein Fehler ≠ Stil). Fehlt das Feld (ältere Antwort), gelten die belegten
//   Verbesserungen der Liste (`sev: 'upgrade'`, Wortwahl/Wortpartner/Ton). Falsche Sprache fällt weg statt die Antwort zu verwerfen.
// - `greetOf` (W5 K7): Anrede und Gruß zusammen bewertet (`fits`/`off`/`missing`) mit einem Satz Warum; fehlt es, `null` (die Oberfläche zeigt dann nichts).

export type Covered = 'yes' | 'partly' | 'no';
export type PointCheck = { i: number; covered: Covered; quote: string; why: string };
export type Good = { quote: string; why: string };

export const POINT_QUOTE_MAX = 200;
export const GOOD_WHY_MAX = 200;
export const POINT_WHY_MAX = 160;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const COVERED_ALIASES: ReadonlyArray<[RegExp, Covered]> = [
  [/^(yes|y|true|covered|full|fully|done|ok)$/, 'yes'],
  [/^(partly|partial|partially|some|half|somewhat)$/, 'partly'],
  [/^(no|n|false|missing|not covered|none|absent)$/, 'no'],
];

/** `covered` tolerant lesen; Unbekanntes zählt vorsichtig als `no`. */
export function coveredOf(v: unknown): Covered {
  if (v === true) return 'yes';
  if (typeof v !== 'string') return 'no';
  const s = v.trim().toLowerCase();
  for (const [re, out] of COVERED_ALIASES) if (re.test(s)) return out;
  return 'no';
}

/**
 * Je Punkt (`n` Stück, Nummern 1 bis n in der Antwort) ein Ergebnis in fester Reihenfolge. `yes`/`partly` nur mit einem Zitat, das wörtlich
 * (Leerraum und typografische Anführungszeichen normalisiert) im Text steht; sonst `no`. Doppelte Nummern: die erste gilt.
 */
export function keepPoints(xs: readonly unknown[], text: string, n: number): PointCheck[] {
  const hay = normWs(text);
  const byI = new Map<number, { covered: Covered; quote: string; why: string }>();
  for (const x of xs) {
    if (!isObj(x)) continue;
    const raw = typeof x.i === 'number' ? x.i : typeof x.i === 'string' ? Number(x.i) : NaN;
    if (!Number.isInteger(raw) || raw < 1 || raw > n || byI.has(raw)) continue;
    const quote = typeof x.quote === 'string' ? normWs(x.quote) : '';
    let covered = coveredOf(x.covered);
    if (covered !== 'no' && (!quote || !hay.includes(quote))) covered = 'no';
    const why = covered !== 'yes' && typeof x.why === 'string' ? clip(x.why.trim(), POINT_WHY_MAX) : '';
    byI.set(raw, { covered, quote: covered === 'no' ? '' : clip(quote, POINT_QUOTE_MAX), why });
  }
  return Array.from({ length: Math.max(0, n) }, (_, k) => ({ i: k + 1, ...(byI.get(k + 1) ?? { covered: 'no' as const, quote: '', why: '' }) }));
}

/** Gelungene Stelle: nur mit wörtlichem Zitat und Grund. */
export function keepGood(v: unknown, text: string): Good | null {
  if (!isObj(v)) return null;
  const quote = typeof v.quote === 'string' ? normWs(v.quote) : '';
  const why = typeof v.why === 'string' ? clip(v.why, GOOD_WHY_MAX) : '';
  if (!quote || !why || !normWs(text).includes(quote)) return null;
  return { quote: clip(quote, POINT_QUOTE_MAX), why };
}

/** Liste tolerant: fehlt sie oder ist sie ein Text, gilt eine leere Liste. */
export const asList = (v: unknown): unknown => (v === undefined || v === null ? [] : typeof v === 'string' ? [] : v);

/** Punkte-Liste: muss vorhanden und nicht leer sein (sonst Neuversuch nach A6.3), dann `keepPoints`. */
export const pointsField = (text: string, n: number) =>
  z
    .array(z.unknown())
    .min(1)
    .transform((xs) => keepPoints(xs, text, n));

/** Bewertungsstufen der Punkte und `why` (gleich für Antwort und Zusammenfassung, Prüfbefund T2). */
export const POINT_SCALE = 'yes = clearly there; partly = mentioned but vague, incomplete or slightly wrong; no = missing.';
export const POINT_WHY_RULE = 'why: only for "partly" or "no", one short sentence in the explanation language saying what is missing or vague; empty for "yes".';

/** Sprachtreue der Begründungen je Punkt (wie die anderen Erklärfelder). */
export const pointWhyIssues = (points: readonly PointCheck[], wrong: (s: string) => boolean): number[] => points.flatMap((p, k) => (p.why && wrong(p.why) ? [k] : []));

/** Zahl der getroffenen Punkte: `yes` zählt 1, `partly` ½. */
export function pointsScore(points: readonly PointCheck[]): number {
  return points.reduce((s, p) => s + (p.covered === 'yes' ? 1 : p.covered === 'partly' ? 0.5 : 0), 0);
}

// ---------------------------------------------------------------- So klingt es gehobener (W5 K1)

export type StyleTip = { from: string; to: string; why: string };
export const STYLE_MAX = 2;
export const STYLE_TEXT_MAX = 160;
const STYLE_KINDS = new Set(['word', 'collocation', 'register']);

const lowNorm = (s: string): string =>
  normWs(s)
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, '')
    .trim();

/**
 * Stil-Verbesserungen behalten: `from` steht wörtlich im Text, `to` ist anders, `why` vorhanden; keine Überschneidung mit einer Fehlerstelle; keine Doppelten;
 * `to` auf Englisch, `why` in der Erklärsprache. Höchstens 2.
 */
export function keepStyle(xs: readonly unknown[], text: string, edits: readonly Edit[], uiLang: UiLang): StyleTip[] {
  const hay = normWs(text);
  const errs = edits.filter((e) => e.sev === 'error').map((e) => lowNorm(e.from)).filter(Boolean);
  const out: StyleTip[] = [];
  for (const x of xs) {
    if (out.length >= STYLE_MAX) break;
    if (!isObj(x)) continue;
    const from = typeof x.from === 'string' ? normWs(x.from) : '';
    const to = typeof x.to === 'string' ? normWs(x.to) : '';
    const why = typeof x.why === 'string' ? clip(x.why.trim(), STYLE_TEXT_MAX) : '';
    if (!from || !to || !why || !hay.includes(from)) continue;
    const f = lowNorm(from);
    if (!f || f === lowNorm(to)) continue;
    if (errs.some((e) => e.includes(f) || f.includes(e))) continue;
    if (out.some((o) => lowNorm(o.from) === f)) continue;
    if (isWrongLang(to, 'en') || isWrongLang(why, uiLang)) continue;
    out.push({ from: clip(from, STYLE_TEXT_MAX), to: clip(to, STYLE_TEXT_MAX), why });
  }
  return out;
}

/** `style` der Antwort; fehlt das Feld ganz, die belegten Verbesserungen der Liste (Wortwahl, Wortpartner, Ton). */
export function styleOf(raw: unknown, text: string, edits: readonly Edit[], uiLang: UiLang): StyleTip[] {
  if (Array.isArray(raw)) return keepStyle(raw, text, edits, uiLang);
  if (raw !== undefined && raw !== null) return [];
  return keepStyle(
    edits.filter((e) => e.sev === 'upgrade' && STYLE_KINDS.has(e.kind)),
    text,
    edits,
    uiLang,
  );
}

export const STYLE_EXAMPLE = '"style":[{"from":"…","to":"…","why":"…"}]';
export const STYLE_RULE =
  '- style: 0 to 2 spans of CORRECT wording that could sound more like C1 business English (precise word, collocation, register, hedging, linking phrase): "from" copied EXACTLY from the text and not part of any error in edits, "to" the better American English phrasing, "why" one short sentence in the explanation language.';

// ---------------------------------------------------------------- Anrede und Gruß (W5 K7)

export type GreetFit = 'fits' | 'off' | 'missing';
export type GreetCheck = { fit: GreetFit; why: string };
/** Vorgabe der Aufgabe: Leser (Rolle, Name), passende Anrede und passender Gruß (Englisch). */
export type GreetVars = { reader: string; hello: string; close: string };

const GREET_ALIASES: ReadonlyArray<[RegExp, GreetFit]> = [
  [/^(fits?|fitting|ok|okay|good|appropriate|right|yes|true)$/, 'fits'],
  [/^(off|wrong|too[\s_-]?(formal|informal|casual|stiff)|not fitting|unsuitable|partly)$/, 'off'],
  [/^(missing|none|absent|no|false)$/, 'missing'],
];

/** Anrede und Gruß tolerant lesen; ohne verwertbares Urteil `null`. */
export function greetOf(v: unknown, uiLang: UiLang): GreetCheck | null {
  if (!isObj(v) || typeof v.fit !== 'string') return null;
  const s = v.fit.trim().toLowerCase();
  const fit = GREET_ALIASES.find(([re]) => re.test(s))?.[1];
  if (!fit) return null;
  const why = typeof v.why === 'string' ? clip(v.why.trim(), STYLE_TEXT_MAX) : '';
  return { fit, why: why && !isWrongLang(why, uiLang) ? why : '' };
}

export const GREET_EXAMPLE = '"greet":{"fit":"fits","why":"…"}';

/** Zeilen der Vorlage zur Vorgabe (vor dem Text) und zur Bewertung (in den Regeln). */
export const greetTaskLine = (g: GreetVars): string =>
  `Reader: ${clip(g.reader, 120)}. A fitting salutation is ${clip(g.hello, 60)} and a fitting sign-off is ${clip(g.close, 40)}; other forms in the same register are fine too.`;
export const GREET_RULE =
  '- greet: the salutation and sign-off together for this reader: "fits", "off" (too formal, too casual, wrong name or title) or "missing"; why is one short sentence in the explanation language. They also count for tone.';

// ---------------------------------------------------------------- Mail-Vorlagen @3 (Großpaket P „Politur“, P4, 13.11.2026)

/** Höchstens so viele Zielwörter je Schreibaufgabe. */
export const WORDS_MAX = 2;

/** Zielwort mit Kennung (`w1`, `w2`) und gelernter Bedeutung (Deutsch; leer, wenn unbekannt). */
export type TargetWord = { id: string; word: string; de: string };

/** Zielwörter einheitlich (höchstens 2): ein bloßer Wortlaut bekommt die Kennung nach seiner Stelle. */
export function targetWordsOf(words: readonly (string | TargetWord)[]): TargetWord[] {
  const out: TargetWord[] = [];
  for (const w of words) {
    if (out.length >= WORDS_MAX) break;
    const t = typeof w === 'string' ? { id: '', word: w, de: '' } : w;
    const word = t.word.trim();
    if (!word || out.some((x) => x.word.toLowerCase() === word.toLowerCase())) continue;
    out.push({ id: /^w\d$/.test(t.id) ? t.id : `w${out.length + 1}`, word, de: t.de.trim() });
  }
  return out;
}

/** Erlaubte Kennungen in `used`: die Zielwörter (Wortlaut) und `rule` (nur wenn es eine Regel gibt). */
export const usedIdsOf = (words: readonly (string | TargetWord)[], rule: string): Set<string> => new Set([...targetWordsOf(words).map((w) => w.word), ...(rule.trim() ? ['rule'] : [])]);

/** Kennungen, die auf ein Zielwort zeigen (`w1` und der Wortlaut in Kleinschreibung) → Wortlaut, wie er in `used` gespeichert wird. */
export function wordAliasOf(words: readonly (string | TargetWord)[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of targetWordsOf(words)) {
    m.set(w.id, w.word);
    m.set(w.word.toLowerCase(), w.word);
  }
  return m;
}

/** Ein `why` in falscher Sprache fällt weg (die Verwendung selbst bleibt belegt). */
export const usedWhyIn = (used: readonly Used[], wrong: (s: string) => boolean): Used[] => used.map((u) => (u.why && wrong(u.why) ? { pat: u.pat, ok: u.ok, quote: u.quote } : u));

/** Zeile der Zielwörter im Prompt: Kennung, Wortlaut und gelernte Bedeutung. */
export const targetWordsLine = (words: readonly (string | TargetWord)[]): string => {
  const ws = targetWordsOf(words);
  return ws.length ? `Target words (id: word = meaning the learner learned): ${ws.map((w) => `${w.id}: ${clip(w.word, 40)}${w.de ? ` = ${clip(w.de, 60)}` : ''}`).join(' | ')}` : '';
};

/** Kurzurteil (@3): steht als „Kurz gesagt“ ganz oben in der Rückmeldung. */
export const GIST_RULE = '- summary: the gist in ONE short sentence in the explanation language (shown first): what works and the one thing to work on next.';

/** Regel für `used` (@3): Kennung, Urteil in der gelernten Bedeutung, wörtliches Zitat und ein Satz Grund. @4 (Befund english-teacher, 13.11.2026):
 * ok false nur bei klarem Fehler; natürlich, aber seltener = ok true mit der üblicheren Wahl im Grund; im Zweifel ok true; Regel: Form UND nötiger Zusammenhang. */
export const USED_RULE =
  '- used: for each target word (by its id, e.g. "w1") and for the target rule ("rule") that the learner tried to use, one entry with pat (the id), ok (true only if the word is used correctly in the meaning given, with the right form and partner words; for the rule: the form is right and it fits the context it needs), a "quote" copied exactly from the text and "why" (one short sentence in the explanation language: why it works here, or what is wrong and the right form). Skip what the learner did not try. ok is false only for a clear error (wrong meaning, wrong form, wrong partner word). A use that is natural but less common is ok true; name the more common option in "why". If you cannot tell, ok true and say what is unclear in "why".';

/** Gemeinsame Regeln der Anwenden-Prüfungen (Antwort und Zusammenfassung). */
export const APPLY_EDIT_RULES = [
  'First list every error as an atomic edit: copy the exact wrong span from the text into "from", write the minimal replacement into "to". Only then explain each edit.',
  'Keep the learner\'s words wherever they are correct. Style improvements are sev "upgrade", never "error". American English is the standard; British spelling and British words are correct (mention the US form only as an upgrade).',
  'American and British grammar both count as correct (e.g. past simple with already/just/yet, have got, collective nouns with plural verbs).',
  'List all errors first, then upgrades; never drop an error to make room for an upgrade.',
];
