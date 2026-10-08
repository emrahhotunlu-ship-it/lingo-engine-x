import { useLayoutEffect } from 'react';
import { useHiddenInput } from '../../engine/HiddenInput';
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
import { skipCheckToday, useC1CheckSheet } from '../c1/check/store';
import { checkDayOf, continueUnit, unitNow } from './run';

// Eigene Ersatzschritte der Tageseinheit (Route `unitStep`), solange die Anbieter der Pakete fehlen
// oder nicht machbar sind – ohne KI erfüllbar (G6, M4):
// - `again` (Schritt 4 „Fehler korrigieren“): die eine Fehlerschlange, Satz für Satz (`AgainScreen`); der alte Ersatzschritt mit
//   einem Textfeld für mehrere Sätze ist entfernt (Lernplattform 2.0 §5.7).
// - `check`: Wochen-Check ohne genug Stoff – kurzer Hinweis, der Block zählt.
// - `c1check`: Check-Tag (Lernplattform 3.0 P40, Plan `u.c1`): „C1-Check starten“ (ersetzt Schritt 2 und 3) oder „Heute nicht“ (normale Schritte).

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

/** Check-Tag: die Wahl zwischen C1-Check und den normalen Schritten. Nach dem gespeicherten Check: „Weiter“ zum nächsten Schritt. */
function C1CheckDay() {
  const { t } = useT();
  const api = useHiddenInput();
  const show = useC1CheckSheet((s) => s.show);
  // Neu gelesen bei jeder Änderung der Pflicht (der Check markiert Schritt 2 und 3 als erledigt).
  useToday((s) => s.duties.done);
  const u = unitNow();
  const duties = u ? checkDayOf(u) : null;
  if (!u || !duties) {
    return (
      <section className="flex flex-col gap-4" data-testid="unit-c1check-done">
        <p className="text-base">{t('pxCkDayDone')}</p>
        <Button variant="primary" size="lg" className="w-full" onClick={() => continueUnit(api)} data-testid="unit-c1check-next">
          {t('pxCkDayNext')}
        </Button>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4" data-testid="unit-c1check">
      <h2 className="lx-t-answer tracking-tight">{t('pxCkDayTitle')}</h2>
      <p className="text-base leading-relaxed">{t('pxCkDayText')}</p>
      <Button variant="primary" size="lg" className="w-full" onClick={() => show({ day: u.day, duties })} data-testid="unit-c1check-start">
        {t('pxCkCardStart')}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          skipCheckToday(u.day);
          toast(t('pxCkSkipped'));
          continueUnit(api);
        }}
        data-testid="unit-c1check-skip"
      >
        {t('pxCkCardSkip')}
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
        {route.step === 'again' ? <AgainRoute /> : route.step === 'c1check' ? <C1CheckDay /> : <CheckEmpty block={route.block} />}
      </StepBoundary>
    </div>
  );
}
