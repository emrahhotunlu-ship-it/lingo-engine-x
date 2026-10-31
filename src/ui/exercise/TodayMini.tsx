import { dutyLabel } from '../../features/learn/ui';
import { firstOpenDuty, useToday } from '../../features/today/state';
import { useT } from '../../i18n';
import { VStateList, type VStep } from '../v';

// Kontextspalte der Übung am Laptop, Block „Heute“ (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau desk.js `dayMini`, L2/L3):
// die Blöcke des Tages ohne Knöpfe – erledigt ✓, der laufende Block „läuft“, der Rest offen. Nur lesen, nie planen (stufe1c-plan §5).
// Ohne Tagesplan (oder mit nur einem Block) steht nichts da: dann sagt der Balken oben schon alles.

export function TodayMini() {
  const { t } = useT();
  const duties = useToday((s) => s.duties);
  if (duties.total < 2) return null;
  const now = firstOpenDuty({ duties });
  const steps: VStep[] = duties.items.map((d) => ({
    id: d.id,
    name: dutyLabel(d.id, t),
    state: d.state === 'done' ? 'done' : d.id === now ? 'run' : 'open',
    ...(d.id === now ? { meta: t('vStepRunMeta') } : {}),
  }));
  return (
    <section className="lx-vu-ctx" data-testid="ex-today">
      <h3 className="lx-vu-ctx-h">{t('vuSideToday')}</h3>
      <VStateList steps={steps} label={t('vRingBlocks')} stateLabels={{ done: t('vStepDone'), run: t('vStepRun'), open: t('vStepOpen') }} />
    </section>
  );
}
