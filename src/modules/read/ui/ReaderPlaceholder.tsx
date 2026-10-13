import { Button, useNav, useT } from '../sharedUi';
import type { ScreenProps } from '../sharedUi';

// Platzhalter für den Leser (Seite `readArticle`). Paket L4 ersetzt diese Datei in index.ts durch `ReaderScreen` (ui/reader/*).
export function ReaderPlaceholder({ route }: ScreenProps<'readArticle'>) {
  const { t } = useT();
  const back = useNav((s) => s.back);
  return (
    <div className="mx-auto flex w-full max-w-[47.5rem] flex-col gap-4 py-6" data-testid="read-article-placeholder" data-id={route.id}>
      <h1 className="m-0 text-2xl font-bold">{t('rdPlaceholderTitle')}</h1>
      <p className="m-0 text-sm text-muted">{t('rdPlaceholderBody')}</p>
      <div>
        <Button icon="arrowLeft" onClick={() => back()} data-testid="read-article-back">
          {t('rdBack')}
        </Button>
      </div>
    </div>
  );
}
