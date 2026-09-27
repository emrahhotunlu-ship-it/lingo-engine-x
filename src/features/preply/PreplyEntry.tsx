import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { Card, ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { setPreplyTab } from './store';

// Einstieg zur Preply-Brücke (seit der UX-Beratung 27.09. unter „Sprechen → Preply"; nicht mehr auf „Dein Stand").
// Früher: Phase 5, D2 (solange es keinen Modul-Einstieg
// aus Phase 2/4 gibt). Eine Zeile, kein konkurrierender Primärknopf zu „Heute".

export function PreplyEntry() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <Card as="div" channel="speak" className="p-0 sm:p-0">
      <button
        type="button"
        onClick={() => {
          setPreplyTab('prep');
          go({ name: 'speak', seg: 'preply' });
        }}
        className="flex min-h-16 w-full items-center gap-4 rounded-[var(--radius-card)] p-5 text-left sm:p-6"
        data-testid="open-preply"
      >
        <ChannelIcon channel="speak">
          <Icon name="book" />
        </ChannelIcon>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{t('ppEntryTitle')}</span>
          <span className="text-sm text-muted">{t('ppEntryBody')}</span>
        </span>
        <Icon name="arrowRight" className="flex-none text-muted" />
      </button>
    </Card>
  );
}
