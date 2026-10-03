import { isoWeek } from '../date';
import { themeFor } from './theme';
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
  WeekDoc,
  WeekTheme,
} from './types';

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
export const SUNDAY_MIN = { review: 5, check: 5 } as const;
/** Mehr als so viele Minuten plant Block 1 auch bei großem Rückstand nie (`domain/unit/backlog.ts`). */
export const REVIEW_MIN_MAX = 15;
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

const isoWeekNo = (day: string): number => Number(isoWeek(day).slice(-2));

const step = (kind: UnitBlockKind, opts: UnitBlockOpts = {}, then: readonly UnitBlockKind[] = []): UnitStep => ({
  kind,
  steps: [kind, ...then],
  opts,
});

function block(n: 1 | 2 | 3 | 4 | 5, s: UnitStep, min: number, channel: UnitChannel = CHANNEL[n]): UnitBlock {
  return { block: n, kind: s.kind, steps: s.steps, opts: s.opts, min, channel };
}

/** Block 2 laut Wochenplan (M7); null an Tagen ohne Input (Sa, So). */
function inputStep(dow: number, day: string, theme: WeekTheme): UnitStep | null {
  switch (dow) {
    case 1:
      return step('input.read', { src: 'theme-text' }, ['pron.shadow']);
    case 2:
      return step('input.listen', { src: 'theme-listen', words: LISTEN_WORDS, ladder: true }, ['pron.shadow']);
    case 3:
      // Ungerade Kalenderwoche: die Mail ist der Input. Gerade: Lesen (neuer Text statt Themen-Text vom Montag).
      return isoWeekNo(day) % 2 === 1 ? step('task.inbox', { src: 'inbox', part: 'read' }) : step('input.read', { src: 'feed' }, ['pron.shadow']);
    case 4:
      return step('input.listen', { src: 'dialog', words: LISTEN_WORDS, ladder: true }, ['pron.shadow']);
    case 5:
      // In Berufswochen Alltags-Input (Mischung Beruf/Alltag, M7).
      return step('input.read', { src: theme.kind === 'job' ? 'feed-life' : 'feed' }, ['pron.shadow']);
    default:
      return null;
  }
}

/** Block 3 laut Wochenplan. `withInput`: Gibt es heute Block 2? (Posteingang sonst komplett in Block 3). */
function taskStep(dow: number, day: string, theme: WeekTheme, prefs: UnitPrefs, short: boolean, withInput: boolean): UnitStep {
  switch (dow) {
    case 1:
      return step('task.say', { aloud: true });
    case 2:
      return step('task.fluency', { question: theme.fluencyQ });
    case 3:
      return isoWeekNo(day) % 2 === 1 ? step('task.inbox', { src: 'inbox', part: withInput ? 'reply' : 'full' }) : step('task.tones');
    case 4: {
      const m = prefs.meetingInDays;
      return typeof m === 'number' && m >= 0 && m <= 3 ? step('task.meeting', { rehearsal: true }) : step('task.objection');
    }
    case 5:
      return step('task.fluency', { question: theme.fluencyQ, compare: 'tue' });
    case 6:
      return short ? step('task.objection', { short: true }) : step('task.roleplay', { scene: theme.scene });
    default:
      return step('task.check');
  }
}

function normalGoal(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 25;
}

/**
 * Plan eines Lerntags (einmal je Lerntag einfrieren, Kap. 15). Ohne `env` (M5): Blockzahl, Minuten
 * und `duty` sind bei KI/Sprachausgabe an oder aus gleich.
 */
export function unitPlanFor(day: string, week: WeekDoc | null | undefined, prefs: UnitPrefs = {}): UnitPlan {
  const pick = themeFor(day, week, prefs.themeHint);
  const theme = pick.theme;
  const dow = dowOf(day);
  const goalMin = normalGoal(prefs.goalMin);
  const short = goalMin <= SHORT_GOAL_MAX;
  const blocks: UnitBlock[] = [];
  let shape: UnitShape;
  let reviewSec: number;
  // Rückstand: Block 1 darf länger dauern als der Grundwert (Anzeige „ca. n Min.“ bleibt wahr), nie kürzer.
  const reviewMin = (base: number): number => Math.max(base, Math.min(REVIEW_MIN_MAX, Math.ceil(prefs.reviewMin ?? 0)));

  if (dow === 7) {
    // S5: Block 1 (≤ 5 Min.) + Wochen-Check (5 Min.), unabhängig vom Tagesziel.
    shape = 'sun';
    reviewSec = REVIEW_SEC.sun;
    blocks.push(block(1, step('review'), reviewMin(SUNDAY_MIN.review)));
    blocks.push(block(3, step('task.check'), SUNDAY_MIN.check, 'ch:u-check'));
  } else if (short) {
    const m = goalMin <= 10 ? SHORT_MIN.tiny : SHORT_MIN.short;
    shape = 'short';
    reviewSec = goalMin <= 10 ? REVIEW_SEC.tiny : REVIEW_SEC.short;
    blocks.push(block(1, step('review'), reviewMin(m.review)));
    blocks.push(block(3, taskStep(dow, day, theme, prefs, true, false), m.task));
    blocks.push(block(5, step('again'), m.again));
  } else {
    shape = dow === 6 ? 'sat' : 'full';
    reviewSec = REVIEW_SEC.full;
    blocks.push(block(1, step('review'), reviewMin(FULL_MIN.review)));
    const input = inputStep(dow, day, theme);
    if (input) blocks.push(block(2, input, FULL_MIN.input));
    blocks.push(block(3, taskStep(dow, day, theme, prefs, false, !!input), dow === 6 ? FULL_MIN.roleplay : FULL_MIN.task));
    blocks.push(block(4, step('focus'), FULL_MIN.focus));
    blocks.push(block(5, step('again'), FULL_MIN.again));
  }

  // M2: Ist `goal.review` = 0, entfällt Block 1.
  const kept = prefs.reviewCount === 0 ? blocks.filter((b) => b.block !== 1) : blocks;
  return {
    v: 1,
    day,
    wk: pick.wk,
    dow,
    theme: pick.id,
    themeBy: pick.by,
    confirmTheme: !pick.stored,
    shape,
    short,
    goalMin,
    reviewSec,
    blocks: kept,
    duty: kept.map((b) => b.channel),
    minutes: kept.reduce((s, b) => s + b.min, 0),
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
