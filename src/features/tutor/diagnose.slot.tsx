import { useEffect } from 'react';
import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { DiagnoseCard } from './DiagnoseCard';
import { runDiagnose } from './diagnoseStore';

// Wochen-Diagnose (Lernplattform 3.0 P49, Schalter `flags.tutor.diagnose`):
// - Fortschritt › Grammatik: Karte „Häufigste Verwechslungen · 28 Tage“ (immer, ohne Claude) mit dem Block „Diagnose von Claude“ (nur mit `sample`).
// - Rundenende (`session.end`): der einzige automatische Auslöser (K-9: nur Rundenstart oder Rundenende, nie Render, Timer oder Snapshot). Die Komponente
//   zeichnet nichts; sie fragt einmal beim Einhängen des Rundenendes. `runDiagnose` entscheidet (Woche, Mindestmenge, Budget, Zustimmung, Beanspruchung).

function RoundEndTrigger() {
  useEffect(() => {
    void runDiagnose({ trigger: 'auto' });
  }, []);
  return null;
}

registerSlot({ slot: 'progress.grammar', order: 20, enabled: () => flags.tutor.diagnose, render: () => <DiagnoseCard /> });
registerSlot({ slot: 'session.end', order: 90, enabled: () => flags.tutor.diagnose, render: () => <RoundEndTrigger /> });
