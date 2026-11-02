import { lazy, Suspense } from 'react';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { useT } from '../../../i18n';
import { loadOverview } from '../../../modules/vocab/api';
import { Button, IconButton } from '../../../ui/Button';
import { HeroCard } from '../../../ui/HeroCard';
import { Icon } from '../../../ui/Icon';
import { Skeleton } from '../../../ui/Skeleton';
import { TabTitle } from '../../system/Chrome';
import { useToday } from '../../today/state';

// Reiter Wörter bei eingeschalteter Wörter-App (Emrah 02.11.2026: „schalte die neue Wörter-App einfach live“). Eine rote Linie (Kap. 2 Nr. 1):
// oben EIN Knopf für die Wörter von heute (dieselbe Runde wie auf Heute), erledigt ist Zustand statt Knopf (Kap. 2 Nr. 2); darunter die
// Übersicht der Wörter-App (Zahlen, 14 Tage, Behaltensrate, alle Wörter, Einstufung). Der alte Reiter bleibt der Rückweg (`vcfg.mod = 0`).

const Overview = lazy(() => loadOverview().then((m) => ({ default: m.Overview })));

export function VocabHome() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  // Dieselbe Quelle wie Heute: Pflicht „Wörter“ offen, erledigt oder (ohne Tagesplan) nicht da.
  const duty = useToday((s) => s.duties.items.find((d) => d.id === 'review')?.state ?? null);
  const done = duty !== null && duty !== 'open';
  return (
    <div className="mx-auto flex w-full max-w-[47.5rem] flex-col gap-6 py-6 sm:py-10" data-testid="vocab-home">
      <TabTitle title={t('nbWsTitle')} actions={<IconButton icon="plus" label={t('nbWsHAddLabel')} onClick={() => openSheet('add')} data-testid="vocab-add" />} />
      <HeroCard
        testId="vh-today"
        tone={done ? 'done' : 'default'}
        eyebrow={t('vmHomeEyebrow')}
        action={
          done ? (
            <Button variant="secondary" size="lg" onClick={() => go({ name: 'vlearn', kind: 'more5' })} data-testid="vh-more">
              {t('vmHomeMore')}
            </Button>
          ) : (
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'vlearn', kind: 'pflicht' })} data-testid="vh-go">
              {t('vmHomeGo')}
            </Button>
          )
        }
      >
        {done && (
          <p className="m-0 inline-flex items-center gap-2 font-medium text-accent-text" role="status" data-testid="vh-done">
            <Icon name="check" size={18} />
            {t('vmHomeDone')}
          </p>
        )}
      </HeroCard>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Overview onOpenList={() => go({ name: 'vocabList' })} onPlace={() => go({ name: 'vplace' })} />
      </Suspense>
    </div>
  );
}
