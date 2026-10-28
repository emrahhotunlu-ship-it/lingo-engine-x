import { useLive } from '../../data/live';
import { currentDevice, dkOk } from '../../domain/dictation/dk';
import { useT } from '../../i18n';
import { useSplitLayout } from '../../platform/input';
import { Button } from '../Button';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.1, Konzept 6.1): Hinweiszeile über dem Antwortfeld einer
// Sprechaufgabe, nur am Laptop (mindestens 1024 px und Tastatur). Genau eine von zwei Zeilen: vor einer erfolgreichen
// Diktat-Probe auf diesem Betriebssystem „Am Laptop tippst du …“, danach die Tasten fürs Diktat. „Am Handy sprechen“
// (nur in der Pflicht-Runde) wirkt wie „Pause, später weiter“. Zählt nicht für F1.

export function DictationHint({ onPhone }: { onPhone?: (() => void) | undefined }) {
  const { t } = useT();
  const split = useSplitLayout();
  const raw = useLive((s) => s.docs['app/profile']?.dk);
  if (!split) return null;
  const ok = dkOk(raw, currentDevice()?.os ?? null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="dictation-hint" data-state={ok ? 'dictate' : 'type'}>
      {/* Gestaltet wie `HintLine` (§4.3), eigene Kennung: Die Tipp-Zeile der Übung bleibt eindeutig. */}
      <p className="lx-t-support text-hint-text" data-testid="dictation-hint-line" role="note">
        {t(ok ? 'dkHintDictate' : 'dkHintType')}
      </p>
      {onPhone && (
        <Button variant="quiet" onClick={onPhone} data-testid="speak-on-phone">
          {t('dkPhone')}
        </Button>
      )}
    </div>
  );
}
