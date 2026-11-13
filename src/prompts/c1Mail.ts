import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { keepEdits, keepUsed, normWs, type Edit, type Used } from '../domain/tutor/edits';
import { patIdsOf } from '../domain/tutor/patList';
import { GREET_EXAMPLE, GREET_RULE, greetOf, greetTaskLine, STYLE_EXAMPLE, STYLE_RULE, styleOf, targetWordsLine, targetWordsOf, usedWhyIn, wordAliasOf, type GreetCheck, type GreetVars, type StyleTip, type TargetWord } from './applyCommon';
import { block, clip, fenced, header, langName, langOf } from './common';
import { intIn, clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// c1-mail@2 (Lernplattform 3.0 P47, KI-Tutor T6): die Wochen-Mail der Schreibwerkstatt (Laptop). Nur auf Antippen (`user`), Stufe `default`, 24 h
// zwischengespeichert, nie automatisch wiederholt. Zweistufig nach GEE (Song u. a. 2024): ERST alle Fehler als atomare Änderungen (genau der falsche Ausschnitt,
// die kleinste Ersetzung), DANN die Erklärung. Die App behält nur wörtlich belegte Stellen (`keepEdits`, T-R3). Stil ist `upgrade`, nie `error` (T-R12);
// Ton/Register ist nie ein Fehler. `errorCount` ist Claudes zweite, unabhängige Zählung der Fehler (K7 nimmt den Mittelwert aus Liste und Nachzählung).
// Ein Neuversuch nach A6.3 nur bei Schemaverletzung (fehlende Fassung, falsche Sprache).
// @2 (W5, Lehrer-Prüfung F3, Anwenden „Eine Mail schreiben“): `style` „So klingt es gehobener“ (K1) und – nur mit Vorgabe `greet` – Anrede und Gruß (K7).
// Beide tolerant (fehlen sie, gelten die Verbesserungen der Liste bzw. kein Urteil); die Schreibwerkstatt ruft ohne `greet` und zeigt beides nicht.
// W5b (Lehrer-Prüfung): mit `greet` behält oder ergänzt `upgraded` Anrede und Gruß. Gleiche Version: nur eine Regelzeile, Schema unverändert, @2 war noch nie live.
// @3 (Großpaket P „Politur“, P4, 13.11.2026; Prüfbefund „c1-mail@2 beurteilt Wörter nie“): mit `words` (nur Anwenden) gehen die Zielwörter mit Kennung und
// gelernter Bedeutung mit, `used` beurteilt sie (Kennung `w1`, gespeichert als Wortlaut) wie die Muster, jeder Eintrag mit `why`. `summary` ist das
// Kurzurteil („Kurz gesagt“). Ohne `words` (Schreibwerkstatt) bleibt alles wie in @2, nur `why` kommt dazu.
// @4 (Befund english-teacher, 13.11.2026): `used.ok` false nur bei klarem Fehler (falsche Bedeutung, Form, Partnerwort); natürlich, aber seltener = true mit
// der üblicheren Wahl im Grund; im Zweifel true. Muster: Form richtig UND der nötige Zusammenhang. Nur mit `words` (Anwenden); die Schreibwerkstatt bleibt wie @3 (Prompt unter 8 KB).
// Ausgabe unverändert, ältere Antworten lesen sich gleich.

export type MailVars = {
  /** Anlass und Gegenüber, ≤ 400 Zeichen. */
  situation: string;
  /** Die drei Kapitelmuster der Situation (Kennung, englischer Name, englische Formel). */
  patterns: ReadonlyArray<{ id: string; name: string; form: string }>;
  /** Die vier Wendungen der Situation. */
  phrases: readonly string[];
  /** Emrahs Text, ≤ 1.800 Zeichen. */
  text: string;
  uiLang: UiLang;
  /** Berufsprofil-Zeile (`tutorCtx`), ≤ 200. */
  ctx: string;
  /** Kurzliste aller Muster (`patListText`), die erlaubten Kennungen für `pat` einer Änderung. */
  pats: string;
  /** Leser, passende Anrede und Gruß (W5 K7, nur Anwenden); fehlt = keine Vorgabe. */
  greet?: GreetVars;
  /** „So klingt es gehobener“ anfragen (W5 K1, nur Anwenden; die Schreibwerkstatt zeigt es nicht und hält ihre Anfrage kurz). */
  polish?: boolean;
  /** Zielwörter aus der Wörter-App mit Kennung und gelernter Bedeutung (@3, nur Anwenden; höchstens 2). */
  words?: readonly TargetWord[];
};

export type ToneFit = 'fits' | 'too-direct' | 'too-informal' | 'too-stiff';
export type C1Mail = {
  edits: Edit[];
  used: Used[];
  tone: { fit: ToneFit; why: string };
  /** „So klingt es gehobener“ (W5 K1). */
  style: StyleTip[];
  /** Anrede und Gruß (W5 K7), `null` ohne Vorgabe oder Urteil. */
  greet: GreetCheck | null;
  /** Eine ganze C1-Fassung der Mail (US-Englisch). */
  upgraded: string;
  summary: string;
  /** Claudes unabhängige Nachzählung der Fehler; `null`, wenn sie fehlt. */
  errorCount: number | null;
};

export const MAIL_TEXT_MAX = 1_800;
export const MAIL_SITUATION_MAX = 400;
export const MAIL_PATTERNS_MAX = 3;
export const MAIL_PHRASES_MAX = 4;
/** Mehr belegte Stellen werden abgeschnitten (Fehler vor Verbesserungen, danach in Textreihenfolge). */
export const MAIL_MAX_EDITS = 12;

const ID = 'c1-mail';
const VERSION = 4;

export const MAIL_EXAMPLE =
  '{"edits":[{"from":"…","to":"…","kind":"grammar","sev":"error","pat":null,"why":"…"}],"used":[{"pat":"…","ok":true,"quote":"…","why":"…"}],"tone":{"fit":"fits","why":"…"},"upgraded":"…","summary":"…","errorCount":0}';

/** Beispielantwort mit den Anwenden-Feldern (W5): Anrede und Gruß nach dem Ton, Stil-Verbesserungen davor der Fassung. */
export function mailExample(v: Pick<MailVars, 'greet' | 'polish'>): string {
  let out = MAIL_EXAMPLE;
  if (v.polish) out = out.replace(',"upgraded"', `,${STYLE_EXAMPLE},"upgraded"`);
  if (v.greet) out = out.replace('"tone":{"fit":"fits","why":"…"},', `"tone":{"fit":"fits","why":"…"},${GREET_EXAMPLE},`);
  return out;
}

const asList = (v: unknown): unknown => (v === undefined || v === null ? [] : typeof v === 'string' ? [] : v);

const TONE_ALIASES: ReadonlyArray<[RegExp, ToneFit]> = [
  [/^(fits?|fitting|appropriate|ok|okay|good|suitable|right)$/, 'fits'],
  [/^too[\s_-]?(direct|blunt|abrupt|curt)$/, 'too-direct'],
  [/^too[\s_-]?(informal|casual|relaxed|chatty)$/, 'too-informal'],
  [/^too[\s_-]?(stiff|formal|rigid|stilted|wordy)$/, 'too-stiff'],
];
export const toneFit = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  for (const [re, out] of TONE_ALIASES) if (re.test(s)) return out;
  return v;
};

export function mailSchema(v: MailVars): z.ZodType<C1Mail> {
  const allIds = patIdsOf(v.pats);
  const words = targetWordsOf(v.words ?? []);
  const chapterIds = new Set([...v.patterns.map((p) => p.id), ...words.map((w) => w.word)]);
  const given = block(v.text, MAIL_TEXT_MAX);
  const base = z
    .object({
      edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, given, allIds, MAIL_MAX_EDITS, { sevDefault: 'upgrade' })),
      used: z.preprocess(asList, z.array(z.unknown())).transform((xs) => usedWhyIn(keepUsed(xs, given, chapterIds, wordAliasOf(words)), (s) => isWrongLang(s, v.uiLang))),
      tone: z.object({ fit: z.preprocess(toneFit, z.enum(['fits', 'too-direct', 'too-informal', 'too-stiff']).catch('fits')), why: z.preprocess((x) => x ?? '', clipped(0, 160)) }),
      style: z.unknown().optional(),
      greet: z.unknown().optional().transform((x) => (v.greet ? greetOf(x, v.uiLang) : null)),
      upgraded: clipped(20, 2200),
      summary: clipped(5, 200),
      errorCount: z.preprocess((x) => (x === undefined || x === null || x === '' ? null : x), intIn(0, 60).nullable()).catch(null),
    })
    .transform((o): C1Mail => ({ ...o, style: styleOf(o.style, given, o.edits, v.uiLang) }));
  return base
    .superRefine((o, ctx) => {
      o.edits.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['edits', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
        if (isWrongLang(e.to, 'en')) ctx.addIssue({ code: 'custom', path: ['edits', i, 'to'], message: 'must be written in English' });
      });
      if (o.tone.why && isWrongLang(o.tone.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['tone', 'why'], message: `must be written in ${langName(v.uiLang)}` });
      if (isWrongLang(o.upgraded, 'en')) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'must be written in English' });
      if (normWs(o.upgraded) === normWs(given)) ctx.addIssue({ code: 'custom', path: ['upgraded'], message: 'upgraded must be a rewritten version' });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export const c1Mail: PromptTemplate<MailVars, C1Mail> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const pats = v.patterns.slice(0, MAIL_PATTERNS_MAX).map((p) => `${p.id}: ${clip(p.name, 80)} (${clip(p.form, 100)})`);
    return [
      header({ id: ID, version: VERSION }),
      'You check a work email by a German-speaking learner (B2 to C1, business English).',
      'First list every error as an atomic edit: copy the exact wrong span from the text into "from", write the minimal replacement into "to". Only then explain each edit.',
      'Keep the learner words wherever they are correct. Style improvements are sev "upgrade", never "error". American English is the standard; British spelling and British words are correct (mention the US form only as an upgrade).',
      'American and British grammar both count as correct (e.g. past simple with already/just/yet, have got, collective nouns with plural verbs).',
      'List all errors first, then upgrades; never drop an error to make room for an upgrade. Do not add facts, names, numbers or product details that are not in the learner text.',
      `Task: ${clip(v.situation, MAIL_SITUATION_MAX)}`,
      v.greet ? greetTaskLine(v.greet) : '',
      v.ctx ? `Learner work context: ${clip(v.ctx, 200)}` : '',
      `Target patterns (id: name (form)):\n${pats.join('\n')}`,
      v.phrases.length ? `Target phrases: ${v.phrases.slice(0, MAIL_PHRASES_MAX).map((p) => clip(p, 60)).join(' | ')}` : '',
      targetWordsLine(v.words ?? []),
      `Explanation language: ${langName(v.uiLang)}`,
      'Learner text:',
      fenced(block(v.text, MAIL_TEXT_MAX)),
      'Grammar patterns for "pat" in edits (topic: ids). "pat" may only be one of these ids, otherwise null:',
      v.pats,
      'Reply with only one JSON object in exactly this shape:',
      mailExample(v),
      'Rules:',
      '- edits: at most 12, each with "from" copied EXACTLY from the learner text (no paraphrase), "to", kind (grammar, word, collocation, spelling, punctuation or register), sev ("error" or "upgrade"), pat (id or null) and "why" (one short sentence in the explanation language: the rule or the reason). Tone and register are never errors (kind register is always sev upgrade).',
      (v.words ?? []).length
        ? '- used: for each target pattern id and each target word (by its id, e.g. "w1") that the learner tried to use, one entry with pat (the id), ok (true only if used correctly; a word only in the meaning given, with the right form and partner words; a pattern: the form is right and it fits the context it needs), a "quote" copied exactly from the text and "why" (one short sentence in the explanation language: why it works here, or what is wrong and the right form). Skip what the learner did not try. ok is false only for a clear error (wrong meaning, wrong form, wrong partner word). A use that is natural but less common is ok true; name the more common option in "why". If you cannot tell, ok true and say what is unclear in "why".'
        : '- used: one entry per target pattern id the learner tried: pat (the id), ok (true if correct), "quote" copied exactly from the text, "why" (one short sentence in the explanation language).',
      '- tone: fit is "fits", "too-direct", "too-informal" or "too-stiff" for this reader and purpose; why is one short sentence in the explanation language.',
      v.greet ? GREET_RULE : '',
      v.polish ? STYLE_RULE : '',
      `- upgraded: the whole email rewritten at C1 level in American English, keeping the learner ideas and structure and roughly the same length${v.greet ? '; keep or add a fitting salutation and sign-off for this reader' : ''}; it must differ from the learner text.`,
      '- summary: the gist in ONE short sentence in the explanation language: what works, whether every task point is covered, what to work on next.',
      '- errorCount: after writing everything, count the mistakes (sev "error") in the learner text once more, independently of the list, and give the number.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => mailSchema(v),
};
