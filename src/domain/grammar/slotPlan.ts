import { daysBetween } from '../date';
import { patternState, patternStateNo, type PatEntry } from '../metrics/pattern';
import { mixPick } from './mix';

// Die eine Prioritätstabelle für Schritt 2 (Lernplattform 3.0 §2.2, P15). Rein, nichts wird gelesen oder gespeichert.
// Ausgabe: je Platz die Rolle und (wo es schon feststeht) das Muster; `aiOk` = hier darf eine Claude-Aufgabe stehen.

export type SlotRole = 'vortest' | 'intro' | 'chapter' | 'focus' | 'due' | 'mix' | 'xtra';
export type Slot = { i: number; role: SlotRole; pat?: string; aiOk: boolean };

export type PatInfo = {
  id: string;
  /** Kapitel-Index (0-basiert, LP2-Reihenfolge). */
  chapter: number;
  /** Eintrag `grammar/<thema>.pats[muster]` (fehlt = Neu). */
  entry?: PatEntry | undefined;
};

export type SlotInput = {
  /** Plätze: voll 6, kurz 4, tiny/Wiedereinstieg 3. */
  n: number;
  ctx: 'duty' | 'xtra';
  /** 0 = Sonntag … 6 = Samstag. */
  weekday: number;
  today: string;
  /** Alle Muster des Pfads (auch noch nicht eingeführte). */
  pats: readonly PatInfo[];
  /** Einführungstag: die Muster des heutigen Schritts (`u.gt.intro` ≠ null). */
  intro?: { pats: readonly string[] } | null;
  /** Wochenfokus (`app/profile.wf`), sonst `null`. */
  focus?: string | null;
  /** Offene Fehlersätze je Muster (Fehler-Radar). */
  errorsByPat?: Readonly<Record<string, number>>;
  /** Muster, zu denen es keine ungesehene feste Aufgabe mehr gibt (nur dort darf Claude einspringen). */
  noFixedLeft?: ReadonlySet<string>;
  /** Nur Extra-Runde: die vom Aufruf gewählten Muster. */
  chosen?: readonly string[];
  seed: string;
};

export const FULL_ROUND = 6;
export const AI_MAX = { duty: 2, xtra: 3 } as const;
/** Fest gewordene Muster werden nach so vielen Tagen wieder fällig (frühestens). */
export const FIRM_DUE_DAYS = 28;

const introduced = (p: PatInfo): boolean => !!p.entry && (p.entry.i !== undefined || (p.entry.n ?? 0) > 0);
const lastOf = (p: PatInfo): number => p.entry?.last ?? 0;
const stateOf = (p: PatInfo, today: string): number => patternStateNo(patternState(p.entry, today));

/**
 * „Aktuelles Kapitel“: das erste Kapitel (in Reihenfolge), in dem ein eingeführtes Muster unter „Sicher“ liegt; sonst das Kapitel der jüngsten
 * Einführung; sonst 0. P31 verwendet dieselbe Funktion.
 */
export function currentChapter(pats: readonly PatInfo[], today: string): number {
  const live = pats.filter(introduced);
  const below = live.filter((p) => stateOf(p, today) < 2).map((p) => p.chapter);
  if (below.length) return Math.min(...below);
  let best: PatInfo | null = null;
  for (const p of live) if (p.entry?.i && (!best || (p.entry.i ?? '') > (best.entry?.i ?? ''))) best = p;
  return best?.chapter ?? 0;
}

const cmpDue = (a: PatInfo, b: PatInfo): number => lastOf(a) - lastOf(b) || a.id.localeCompare(b.id);

/** Muster, die als „fällig“ gelten: eingeführt, und Muster im Zustand Fest erst nach `FIRM_DUE_DAYS` Tagen. */
function dueList(pats: readonly PatInfo[], today: string): PatInfo[] {
  return pats
    .filter(introduced)
    .filter((p) => stateOf(p, today) < 3 || !p.entry?.last || daysBetween(new Date(p.entry.last).toISOString().slice(0, 10), today) >= FIRM_DUE_DAYS)
    .sort(cmpDue);
}

export function slotPlan(i: SlotInput): Slot[] {
  const n = Math.max(0, Math.min(i.ctx === 'xtra' ? 8 : FULL_ROUND, Math.floor(i.n)));
  const out: Slot[] = [];
  const push = (role: SlotRole, pat: string | undefined, aiOk = false): void => {
    out.push({ i: out.length, role, ...(pat ? { pat } : {}), aiOk });
  };

  // Einführungstag: Vortest (1–2), dann Einführungsaufgaben; nie Claude.
  if (i.intro) {
    const ps = i.intro.pats;
    for (let k = 0; k < n; k++) {
      if (k < 2) push('vortest', undefined);
      else push('intro', ps.length ? ps[(k - 2) % ps.length] : undefined);
    }
    return out;
  }

  const byId = new Map(i.pats.map((p) => [p.id, p]));
  const all = dueList(i.pats, i.today);

  // Samstag: Kapitel-Mix, nie Claude.
  if (i.ctx === 'duty' && i.weekday === 6) {
    const picks = mixPick(all.map((p) => ({ pat: p.id, chapter: p.chapter, last: lastOf(p) })), n, i.seed);
    for (let k = 0; k < n; k++) push('mix', picks[k % Math.max(1, picks.length)]);
    return out;
  }

  const used: string[] = [];
  const free = (p: PatInfo): boolean => !used.includes(p.id);
  /** Nicht dasselbe Muster zweimal direkt hintereinander in den Plätzen 1–3. */
  const okAt = (k: number, p: PatInfo): boolean => k >= 3 || out[k - 1]?.pat !== p.id;
  const take = (k: number, list: readonly PatInfo[]): string | undefined => {
    const uses = (p: PatInfo): number => used.filter((u) => u === p.id).length;
    // Gibt es nichts Neues mehr, kommt das am seltensten verwendete Muster (nicht dasselbe direkt davor in den Plätzen 1–3).
    const hit = list.find((p) => free(p) && okAt(k, p)) ?? [...list].filter((p) => okAt(k, p)).sort((a, b) => uses(a) - uses(b))[0];
    if (hit) used.push(hit.id);
    return hit?.id;
  };

  // Extra-Runde: Muster wählt der Aufruf; Plätze `due`.
  if (i.ctx === 'xtra') {
    const chosen = (i.chosen ?? []).map((id) => byId.get(id)).filter((p): p is PatInfo => !!p);
    const pool = chosen.length ? chosen : all;
    let ai = 0;
    for (let k = 0; k < n; k++) {
      const p = pool.length ? pool[k % pool.length] : undefined;
      const aiOk = !!p && ai < AI_MAX.xtra && !!i.noFixedLeft?.has(p.id) && k >= 3;
      if (aiOk) ai++;
      push('xtra', p?.id, aiOk);
    }
    return out;
  }

  // Normaltag: 2 chapter · 1 focus · 3 due.
  const roles: SlotRole[] = ['chapter', 'chapter', 'focus', 'due', 'due', 'due'];
  const cur = currentChapter(i.pats, i.today);
  const recent = (p: PatInfo): boolean => !!p.entry?.i && daysBetween(p.entry.i, i.today) <= 7 && daysBetween(p.entry.i, i.today) >= 0;
  const chapterList = all
    .filter((p) => p.chapter === cur)
    .sort((a, b) => Number(recent(b)) - Number(recent(a)) || stateOf(a, i.today) - stateOf(b, i.today) || cmpDue(a, b));
  const errs = i.errorsByPat ?? {};
  const radarList = all.filter((p) => (errs[p.id] ?? 0) > 0).sort((a, b) => (errs[b.id] ?? 0) - (errs[a.id] ?? 0) || cmpDue(a, b));
  const focusFirst = i.focus ? byId.get(i.focus) : undefined;
  let firm = 0;
  const dueOk = (p: PatInfo): boolean => stateOf(p, i.today) < 3 || firm < 1;
  let ai = 0;
  for (let k = 0; k < n; k++) {
    const role = roles[k] as SlotRole;
    let pat: string | undefined;
    if (role === 'chapter') pat = take(k, chapterList) ?? take(k, all);
    else if (role === 'focus') pat = take(k, focusFirst ? [focusFirst] : []) ?? take(k, radarList) ?? take(k, all);
    else {
      pat = take(k, all.filter(dueOk)) ?? take(k, all);
      if (pat && stateOf(byId.get(pat) as PatInfo, i.today) >= 3) firm++;
    }
    const aiOk = role === 'due' && k >= 3 && !!pat && ai < AI_MAX.duty && !!i.noFixedLeft?.has(pat);
    if (aiOk) ai++;
    push(role, pat, aiOk);
  }
  return out;
}
