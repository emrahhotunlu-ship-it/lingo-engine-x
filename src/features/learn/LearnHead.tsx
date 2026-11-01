import { useT } from '../../i18n';
import { VPageHead } from '../../ui/v';
import { AskHeadButton } from '../today/TodayHead';

// Kopf „Grammatik“ (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau H6 `phead` screens.js:476, L4 `dh1` desk.js:243): Titel 30/36 fett, rechts EIN
// „Fragen“ (Handy Symbol, ab 1.024 px Knopf mit Wort). Gleicher Aufbau wie der Kopf von Heute (`lx-vh-head`). Gerendert vom Rahmen (`TopBar`).

export function LearnHead() {
  const { t } = useT();
  return (
    <div data-testid="topbar">
      <VPageHead className="lx-vh-head" title={t('lhTitle')} right={<AskHeadButton />} />
    </div>
  );
}
