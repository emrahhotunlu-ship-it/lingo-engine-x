import { flags } from '../../app/flags';
import { useNav } from '../../app/nav';
import { registerSlot } from '../../app/slots';
import { useT } from '../../i18n';
import { Row, RowList } from '../../ui/RowList';

// Fortschritt › Rückblick: Einstieg in den Wochenrückblick 3.0 (Lernplattform 3.0 P50, Schalter `flags.weekly3`). Der Rückblick selbst steht auf der Seite
// `weekly` (auch über das Montags-Band auf Heute und das Profil-Blatt erreichbar).

function WeeklyEntry() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <RowList testId="wk-entry-list" label={t('moWkEntry')}>
      <Row icon="history" channel="grammar" title={t('moWkEntry')} sub={t('moWkEntrySub')} testId="wk-entry" onClick={() => go({ name: 'weekly' })} />
    </RowList>
  );
}

registerSlot({ slot: 'progress.review', order: 30, enabled: () => flags.weekly3, render: () => <WeeklyEntry /> });
