import { z } from 'zod';
import { C1_VERDICTS } from '../domain/assessment/types';
import { assessBody, assessExample, assessSchema, cleanEv, EV_MAX, type AssessOut, type AssessVars } from './assess';
import { header, langName, langOf } from './common';
import { clipped } from './tolerant';
import type { PromptTemplate } from './types';

// assess@4 (Lernplattform 3.0 R4 „Messen“, P45): assess@3 unverändert plus das Urteil „Weg zu C1“. Claude liest die Belegzeilen der sieben
// Kriterien (`[c1:k1]`…`[c1:k7]`), der C1-Checks (`[chk:<Monat>]`), der Kapitelprüfungen (`[gate:<Kapitel>]`) und der Einstufung (`[place]`)
// und urteilt IN WORTEN: Status, ein bis zwei Sätze Begründung, höchstens drei fehlende Kriterien. Keine Punktzahl, keine Prozentzahl „x % C1“.
// `complex`, nie zwischengespeichert, höchstens alle 3 Tage (`assessDue`). Das Feld `c1` wird tolerant gelesen; fehlt es, zeigt das Blatt
// den festen Satz „a von 7 Kriterien erreicht“. Den Status entscheidet der Code in beide Richtungen: „ready“ genau dann, wenn alle sieben
// Kriterien erreicht sind; „on_track“ nur, wenn mindestens die Hälfte der offenen Kriterien „auf Kurs“ ist. Ist nach dem einen Neuversuch nur
// `c1` ungültig, fällt nur `c1` weg (`lenient`), die übrige Einschätzung bleibt.

const ID = 'assess';
const VERSION = 4;
const CRIT = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'] as const;
export const C1_MISSING_MAX = 3;
export const C1_WHY_MAX = 300;
export const C1_TITLE_MAX = 80;

export type Assess4Vars = AssessVars & {
  c1: {
    /** Belegzeilen als Text (`c1EvidenceText`) und ihre Kennungen (`c1:k1`, `chk:2026-10`, `gate:3`, `place`). */
    evidence: string;
    ids: readonly string[];
    /** Noch nicht erreichte Kriterien (vom Code bestimmt). Leer = C1-Etappe erreicht. */
    open: readonly string[];
    /** Wie viele der offenen Kriterien „auf Kurs“ sind (vom Code bestimmt). */
    course: number;
  };
};

export type Assess4C1 = { status: (typeof C1_VERDICTS)[number]; why: string; missing: Array<{ crit: (typeof CRIT)[number]; title: string }>; ev: string[] };
export type Assess4Out = AssessOut & { c1?: Assess4C1 };

const STATUS_ALIASES: Record<string, (typeof C1_VERDICTS)[number]> = {
  not_yet: 'not_yet',
  'not yet': 'not_yet',
  notyet: 'not_yet',
  open: 'not_yet',
  on_track: 'on_track',
  'on track': 'on_track',
  ontrack: 'on_track',
  course: 'on_track',
  ready: 'ready',
  reached: 'ready',
  met: 'ready',
};

/** Fehlende Kriterien tolerant: „K4“, „[c1:k4]“, `{id: 'k4'}` → `k4`; erreichte, doppelte und unbekannte fallen weg, höchstens 3. */
export function cleanMissing(v: unknown, open: readonly string[]): unknown {
  if (!Array.isArray(v)) return v;
  const out: Array<{ crit: string; title: unknown }> = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const raw = typeof o.crit === 'string' ? o.crit : typeof o.id === 'string' ? o.id : '';
    const crit = /k([1-7])/i.exec(raw)?.[1];
    const id = crit ? `k${crit}` : '';
    if (!open.includes(id) || out.some((m) => m.crit === id)) continue;
    out.push({ crit: id, title: o.title });
  }
  return out.slice(0, C1_MISSING_MAX);
}

/**
 * Status, wie der Code ihn zulässt (P1/P2): Etappe erreicht → immer „ready“; sonst nie „ready“ (→ „on_track“), und „on_track“ nur, wenn
 * mindestens die Hälfte der offenen Kriterien auf Kurs ist (sonst „not_yet“). Unbekannte Werte bleiben stehen (das Schema lehnt sie ab).
 */
export function c1Status(raw: unknown, c1: Pick<Assess4Vars['c1'], 'open' | 'course'>): unknown {
  const a = typeof raw === 'string' ? (STATUS_ALIASES[raw.trim().toLowerCase()] ?? raw) : raw;
  if (c1.open.length === 0) return 'ready';
  const b = a === 'ready' ? 'on_track' : a;
  return b === 'on_track' && c1.course * 2 < c1.open.length ? 'not_yet' : b;
}

/** Das Feld `c1` allein (für Tests und das Schema). Den Status entscheidet der Code mit (`c1Status`). */
export function c1VerdictSchema(v: Pick<Assess4Vars, 'lang' | 'c1'>): z.ZodType<Assess4C1> {
  const ids = new Set(v.c1.ids);
  const stage = v.c1.open.length === 0;
  return z
    .object({
      status: z.preprocess((s) => c1Status(s, v.c1), z.enum(C1_VERDICTS)),
      why: clipped(1, C1_WHY_MAX),
      missing: z.preprocess((m) => cleanMissing(m ?? [], v.c1.open), z.array(z.object({ crit: z.enum(CRIT), title: clipped(1, C1_TITLE_MAX) }).superRefine(langOf(['title'], v.lang))).max(C1_MISSING_MAX)),
      ev: z.preprocess((x) => cleanEv(x, ids), z.array(z.string()).min(1, { message: 'cite at least one known C1 evidence id from the [brackets]' }).max(EV_MAX)),
    })
    .superRefine(langOf(['why'], v.lang))
    .superRefine((o, ctx) => {
      // Keine Punktzahl und keine Prozentzahl im Urteil (Plan §4.4).
      if (/\d+\s*%|\d+\s*(?:von|of|\/)\s*\d+\s*(?:points|punkte|pts)/i.test(o.why)) ctx.addIssue({ code: 'custom', path: ['why'], message: 'judge in words; no percentages or scores' });
      if (!stage && o.missing.length === 0) ctx.addIssue({ code: 'custom', path: ['missing'], message: 'name 1–3 open criteria from the list' });
    });
}

export function assess4Schema(v: Pick<Assess4Vars, 'lang' | 'ids' | 'allowed' | 'c1'>): z.ZodType<Assess4Out> {
  const base = assessSchema({ lang: v.lang, ids: [...v.ids, ...v.c1.ids], allowed: v.allowed });
  const c1 = c1VerdictSchema(v);
  // `c1` darf fehlen (dann steht der feste Satz da); ist es da, gilt es streng – sonst ein Neuversuch mit Fehlerbeschreibung (A6.3).
  return z.intersection(base, z.object({ c1: z.preprocess((x) => (x === null ? undefined : x), c1.optional()) }));
}

/** Nur nach dem gescheiterten Neuversuch (P8): die Einschätzung ohne `c1` (das Blatt zeigt dann den festen Satz). */
export function assess4Lenient(v: Pick<Assess4Vars, 'lang' | 'ids' | 'allowed' | 'c1'>): z.ZodType<Assess4Out> {
  const base = assessSchema({ lang: v.lang, ids: [...v.ids, ...v.c1.ids], allowed: v.allowed });
  return z.intersection(base, z.object({ c1: z.unknown().optional().transform((): undefined => undefined) }));
}

/** Beispielantwort (besteht selbst das Schema, Test). */
export function assess4Example(v: Pick<Assess4Vars, 'lang' | 'ids' | 'allowed' | 'c1'>): Assess4Out {
  const de = v.lang === 'de';
  const stage = v.c1.open.length === 0;
  const ev = [v.c1.ids[0] ?? 'c1:k1'];
  const titles: Record<string, [string, string]> = {
    k1: ['Mehr Grammatik-Muster sicher machen', 'Make more grammar patterns safe'],
    k2: ['Deutsch-Fallen seltener wiederholen', 'Repeat German traps less often'],
    k3: ['Wortschatztest wiederholen', 'Retake the vocabulary test'],
    k4: ['Mehr Wörter fest verankern', 'Anchor more words firmly'],
    k5: ['C1-Check am Laptop machen', 'Take the C1 check on a laptop'],
    k6: ['Fehler in Sätzen sicherer finden', 'Spot errors in sentences more reliably'],
    k7: ['Mehr eigene Texte schreiben', 'Write more texts of your own'],
  };
  const missing = v.c1.open.slice(0, 2).map((id) => ({ crit: id as (typeof CRIT)[number], title: (titles[id] ?? titles.k1!)[de ? 0 : 1] }));
  return {
    ...assessExample({ lang: v.lang, ids: v.ids, allowed: v.allowed }),
    c1: stage
      ? {
          status: 'ready',
          why: de ? 'Alle sieben Kriterien sind erreicht: Grammatik, Wörter und die Genauigkeit im eigenen Text stehen auf C1-Niveau.' : 'All seven criteria are met: grammar, vocabulary and accuracy in writing are at C1 level.',
          missing: [],
          ev,
        }
      : {
          status: 'not_yet',
          // Inhaltsneutral (P6): der Beispielsatz darf das Urteil nicht vorwegnehmen.
          why: de ? '<1–2 Sätze: was die Belege zeigen, was jetzt am meisten bringt>' : '<1–2 sentences: what the evidence shows, what helps most now>',
          missing,
          ev,
        },
  };
}

export const assess4: PromptTemplate<Assess4Vars, Assess4Out> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: false,
  verb: 'text-json',
  build(v) {
    const ids = [...v.ids, ...v.c1.ids];
    return [
      header({ id: ID, version: VERSION }),
      ...assessBody({ ...v, ids, evidence: `${v.evidence}\n${v.c1.evidence}` }),
      'C1 verdict ("c1"):',
      '- Judge readiness for C1 ONLY from the [c1:…], [chk:…], [gate:…] and [place] lines. The app measures grammar, vocabulary and accuracy in writing; it does not measure speaking, listening or reading, so never judge those.',
      `- status: "not_yet", "on_track" (at least half of the open criteria on track, trend forward) or "ready" (only when every criterion is met). Open criteria now: ${v.c1.open.length ? v.c1.open.join(', ') : 'none'}. Criteria on track now: ${v.c1.course} of ${v.c1.open.length} open.`,
      `- why: 1–2 sentences (≤ ${C1_WHY_MAX} characters) in ${langName(v.lang)}: what the evidence shows and what matters most next. Words only: no score, no percentage, no "x % C1". Do not copy any percentage from the evidence; say "just below the goal", "about halfway".`,
      `- missing: up to ${C1_MISSING_MAX} of the open criteria, most useful first, each {"crit": "k1"…"k7", "title": a short practice goal in ${langName(v.lang)}, ≤ ${C1_TITLE_MAX} characters}. Empty only when status is "ready".`,
      `- ev: 1–${EV_MAX} evidence ids for the verdict, copied exactly from the brackets (e.g. "c1:k4").`,
      '- Criteria marked "too little data" are not weaknesses: say that evidence is missing, never infer a level from them.',
      '- Criteria without a practice place in the app yet: k7. List them only if nothing else is open.',
      '- Tone: factual and calm. First what the evidence shows is met or moving, then the one most useful next step. No praise beyond the evidence, no blame, no "you should have".',
      '- Never predict a date or a duration; the app shows its own forecast.',
      '- K7 is counted by Claude and only a guide value; never treat it as an exact score.',
      '- Exception for "c1" only: K7 (accuracy in own writing, counted by Claude) may be used.',
      'Reply with only one JSON object, no other text, exactly this shape:',
      JSON.stringify(assess4Example({ ...v, ids })),
    ].join('\n');
  },
  schema: (v) => assess4Schema(v),
  lenient: (v) => assess4Lenient(v),
};
