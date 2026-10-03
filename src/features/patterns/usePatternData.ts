import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { countWeeks, mergeHistory, recentWeeks, weekFocus, type FocusPoint, type PatternsDoc } from '../../domain/patterns/patterns';
import type { Mistake } from '../../domain/patterns/mistakes';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { loadPatternData, syncHistory, usePatternsRun } from './store';

// Muster, Fehler und Wochenfokus für eine Ansicht: einmal lesen, solange sie offen ist (kein Abo),
// den Verlauf lokal nachzählen (ohne KI) und nur bei Änderung speichern. Nach einem neuen
// Erkennen gilt das frische Dokument aus dem Lauf.

export type PatternView = {
  status: 'loading' | 'ready' | 'error';
  doc: PatternsDoc | null;
  mistakes: Mistake[];
  focus: FocusPoint[];
};

export function usePatternData(enabled = true): PatternView {
  const db = useCapabilities((s) => s.db);
  const today = useClock((s) => s.today);
  const last = usePatternsRun((s) => s.last);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; doc: PatternsDoc | null; mistakes: Mistake[] }>({
    status: 'loading',
    doc: null,
    mistakes: [],
  });

  useEffect(() => {
    if (!enabled || db !== 'ready') return;
    const handle = getDb();
    if (!handle) return;
    let alive = true;
    loadPatternData(handle).then(
      (d) => {
        if (!alive) return;
        setState({ status: 'ready', doc: d.doc, mistakes: d.mistakes });
        if (d.doc?.items.length) void syncHistory(d.mistakes, d.doc.items, today);
      },
      (err: unknown) => {
        logWarn('patterns:load', err);
        if (alive) setState((s) => ({ ...s, status: 'error' }));
      },
    );
    return () => {
      alive = false;
    };
  }, [enabled, db, today]);

  const base = last && (!state.doc || last.t >= state.doc.t) ? last : state.doc;
  const doc = useMemo<PatternsDoc | null>(() => {
    if (!base || !base.items.length || state.status !== 'ready') return base;
    // Frisch gezählte Wochen dazu (Anzeige sofort, gespeichert wird im Hintergrund).
    return { ...base, history: mergeHistory(base.history, countWeeks(state.mistakes, base.items, recentWeeks(today, 4))) };
  }, [base, state.mistakes, state.status, today]);
  const focus = useMemo(() => weekFocus(doc, today), [doc, today]);
  return { status: state.status, doc, mistakes: state.mistakes, focus };
}
