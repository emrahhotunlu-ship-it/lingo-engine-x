import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { fehlersaetzeDue, fixAll, fixToday } from '../../domain/metrics';
import { useToday } from '../today/state';
import { startUnitDuty } from '../unit/run';
import type { FocusApi } from '../../app/registry';

// Fehlersätze im Grammatik-Reiter (eine Quelle je Zahl, `domain/metrics/today`): alle fälligen, die Zahl des Starts (heute) und der Start selbst.
// Genutzt von der Zeile „Fehler korrigieren“ auf der Wurzel und „Deine Fehler“ im Kapitel-Detail (D5).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

export function useFix(): { nDue: number; nToday: number; start: (api: FocusApi) => void } {
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const plan = useToday((s) => s.plan);
  const fixOpen = useToday((s) => s.duties.items.some((d) => d.id === 'ch:u-again' && d.state === 'open'));
  const go = useNav((s) => s.go);
  const nDue = useMemo(() => fixAll(fehlersaetzeDue({ grammarDocs: docs, repairDoc, nowMs: now, today })), [docs, repairDoc, now, today]);
  // Genau die Zahl der Sätze, die der Start bringt (Schritt 4 von heute oder die freiwillige Runde).
  const nToday = fixToday({ plan, fixDue: nDue });
  const start = (api: FocusApi) => {
    // Schritt 4 von heute noch offen: Pflicht starten; sonst die freiwillige Runde mit derselben Grenze.
    if (fixOpen && startUnitDuty('ch:u-again', api)) return;
    go({ name: 'repairRound' });
  };
  return { nDue, nToday, start };
}
