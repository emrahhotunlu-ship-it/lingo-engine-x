import { z } from 'zod';
import type { PatStat } from '../domain/tutor/confusion';
import { patIdsOf } from '../domain/tutor/patList';
import { isWrongLang } from '../domain/lang/detect';
import type { HypState } from '../domain/tutor/tutorTypes';
import { cleanEv } from './assess';
import { clip, header, langName, US_SIMPLE_PAST_RULE } from './common';
import { cut } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// diagnose@2 (Tutor-Engine v3 §6.3, E4, S4): Wochen-Diagnose MIT Annahmen. Die App leitet Annahmen selbst ab (`hypotheses.ts`: open/quiet/resolved,
// eigene Schwellen 3 Belege an 2 Tagen); Claude beurteilt nur, ob die Belege eine Annahme tragen (`likely`/`unlikely`/`unclear`), nennt höchstens drei
// Muster als Wochenfokus und fasst zweisprachig zusammen. Claude bewegt nie Lernwerte und erfindet keine Annahmen: Kennungen, die nicht in der Eingabe
// stehen (Annahme, Beleg, Muster), fallen still weg, zu lange Listen werden gekappt. Ein Neuversuch nur, wenn danach Pflichtteile fehlen (A6.3).
// `complex`, nie zwischengespeichert, per `sample()` mit eigenem Lesen (`text-json`), Hintergrund höchstens 1 je Tag (reservierter Platz `diagnose`).
// Gleicher Speicher wie @1 (`app/patterns.diag[]`, §3.2: `out.hyps[]` ≤ 4 KB je Woche); `diagnose@1` bleibt als Datei.

export type Bi = { de: string; en: string };
export type DiagnoseHypIn = { id: string; from: string; to: string; state: HypState; n: number; days: number; l1: string | null };
export type DiagnoseV2Vars = {
  lang: UiLang;
  today: string;
  /** Musterstatistik der letzten 28 Tage (≤ 2 KB im Prompt). */
  stats: readonly PatStat[];
  /** Belegzeilen `[kennung] Text` (≤ 4,9 KB, `evidenceText`). */
  evidence: string;
  /** Kennungen der Belegzeilen ohne Klammern. */
  ids: readonly string[];
  /** Abgeleitete Annahmen (≤ 1 KB im Prompt). */
  hyps: readonly DiagnoseHypIn[];
  /** Kennungen der Übertragungstabelle mit kurzem Auslöser (nur die der Annahmen). */
  l1: ReadonlyArray<{ id: string; trigger: string }>;
  /** Musterliste (`patListText`, ≤ 3 KB). */
  patList: string;
};

export type DiagnoseHypVerdict = 'likely' | 'unlikely' | 'unclear';
export type DiagnoseHypOut = { id: string; verdict: DiagnoseHypVerdict; ev: string[]; why: Bi };
export type DiagnoseV2Out = { hyps: DiagnoseHypOut[]; focus: string[]; summary: Bi };

export const DIAGNOSE2_HYPS_MAX = 5;
export const DIAGNOSE2_FOCUS_MAX = 3;
export const DIAGNOSE2_EV_MAX = 5;
export const STATS_MAX_BYTES = 2_000;
export const HYPS_MAX_BYTES = 1_000;
export const L1_MAX_BYTES = 600;

const ID = 'diagnose';
const VERSION = 2;

export const DIAGNOSE2_EXAMPLE =
  '{"hyps":[{"id":"h:psp.finished-time>psp.result-now","verdict":"likely","ev":["cf:psp.finished-time>psp.result-now"],"why":{"de":"Bei „yesterday“ und „last week“ hast du mehrmals „have done“ benutzt: Du überträgst das deutsche Perfekt.","en":"With “yesterday” and “last week” you used “have done” several times: the German Perfekt carries over."}}],"focus":["psp.finished-time"],"summary":{"de":"Die Zeitform nach abgeschlossenen Zeitangaben ist diese Woche das Hauptthema.","en":"The tense after finished time expressions is the main topic this week."}}';

const bytes = (s: string): number => new TextEncoder().encode(s).length;

/** Zeilen bis `max` Byte (ganze Zeilen, keine angeschnittenen). */
function fitLines(lines: readonly string[], max: number): string {
  const out: string[] = [];
  let size = 0;
  for (const l of lines) {
    const b = bytes(l) + 1;
    if (size + b > max) break;
    out.push(l);
    size += b;
  }
  return out.join('\n');
}

export const statsText = (stats: readonly PatStat[]): string =>
  fitLines(
    [...stats].sort((a, b) => b.w - a.w || a.pat.localeCompare(b.pat)).map((s) => `${s.pat}: ${s.n} tries, ${s.w} wrong (before: ${s.prevN}/${s.prevW}); wrong per week ${s.weeks.join(',')}`),
    STATS_MAX_BYTES,
  );

export const hypsText = (hyps: readonly DiagnoseHypIn[]): string =>
  fitLines(
    hyps.map((h) => `${h.id} | used ${h.to} where ${h.from} was right | state=${h.state} | ${h.n} cases on ${h.days} days${h.l1 ? ` | ${h.l1}` : ''}`),
    HYPS_MAX_BYTES,
  );

const l1Text = (l1: DiagnoseV2Vars['l1']): string => fitLines(l1.map((x) => `${x.id}: ${clip(x.trigger, 120)}`), L1_MAX_BYTES);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Zweisprachiger Text; zu lang wird gekürzt, falsche Sprache oder fehlender Teil → `null`. */
function bi(v: unknown, min: number, max: number): Bi | null {
  if (!isObj(v)) return null;
  const de = cut(str(v.de), max);
  const en = cut(str(v.en), max);
  if (de.length < min || en.length < min || isWrongLang(de, 'de') || isWrongLang(en, 'en')) return null;
  return { de, en };
}

const VERDICTS: Record<string, DiagnoseHypVerdict> = { likely: 'likely', probable: 'likely', yes: 'likely', unlikely: 'unlikely', no: 'unlikely', unclear: 'unclear', unknown: 'unclear', uncertain: 'unclear' };

export function diagnoseV2Schema(v: Pick<DiagnoseV2Vars, 'ids' | 'hyps' | 'patList'>): z.ZodType<DiagnoseV2Out> {
  const evIds = new Set(v.ids);
  const hypIds = new Set(v.hyps.map((h) => h.id));
  const patIds = patIdsOf(v.patList);
  return z.unknown().transform((raw, ctx): DiagnoseV2Out => {
    const o = isObj(raw) ? raw : {};
    const summary = bi(o.summary, 10, 240);
    if (!summary) {
      ctx.addIssue({ code: 'custom', path: ['summary'], message: '"summary" needs {"de": German, "en": English}, 10–240 characters each' });
      return z.NEVER;
    }
    // Annahmen: nur Kennungen aus der Eingabe, jede höchstens einmal; ungültige Einträge fallen einzeln weg (kappen statt neu fragen).
    const hyps: DiagnoseHypOut[] = [];
    for (const h of Array.isArray(o.hyps) ? o.hyps : []) {
      if (hyps.length >= DIAGNOSE2_HYPS_MAX) break;
      if (!isObj(h)) continue;
      const id = str(h.id);
      if (!hypIds.has(id) || hyps.some((x) => x.id === id)) continue;
      const verdict = VERDICTS[str(h.verdict).toLowerCase()] ?? 'unclear';
      const ev = cleanEv(h.ev, evIds);
      const why = bi(h.why, 5, 240);
      if (!why) continue;
      hyps.push({ id, verdict, ev: Array.isArray(ev) ? (ev as string[]).slice(0, DIAGNOSE2_EV_MAX) : [], why });
    }
    const focus: string[] = [];
    for (const f of Array.isArray(o.focus) ? o.focus : []) {
      const id = str(f).replace(/^(pattern|pat):/, '');
      if (patIds.has(id) && !focus.includes(id)) focus.push(id);
      if (focus.length >= DIAGNOSE2_FOCUS_MAX) break;
    }
    return { hyps, focus, summary };
  });
}

export const diagnoseV2: PromptTemplate<DiagnoseV2Vars, DiagnoseV2Out> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: false,
  verb: 'text-json',
  budget: { bgPerDay: 1 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced English teacher for a German-speaking Head of Business Development (B2, aiming for C1).',
      `Today is ${v.today}.`,
      'Task: judge the app\'s hypotheses about what this learner SYSTEMATICALLY confuses, ONLY from the numbered evidence below. Never invent counts, examples, ids or evidence.',
      'Rules:',
      '- "hyps": for each hypothesis id from the list (copy the id exactly), say "likely" if the evidence clearly supports it, "unlikely" if the evidence speaks against it (e.g. the other form is also correct English, or only one context), otherwise "unclear". Never add hypotheses that are not in the list.',
      '- A hypothesis with state=quiet has no new evidence for 14 days: do not call it learned. state=resolved: the learner used the form correctly; only confirm it.',
      '- Good English is never an error: if the learner\'s form is also correct (British forms, another valid tense or word order), the verdict is "unlikely".',
      `- ${US_SIMPLE_PAST_RULE}: such a case is not evidence for an error.`,
      `- "ev": 1–${DIAGNOSE2_EV_MAX} evidence ids copied exactly from the [brackets] (without the brackets).`,
      `- "focus": 0–${DIAGNOSE2_FOCUS_MAX} pattern ids from the pattern list that matter most this week, most important first.`,
      '- "why" and "summary": {"de": German, "en": English}, calm and factual, no praise, no blame, no CEFR level, score or percentage; address the learner as "du" / "you". Put English example words in “…”.',
      `- The learner reads ${langName(v.lang)}; both languages are stored.`,
      'Pattern statistics (last 28 days):',
      statsText(v.stats) || '(none)',
      'Hypotheses of the app:',
      hypsText(v.hyps) || '(none)',
      'German transfer notes:',
      l1Text(v.l1) || '(none)',
      'Evidence:',
      v.evidence || '(none)',
      'Pattern list (topic: ids):',
      v.patList,
      'Length limits: why ≤ 240 characters, summary ≤ 240 characters per language.',
      'Reply with only one JSON object, no other text, exactly this shape:',
      DIAGNOSE2_EXAMPLE,
    ].join('\n');
  },
  schema: (v) => diagnoseV2Schema(v),
};
