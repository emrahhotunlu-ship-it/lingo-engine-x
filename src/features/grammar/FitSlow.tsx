import { useT } from '../../i18n';
import { Button } from '../../ui/Button';

// Nach 8 s (quick): leise Zeile statt endlosem „Prüft …“, mit Ausweg ohne Zweitmeinung (lokales Urteil, nie als „nicht gewusst“ gebucht).
export function FitSlow({ phase, onSkip }: { phase: string; onSkip: () => void }) {
  const { t } = useT();
  if (phase !== 'slow') return null;
  return (
    <div className="flex flex-col items-start gap-1" data-testid="fit-slow">
      <p className="lx-t-support text-muted" role="status">
        {t('grFitSlow')}
      </p>
      <div className="-ml-4">
        <Button variant="ghost" onClick={onSkip} data-testid="fit-skip">
          {t('grFitSkip')}
        </Button>
      </div>
    </div>
  );
}
