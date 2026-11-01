import type { Form, Lex } from './types';

// Alte Felder spiegeln (plan.md §3.1; Kap. 9 Regel 2 und 5): Bei jeder Antwort MIT Planwirkung schreibt das Modul `fsrs`, `S`, `D`, `due`,
// `stage`, `state`, `reps`, `lapses`, `last` und `hist` aus der FÜHRENDEN Spur (Benutzen, wenn angelegt, sonst Verstehen), nach den heutigen
// Schemaregeln (`cardPatchSchema` / `chunkPatchSchema`, domain/srs/applyReview.ts). So zeigen alte Leser (Heute, Fortschritt, v86-Rückweg)
// weiter Sinnvolles, und der Rückweg-Schalter (§9.4) bleibt möglich. Die Umrechnung selbst spiegelt NIE (§9.1).

type Doc = Record<string, unknown>;
const HIST_MAX = 12;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);
const LEGACY_MODES = ['recog', 'cloze', 'type', 'colloc', 'listen', 'produce'] as const;

/** Übungsart der alten App je Form (Verlauf `x`, Modus `m`): frei getippte Formen bleiben für alte Leser „frei“. */
export const LEGACY_EX: Readonly<Record<Form, { x: string; m: (typeof LEGACY_MODES)[number] }>> = {
  intro: { x: 'mc_en', m: 'recog' },
  gap: { x: 'cloze', m: 'cloze' },
  nosent: { x: 'type', m: 'type' },
  transfer: { x: 'produce', m: 'produce' },
  gap_hint: { x: 'cloze_hint', m: 'cloze' },
  meaning: { x: 'mc_de', m: 'recog' },
  listen: { x: 'dictation', m: 'listen' },
  flip: { x: 'flip', m: 'recog' },
  choice: { x: 'mc_en', m: 'recog' },
};

const counts = (v: unknown): { c: number; w: number } | null =>
  isObj(v) && Number.isInteger(v.c) && Number.isInteger(v.w) && (v.c as number) >= 0 && (v.w as number) >= 0 ? { c: v.c as number, w: v.w as number } : null;

/**
 * Patch der alten Felder für das Dokument `doc` nach einer gebuchten Antwort (`t`, `grade`, `form`). `chunk` = Wendung (ohne `modes`-Pflicht).
 * Die Zahlen werden auf die Grenzen der alten Schemas gebracht: S ≤ 365, D 1–10, Stufe 6–7 → 5, `hist` ≤ 12.
 */
export function mirrorLegacy(lex: Lex, doc: Doc, a: { t: number; grade: number; form: Form; ms?: number; fk?: number }, chunk: boolean): Doc {
  const lead = lex.b ?? lex.u;
  const last = lead.last ?? a.t;
  const D = Math.min(10, Math.max(1, lead.d || 5));
  const S = Math.min(365, Math.max(0, lead.s));
  const ex = LEGACY_EX[a.form];
  const ok = a.grade >= 3;
  const xs: Record<string, { c: number; w: number }> = {};
  if (isObj(doc.xs)) for (const [k, v] of Object.entries(doc.xs)) if (k.length <= 24 && counts(v)) xs[k] = counts(v)!;
  const prevX = xs[ex.x] ?? { c: 0, w: 0 };
  xs[ex.x] = { c: prevX.c + (ok ? 1 : 0), w: prevX.w + (ok ? 0 : 1) };
  const modes: Partial<Record<(typeof LEGACY_MODES)[number], { c: number; w: number }>> = {};
  const allowed: readonly string[] = chunk ? ['cloze', 'produce'] : LEGACY_MODES;
  if (isObj(doc.modes)) for (const [k, v] of Object.entries(doc.modes)) if (allowed.includes(k) && counts(v)) modes[k as (typeof LEGACY_MODES)[number]] = counts(v)!;
  if (allowed.includes(ex.m)) {
    const pm = modes[ex.m] ?? { c: 0, w: 0 };
    modes[ex.m] = { c: pm.c + (ok ? 1 : 0), w: pm.w + (ok ? 0 : 1) };
  }
  const prevHist = (Array.isArray(doc.hist) ? doc.hist : []).filter((h): h is Doc => isObj(h) && typeof h.t === 'number');
  const timing: Doc = {};
  if (typeof a.ms === 'number' && a.ms > 0) timing.ms = Math.min(600_000, Math.round(a.ms / 10) * 10);
  if (typeof a.fk === 'number' && a.fk >= 0) timing.fk = Math.min(600_000, Math.round(a.fk / 10) * 10);
  const hist = [...prevHist, { t: a.t, m: ex.m, g: a.grade, x: ex.x, ...timing }].slice(-HIST_MAX);
  const out: Doc = {
    S: Math.round(S * 1000) / 1000,
    D: Math.round(D * 100) / 100,
    due: lead.due,
    last,
    state: lead.st === 2 ? 'review' : 'learning',
    reps: Math.max(1, lead.reps),
    lapses: lead.lapses,
    stage: Math.min(5, Math.max(1, lex.lv)),
    xs,
    hist,
    fsrs: { v: 1, due: lead.due, stability: lead.s, difficulty: D, state: lead.st, reps: Math.max(1, lead.reps), lapses: lead.lapses, last, scheduledDays: lead.sd, learningSteps: lead.ls, src: 'lx' },
  };
  if (!chunk || Object.keys(modes).length) out.modes = modes;
  return out;
}
