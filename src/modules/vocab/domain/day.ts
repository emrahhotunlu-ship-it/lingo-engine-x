import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { pickDay } from './balance';
import { type Catalog, danger, dueOn, formFor as formForLex, formMs, isNewLex, loadByDay } from './catalog';
import { nextSrc, type Src, weightsOf } from './sources';
import type { Form, FormStats, Lex, TrackKey, VocabCfg } from './types';

// Wörter-Modul V1: Tagesplan, eingefroren je Lerntag (`vmod/day`, Kap. 15; plan.md §4.4; M12, M13, M21).
//  - Fällige nach Gefährdung (gefährdetste zuerst), Kernwörter vor Randwörtern.
//  - Rückstand: höchstens 2 Tagesbudgets je Tag. Der Rest: Randwörter werden nach Gefährdung auf die nächsten 7 Tage verteilt (Lastausgleich),
//    jedes höchstens 3-mal (`lex.mv`); Kernwörter und dreimal verschobene bleiben fällig und kommen am nächsten Tag zuerst.
//  - Neue: mindestens 2 an jedem Lerntag (auch bei Rückstand), darüber so viele, wie das Minutenbudget erlaubt, höchstens das Kontingent;
//    bei Kontingent 0 keine (Emrahs Antwort 5). Nie zwei verwechselbare neue am selben Tag, nie eine Kollokation am Einführungstag ihres Kernworts.

export const MOVE_MAX = 3;
export const BACKLOG_BUDGETS = 2;
export const SPREAD_DAYS = 7;
export const MIN_NEW = 2;
/** Vorgezogen (M15): bis zu dieser Zahl Lerntage voraus, nur solange der Plan unter AHEAD_FILL × Zielzeit liegt. */
export const AHEAD_DAYS = 2;
export const AHEAD_FILL = 0.9;
/** Nur Lexeme mit einem Abstand von mindestens so vielen Tagen werden vorgezogen (ein 1-Tages-Abstand früher geprüft bringt nichts). */
export const AHEAD_MIN_IVL = 7;
/** Vorlauf höchstens 15 % des Abstands (learning-scientist V1, Befund 2): 7–13 Tage → 1 Tag, ab 14 Tagen 2 Tage. */
export const aheadDays = (sd: number): number => Math.min(AHEAD_DAYS, Math.max(1, Math.floor(0.15 * sd)));
const startOfOffset = (day: string, n: number): number => dayStartOf(addDays(day, n));

/** Ein Eintrag im eingefrorenen Plan: Pfad, Spur (`n` = neu), Form. */
export type PlanEntry = [string, TrackKey | 'n', Form];
/** `sp` (V3 Schritt 4): Rückstand, der heute nicht drankommt, je Lerntag (verschoben bzw. als Kernwort morgen zuerst); fehlt ohne Rückstand. */
/** `ry` (Großpaket A S6): Ziel-Behaltensrate junger Wörter für diesen Lerntag, wenn die App nachsteuert („Junge Wörter früher“). */
export type DayPlan = { d: string; plan: PlanEntry[]; min: number; due: number; fresh: number; ahead: number; moved: number; why: string; sp?: [string, number][]; ry?: number };
export type Move = { path: string; track: TrackKey; to: string };

/** Minuten für ein neues Lexem: Einführung + Schritt A + Schritt B. */
export function newCostMs(med: FormStats): number {
  return formMs('intro', med) + formMs('gap_hint', med) + formMs('gap', med);
}

export function buildDayPlan(cat: Catalog, nowMs: number, cfg: VocabCfg, med: FormStats): { plan: DayPlan; moves: Move[] } {
  const day = dayKey(nowMs);
  const budgetMs = cfg.min * 60_000;
  type Due = { path: string; lex: Lex; track: TrackKey; form: Form; ms: number; r: number };
  const due: Due[] = [];
  let introducedToday = 0;
  for (const it of cat.items()) {
    if (it.lex.intro === day) introducedToday++;
    if (it.lex.day === day) continue; // heute schon gebucht
    if (cat.rests(it.path)) continue; // Paar-Regel (M14)
    const d = dueOn(it.lex, day, it.av);
    if (d) due.push({ path: it.path, lex: it.lex, ...d, ms: formMs(d.form, med), r: danger(it.lex, nowMs) });
  }
  const mustOf = (x: Due) => (x.lex.pri === 'core' || x.lex.mv >= MOVE_MAX ? 0 : 1);
  due.sort((a, b) => mustOf(a) - mustOf(b) || a.r - b.r || a.path.localeCompare(b.path));

  const quota = Math.max(0, cfg.newPerDay - introducedToday);
  const minNew = Math.min(MIN_NEW, quota);
  const nc = newCostMs(med);
  const cap = BACKLOG_BUDGETS * budgetMs - minNew * nc;
  const taken: Due[] = [];
  const rest: Due[] = [];
  let used = 0;
  for (const x of due) {
    if (used + x.ms <= Math.max(cap, x.ms) || taken.length === 0) {
      taken.push(x);
      used += x.ms;
    } else rest.push(x);
  }
  // Rückstand verteilen: nur Randwörter, je höchstens 3-mal.
  const moves: Move[] = [];
  const load = loadByDay(cat, med);
  for (const x of rest) {
    if (mustOf(x) === 0) continue;
    const sib = cat.siblingOffsets(x.path, day);
    const off = pickDay({ lo: 1, hi: SPREAD_DAYS, load: (i) => load.get(addDays(day, i)) ?? 0, siblings: sib, seed: `${x.path}|mv|${x.lex.mv}|${day}` });
    const to = addDays(day, off);
    load.set(to, (load.get(to) ?? 0) + x.ms / 60_000);
    moves.push({ path: x.path, track: x.track, to });
  }
  // Neue Lexeme.
  const room = Math.max(0, budgetMs - used);
  const nFresh = quota === 0 ? 0 : Math.min(quota, Math.max(minNew, Math.floor(room / nc)));
  const fresh: string[] = [];
  const blocked = new Set<string>();
  for (const it of cat.items()) if (it.lex.intro === day) for (const s of cat.siblingsOf(it.path)) blocked.add(s);
  // Großpaket A S7: neue Kandidaten je Quelle (eigene Funde, Wortpartner, Beruf, Häufigkeitsliste), gleichmäßig nach Gewicht gemischt;
  // innerhalb einer Quelle nach `order`. Ist eine Quelle erschöpft (oder nur noch Geschwister), füllen die übrigen.
  const bySrc = new Map<Src, string[]>();
  for (const it of cat
    .items()
    .filter((it) => isNewLex(it.lex))
    .sort((a, b) => a.order - b.order || a.path.localeCompare(b.path))) {
    const s = it.src ?? 'own';
    (bySrc.get(s) ?? bySrc.set(s, []).get(s)!).push(it.path);
  }
  const w = weightsOf(cfg.w);
  const bySrcN: Record<Src, number> = { col: 0, job: 0, own: 0, band: 0 };
  const open = new Set<Src>([...bySrc.keys()]);
  while (fresh.length < nFresh) {
    const s = nextSrc(bySrcN, open, w);
    if (!s) break;
    const list = bySrc.get(s)!;
    let p: string | undefined;
    while ((p = list.shift()) !== undefined && blocked.has(p));
    if (p === undefined) {
      open.delete(s);
      continue;
    }
    fresh.push(p);
    bySrcN[s]++;
    for (const x of cat.siblingsOf(p)) blocked.add(x);
  }
  // Vorgezogen gleitend (M15): Bleibt das Budget unter der Zielzeit, kommen Lexeme dazu, die in den nächsten AHEAD_DAYS Lerntagen fällig
  // werden (früheste zuerst). FSRS rechnet die frühere Abfrage mit kleinerem Zuwachs (Abrufwahrscheinlichkeit), der Folgetag wird leichter.
  let total = used + fresh.length * nc;
  const ahead: Due[] = [];
  if (total < budgetMs * AHEAD_FILL) {
    const limit = startOfOffset(day, AHEAD_DAYS + 1);
    const cands = cat
      .items()
      .filter((it) => !isNewLex(it.lex) && it.lex.day !== day && !dueOn(it.lex, day, it.av) && !cat.rests(it.path) && !(it.lex.step && dayKey(it.lex.step.at) === day) && (it.lex.b ?? it.lex.u).sd >= AHEAD_MIN_IVL)
      .map((it) => ({ it, at: Math.min(it.lex.u.due, it.lex.b?.due ?? Infinity), lead: aheadDays((it.lex.b ?? it.lex.u).sd) }))
      .filter((x) => x.at < startOfOffset(day, x.lead + 1) && x.at < limit)
      .sort((a, b) => a.at - b.at || a.it.path.localeCompare(b.it.path));
    for (const { it } of cands) {
      const track: TrackKey = it.lex.b ? 'b' : 'u';
      const form: Form = it.lex.b ? formForLex(it.lex, it.av) : 'gap';
      const ms = formMs(form, med);
      if (total + ms > budgetMs) break;
      ahead.push({ path: it.path, lex: it.lex, track, form, ms, r: 1 });
      total += ms;
    }
  }
  const plan: PlanEntry[] = [...taken.map((x): PlanEntry => [x.path, x.track, x.form]), ...ahead.map((x): PlanEntry => [x.path, x.track, x.form]), ...fresh.map((p): PlanEntry => [p, 'n', 'intro'])];
  const minutes = Math.round((total / 60_000) * 10) / 10;
  const why = `${taken.length} due, most at risk first · ${fresh.length} new${ahead.length ? ` · ${ahead.length} ahead` : ''}${moves.length ? ` · ${moves.length} spread` : ''}`;
  // Verteilung des Rückstands für den Start-Bildschirm (ruhige Rückkehr): Verschobene am Zieltag, Kernwörter bleiben fällig und kommen morgen.
  const spread = new Map<string, number>();
  const moved = new Map(moves.map((m) => [m.path, m.to]));
  const tomorrow = addDays(day, 1);
  for (const x of rest) {
    const to = moved.get(x.path) ?? tomorrow;
    spread.set(to, (spread.get(to) ?? 0) + 1);
  }
  const sp = [...spread.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return { plan: { d: day, plan, min: minutes, due: taken.length, fresh: fresh.length, ahead: ahead.length, moved: moves.length, why, ...(sp.length ? { sp } : {}) }, moves };
}

/** Termin einer Spur auf einen anderen Lerntag legen (Rückstand verteilen), `mv` + 1. Ändert keine FSRS-Werte außer `due`. */
export function applyMove(lex: Lex, m: Move, startOf: (day: string) => number): Lex {
  const l: Lex = { ...lex, u: { ...lex.u }, b: lex.b ? { ...lex.b } : null, mv: lex.mv + 1 };
  const at = startOf(m.to);
  if (m.track === 'b' && l.b) l.b.due = at;
  else l.u.due = at;
  // Die andere Spur nicht am selben Tag allein fällig lassen: Benutzen kommt mit, Verstehen folgt über die Kopplung.
  if (m.track === 'b' && l.u.due < at) l.u.due = at;
  return l;
}

/** Tage seit dem Plan (für den Abbau-Test). */
export const planAge = (p: DayPlan, nowMs: number): number => daysBetween(p.d, dayKey(nowMs));
