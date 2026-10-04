import { THEMES, themeById } from '../../content/nb/themes';
import { TRAPS } from '../../content/nb/traps';
import { isoWeek } from '../date';
import { hasWords, normText, phraseCore } from '../text/normText';
import { matchTraps, type TrapHit } from '../patterns/traps';
import type { TargetKind, ThemeId, WeekDoc, WeekTargets, WeekTheme } from './types';

// Wochenziele (Plan N13, Lehrer W7/W8/G2): ≤ 4 Ziele (3 Fallen, 1 Werkzeug) und die
// Zählziele der Aufgaben („Ziel: 2 Abschwächungen · 3 Überleitungen“). `detectTargets` zählt lokal beim Tippen.

export const TRAPS_MAX = 3;

export const EMPTY_TARGETS: WeekTargets = { wk: null, theme: null, traps: [], tool: null, goals: [], phrases: [] };

/**
 * Wochenziele einer Woche. Gespeicherte Ziele in `app/week.targets` (gleiche Woche) gehen vor.
 * Sonst: eigene Fallen (`own`, z. B. Top-Muster aus `app/patterns`) zuerst, dann die Falle des Themas,
 * aufgefüllt aus dem Startsatz.
 */
export function weekTargets(theme: WeekTheme | ThemeId | null | undefined, opts: { day?: string; week?: WeekDoc | null; own?: readonly string[] } = {}): WeekTargets {
  const t = typeof theme === 'string' ? themeById(theme) : (theme ?? null);
  if (!t) return EMPTY_TARGETS;
  const wk = opts.day ? isoWeek(opts.day) : (opts.week?.cur?.wk ?? null);
  const stored = opts.week?.targets && wk && opts.week.targets.wk === wk ? opts.week.targets : null;
  let traps: string[];
  if (stored?.traps.length) traps = stored.traps.slice(0, TRAPS_MAX);
  else {
    traps = [];
    const add = (id: string) => {
      if (id && !traps.includes(id) && traps.length < TRAPS_MAX) traps.push(id);
    };
    for (const id of opts.own ?? []) add(id);
    add(t.trap);
    const start = Math.max(0, TRAPS.findIndex((x) => x.id === t.trap));
    for (let k = 1; k < TRAPS.length && traps.length < TRAPS_MAX; k++) add(TRAPS[(start + k) % TRAPS.length]?.id ?? '');
  }
  return {
    wk,
    theme: t.id,
    traps,
    tool: stored?.tool || t.tool,
    goals: t.goals.map((g) => ({ ...g })),
    phrases: t.phrases.map((p) => p.en),
  };
}

// ------------------------------------------------------------------ Erkennen im Text

/** Abschwächungen (Hedging, W7). Reguläre Ausdrücke über dem Originaltext, ohne Groß-/Kleinschreibung. */
export const HEDGES: readonly string[] = [
  "\\b(?:might|may)\\b(?! i\\b)",
  "\\bcould\\b(?! (?:you|we|i)\\b)",
  "\\bshould\\b(?! (?:you|we|i)\\b)",
  '\\b(?:perhaps|possibly|probably|presumably|potentially|arguably)\\b',
  '\\b(?:likely|unlikely)\\b',
  '\\b(?:roughly|approximately|around|about|up to|nearly|almost) (?:\\$|€)?\\d',
  '\\b(?:roughly|approximately|around|about|up to|nearly|almost) (?:a|one|two|three|four|half|a third|a quarter)\\b',
  "\\bi'?d (?:say|argue|suggest)\\b",
  '\\bi would (?:say|argue|suggest)\\b',
  '\\bi (?:think|believe|suspect|assume|guess)\\b',
  '\\bit (?:seems|appears|looks like)\\b',
  '\\b(?:tends?|tended) to\\b',
  '\\b(?:somewhat|fairly|relatively|rather)\\b',
  '\\bin most cases\\b',
  '\\b(?:as far as i know|to some extent|to a certain extent|more or less|in general|generally)\\b',
  '\\bchances are\\b',
];

/** Überleitungen und Wegweiser (W8). */
export const TRANSITIONS: readonly string[] = [
  '\\bthat (?:said|being said)\\b',
  '\\bhaving said that\\b',
  '\\bto build on that\\b',
  '\\bcoming back to\\b',
  '\\b(?:the )?bottom line\\b',
  '\\bin a nutshell\\b',
  '\\b(?:first of all|firstly|secondly|thirdly|finally|lastly)\\b',
  '\\b(?:first|second|third),',
  '\\bon top of that\\b',
  '\\bin addition\\b',
  '\\b(?:moreover|furthermore|however|therefore|meanwhile|nevertheless|consequently)\\b',
  '\\bon the other hand\\b',
  '\\bas a result\\b',
  '\\bwhat (?:that|this) means (?:for you )?is\\b',
  '\\b(?:this|which) brings me to\\b',
  "\\blet(?:'s| us| me) (?:move on|turn to|walk you through|start with|get started)\\b",
  '\\bmoving on\\b',
  '\\bto (?:wrap up|sum up|summarize|start with|begin with)\\b',
  '\\b(?:in short|in summary|in other words|long story short|all in all|overall)\\b',
  '\\bfor (?:example|instance)\\b',
  '\\b(?:at the same time|by contrast|in contrast|in fact|as i mentioned|then again|in the end|on balance)\\b',
  '\\bit turned out\\b',
  '\\bso there i was\\b',
];

const compiled = (list: readonly string[]): RegExp[] => list.map((s) => new RegExp(s, 'giu'));
const HEDGE_RE = compiled(HEDGES);
const TRANS_RE = compiled(TRANSITIONS);

export type TargetHit = { kind: TargetKind; at: number; text: string };
export type TargetCount = { kind: TargetKind; need: number; have: number };
export type TargetScan = {
  hedge: number;
  transition: number;
  phrase: number;
  /** Benutzte Wendungen der Woche (in der Schreibweise der Liste). */
  phrasesUsed: string[];
  hits: TargetHit[];
  /** Fortschritt je Zählziel der Woche. */
  progress: TargetCount[];
  /** Deutsch-Fallen im Text (Startsatz). */
  traps: TrapHit[];
};

function scan(text: string, res: readonly RegExp[], kind: TargetKind): TargetHit[] {
  const hits: TargetHit[] = [];
  const taken: [number, number][] = [];
  for (const re of res) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const a = m.index;
      const b = a + m[0].length;
      if (taken.some(([x, y]) => a < y && b > x)) continue;
      taken.push([a, b]);
      hits.push({ kind, at: a, text: m[0].trim() });
    }
  }
  return hits;
}

/** Zählt Abschwächungen, Überleitungen, benutzte Wendungen und Fallen in einem eigenen Text (N13). */
export function detectTargets(text: string, targets: Pick<WeekTargets, 'goals' | 'phrases'> = EMPTY_TARGETS): TargetScan {
  const s = text.normalize('NFKC').replace(/[’‘`´]/g, "'");
  const hedges = scan(s, HEDGE_RE, 'hedge');
  const trans = scan(s, TRANS_RE, 'transition');
  const normed = normText(s);
  const phrasesUsed = targets.phrases.filter((p) => {
    const core = phraseCore(p);
    return core.split(' ').length >= 2 && hasWords(normed, core);
  });
  const hits = [...hedges, ...trans, ...phrasesUsed.map((p): TargetHit => ({ kind: 'phrase', at: -1, text: p }))].sort((a, b) => a.at - b.at);
  const count: Record<TargetKind, number> = { hedge: hedges.length, transition: trans.length, phrase: phrasesUsed.length };
  return {
    hedge: count.hedge,
    transition: count.transition,
    phrase: count.phrase,
    phrasesUsed,
    hits,
    progress: targets.goals.map((g) => ({ kind: g.kind, need: g.need, have: count[g.kind] })),
    traps: matchTraps(s),
  };
}

/** Alle Themen (für Auswahllisten, „Anderes wählen“). */
export const allThemes = (): readonly WeekTheme[] => THEMES;
