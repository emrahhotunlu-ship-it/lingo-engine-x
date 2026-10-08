import { flags } from '../../../app/flags';
import { registerSlot } from '../../../app/slots';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { useC1CheckSheet } from './store';
import { useCheckCard } from './useCheck';

// Heute, unter „Extra“ (nach der Pflicht): die Karte des C1-Checks (Lernplattform 3.0 P40), nur im Check-Fenster (letzte 7 Tage des Monats), mit Programm,
// mindestens 21 Tage nach dem letzten Check und mit freier Form. Keine Pflicht. Der Check-Tag selbst kommt über den Tagesablauf (Schritt `c1check`
// mit „Heute nicht“). Ohne Angebot kommt nichts (keine Höhe). Schalter `flags.c1check`.

function CheckCardView() {
  const { t } = useT();
  const card = useCheckCard();
  const show = useC1CheckSheet((s) => s.show);
  if (!card) return null;
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="px-ck-card" data-testid="ck-card">
      <p className="lx-eyebrow">{t('pxCkCardEyebrow')}</p>
      <h2 id="px-ck-card" className="lx-t-answer tracking-tight">
        {t('pxCkCardTitle')}
      </h2>
      <p className="text-sm text-muted">{t('pxCkCardText')}</p>
      {card.touch && (
        <p className="text-sm text-muted" data-testid="ck-card-touch">
          {t('pxCkCardTouch')}
        </p>
      )}
      <div>
        <Button variant="secondary" onClick={() => show(null)} data-testid="ck-start">
          {t('pxCkCardStart')}
        </Button>
      </div>
    </section>
  );
}

registerSlot({ slot: 'today.extra', order: 15, enabled: () => flags.c1check, render: () => <CheckCardView /> });
