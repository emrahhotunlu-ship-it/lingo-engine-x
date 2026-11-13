import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { pickDay } from './balance';
import { type Catalog, danger, dueOn, formFor as formForLex, formMs, isNewLex, loadByDay } from './catalog';
import { nextSrc, type Src, weightsOf } from './sources';
import type { Form, FormStats, Lex, TrackKey, VocabCfg } from './types';

// Wörter-Modul V1: Tagesplan, eingefroren je Lerntag (`vmod/day`, Kap. 15; plan.md §4.4; M12, M13, M21).
//  - Fällige nach Gefährdung (gefährdetste zuerst), Kernwörter vor Randwörtern.
//  - Rückstand: höchstens 1 Tagesbudget je Tag (Emrah 04.11.2026, Wahl A: „88 Wörter in einem Durchgang“ – der Plan passt in die eingestellte
//    Wörter-Zeit; vorher 2 Budgets). Der Rest: Randwörter werden nach Gefährdung auf die nächsten 7 Tage verteilt (Lastausgleich),
//    jedes höchstens 3-mal (`lex.mv`); Kernwörter und dreimal verschobene bleiben fällig und kommen am nächsten Tag zuerst.
//  - Politur P2 (Emrah 13.11.2026, E3 „A: Wiederholungen zuerst“; ersetzt „das Kontingent kommt immer“ vom 08.11.): Im Minuten-Modus kommen
//    die WIEDERHOLUNGEN ZUERST. Der erste Abruf nach dem Einführungstag („gestern gelernt“) steht immer im Plan. Die Wiederholungen bekommen
//    mindestens 60 % der Wörter-Zeit (`REVIEW_SHARE`) und alles darüber hinaus, was sie brauchen – bis auf den Platz für die Mindestzahl neuer
//    Wörter. Neue = was übrig bleibt: mindestens `MIN_NEW` (bei sehr kurzer Wörter-Zeit 1), höchstens das Tempo des Tages (`newPerDay`,
//    domain/tempo.ts). Vorher rechnete der Plan „Zeit − neue × Kosten“: bei Tagesziel 30/35 blieben 10 neue und 1 Wiederholung (Prüfbericht S1).
//    Bei Tempo 0 keine neuen (Emrahs Antwort 5). Nie zwei verwechselbare neue am selben Tag, nie eine Kollokation am Einführungstag ihres Kernworts.
//  - Wörter-Zahl-Modus (`cfg.cnt`, Großpaket WT): unverändert – jedes Wort zählt 1, das ganze Kontingent neuer Wörter kommt.

export const MOVE_MAX = 3;
export const BACKLOG_BUDGETS = 1;
export const SPREAD_DAYS = 7;
/** Mindestens so viele neue Wörter je Lerntag (wenn das Tempo sie erlaubt); so viele behält auch der kurze Tag beim Verkleinern (`shrinkDayPlan`). */
export const MIN_NEW = 2;
/** Politur P2 (E3): mindestens dieser Anteil der Wörter-Zeit gehört den Wiederholungen. */
export const REVIEW_SHARE = 0.6;

/**
 * Mindestzahl neuer Wörter an einem Lerntag im Minuten-Modus: `MIN_NEW`, aber nie mehr als das Tempo und nie mehr, als in den Anteil passt,
 * der nicht den Wiederholungen gehört – bei sehr kurzer Wörter-Zeit (kurzer Tag) 1, damit an keinem Lerntag gar kein neues Wort kommt (Kap. 15).
 */
export function minNewFor(quota: number, budgetMs: number, nc: number): number {
  if (quota <= 0) return 0;
  const fit = nc > 0 ? Math.floor(((1 - REVIEW_SHARE) * budgetMs) / nc) : MIN_NEW;
  return Math.min(quota, Math.max(1, Math.min(MIN_NEW, fit)));
}

/** So viel der Wörter-Zeit dürfen die Wiederholungen belegen: alles bis auf den Platz der Mindestzahl neuer Wörter, nie unter `REVIEW_SHARE`. */
export function reviewCapMs(quota: number, budgetMs: number, nc: number): number {
  return Math.max(REVIEW_SHARE * budgetMs, budgetMs - minNewFor(quota, budgetMs, nc) * nc);
}

/**
 * Neue Wörter eines Lerntags im Minuten-Modus (eine Regel für Tagesplan und Vorschau, domain/overview.ts): was nach den Wiederholungen
 * (`reviewMs`) übrig bleibt, mindestens `minNewFor`, höchstens das Tempo `quota`.
 */
export function freshFor(x: { quota: number; budgetMs: number; reviewMs: number; nc: number }): number {
  if (x.quota <= 0) return 0;
  const room = Math.max(0, x.budgetMs - x.reviewMs);
  return Math.min(x.quota, Math.max(minNewFor(x.quota, x.budgetMs, x.nc), x.nc > 0 ? Math.floor(room / x.nc) : 0));
}
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

/** Der erste Abruf nach der Einführung gilt so viele Lerntage als „immer im Plan“ (danach ordnet ihn die Gefährdung ohnehin nach vorn). */
export const FIRST_RECALL_DAYS = 3;

/**
 * Steht der erste Abruf nach dem Einführungstag noch aus („gestern gelernt, heute zum ersten Mal wieder“)? Eingeführt in den letzten
 * `FIRST_RECALL_DAYS` Lerntagen vor `day` und seither nicht gebucht. Diese Abrufe stehen immer im Tagesplan und kommen zuerst: ohne sie ist
 * das neue Wort nach zwei Tagen wieder weg. Übernommene Wörter (älterer Einführungstag) fallen nicht darunter.
 */
export function firstRecallOpen(l: Pick<Lex, 'intro' | 'day'>, day: string): boolean {
  return l.intro !== null && l.intro < day && daysBetween(l.intro, day) <= FIRST_RECALL_DAYS && (l.day === null || l.day <= l.intro);
}

/** Minuten für ein neues Lexem: Einführung + Schritt A + Schritt B. */
export function newCostMs(med: FormStats): number {
  return formMs('intro', med) + formMs('gap_hint', med) + formMs('gap', med);
}

export function buildDayPlan(cat: Catalog, nowMs: number, cfg: VocabCfg, med: FormStats): { plan: DayPlan; moves: Move[] } {
  const day = dayKey(nowMs);
  // Großpaket WT (Emrah 10.11.2026): mit Tagesziel in Wörtern (`cfg.cnt`) zählt jedes Wort im Plan 1 statt seiner Minuten; die Zeit bleibt Notbremse
  // (`cfg.min`, im Lauf). Die Bremse „unter 20 Minuten höchstens 5 neue“ gilt dann nicht.
  const byCount = (cfg.cnt ?? 0) > 0;
  const costOf = (f: Form): number => (byCount ? 1 : formMs(f, med));
  const budgetMs = byCount ? (cfg.cnt as number) : cfg.min * 60_000;
  type Due = { path: string; lex: Lex; track: TrackKey; form: Form; ms: number; r: number; first: boolean };
  const due: Due[] = [];
  let introducedToday = 0;
  for (const it of cat.items()) {
    if (it.lex.intro === day) introducedToday++;
    if (it.lex.day === day) continue; // heute schon gebucht
    if (cat.rests(it.path)) continue; // Paar-Regel (M14)
    const d = dueOn(it.lex, day, it.av);
    if (d) due.push({ path: it.path, lex: it.lex, ...d, ms: costOf(d.form), r: danger(it.lex, nowMs), first: firstRecallOpen(it.lex, day) });
  }
  const mustOf = (x: Due) => (x.lex.pri === 'core' || x.lex.mv >= MOVE_MAX ? 0 : 1);
  // Der erste Abruf nach dem Einführungstag zuerst (E3: „Abrufe für gestern eingeführte Wörter immer“), dann Kernwörter, dann nach Gefährdung.
  due.sort((a, b) => Number(b.first) - Number(a.first) || mustOf(a) - mustOf(b) || a.r - b.r || a.path.localeCompare(b.path));

  const quota = Math.max(0, cfg.newPerDay - introducedToday);
  const nc = byCount ? 1 : newCostMs(med);
  // Wörter-Zahl-Modus: das ganze Kontingent hat Platz (wie bisher). Minuten-Modus: nur die Mindestzahl ist reserviert, der Rest gehört den Wiederholungen.
  const minNew = byCount ? quota : minNewFor(quota, budgetMs, nc);
  // Kurzer Tag (2A, learning-scientist 6): Rückstand höchstens ein Tagesbudget, nichts verschieben, nichts vorziehen (wie `shrinkDayPlan`).
  const short = cfg.short === true;
  const cap = byCount ? (short ? 1 : BACKLOG_BUDGETS) * budgetMs - minNew * nc : reviewCapMs(quota, budgetMs, nc);
  const taken: Due[] = [];
  const rest: Due[] = [];
  let used = 0;
  for (const x of due) {
    // Erste Abrufe stehen immer im Plan (am kurzen Tag gilt auch für sie die Zeit).
    if ((x.first && !short) || used + x.ms <= Math.max(cap, x.ms) || taken.length === 0) {
      taken.push(x);
      used += x.ms;
    } else rest.push(x);
  }
  // Rückstand verteilen: nur Randwörter, je höchstens 3-mal.
  const moves: Move[] = [];
  const load = loadByDay(cat, med);
  for (const x of rest) {
    if (short || mustOf(x) === 0) continue;
    const sib = cat.siblingOffsets(x.path, day);
    const off = pickDay({ lo: 1, hi: SPREAD_DAYS, load: (i) => load.get(addDays(day, i)) ?? 0, siblings: sib, seed: `${x.path}|mv|${x.lex.mv}|${day}` });
    const to = addDays(day, off);
    load.set(to, (load.get(to) ?? 0) + x.ms / 60_000);
    moves.push({ path: x.path, track: x.track, to });
  }
  // Neue Lexeme.
  const nFresh = byCount ? (quota === 0 ? 0 : Math.min(quota, Math.max(minNew, Math.floor(Math.max(0, budgetMs - used) / nc)))) : freshFor({ quota, budgetMs, reviewMs: used, nc });
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
  if (!short && total < budgetMs * AHEAD_FILL) {
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
      const ms = costOf(form);
      if (total + ms > budgetMs) break;
      ahead.push({ path: it.path, lex: it.lex, track, form, ms, r: 1, first: false });
      total += ms;
    }
  }
  const plan: PlanEntry[] = [...taken.map((x): PlanEntry => [x.path, x.track, x.form]), ...ahead.map((x): PlanEntry => [x.path, x.track, x.form]), ...fresh.map((p): PlanEntry => [p, 'n', 'intro'])];
  // Minuten immer als echte Schätzung (Anzeige), auch im Wörter-Modus.
  const estMs = byCount ? [...taken, ...ahead].reduce((a, x) => a + formMs(x.form, med), 0) + fresh.length * newCostMs(med) : total;
  const minutes = Math.round((estMs / 60_000) * 10) / 10;
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

/** Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): Wörter-Minuten des verkürzten Tagesplans. */
export const SHORT_DAY_MIN = 5;

/**
 * Kurzer Tag: den eingefrorenen Plan von heute verkleinern (rein). Behalten werden die ersten fälligen Einträge (gefährdetste zuerst, wie
 * eingefroren) so weit, wie `targetMin` reicht, und höchstens `MIN_NEW` neue. Was wegfällt, bleibt fällig (es wird nichts verschoben) und
 * kommt am nächsten Lerntag mit (die gefährdetsten zuerst); nicht eingeführte neue Wörter bleiben neu. Minuten je Eintrag wie im Plan gemittelt. `null`, wenn der Plan
 * schon klein genug ist.
 */
export function shrinkDayPlan(p: DayPlan, targetMin: number): DayPlan | null {
  if (!p.plan.length || p.min <= targetMin) return null;
  const per = p.min / p.plan.length;
  const fresh = p.plan.filter((e) => e[1] === 'n').slice(0, MIN_NEW);
  const old = p.plan.filter((e) => e[1] !== 'n');
  const room = Math.max(0, targetMin - fresh.length * per);
  const keepOld = old.length ? Math.max(1, Math.min(old.length, Math.floor(room / per))) : 0;
  const kept = [...old.slice(0, keepOld), ...fresh];
  if (kept.length >= p.plan.length) return null;
  const due = Math.min(p.due, keepOld);
  // Weggefallene Wiederholungen kommen am nächsten Lerntag mit (learning-scientist 3): die Verteilung `sp` der Startkarte zählt sie dort.
  const dropped = old.length - keepOld;
  const tomorrow = addDays(p.d, 1);
  const sp = new Map<string, number>(p.sp ?? []);
  if (dropped > 0) sp.set(tomorrow, (sp.get(tomorrow) ?? 0) + dropped);
  const spList = [...sp.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 8);
  return {
    ...p,
    ...(spList.length ? { sp: spList } : {}),
    plan: kept,
    min: Math.round(kept.length * per * 10) / 10,
    due,
    ahead: Math.max(0, keepOld - due),
    fresh: fresh.length,
    why: `${p.why} · short day`.slice(0, 200),
  };
}
