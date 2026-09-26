import { validateDoc } from '../../data/validate';

// „Stunde gehalten" (Phase 5 §5.6, E5-17): zählt als Aktivität (`act[tag].preply`, Minuten),
// NICHT für `days`/`xpDays`/Pflicht (A7.2: nur die Pflicht zählt für die Serie). Kein Rückgängig.
// Doppelzählung ist ausgeschlossen: Das Profil wird nur geschrieben, wenn der Plan gerade erst
// auf `done` gesetzt wurde, und `lxSeq[gerät]` macht einen wiederholten Schreibvorgang wirkungslos.

type Doc = Record<string, unknown>;

export const HELD_MIN_MAX = 120;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type Held = { day: string; minutes: number; now: number };

/** Plan als gehalten markieren; `null`, wenn er schon gehalten ist. */
export function heldOp(cur: Doc | undefined, h: Held): { update: Doc } | null {
  if (!cur || cur.done === true) return null;
  return { update: { done: true, doneT: h.now, heldDay: h.day, heldMin: h.minutes } };
}

/** Mindestform eines Plans für „Stunde ohne Plan eintragen" (§5.3). */
export function heldWithoutPlanDoc(h: Held & { lang: string; title: string }): Doc {
  return {
    t: h.now,
    lang: h.lang,
    ctx: { kind: 'held' },
    title: h.title,
    minutes: h.minutes,
    warmup: [],
    talk: [],
    say: [],
    watch: [],
    message: '',
    done: true,
    doneT: h.now,
    heldDay: h.day,
    heldMin: h.minutes,
  };
}

/**
 * Aktivitäts-Zähler im Profil: `act[tag][key] + 1`, `minutes[tag] + min` (1–120).
 * `null` bei ungültigem Profil oder wenn diese Folgenummer dieses Geräts schon angewendet ist.
 */
export function activityPatch(cur: Doc, a: { day: string; key: 'preply'; minutes: number }, ctx: { deviceId: string | null; seq: number }): Doc | null {
  if (!validateDoc('app/profile', cur).ok) return null;
  if (ctx.deviceId && num(obj(cur.lxSeq)[ctx.deviceId]) >= ctx.seq) return null;
  const min = Math.min(HELD_MIN_MAX, Math.max(1, Math.round(a.minutes)));
  const dayAct = obj(obj(cur.act)[a.day]);
  const patch: Doc = {
    act: { [a.day]: { [a.key]: num(dayAct[a.key]) + 1 } },
    minutes: { [a.day]: num(obj(cur.minutes)[a.day]) + min },
  };
  if (ctx.deviceId) patch.lxSeq = { [ctx.deviceId]: ctx.seq };
  return patch;
}
