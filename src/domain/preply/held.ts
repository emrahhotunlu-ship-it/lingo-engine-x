// „Stunde gehalten" (Phase 5 §5.6, E5-17): zählt als Aktivität (`act[tag].preply`, Minuten),
// NICHT für `days`/`xpDays`/Pflicht (A7.2: nur die Pflicht zählt für die Serie). Kein Rückgängig.
// Doppelzählung ist ausgeschlossen: Das Profil wird nur geschrieben, wenn der Plan gerade erst
// auf `done` gesetzt wurde; den Zähler schreibt die Sammel-Warteschlange (`act:'preply'`,
// profilePatch), deren `lxSeq[tab]` einen wiederholten Schreibvorgang wirkungslos macht.

type Doc = Record<string, unknown>;

export const HELD_MIN_MAX = 120;

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
