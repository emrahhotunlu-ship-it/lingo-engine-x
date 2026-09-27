import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, langName, langOf } from './common';
import { ERROR_CATS } from './threeLayers';
import { phraseIn, sliced, topicCat } from './tolerant';
import type { ToolkitNote, ToolkitSkill } from '../domain/speak/types';
import type { PromptTemplate, UiLang } from './types';

// roleplay-report@3 (Plan §5.4, §6.2): Urteil in Worten nach einem Gespräch – Ziel, Stärken
// mit Zitat, Fokuspunkte, beste Wendungen. Kein Punktestand (Kap. 2.3). `complex`, zwischen-
// gespeichert. Zitate müssen wörtlich aus den eigenen Zügen stammen.
// @3 (Lernberatung 27.09., Vorschlag 7 „C1-Werkzeugkasten“): zusätzlich `toolkit` – hat er
// abgeschwächt, strukturiert, betont? Tolerant gelesen: Ungültiges fällt weg, nie ein Neuversuch.

export type ReportTurnInfo = { me: string; persona: string; v: string; c: readonly string[] };

export type RoleplayReportVars = {
  title: string;
  goal: string;
  role: string;
  turns: readonly ReportTurnInfo[];
  taken: readonly string[];
  uiLang: UiLang;
};

export type RoleplayReportOut = {
  goal: { state: 'reached' | 'partly' | 'missed'; why: string };
  summary: string;
  strengths: Array<{ quote: string; why: string }>;
  focus: Array<{ title: string; said: string; better: string; why: string; cat: string }>;
  phrases: Array<{ en: string; de: string; def: string; ex: string }>;
  /** @3: C1-Werkzeugkasten – abgeschwächt, strukturiert, betont? (fehlt in älteren Berichten) */
  toolkit?: ToolkitNote[];
};

export const TOOLKIT_SKILLS: readonly ToolkitSkill[] = ['hedge', 'structure', 'emphasis'];
export const TOOLKIT_NOTE_MAX = 200;

const SKILL_ALIASES: ReadonlyArray<[RegExp, ToolkitSkill]> = [
  [/^(hedg|soft|diplom|polite)/, 'hedge'],
  [/^(struct|discourse|signpost|organi[sz])/, 'structure'],
  [/^(emphas|stress|cleft|invers)/, 'emphasis'],
];

/**
 * `toolkit` tolerant lesen: je Fähigkeit höchstens ein Eintrag, Synonyme („hedging“,
 * „discourse markers“) werden zugeordnet; ohne Hinweis oder mit Hinweis in der falschen Sprache
 * fällt der Eintrag weg. Kein Eintrag ist nie ein Fehler (additiv, alte Antworten bleiben gültig).
 */
export function readToolkit(v: unknown, uiLang: UiLang): ToolkitNote[] {
  if (!Array.isArray(v)) return [];
  const out: ToolkitNote[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = typeof r.skill === 'string' ? r.skill.trim().toLowerCase() : '';
    const skill = (TOOLKIT_SKILLS as readonly string[]).includes(key) ? (key as ToolkitSkill) : SKILL_ALIASES.find(([re]) => re.test(key))?.[1];
    const used = typeof r.used === 'boolean' ? r.used : typeof r.used === 'string' ? /^(yes|true|used)$/i.test(r.used.trim()) : null;
    const note = typeof r.note === 'string' ? r.note.trim() : '';
    if (!skill || used === null || !note || isWrongLang(note, uiLang) || out.some((o) => o.skill === skill)) continue;
    out.push({ skill, used, note: Array.from(note).length > TOOLKIT_NOTE_MAX ? `${Array.from(note).slice(0, TOOLKIT_NOTE_MAX - 1).join('').trimEnd()}…` : note });
  }
  return out;
}

export const REP_ME_MAX = 300;
export const REP_PERSONA_MAX = 200;
export const REP_TURNS_MAX = 16;

const ID = 'roleplay-report';
const VERSION = 3;

const en = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export function reportSchema(v: Pick<RoleplayReportVars, 'turns' | 'uiLang'>): z.ZodType<RoleplayReportOut> {
  const mine = v.turns.map((t) => clip(t.me, REP_ME_MAX));
  const inMine = (s: string) => mine.some((m) => containsPhrase(m, s));
  return z
    .object({
      goal: z.object({ state: z.enum(['reached', 'partly', 'missed']), why: z.string().trim().min(1).max(240) }).superRefine(langOf(['why'], v.uiLang)),
      summary: z.string().trim().min(1).max(500),
      strengths: z
        .array(z.object({ quote: z.string().trim().min(1).max(300), why: z.string().trim().min(1).max(200) }).superRefine(langOf(['why'], v.uiLang)))
        .min(1)
        .max(2),
      // Tolerant (Prüfhinweis): ein gutes Gespräch darf ohne Fokuspunkt sein; freie Kategorie → Liste;
      // überzählige Einträge fallen weg.
      focus: sliced(
        z
          .object({
            title: z.string().trim().min(1).max(80),
            said: z.string().trim().min(1).max(300),
            better: en(300),
            why: z.string().trim().min(1).max(200),
            cat: z.preprocess((c) => topicCat(c, ERROR_CATS), z.string().trim()),
          })
          .superRefine(langOf(['title', 'why'], v.uiLang)),
        0,
        3,
      ),
      phrases: sliced(z.object({ en: en(80), de: z.string().trim().min(1).max(120), def: en(160), ex: en(240) }), 0, 3),
      toolkit: z.preprocess((t) => readToolkit(t, v.uiLang), z.array(z.object({ skill: z.enum(['hedge', 'structure', 'emphasis']), used: z.boolean(), note: z.string() }))),
    })
    .superRefine((o, ctx) => {
      o.strengths.forEach((s, i) => {
        if (!inMine(s.quote)) ctx.addIssue({ code: 'custom', path: ['strengths', i, 'quote'], message: 'must be quoted word for word from a learner turn' });
      });
      o.focus.forEach((f, i) => {
        if (!inMine(f.said)) ctx.addIssue({ code: 'custom', path: ['focus', i, 'said'], message: 'must be quoted word for word from a learner turn' });
        if (!ERROR_CATS.includes(f.cat)) ctx.addIssue({ code: 'custom', path: ['focus', i, 'cat'], message: `cat must be one of: ${ERROR_CATS.join(', ')}` });
      });
      o.phrases.forEach((p, i) => {
        if (!containsPhrase(p.ex, p.en) && !phraseIn(p.ex, p.en)) ctx.addIssue({ code: 'custom', path: ['phrases', i, 'ex'], message: 'ex must contain en word for word' });
      });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export function reportExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    goal: { state: 'partly', why: de ? 'Du hast das Risiko benannt, aber keinen festen Termin vereinbart.' : 'You named the risk but did not agree on a firm date.' },
    summary: de ? 'Du bist ruhig geblieben und hast Argumente gebracht. Bei Einwänden bist du noch zu schnell eingeknickt.' : 'You stayed calm and gave reasons. You still gave in too quickly when he objected.',
    strengths: [{ quote: 'the exposure here is the penalty', why: de ? 'Klare Benennung des Risikos, ohne Vorwurf.' : 'A clear statement of the risk without blame.' }],
    focus: [
      {
        title: de ? 'Vorschläge abschwächen' : 'Softening proposals',
        said: 'we must delay the start',
        better: 'I would rather we kept the Q2 date.',
        why: de ? '„I would rather we …“ klingt nach Vorschlag statt nach Befehl.' : '"I would rather we …" sounds like a proposal, not an order.',
        cat: 'register',
      },
    ],
    phrases: [{ en: 'that hinges on', de: 'das hängt ab von', def: 'depends mainly on', ex: 'That hinges on how fast your team can test.' }],
    toolkit: [
      { skill: 'hedge', used: false, note: de ? 'Deine Einwände kamen sehr direkt; „That might be tricky for us“ wirkt weicher.' : 'Your objections were very direct; “That might be tricky for us” sounds softer.' },
      { skill: 'structure', used: true, note: de ? 'Mit „That hinges on …“ hast du deinen Punkt klar eingeleitet.' : 'With “That hinges on …” you introduced your point clearly.' },
    ],
  });
}

export const roleplayReport: PromptTemplate<RoleplayReportVars, RoleplayReportOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: true,
  build(v) {
    const lines = v.turns.slice(-REP_TURNS_MAX).map((t, i) => {
      const c = t.c.length ? ` [${t.c.join(', ')}]` : '';
      return `- T${i + 1} them: ${clip(t.persona, REP_PERSONA_MAX)}\n  T${i + 1} learner: ${clip(t.me, REP_ME_MAX)} (${t.v}${c})`;
    });
    return [
      header({ id: ID, version: VERSION }),
      'You coach a German-speaking business professional (B2, aiming for C1) after a spoken role-play.',
      'Judge in words, not in points. Be specific, kind and honest.',
      `Scene: ${clip(v.title, 160)}`,
      `Learner goal: ${clip(v.goal, 300)}`,
      `Other speaker: ${clip(v.role, 200)}`,
      'Turns (with a short verdict per learner turn):',
      ...lines,
      `Phrases the learner already saved: ${v.taken.slice(0, 12).map((p) => clip(p, 60)).join(', ') || '(none)'}`,
      `Explanation language: ${langName(v.uiLang)} (goal.why, summary, strengths.why, focus.title, focus.why, toolkit.note). All English fields in American English.`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      reportExample(v.uiLang),
      'Rules:',
      '- goal.state: "reached", "partly" or "missed"; goal.why: one sentence.',
      '- summary: at most 3 sentences.',
      '- strengths: 1–2 items; quote copied word for word from a learner turn.',
      '- focus: 0–3 items (none if there is nothing to improve); said copied word for word from a learner turn; better = how a C1 speaker would say it;',
      `  cat one of ${ERROR_CATS.join(', ')}.`,
      '- phrases: up to 3 useful phrases for this situation that the learner has not saved yet; ex contains en word for word.',
      '- toolkit (C1 toolkit): 0–3 items, at most one per skill: "hedge" (softening, hedging, diplomatic distance), "structure" (discourse markers such as That said, To build on that, Coming back to), "emphasis" (cleft sentences, inversion).',
      '  used = true if the learner did it well at least once, false if it was missing where it would have helped; note = one short sentence in the explanation language, quoting or suggesting an English phrase.',
      '- British spelling is never a mistake.',
    ].join('\n');
  },
  schema: (v) => reportSchema(v),
};
