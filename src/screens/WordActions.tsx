import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { saveCards, useCoach } from '../coach/store';
import { bankCard, hiddenCard, markedKnown } from '../coach/vocab';
import { AddToTraining } from './TranslateSheet';

// Aktionen am einzelnen Wort (Wort-Blatt): als bekannt markieren, nicht mehr üben, rückgängig.
// Gespeichert wird über saveCards, die Karte bleibt immer erhalten (nur `hide` und die Planung ändern sich).

export function WordActions({ id }: { id: string }) {
  const { t } = useT();
  const rec = useCoach((s) => s.cards.get(id));

  if (rec?.hide === 1) {
    return (
      <div className="w-full" data-testid="word-hidden">
        <p className="text-sm text-muted">{t('mwHiddenNote')}</p>
        <div className="mt-3">
          <Button
            variant="secondary"
            icon="undo"
            onClick={() => {
              void saveCards([[id, hiddenCard(rec, false)]]);
              toast(t('mwToastUnhide'));
            }}
            data-testid="word-unhide"
          >
            {t('mwActUnhide')}
          </Button>
        </div>
      </div>
    );
  }

  const canKnow = !rec || rec.f.state === 0 || rec.lv < 3;
  return (
    <>
      <AddToTraining id={id} />
      {canKnow && (
        <Button
          variant="secondary"
          icon="check"
          onClick={() => {
            void saveCards([[id, rec ? markedKnown(rec, Date.now()) : bankCard(Date.now(), { known: true })]]);
            toast(t('mwToastKnown'));
          }}
          data-testid="word-known"
        >
          {t('mwActKnown')}
        </Button>
      )}
      <Button
        variant="ghost"
        icon="eyeOff"
        onClick={() => {
          void saveCards([[id, rec ? hiddenCard(rec, true) : bankCard(Date.now(), { hide: true })]]);
          toast(t('mwToastHide'));
        }}
        data-testid="word-hide"
      >
        {t('mwActHide')}
      </Button>
    </>
  );
}
