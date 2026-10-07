import { useT } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

/** Rumpf für Arten, deren Oberfläche ein späteres Paket baut: nur im Entwicklungsmodus sichtbar (die Registry bietet sie im Build nie an). */
export function useStubUi(ctrl: C1Ctrl): C1Ui {
  const { t } = useT();
  return {
    prompt: (
      <p className="text-muted" data-testid="c1x-stub" data-kind={ctrl.item.kind}>
        {t('cxNotAvailable')}
      </p>
    ),
    answer: null,
  };
}
