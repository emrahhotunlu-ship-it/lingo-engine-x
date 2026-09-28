import { HIST_MAX } from '../week/theme';
import type { ThemeId, WeekTargets } from '../week/types';

// Schreibweg `app/week` (plan.md §4.10, data-guard §8 00:35, verbindlich):
// - nur in `writer.transform` nach `validateDoc('app/week', cur).ok` (sonst kein Schreibweg),
// - Patch NUR der geänderten Felder, gerechnet auf dem ROHEN Dokument – nie auf der normalisierten
//   Ausgabe von `readWeekDoc`/`withTheme` (die kürzt und verwirft Unbekanntes),
// - unbekannte `hist`-Einträge bleiben, `v` wird nie verringert, `cur.at` ist eine Zahl (ms).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : null);
const WK_RE = /^\d{4}-W\d{2}$/;

export type WeekChoice = { wk: string; theme: ThemeId; by: 'auto' | 'user'; at: number };

/** Ein gültiger, bekannter Verlaufseintrag (sonst bleibt er unangetastet stehen). */
const knownHist = (h: unknown): boolean => {
  const o = obj(h);
  return !!o && typeof o.wk === 'string' && WK_RE.test(o.wk);
};

/**
 * Patch für „Thema der Woche festlegen“. `null` = nichts zu schreiben (gleiche Wahl steht schon).
 * Die bisherige Woche wandert nach `hist` (≤ 26 bekannte Einträge; unbekannte bleiben stehen).
 */
export function weekThemePatch(raw: Readonly<Doc> | null | undefined, c: WeekChoice, targets?: WeekTargets | null): Doc | null {
  const d = raw ?? {};
  const cur = obj(d.cur);
  const patch: Doc = {};
  if (!(cur && cur.wk === c.wk && cur.theme === c.theme && cur.by === c.by && typeof cur.at === 'number')) {
    patch.cur = { wk: c.wk, theme: c.theme, by: c.by, at: c.at };
  }
  if (cur && typeof cur.wk === 'string' && WK_RE.test(cur.wk) && cur.wk !== c.wk) {
    const hist: unknown[] = Array.isArray(d.hist) ? [...(d.hist as unknown[])] : [];
    if (!hist.some((h) => obj(h)?.wk === cur.wk)) {
      hist.push({ wk: cur.wk, theme: cur.theme, by: cur.by === 'user' ? 'user' : 'auto' });
      // Kürzen nur über bekannte Einträge (älteste zuerst); Unbekanntes bleibt.
      let known = hist.filter(knownHist).length;
      while (known > HIST_MAX) {
        const k = hist.findIndex(knownHist);
        if (k < 0) break;
        hist.splice(k, 1);
        known--;
      }
      patch.hist = hist;
    }
  }
  if (targets && targets.wk === c.wk) {
    const t = obj(d.targets);
    if (!t || t.wk !== c.wk) {
      const next: Doc = { wk: c.wk, traps: targets.traps.slice(0, 3), tool: targets.tool ?? '' };
      if (targets.preply) next.preply = targets.preply;
      patch.targets = next;
    }
  }
  if (typeof d.v !== 'number') patch.v = 1;
  return Object.keys(patch).length ? patch : null;
}

/** Neues Dokument (es gibt noch kein `app/week`). */
export function weekDocNew(c: WeekChoice, targets?: WeekTargets | null): Doc {
  return { v: 1, ...(weekThemePatch(null, c, targets) ?? {}) };
}
