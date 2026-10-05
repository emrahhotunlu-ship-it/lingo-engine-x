import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import type { DutyId } from '../../domain/plan/types';
import { unlockSpeech } from '../../platform/speech';
import { startSession } from '../vocab/session';
import { startGrammar } from '../grammar/session';
import { startDrill } from '../drills/session';
import { startUnitDuty } from '../unit/run';

// Pflichtpunkte starten – von der Heldenkarte auf „Heute" und aus jeder Pflicht-Zusammenfassung
// („Weiter: nächster Pflichtschritt", M11). Die Runden werden synchron im Klick gebaut, damit
// derselbe Handler am iPhone die Tastatur öffnen kann.

type FocusApi = { focusNow(): void; blur(): void };

export function startDuty(id: DutyId, api: FocusApi): void {
  const go = useNav.getState().go;
  // iPhone: Sprachausgabe nur in einer Nutzergeste freischalten.
  unlockSpeech();
  // Neubau (plan.md §1.5): Ist heute die Tageseinheit der Plan, startet jeder Pflichtpunkt seinen
  // Block (Anbieter oder Ersatz) – auch aus „Weiter: …“ einer Pflicht-Zusammenfassung.
  if ((id === 'review' || id.startsWith('ch:u-')) && startUnitDuty(id, api)) return;
  if (id === 'review') {
    const first = startSession('pflicht');
    if (first === 'typed') api.focusNow();
    go({ name: 'trainer', round: 'pflicht' });
    return;
  }
  if (id === 'lesson') {
    // Pläne vom Übergangstag können noch eine Lektion enthalten; den Kurs gibt es nicht mehr: Reiter „Grammatik“.
    api.blur();
    go({ name: 'learn' });
    return;
  }
  const ch = id.slice(3);
  const day = useClock.getState().today;
  if (ch === 'gram') {
    const first = startGrammar({ mode: 'duty', day });
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'grammarSession', mode: 'duty' });
    return;
  }
  if (ch === 'cloze' || ch === 'order') {
    const first = startDrill(ch, day);
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'drill', kind: ch, ctx: 'duty' });
  }
}
