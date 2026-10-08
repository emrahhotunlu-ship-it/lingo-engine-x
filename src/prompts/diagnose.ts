import { z } from 'zod';
import { cleanAction, cleanEv } from './assess';
import { header, langName, langOf } from './common';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// diagnose@1 (Lernplattform 3.0 P49, KI-Tutor T5): „Was du verwechselst“. Claude urteilt wie eine erfahrene Lehrerin über die Fehler der letzten
// 28 Tage – nur aus den nummerierten Belegzeilen der App (`domain/tutor/confusion.ts`), nie aus dem Gedächtnis. `complex`, nie zwischengespeichert,
// per `sample()` mit eigenem Lesen (`verb: 'text-json'`), damit die antwortende Stufe sichtbar bleibt. Höchstens einmal je ISO-Woche geräteübergreifend
// (K-10, `features/tutor/diagnoseStore.ts`); als Hintergrundaufruf deckelt das Budget auf 1 je Tag. Die Antwort wird nur gelesen, nie gebucht.
// Fehlerweg nach A6.3: ein Neuversuch nur bei Schemaverletzung (zum Beispiel keine bekannte Beleg-Kennung), `invalid_json` nie.

export type DiagnoseVars = {
  lang: UiLang;
  /** Belegzeilen `[kennung] Text` (≤ 4,9 KB). */
  evidence: string;
  /** Kennungen der Belegzeilen ohne Klammern. */
  ids: readonly string[];
  /** Erlaubte Aktionen: `contrast:<a>|<b>` und `pattern:<id>`. */
  allowed: readonly string[];
  /** Vorherige Diagnose (nur Überschrift und Titel), damit „Besser geworden“ stimmt. */
  prev: { headline: string; titles: readonly string[] } | null;
  today: string;
};

export type DiagnoseFinding = { title: string; why: string; rule: string; ev: string[]; action: string };
export type DiagnoseOut = {
  headline: string;
  findings: DiagnoseFinding[];
  better: { text: string; ev: string[] } | null;
  next: string;
};

const ID = 'diagnose';
const VERSION = 1;
export const DIAGNOSE_EV_MAX = 3;
export const DIAGNOSE_FINDINGS_MAX = 3;

export const DIAGNOSE_EXAMPLE =
  '{"headline":"…","findings":[{"title":"…","why":"…","rule":"…","ev":["p:…"],"action":"contrast:a|b"}],"better":{"text":"…","ev":["p:…"]},"next":"…"}';

/** Die Muster-Kennungen, die eine Belegkennung nennt: `p:a` → a · `cf:a>b` → a, b · `pc:a|b` → a, b · `src:write:a` → a. Exakter Vergleich, kein Teilstring. */
export function evPatterns(id: string): string[] {
  const rest = id.startsWith('src:') ? id.split(':').slice(2).join(':') : id.slice(id.indexOf(':') + 1);
  return rest.split(/[>|]/).filter(Boolean);
}

/** Passt die Aktion (`contrast:a|b`, `pattern:id`) zu den zitierten Belegen? Mindestens eine Kennung nennt eines der Muster. */
export function actionFits(action: string, ev: readonly string[]): boolean {
  const pats = action.replace(/^(contrast|pattern):/, '').split('|').filter(Boolean);
  return ev.some((id) => evPatterns(id).some((p) => pats.includes(p)));
}

export function diagnoseSchema(v: Pick<DiagnoseVars, 'lang' | 'ids' | 'allowed'>): z.ZodType<DiagnoseOut> {
  const ids = new Set(v.ids);
  const allowed = v.allowed;
  const ev = (min: number) => z.preprocess((x) => cleanEv(x, ids), z.array(z.string()).min(min, { message: 'cite at least one known evidence id from the [brackets]' }).max(DIAGNOSE_EV_MAX));
  const action = z.preprocess((a) => cleanAction(a, allowed), z.string().refine((a) => allowed.includes(a), { message: 'action must be one of the allowed actions' }));
  const finding = z
    .object({ title: clipped(3, 60), why: clipped(10, 240), rule: clipped(5, 160), ev: ev(1), action })
    .superRefine(langOf(['title', 'why', 'rule'], v.lang))
    // Die Aktion muss zur Evidenz passen: ein zitierter Beleg nennt eines der Muster der Aktion.
    .superRefine((f, ctx) => {
      if (!actionFits(f.action, f.ev)) ctx.addIssue({ code: 'custom', path: ['action'], message: 'the action must concern a pattern named in the cited evidence ids' });
    });
  return z
    .object({
      headline: clipped(10, 120),
      // Eine leere Liste ist erlaubt: reicht die Evidenz nicht, gibt es keinen Befund (die Schwelle wird nie gesenkt).
      findings: sliced(finding, 0, DIAGNOSE_FINDINGS_MAX),
      // Ein ungültiges „Besser geworden“ fällt weg, statt die ganze Antwort zu verwerfen.
      better: z.object({ text: clipped(5, 160), ev: ev(1) }).nullable().catch(null),
      next: clipped(5, 160),
    })
    .superRefine(langOf(['headline', 'next'], v.lang));
}

export const diagnose: PromptTemplate<DiagnoseVars, DiagnoseOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: false,
  verb: 'text-json',
  budget: { bgPerDay: 1 },
  build(v) {
    const prev = v.prev ? `Previous diagnosis: "${v.prev.headline.slice(0, 120)}"; findings: ${v.prev.titles.slice(0, 3).map((t) => `"${t.slice(0, 60)}"`).join(', ') || '-'}` : 'Previous diagnosis: none';
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced English teacher for a German-speaking Head of Business Development (B2, aiming for C1).',
      `Today is ${v.today}.`,
      'Task: say what this learner SYSTEMATICALLY confuses, judging ONLY from the numbered evidence below. Never invent counts, examples or evidence.',
      'Rules:',
      '- A finding needs at least 3 WRONG answers/mistakes, or 2 wrong answers in different weeks (see "wrong per week"). Attempts that were correct do not count. Prefer fewer, solid findings to many weak ones.',
      '- If no pattern meets the threshold, return "findings": [] and say in the headline that the evidence is still thin. Never lower the threshold to fill the list.',
      '- For [pc:…] lines: report errors in the first pattern and suggest contrasting it with the second; do not claim the learner mixed them up. Only [cf:…] lines prove a mix-up.',
      '- The action must concern a pattern named in the evidence ids you cite.',
      '- No CEFR level, score or percentage. Calm and factual: no praise, no blame.',
      `- Each finding cites 1–${DIAGNOSE_EV_MAX} evidence ids in "ev", copied exactly from the brackets (without the brackets).`,
      '- title: for [cf:…] the two forms that get mixed up; otherwise the one pattern. why: what goes wrong and how to tell the forms apart. rule: a decision question or rule of thumb.',
      '- why: if the cited line contains the learner\'s own example ("…" instead of "…"), quote it. Never make up a learner example; you may add one short correct model sentence from a sales or client context, clearly as a model.',
      '- action: exactly one allowed action for the finding.',
      '- better: only if the evidence shows a pattern that went from clearly worse to clearly better; otherwise null.',
      '- next: one concrete step for this week (one sentence), ideally using the form in a real work situation (an email, a client call) or the allowed contrast round.',
      'Evidence format: [p:id] pattern: attempts and wrong answers in the last 28 days, "before" = the 28 days before that. [cf:a>b] the learner used b where a was correct. [pc:a|b] a contrast pair from the course, no mix-up recorded; use the [p:a] line for the threshold. [src:…] mistakes in the learner\'s own writing or sentences.',
      'Language rules:',
      '- Address the learner directly as "du" in German and "you" in English.',
      `- Write headline, titles, why, rule and next in ${langName(v.lang)}. Grammar terms and example phrases may stay in English (American English).`,
      prev,
      'Evidence:',
      v.evidence,
      `Allowed actions: ${v.allowed.join(', ') || '-'}`,
      'Length limits: headline 10–120 characters, 0–3 findings, titles ≤ 60, why ≤ 240, rule ≤ 160, better.text ≤ 160, next ≤ 160.',
      'Reply with only one JSON object, no other text, exactly this shape:',
      DIAGNOSE_EXAMPLE,
    ].join('\n');
  },
  schema: (v) => diagnoseSchema(v),
};
