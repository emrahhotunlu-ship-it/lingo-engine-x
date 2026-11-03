import { useT } from '../../i18n';
import { TabHead } from '../system/TabHead';

// Kopf „Grammatik“ (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau H6 `phead` screens.js:476, L4 `dh1` desk.js:243): seit Großpaket B1 der
// gemeinsame Reiter-Kopf (Übersetzer · Fragen · Zahnrad). Gerendert vom Rahmen (`TopBar`).

export function LearnHead() {
  const { t } = useT();
  return <TabHead testId="learn" title={t('lhTitle')} />;
}
