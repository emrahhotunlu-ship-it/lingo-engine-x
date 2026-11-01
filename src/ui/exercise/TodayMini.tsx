import { dutyLabel } from '../../features/learn/ui';
import { firstOpenDuty, useToday } from '../../features/today/state';
import { useT } from '../../i18n';
import { VStateList, type VStep } from '../v';
import { useRunCtx } from './runCtx';

// Kontextspalte der Übung am Laptop, Block „Heute“ (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau desk.js `dayMini`, L2/L3):
// die Blöcke des Tages ohne Knöpfe – erledigt ✓, der laufende Block „läuft“, der Rest offen. Nur lesen, nie planen (stufe1c-plan §5).
// Ohne Tagesplan (oder mit nur einem Block) steht nichts da: dann sagt der Balken oben schon alles.

export function TodayMini() {
  const { t } = useT();
  const duties = useToday((s) => s.duties);
  const run = useRunCtx();
  if (duties.total < 2) return null;
  // „läuft“ nur in einer Pflicht-Runde: am gemeldeten Block, sonst am ersten offenen. In einer Extra-Runde läuft kein Pflichtblock.
  const now = run.ctx === 'duty' ? (run.duty ?? firstOpenDuty({ duties })) : null;
  // Der gemeldete Block läuft, bis seine Runde endet, auch wenn sein Zähler schon voll ist (Wörter: „Anwenden“ nach der letzten Karte; ux S5c #12).
  const live = run.ctx === 'duty' ? run.duty : null;
  const steps: VStep[] = duties.items.map((d) => {
    const state = d.id === live ? 'run' : d.state === 'done' ? 'done' : d.id === now ? 'run' : 'open';
    return { id: d.id, name: dutyLabel(d.id, t), state, ...(state === 'run' ? { meta: t('vStepRunMeta') } : {}) };
  });
  return (
    <section className="lx-vu-ctx" data-testid="ex-today">
      <h3 className="lx-vu-ctx-h">{t('vuSideToday')}</h3>
      <VStateList steps={steps} label={t('vRingBlocks')} stateLabels={{ done: t('vStepDone'), run: t('vStepRun'), open: t('vStepOpen') }} />
    </section>
  );
}
