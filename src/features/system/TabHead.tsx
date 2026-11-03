import type { ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { openSettings } from '../../app/sheets';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { VPageHead } from '../../ui/v';
import { openCompanion } from '../companion/store';

// Großpaket B1 (docs/umbau/design/grosspaket-b.md §2, Emrah 03.11.2026 „Übersetzer · Claude · Zahnrad“): EIN Kopf für alle vier Reiter.
// Links der große Titel (Vorschau `phead`, 30/36 fett), rechts Übersetzer · Fragen (Claude) · Zahnrad – Einstellungen und Übersetzer
// von jedem Reiter mit einem Tipp. Ab 600 px stehen Übersetzer und Zahnrad schon in der Schiene links (`lx-nav-tools`): dort zeigt der
// Kopf nur „Fragen“ (Kap. 15: nichts doppelt auf einem Bildschirm). Ohne KI fallen Übersetzer und „Fragen“ weg, das Zahnrad bleibt.

/** „Fragen“: öffnet Claude (Handy Symbol 44 × 44, ab 1.024 px Knopf mit Wort). Ohne KI unsichtbar. */
export function AskHeadButton() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return (
    <button type="button" className="lx-v-iconbtn lx-vh-ask" onClick={() => openCompanion()} aria-label={t('vhAsk')} title={t('vhAsk')} data-testid="open-companion" data-ai="">
      <Icon name="ask" size={24} />
      <span className="lx-vh-ask-l" aria-hidden="true">{t('vhAsk')}</span>
    </button>
  );
}

function TranslateHeadButton() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return (
    <button type="button" className="lx-v-iconbtn lx-vh-tool" onClick={() => openCompanion({ tab: 'translate' })} aria-label={t('shTranslator')} title={t('shTranslator')} data-testid="open-translate" data-ai="">
      <Icon name="translate" size={22} />
    </button>
  );
}

function GearHeadButton() {
  const { t } = useT();
  return (
    <button type="button" className="lx-v-iconbtn lx-vh-tool" onClick={openSettings} aria-label={t('openSettings')} title={t('shSettings')} data-testid="open-settings">
      <Icon name="gear" size={22} />
    </button>
  );
}

/** Rechte Seite des Reiter-Kopfs. `loading`: beim Laden nur ein freier Platz in Kopfhöhe. */
export function HeadTools({ loading = false }: { loading?: boolean }) {
  if (loading) return <span className="lx-vh-ask-gap" aria-hidden="true" />;
  return (
    <>
      <TranslateHeadButton />
      <AskHeadButton />
      <GearHeadButton />
    </>
  );
}

/** Kopf einer Reiter-Wurzel (gerendert vom Rahmen, `TopBar`; Test-ID `topbar` bleibt). */
export function TabHead({ title, loading = false, testId }: { title: ReactNode; loading?: boolean; testId?: string }) {
  return (
    <div data-testid="topbar" data-tabhead={testId}>
      <VPageHead className="lx-vh-head" title={title} right={<HeadTools loading={loading} />} />
    </div>
  );
}
