import { useLive } from '../../data/live';
import { currentDevice, dkOk } from '../../domain/dictation/dk';
import { useT } from '../../i18n';
import { useSplitLayout } from '../../platform/input';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.1, Konzept 6.1; Nora G2 Muss 1+2): die EINE Diktat-Aussage einer
// Sprechaufgabe am Laptop (mindestens 1024 px und Tastatur). Keine eigene Zeile über dem Feld: Der Text steht in der vorhandenen
// Tastenzeile des Rahmens (`keysHint`), nach erfolgreicher Probe mit der Diktat-Taste NUR des eigenen Betriebssystems, sonst
// „Laut sprechen: am Handy“. Am Handy (oder schmal) `null`: dann bleibt alles wie bisher. Zählt nicht für F1.

export type DictationDesk = { ok: boolean; keys: string };

export function useDictationDesk(): DictationDesk | null {
  const { t } = useT();
  const split = useSplitLayout();
  const raw = useLive((s) => s.docs['app/profile']?.dk);
  if (!split) return null;
  const os = currentDevice()?.os ?? null;
  const ok = dkOk(raw, os);
  return {
    ok,
    keys: t(!ok ? 'dkKeysLinePhone' : os === 'mac' ? 'dkKeysLineMac' : 'dkKeysLineWin'),
  };
}
