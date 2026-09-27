import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { patternSlug } from '../domain/patterns/patterns';
import { repairNorm } from '../domain/repair/repair';
import { clip, header, langName, promptBytes } from './common';
import { clipped, intIn } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// patterns@1 (Lernberatung 27.09., V3 „Deutsch-Fallen“): Aus Emrahs letzten Fehlern aller
// Quellen fasst Claude höchstens 8 persönliche, WIEDERKEHRENDE Muster zusammen – typisch sind
// Übertragungsfehler deutscher Muttersprachler. `complex`: wenige Aufrufe (Knopf oder höchstens
// einmal je Woche), aber ein Urteil über viele Belege. Beispiele müssen wörtlich aus seinen
// Sätzen stammen (sonst fallen sie weg); ein Muster ohne echtes Beispiel fällt ganz weg.
// Sprachtreue: `rule` in der Oberflächensprache, `title_de` Deutsch, `title_en` Englisch.

export type PatternsMistake = { wrong: string; right: string; src: string };
export type PatternsVars = { mistakes: readonly PatternsMistake[]; uiLang: UiLang };
export type PatternOut = {
  id: string;
  title_de: string;
  title_en: string;
  rule: string;
  examples: Array<{ wrong: string; right: string }>;
  count: number;
  keys: string[];
  tasks: string[];
};
export type PatternsOut = { patterns: PatternOut[] };

/** Höchstens so viele Fehler gehen in den Prompt (neueste zuerst). */
export const PATTERNS_MISTAKES_MAX = 300;
/** Budget der Fehlerliste in UTF-8-Bytes: der Rest des Prompts und der Neuversuch passen daneben. */
export const PATTERNS_LIST_BYTES = 44_000;
const LINE_MAX = 220;

const ID = 'patterns';
const VERSION = 1;

export function patternsExample(uiLang: UiLang): string {
  return JSON.stringify({
    patterns: [
      {
        id: 'since-present',
        title_de: '„since“ mit Gegenwart',
        title_en: '“since” with the present tense',
        rule: uiLang === 'de' ? 'Seit einem Zeitpunkt bis jetzt: Present Perfect (Continuous), nicht Präsens.' : 'From a point in the past until now: use the present perfect (continuous), not the present tense.',
        examples: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }],
        count: 3,
        keys: ['since'],
        tasks: ['Say how long you have worked for your company.', 'Tell a client how long you have known their CFO.'],
      },
    ],
  });
}

/** Fehlerliste für den Prompt, neueste zuerst, gekürzt auf das Byte-Budget (64-KiB-Grenze). */
export function mistakeLines(list: readonly PatternsMistake[], maxBytes = PATTERNS_LIST_BYTES): string[] {
  const out: string[] = [];
  let bytes = 0;
  for (const m of list.slice(0, PATTERNS_MISTAKES_MAX)) {
    const line = `- [${clip(m.src, 10)}] ${clip(m.wrong, LINE_MAX)} => ${clip(m.right, LINE_MAX)}`;
    const b = promptBytes(line) + 1;
    if (bytes + b > maxBytes) break;
    bytes += b;
    out.push(line);
  }
  return out;
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
const text = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().trim().max(max * 2));

export function patternsSchema(vars: PatternsVars): z.ZodType<PatternsOut> {
  const given = vars.mistakes.slice(0, PATTERNS_MISTAKES_MAX).map((m) => repairNorm(m.wrong)).filter(Boolean);
  const known = (s: string): boolean => {
    const n = repairNorm(s);
    return !!n && given.some((g) => g === n || (n.length >= 12 && g.includes(n)));
  };
  const item = z
    .object({
      id: z.preprocess(patternSlug, z.string().min(2)),
      title_de: clipped(1, 80),
      title_en: clipped(1, 80),
      rule: clipped(1, 240),
      examples: z.preprocess(asList, z.array(z.object({ wrong: text(240), right: text(240) }).partial())),
      count: z.preprocess((v) => v ?? 1, intIn(1, 999)),
      keys: z.preprocess(asList, z.array(z.unknown())),
      tasks: z.preprocess(asList, z.array(z.unknown())),
    })
    .transform((p) => ({
      ...p,
      // Nur echte eigene Sätze (wörtlich aus der Liste), höchstens 4.
      examples: p.examples
        .map((e) => ({ wrong: clip(e.wrong ?? '', 240), right: clip(e.right ?? '', 240) }))
        .filter((e) => e.wrong && e.right && known(e.wrong) && !isWrongLang(e.right, 'en'))
        .slice(0, 4),
      keys: [...new Set(p.keys.filter((k): k is string => typeof k === 'string').map((k) => clip(k, 30).toLowerCase()).filter(Boolean))].slice(0, 6),
      tasks: p.tasks
        .filter((x): x is string => typeof x === 'string')
        .map((x) => clip(x, 200))
        .filter((x) => x && !isWrongLang(x, 'en'))
        .slice(0, 3),
    }));
  return z
    .object({ patterns: z.preprocess((v) => (v == null ? [] : v), z.array(z.unknown())) })
    .transform((o, ctx): PatternsOut => {
      const out: PatternOut[] = [];
      const bad: string[] = [];
      o.patterns.forEach((raw, i) => {
        const r = item.safeParse(raw);
        if (!r.success) {
          bad.push(`patterns.${i}: ${r.error.issues[0]?.message ?? 'invalid'}`);
          return;
        }
        const p = r.data;
        const langBad = isWrongLang(p.rule, vars.uiLang)
          ? `patterns.${i}.rule: must be written in ${langName(vars.uiLang)}`
          : isWrongLang(p.title_de, 'de')
            ? `patterns.${i}.title_de: must be written in German`
            : isWrongLang(p.title_en, 'en')
              ? `patterns.${i}.title_en: must be written in English`
              : null;
        if (langBad) {
          bad.push(langBad);
          return;
        }
        // Kein echtes Beispiel: das Muster ist nicht belegt und fällt weg (kein Neuversuch).
        if (!p.examples.length || out.some((x) => x.id === p.id)) return;
        out.push(p);
      });
      // Nur wenn Claude Muster geliefert hat, aber keines brauchbar ist: einmal neu fragen.
      if (!out.length && bad.length) {
        bad.slice(0, 5).forEach((m) => ctx.addIssue({ code: 'custom', message: m }));
        return z.NEVER;
      }
      return { patterns: out.slice(0, 8) };
    });
}

export const patterns: PromptTemplate<PatternsVars, PatternsOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: true,
  build(vars) {
    const lines = mistakeLines(vars.mistakes);
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced English teacher for German-speaking business professionals (B2, aiming for C1).',
      'Below are the learner\'s own recent mistakes from role-plays, writing corrections, tutor lessons, grammar exercises and free speaking (wrong => correct, newest first).',
      'Find his PERSONAL, RECURRING error patterns – typical transfer errors of German native speakers, for example:',
      '"since" with the present tense, make/do, actual = aktuell, become = bekommen, missing auxiliary in questions, "look forward to" + -ing, too direct a tone.',
      'Only report a pattern that is backed by at least one of his sentences below; prefer patterns that occur several times.',
      `Explanation language: ${langName(vars.uiLang)}`,
      `Mistakes (${lines.length}):`,
      lines.length ? lines.join('\n') : '(none)',
      'Reply with only one JSON object, no other text, exactly this shape:',
      patternsExample(vars.uiLang),
      'Rules:',
      '- patterns: 0–8 patterns, most frequent and most important first. No pattern for a single typo.',
      '- id: short English slug (a-z, 0-9, hyphen). title_de: short German title. title_en: short English title.',
      '- rule: one short sentence in the explanation language: what to do instead.',
      '- examples: 1–4 of HIS sentences, "wrong" copied character for character from the list above, "right" the corrected sentence in American English.',
      '- count: how many of the listed mistakes belong to this pattern.',
      '- keys: 1–6 short lowercase English trigger words or phrases that appear in his wrong sentences for this pattern (e.g. "since", "make", "actual").',
      '- tasks: 2–3 short tasks in English that make him produce a NEW sentence where this trap occurs, related to his work or life.',
    ].join('\n');
  },
  schema: (vars) => patternsSchema(vars),
};
