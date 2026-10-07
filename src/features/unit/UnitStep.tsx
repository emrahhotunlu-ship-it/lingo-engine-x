import { useLayoutEffect } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import type { ScreenProps } from '../../app/registry';
import { unitDone } from '../../app/unit/done';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { ExerciseTop } from '../learn/ui';
import { useToday } from '../today/state';
import { AgainScreen } from '../repair/again/AgainScreen';
import { startAgain, useAgain } from '../repair/again/session';

// Eigene Ersatzschritte der Tageseinheit (Route `unitStep`), solange die Anbieter der Pakete fehlen
// oder nicht machbar sind – ohne KI erfüllbar (G6, M4):
// - `again` (Schritt 4 „Fehler korrigieren“): die eine Fehlerschlange, Satz für Satz (`AgainScreen`); der alte Ersatzschritt mit
//   einem Textfeld für mehrere Sätze ist entfernt (Lernplattform 2.0 §5.7).
// - `check`: Wochen-Check ohne genug Stoff – kurzer Hinweis, der Block zählt.

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

function leave(t: T): void {
  toast(t('nbHeuteSaved'));
  useNav.getState().go({ name: 'today' });
}

function CheckEmpty({ block }: { block: number }) {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-4" data-testid="unit-check-empty">
      <p className="text-base">{t('nbHeuteCheckEmpty')}</p>
      <Button variant="primary" size="lg" className="w-full" onClick={() => unitDone(block === 3 ? 3 : 3)} data-testid="unit-check-empty-ok">
        {t('nbHeuteCheckEmptyOk')}
      </Button>
    </section>
  );
}

/** Ersatzweg zu Schritt 4: startet die Schlange, falls sie noch nicht läuft, und zeigt den einen Bildschirm. */
function AgainRoute() {
  useLayoutEffect(() => {
    if (!useAgain.getState().active) startAgain({ day: useClock.getState().today, block: 5 });
  }, []);
  return <AgainScreen />;
}

export function UnitStepScreen({ route }: ScreenProps<'unitStep'>) {
  const { t } = useT();
  const total = useToday((s) => s.duties.total);
  const done = useToday((s) => s.duties.done);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-4 sm:py-8" data-testid="unit-step" data-step={route.step}>
      <ExerciseTop onClose={() => leave(t)} closeLabel={t('nbHeuteClose')} closeTestId="unit-close" progress={total ? { n: Math.min(total, done + 1), total } : null} ctx="duty" />
      <StepBoundary resetKey={`${route.step}-${route.block}`} scope="unitStep" onSkip={() => leave(t)}>
        {route.step === 'again' ? <AgainRoute /> : <CheckEmpty block={route.block} />}
      </StepBoundary>
    </div>
  );
}
