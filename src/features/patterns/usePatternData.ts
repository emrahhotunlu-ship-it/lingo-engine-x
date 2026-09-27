import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { TOPICS } from '../../domain/content';
import { lastImport, preplyList } from '../../domain/preply/docs';
import { countWeeks, mergeHistory, recentWeeks, weekFocus, type FocusPoint, type PatternsDoc } from '../../domain/patterns/patterns';
import type { Mistake } from '../../domain/patterns/mistakes';
import { topicName } from '../../domain/progress/weekly';
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

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
const topicNames = (id: string) => (TOPIC_IDS.has(id) ? { de: topicName(id, 'de'), en: topicName(id, 'en') } : null);

export function usePatternData(enabled = true): PatternView {
  const db = useCapabilities((s) => s.db);
  const today = useClock((s) => s.today);
  const last = usePatternsRun((s) => s.last);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; doc: PatternsDoc | null; mistakes: Mistake[]; imp: ReturnType<typeof lastImport> }>({
    status: 'loading',
    doc: null,
    mistakes: [],
    imp: null,
  });

  useEffect(() => {
    if (!enabled || db !== 'ready') return;
    const handle = getDb();
    if (!handle) return;
    let alive = true;
    loadPatternData(handle).then(
      (d) => {
        if (!alive) return;
        setState({ status: 'ready', doc: d.doc, mistakes: d.mistakes, imp: lastImport(preplyList(d.preply)) });
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
  const focus = useMemo(() => weekFocus(doc, state.imp, today, topicNames), [doc, state.imp, today]);
  return { status: state.status, doc, mistakes: state.mistakes, focus };
}
