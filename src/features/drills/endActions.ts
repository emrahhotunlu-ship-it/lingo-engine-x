import { leaveBack, useNav, type Route } from '../../app/nav';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { dutyLabel } from '../learn/ui';
import { startDuty } from '../learn/flow';
import { firstOpenDuty, useToday } from '../today/state';

// Hauptknopf und ruhiger zweiter Weg am Ende einer Runde (Diktat, Lückenjagd, Satzbau, Wochen-Check): „Weiter: nächster
// Pflichtschritt“, sonst der Weg zurück dorthin, woher man kam (UX-Beratung Nr. 3). Ersetzt `SummaryActions` für das Rundenende
// im Übungsgerüst (`SessionEnd`).

/** Beschriftung des Rückwegs nach der Herkunft. */
const ORIGIN_LABEL: Partial<Record<Route['name'], MessageKey>> = { today: 'sumBack', learn: 'lrBackToLearn', overview: 'ckBack', apply: 'lrBackToApply' };

export type EndActions = { main: { label: string; run: () => void }; secondary?: { label: string; run: () => void } };

export function useEndActions(o: { onBack: () => void; backLabel?: string; backTo?: Route; /** Pflichtschritt der Tageseinheit: der Hauptknopf meldet ihn als erledigt. */ onDutyDone?: (() => void) | null }): EndActions {
  const { t } = useT();
  const api = useHiddenInput();
  const duties = useToday((x) => x.duties);
  const ready = useToday((x) => x.ready);
  const go = useNav((s) => s.go);
  const origin = useNav((s) => s.stack[s.stack.length - 1] ?? null);
  const label = origin ? t(ORIGIN_LABEL[origin.name] ?? 'lrBack') : (o.backLabel ?? t('sumBack'));
  const back = (): void => {
    const hasOrigin = useNav.getState().stack.length > 0;
    if (!hasOrigin && o.backTo) {
      o.onBack();
      go(o.backTo);
      return;
    }
    leaveBack(o.onBack);
  };
  if (o.onDutyDone) return { main: { label: t('nbShNext'), run: o.onDutyDone } };
  const next = ready ? firstOpenDuty({ duties }) : null;
  if (!next) return { main: { label, run: back } };
  return {
    main: {
      label: t('lrNextDuty', { step: dutyLabel(next, t) }),
      run: () => {
        o.onBack();
        startDuty(next, api);
      },
    },
    secondary: { label, run: back },
  };
}
