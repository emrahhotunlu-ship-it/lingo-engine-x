import { THEME_ORDER, isThemeId, themeById } from '../../content/nb/themes';
import { isoWeek } from '../date';
import { hintOf, readHint } from './hint';
import type { ThemeHint, ThemeId, WeekCur, WeekDoc, WeekHist, WeekStoredTargets, WeekTheme } from './types';

// Wochenthema (Plan §1.5, N11, N17; Prüfung M10): lesen, vorschlagen, bestätigen. Rein und getestet.

export { isoWeek };

export const HIST_MAX = 26;
const WK_RE = /^\d{4}-W\d{2}$/;

type Obj = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const by = (v: unknown): 'auto' | 'user' => (v === 'user' ? 'user' : 'auto');
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** `app/week` tolerant lesen (fehlerhafte Einträge fallen weg, nichts wird erfunden). */
export function readWeekDoc(raw: unknown): WeekDoc {
  const d = obj(raw);
  const out: WeekDoc = { v: 1 };
  const c = obj(d.cur);
  if (typeof c.wk === 'string' && WK_RE.test(c.wk) && isThemeId(c.theme)) {
    const cur: WeekCur = { wk: c.wk, theme: c.theme, by: by(c.by) };
    if (typeof c.at === 'number' && Number.isFinite(c.at)) cur.at = c.at;
    out.cur = cur;
  }
  if (Array.isArray(d.hist)) {
    const hist: WeekHist[] = [];
    for (const h of d.hist) {
      const e = obj(h);
      if (typeof e.wk === 'string' && WK_RE.test(e.wk) && isThemeId(e.theme)) hist.push({ wk: e.wk, theme: e.theme, by: by(e.by) });
    }
    if (hist.length) out.hist = hist.slice(-HIST_MAX);
  }
  const hint = readHint(d.hint);
  if (hint) out.hint = hint;
  const t = obj(d.targets);
  if (typeof t.wk === 'string' && WK_RE.test(t.wk)) {
    const targets: WeekStoredTargets = {
      wk: t.wk,
      traps: Array.isArray(t.traps) ? t.traps.map((x) => str(x, 60)).filter(Boolean).slice(0, 3) : [],
      tool: str(t.tool, 60),
    };
    out.targets = targets;
  }
  return out;
}

/** Alle gespeicherten Wochen (hist + cur), nach Woche sortiert, je Woche der letzte Eintrag. */
function weeksOf(week: WeekDoc | null | undefined): WeekHist[] {
  const m = new Map<string, WeekHist>();
  for (const h of week?.hist ?? []) m.set(h.wk, h);
  if (week?.cur) m.set(week.cur.wk, { wk: week.cur.wk, theme: week.cur.theme, by: week.cur.by });
  return [...m.values()].sort((a, b) => (a.wk < b.wk ? -1 : a.wk > b.wk ? 1 : 0));
}

/** Gespeichertes Thema einer Kalenderwoche (oder null). */
export function storedTheme(week: WeekDoc | null | undefined, wk: string): WeekHist | null {
  return weeksOf(week).find((h) => h.wk === wk) ?? null;
}

/**
 * Vorschlag für eine Woche: Termin > das nächste Thema der Reihenfolge nach dem zuletzt
 * gespeicherten (vor dieser Woche). Nach dem 16. Thema beginnt der zweite Durchgang.
 */
export function suggestTheme(week: WeekDoc | null | undefined, wk: string, hint?: ThemeHint): ThemeId {
  if (hint?.meeting && isThemeId(hint.meeting)) return hint.meeting;
  const before = weeksOf(week).filter((h) => h.wk < wk);
  const last = before[before.length - 1];
  if (!last) return THEME_ORDER[0] ?? 't01';
  const i = THEME_ORDER.indexOf(last.theme);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length] ?? 't01';
}

export type ThemePick = {
  wk: string;
  id: ThemeId;
  theme: WeekTheme;
  by: 'auto' | 'user';
  /** true: in `app/week` gespeichert; false: nur Vorschlag (noch zu bestätigen). */
  stored: boolean;
};

/**
 * Das Thema, das an einem Lerntag gilt. Nie leer (M10): Ohne gespeicherte Wahl gilt der Vorschlag
 * mit `by: 'auto'`, bis Emrah ihn auf der Bestätigungskarte bestätigt oder ändert.
 */
export function themeFor(day: string, week: WeekDoc | null | undefined, hint?: ThemeHint): ThemePick {
  const wk = isoWeek(day);
  const s = storedTheme(week, wk);
  // N17: ohne ausdrücklichen Hinweis gilt der gespeicherte Termin-Hinweis dieser Woche.
  const id = s ? s.theme : suggestTheme(week, wk, hint ?? hintOf(week, wk));
  const theme = themeById(id) ?? themeById('t01');
  if (!theme) throw new Error('content/nb/themes leer');
  return { wk, id: theme.id, theme, by: s ? s.by : 'auto', stored: !!s };
}

/** Bestätigungskarte: am ersten Lerntag der Kalenderwoche, solange kein Thema gespeichert ist (M10). */
export function needsThemeConfirm(day: string, week: WeekDoc | null | undefined): boolean {
  return !storedTheme(week, isoWeek(day));
}

/**
 * Neues `app/week` mit bestätigtem Thema (für `writer.transform`, P1). Die bisherige Woche wandert
 * nach `hist` (≤ 26), andere Felder bleiben unverändert.
 */
export function withTheme(doc: WeekDoc | null | undefined, wk: string, theme: ThemeId, choice: 'auto' | 'user', at: number): WeekDoc {
  const base = doc ?? { v: 1 };
  const hist = (base.hist ?? []).filter((h) => h.wk !== wk);
  if (base.cur && base.cur.wk !== wk) {
    const prev = base.cur;
    if (!hist.some((h) => h.wk === prev.wk)) hist.push({ wk: prev.wk, theme: prev.theme, by: prev.by });
  }
  hist.sort((a, b) => (a.wk < b.wk ? -1 : a.wk > b.wk ? 1 : 0));
  const next: WeekDoc = { ...base, v: 1, cur: { wk, theme, by: choice, at } };
  if (hist.length) next.hist = hist.slice(-HIST_MAX);
  else delete next.hist;
  return next;
}
