import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { watchDoc } from '../../data/watch';
import { isoWeek } from '../../domain/date';
import { weekDocNew, weekThemePatch } from '../../domain/unit/weekWrite';
import { readWeekDoc, themeFor, weekTargets } from '../../domain/week';
import type { ThemeId, WeekDoc } from '../../domain/week/types';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';

// Wochenthema (plan.md §1.5, N11/N13; Prüfung M10) – EIN Abo auf `app/week` für die ganze App
// (gestartet von `ensureDay`, danach dauerhaft; ein Dokument, klein). Schreiben nur hier und nur
// laut data-guard (§8 00:35): `writer.transform`, `validateDoc` vorher, Patch aus dem rohen Dokument.
// Ist das Dokument ungültig (`ok === false`), gilt nur der Vorschlag und es gibt keinen Schreibweg.

type Doc = Record<string, unknown>;

type WeekDocState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  raw: Doc | null;
  ok: boolean;
  /** Optimistisch: gerade bestätigte Wahl (bis der Schnappschuss sie zeigt). */
  chosen: { wk: string; theme: ThemeId; by: 'auto' | 'user'; at: number } | null;
  saving: boolean;
  failed: boolean;
};

export const useWeekDoc = create<WeekDocState>(() => ({ status: 'idle', raw: null, ok: true, chosen: null, saving: false, failed: false }));

let stop: (() => void) | null = null;

/** Abo starten (einmal; weitere Aufrufe tun nichts). */
export function startWeekWatch(): void {
  if (stop) return;
  const db = getDb();
  if (!db) return;
  useWeekDoc.setState({ status: 'loading' });
  stop = watchDoc(
    db,
    'app/week',
    (w) => {
      const raw = w.exists ? (w.data ?? null) : null;
      const chosen = useWeekDoc.getState().chosen;
      // Die optimistische Wahl endet, sobald das Dokument sie trägt.
      const keep = chosen && !(raw && typeof raw.cur === 'object' && (raw.cur as Doc | null)?.wk === chosen.wk && (raw.cur as Doc | null)?.theme === chosen.theme);
      useWeekDoc.setState({ status: 'ready', raw, ok: w.ok, chosen: keep ? chosen : null });
    },
    () => useWeekDoc.setState({ status: 'error' }),
  );
}

/** Wochen-Dokument für die Domäne: ungültig → nur Vorschlag (leer), optimistische Wahl eingerechnet. */
export function weekDocOf(s: Pick<WeekDocState, 'raw' | 'ok' | 'chosen'>): WeekDoc {
  const base = s.ok ? readWeekDoc(s.raw) : readWeekDoc(null);
  if (!s.chosen) return base;
  const hist = (base.hist ?? []).filter((h) => h.wk !== s.chosen?.wk);
  if (base.cur && base.cur.wk !== s.chosen.wk && !hist.some((h) => h.wk === base.cur?.wk)) hist.push({ wk: base.cur.wk, theme: base.cur.theme, by: base.cur.by });
  return { ...base, cur: { ...s.chosen }, ...(hist.length ? { hist } : {}) };
}

export const weekDocNow = (): WeekDoc => weekDocOf(useWeekDoc.getState());

/** Ist das Wochen-Dokument geladen (oder endgültig nicht ladbar)? */
export const weekLoaded = (): boolean => {
  const st = useWeekDoc.getState().status;
  return st === 'ready' || st === 'error' || !getDb();
};

/**
 * Thema der Woche festlegen (Bestätigungskarte: „Passt“ = `auto`, „Anderes wählen“ = `user`).
 * Sofort sichtbar (optimistisch); geschrieben über `transform`. Liefert `false` ohne Schreibweg.
 */
export function chooseTheme(theme: ThemeId, by: 'auto' | 'user', day = useClock.getState().today): Promise<boolean> {
  const st = useWeekDoc.getState();
  const wk = isoWeek(day);
  const at = Date.now();
  if (!st.ok) {
    logWarn('week:theme', { code: 'invalid_document', message: 'app/week ungültig – Thema nur als Vorschlag' }, 'app/week');
    return Promise.resolve(false);
  }
  const choice = { wk, theme, by, at };
  useWeekDoc.setState({ chosen: choice, saving: true, failed: false });
  const writer = getWriter();
  if (!writer) {
    useWeekDoc.setState({ saving: false });
    return Promise.resolve(false);
  }
  const targets = weekTargets(themeFor(day, weekDocOf({ ...st, chosen: choice })).theme, { day });
  let invalid = false;
  return writer
    .transform('app/week', (cur) => {
      if (!cur) return { set: weekDocNew(choice, targets) };
      if (!validateDoc('app/week', cur).ok) {
        invalid = true;
        return null;
      }
      const p = weekThemePatch(cur, choice, targets);
      return p ? { update: p } : null;
    })
    .then(() => {
      if (invalid) logWarn('week:theme', { code: 'invalid_document', message: 'app/week ungültig – nicht überschrieben' }, 'app/week');
      useWeekDoc.setState({ saving: false, failed: invalid });
      return !invalid;
    })
    .catch((err: unknown) => {
      logError('week:theme', err, 'app/week');
      useWeekDoc.setState({ saving: false, failed: true });
      return false;
    });
}

/** Nur für Tests. */
export function resetWeekForTests(): void {
  stop?.();
  stop = null;
  useWeekDoc.setState({ status: 'idle', raw: null, ok: true, chosen: null, saving: false, failed: false });
}
