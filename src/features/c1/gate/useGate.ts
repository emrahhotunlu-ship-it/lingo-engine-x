import { useMemo } from 'react';
import { useClock } from '../../../app/clock';
import { useLive } from '../../../data/live';
import { readC1 } from '../../../domain/c1/c1doc';
import { firstReadyGate, gateStatus, type GateStatus } from '../../../domain/c1/gate/trigger';
import { chapterState } from '../../../domain/c1/state';

// Stand der Kapitelprüfungen aus den Live-Daten (Lernplattform 3.0 P42): je Kapitel `gateStatus`, eine reine Funktion über Kapitelstand und
// `app/c1.gates`. Nichts wird gespeichert oder abgeleitet, was nicht aus den Dokumenten folgt.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

export function useGateStatuses(): GateStatus[] {
  const today = useClock((s) => s.today);
  const nowMs = useClock((s) => s.now);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const c1 = useLive((s) => s.docs['app/c1']);
  return useMemo(() => {
    const gates = readC1(c1).gates;
    return chapterState({ docs, today, nowMs }).chapters.map((chapter) => gateStatus({ chapter, docs, gates, today, nowMs }));
  }, [docs, c1, today, nowMs]);
}

/** Die Prüfung, die jetzt anbietbar ist (höchstens eine). */
export function useReadyGate(): Extract<GateStatus, { state: 'ready' }> | null {
  const statuses = useGateStatuses();
  return useMemo(() => firstReadyGate(statuses), [statuses]);
}
