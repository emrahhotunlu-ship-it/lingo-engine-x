import { defineArea } from '../app/registry';
import { useNav } from '../app/nav';
import { markNavStart } from '../app/perf';
import { useT } from '../i18n';
import { Row, RowList } from '../ui/RowList';

// Zuordnung zum Reiter „Praxis“ (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §6.3/§6.5):
// Lesen (früher eigener Reiter) und Sprechen sind Seiten unter Praxis. Diese Liste macht beide mit einem Tipp
// erreichbar (A5), auch am Handy, wo die Rollenspiel-Kachel in „Übungen für den Laptop“ eingeklappt ist.
// Kein neuer Inhalt: nur zwei Einstiege auf bestehende Seiten.

function PracticeMore() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const open = (name: 'read' | 'speak') => () => {
    markNavStart();
    go({ name });
  };
  return (
    <RowList title={t('shPracticeMore')} testId="practice-more">
      <Row icon="book" channel="read" title={t('shRead')} sub={t('shReadSub')} onClick={open('read')} testId="hub-read" />
      <Row icon="chat" channel="speak" title={t('shSpeak')} sub={t('shSpeakSub')} onClick={open('speak')} testId="hub-speak-page" />
    </RowList>
  );
}

export const praxis = defineArea({
  id: 'praxis',
  screens: {},
  sections: [{ id: 'practice-more', place: 'apply', order: 5, component: PracticeMore }],
});
