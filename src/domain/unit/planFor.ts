import { isoWeek } from '../date';
import type {
  UnitBlock,
  UnitBlockKind,
  UnitBlockOpts,
  UnitChannel,
  UnitEnv,
  UnitPlan,
  UnitPrefs,
  UnitShape,
  UnitStep,
} from './types';
import type { StepArgs } from '../plan/types';

// Wochenplan der Tageseinheit (Plan §1.5, N10/N12; Prüfung Tageseinheit M2, M3, M5, M7, M10, S1, S2, S5).
// `unitPlanFor` hängt nur von Tag, `app/week` und den Einstellungen ab – nie von KI oder Sprachausgabe.
// Die Rückfälle entscheidet `resolveBlock(block, env)` beim Blockstart (M4, M5).

export const SHORT_GOAL_MAX = 20;
/** Block-1-Budget in Sekunden (M2). */
export const REVIEW_SEC = { full: 480, short: 300, tiny: 180, sun: 300 } as const;
/** Minuten je Block der vollen Einheit (Summe 27). */
export const FULL_MIN = { review: 8, input: 5, task: 9, roleplay: 12, focus: 3, again: 2 } as const;
/** Kurz-Einheit (M3): Tagesziel 10 → 3/5/2, Tagesziel 15–20 → 5/7/3. */
export const SHORT_MIN = { tiny: { review: 3, task: 5, again: 2 }, short: { review: 5, task: 7, again: 3 } } as const;
export const SUNDAY_MIN = { review: 5, check: 5, again: 2 } as const;
/**
 * Vokabeln und Grammatik (Emrahs Vorgabe 04.10.2026): Wortschatz · Grammatik (die Grammatikrunde: Fehler, fällige und neue Themen)
 * · Satzbau · Korrektur eigener falscher Sätze. Lesen, Hören, Sprech- und Schreibaufgaben sind nicht mehr Teil der Einheit.
 */
export const VG_MIN = { full: { review: 8, grammar: 7, order: 5, again: 3 }, short: { review: 5, grammar: 5, again: 2 }, tiny: { review: 3, grammar: 4, again: 2 } } as const;
/** Hauptaufgaben im Grammatik-Block (Block 2). */
export const GRAMMAR_N = { full: 6, short: 4, tiny: 3 } as const;
/** Mehr als so viele Minuten plant Block 1 auch bei großem Rückstand nie (`domain/unit/backlog.ts`). */
export const REVIEW_MIN_MAX = 15;
/** Sekunden je Fehlersatz in Schritt 4 (Regelversion 2, §2.3): `max(Grundminuten, ceil(limit × 25 s / 60))`. */
export const FIX_SEC = 25;
/** Sätze in Schritt 4 am Sonntag (Regelversion 2). */
export const SUNDAY_FIX = 3;
/** Mindest- und Höchstzahl der Sätze in Schritt 4 (voller Tag, kurze Tage nie über 5). */
export const FIX_LIMIT = { min: 5, max: 9, shortMax: 5 } as const;

/**
 * Grenze von Schritt 4 (Regelversion 2, §2.3), beim Anlegen eingefroren: `min(9, 5 + ceil(max(0, fixDue − 5) / 3))`;
 * an kurzen Tagen höchstens 5, sonntags 3. Ohne Angabe (`fixDue` unbekannt) gilt die Untergrenze.
 */
export function fixLimitFor(shape: UnitShape, fixDue: number | undefined, light = false): number {
  if (shape === 'sun') return SUNDAY_FIX;
  const due = typeof fixDue === 'number' && Number.isFinite(fixDue) ? Math.max(0, Math.floor(fixDue)) : 0;
  const raw = Math.min(FIX_LIMIT.max, FIX_LIMIT.min + Math.ceil(Math.max(0, due - FIX_LIMIT.min) / 3));
  return shape === 'short' || light ? Math.min(FIX_LIMIT.shortMax, raw) : raw;
}

/** Minuten von Schritt 4 bei gegebener Grenze. */
export const fixMinutes = (base: number, limit: number): number => Math.max(base, Math.ceil((limit * FIX_SEC) / 60));

export const LISTEN_WORDS: readonly [number, number] = [150, 180];

const CHANNEL: Readonly<Record<1 | 2 | 3 | 4 | 5, UnitChannel>> = {
  1: 'review',
  2: 'ch:u-in',
  3: 'ch:u-task',
  4: 'ch:u-focus',
  5: 'ch:u-again',
};

/** Wochentag eines Lerntags: 1 = Montag … 7 = Sonntag (reine Kalenderrechnung). */
export function dowOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return wd === 0 ? 7 : wd;
}


const step = (kind: UnitBlockKind, opts: UnitBlockOpts = {}, then: readonly UnitBlockKind[] = []): UnitStep => ({
  kind,
  steps: [kind, ...then],
  opts,
});

function block(n: 1 | 2 | 3 | 4 | 5, s: UnitStep, min: number, channel: UnitChannel = CHANNEL[n], args?: StepArgs): UnitBlock {
  return { block: n, kind: s.kind, steps: s.steps, opts: s.opts, min, channel, ...(args ? { args } : {}) };
}

function normalGoal(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 25;
}

/**
 * Plan eines Lerntags (einmal je Lerntag einfrieren, Kap. 15). Ohne `env` (M5): Blockzahl, Minuten
 * und `duty` sind bei KI/Sprachausgabe an oder aus gleich. `_week` ist ein Rest des früheren Wochenthemas und wird ignoriert.
 */
export function unitPlanFor(day: string, _week: unknown, prefs: UnitPrefs = {}): UnitPlan {
  const dow = dowOf(day);
  const goalMin = normalGoal(prefs.goalMin);
  // Neustart-Woche: immer der kleinste Plan (3 + 4 + 2 Min.), auch am Sonntag.
  const restart = prefs.comeback === 'restart';
  const reduced = prefs.comeback === 'reduced';
  // Regelversion 2 (§2.3): Schritt 1 nur Karten, Grammatik ohne Fehlersätze, Schritt 4 Satz für Satz mit eingefrorener Grenze.
  const v2 = prefs.rv === 2;
  const rv1: StepArgs | undefined = v2 ? { repairs: 0 } : undefined;
  const rv2: StepArgs | undefined = v2 ? { errs: 0 } : undefined;
  const fixBlock = (base: number, limit: number): UnitBlock => block(5, step('again'), v2 ? fixMinutes(base, limit) : base, CHANNEL[5], v2 ? { limit } : undefined);
  const short = goalMin <= SHORT_GOAL_MAX || restart;
  const blocks: UnitBlock[] = [];
  let shape: UnitShape;
  let reviewSec: number;
  // Rückstand: Block 1 darf länger dauern als der Grundwert (Anzeige „ca. n Min.“ bleibt wahr), nie kürzer.
  const reviewMin = (base: number): number => Math.max(base, Math.min(REVIEW_MIN_MAX, Math.ceil(prefs.reviewMin ?? 0)));

  if (dow === 7 && !restart) {
    // S5: Block 1 (≤ 5 Min.) + Wochen-Check (5 Min.), unabhängig vom Tagesziel.
    shape = 'sun';
    reviewSec = REVIEW_SEC.sun;
    blocks.push(block(1, step('review'), reviewMin(SUNDAY_MIN.review), CHANNEL[1], rv1));
    blocks.push(block(3, step('task.check'), SUNDAY_MIN.check, 'ch:u-check'));
    // Neu in Regelversion 2: am Sonntag drei Fehlersätze (2 Min.), nur wenn welche fällig sind.
    if (v2 && (prefs.fixDue ?? 0) > 0) blocks.push(fixBlock(SUNDAY_MIN.again, SUNDAY_FIX));
  } else if (short) {
    const tiny = goalMin <= 10 || restart;
    const m = tiny ? VG_MIN.tiny : VG_MIN.short;
    shape = 'short';
    reviewSec = tiny ? REVIEW_SEC.tiny : REVIEW_SEC.short;
    blocks.push(block(1, step('review'), reviewMin(m.review), CHANNEL[1], rv1));
    const light = tiny || reduced;
    blocks.push(block(2, step('grammar', { n: light ? GRAMMAR_N.tiny : GRAMMAR_N.short }), light ? VG_MIN.tiny.grammar : m.grammar, 'ch:u-focus', rv2));
    blocks.push(fixBlock(m.again, fixLimitFor('short', prefs.fixDue, true)));
  } else {
    shape = dow === 6 ? 'sat' : 'full';
    reviewSec = REVIEW_SEC.full;
    blocks.push(block(1, step('review'), reviewMin(VG_MIN.full.review), CHANNEL[1], rv1));
    if (reduced) {
      // Wiedereinstieg nach 7–13 Tagen Pause mit viel Überfälligem: nur 3 Grammatikaufgaben, Satzbau pausiert.
      blocks.push(block(2, step('grammar', { n: GRAMMAR_N.tiny }), VG_MIN.tiny.grammar, 'ch:u-focus', rv2));
    } else {
      blocks.push(block(2, step('grammar', { n: GRAMMAR_N.full }), VG_MIN.full.grammar, 'ch:u-focus', rv2));
      blocks.push(block(3, step('task.order'), VG_MIN.full.order));
    }
    blocks.push(fixBlock(VG_MIN.full.again, fixLimitFor(reduced ? 'short' : 'full', prefs.fixDue, reduced)));
  }

  // M2: Ist `goal.review` = 0, entfällt Block 1.
  // Nichts fällig: der Schritt „Fehler korrigieren“ (Block 5) entfällt, die Minuten werden neu summiert.
  const kept = blocks.filter((b) => !(prefs.reviewCount === 0 && b.block === 1) && !(prefs.fixDue === 0 && b.block === 5));
  return {
    v: 1,
    day,
    wk: isoWeek(day),
    dow,
    shape,
    short,
    goalMin,
    reviewSec,
    blocks: kept,
    duty: kept.map((b) => b.channel),
    minutes: kept.reduce((s, b) => s + b.min, 0),
    ...(v2 ? { rv: 2 as const } : {}),
    ...(prefs.comeback ? { comeback: prefs.comeback } : {}),
  };
}

export type ResolvedBlock = UnitStep & {
  block: UnitBlock['block'];
  /** Ohne KI: ungeprüft speichern (Block 3), lokal prüfen (Block 4/5). */
  offline: boolean;
  /** Ein Rückfall wurde angewandt. */
  fallback: boolean;
};

/**
 * Ausführung eines Blocks mit der aktuellen Umgebung (beim Blockstart, M4/M5):
 * - ohne KI: Rollenspiel und Generalprobe → Einwand-Training;
 *   Tonlagen → Posteingang; Hörtext zum Thema → Themen-Text vorlesen + Zusammenfassung; Dialog → Feed.
 * - ohne Sprachausgabe: Hören → Lesen, Nachsprechen entfällt (ist es der ganze Block: Wendungen lesen).
 */
export function resolveBlock(b: UnitBlock, env: UnitEnv): ResolvedBlock {
  let s: UnitStep = { kind: b.kind, steps: [...b.steps], opts: { ...b.opts } };
  let fallback = false;
  if (!env.ai) {
    const swap = (kind: UnitBlockKind, opts: UnitBlockOpts) => {
      s = { kind, steps: s.steps.map((k) => (k === s.kind ? kind : k)), opts };
      fallback = true;
    };
    if (s.kind === 'task.roleplay') swap('task.objection', { short: s.opts.short });
    else if (s.kind === 'task.meeting') swap('task.objection', {});
    else if (s.kind === 'task.tones') swap('task.inbox', { src: 'inbox', part: 'full' });
    else if (s.opts.src === 'theme-listen') {
      s = { ...s, opts: { ...s.opts, src: 'theme-text', summary: true, words: undefined } };
      fallback = true;
    } else if (s.opts.src === 'dialog') {
      s = { ...s, opts: { ...s.opts, src: 'feed', words: undefined } };
      fallback = true;
    }
  }
  if (!env.tts) {
    if (s.kind === 'input.listen') {
      s = { kind: 'input.read', steps: s.steps.map((k) => (k === 'input.listen' ? 'input.read' : k)), opts: { ...s.opts, ladder: undefined } };
      fallback = true;
    }
    if (s.steps.includes('pron.shadow')) {
      const rest = s.steps.filter((k) => k !== 'pron.shadow');
      s = rest.length ? { ...s, kind: rest[0] ?? s.kind, steps: rest } : { kind: 'input.read', steps: ['input.read'], opts: { ...s.opts, src: 'phrases' } };
      fallback = true;
    }
  }
  const opts: UnitBlockOpts = {};
  for (const [k, v] of Object.entries(s.opts) as [keyof UnitBlockOpts, unknown][]) if (v !== undefined) (opts as Record<string, unknown>)[k] = v;
  return { block: b.block, kind: s.kind, steps: s.steps, opts, offline: !env.ai && b.block >= 3, fallback };
}
