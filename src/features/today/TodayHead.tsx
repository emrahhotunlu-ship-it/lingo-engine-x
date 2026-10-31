import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { VPageHead } from '../../ui/v';
import { openCompanion } from '../companion/store';
import { dateLabelOf } from './dateLabel';

// Kopf „Heute“ (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1 `phead` screens.js:174, L1 desk.js:96–97): Titel „Heute“ 30/36 fett, rechts EIN „Fragen“
// (Handy: Symbol 44 × 44; ab 1.024 px Knopf mit Wort wie L1). Ohne KI steht rechts nichts. Das Datum (Tageswechsel 04:00, `useClock`) bleibt Teil
// der Überschrift für Screenreader und Tests (`today-date`); sichtbar zeigt der Wochenstreifen den Tag.
// Gerendert vom Rahmen (`TopBar` auf der Reiter-Wurzel „Heute“, beim Laden `Shell`), damit Start-Bild, Ladezustand und Heute denselben Kopf haben.

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

/** Kopf von Heute. `loading`: beim Laden ohne „Fragen“ (die Stelle bleibt frei, gleiche Höhe). */
export function TodayHead({ loading = false }: { loading?: boolean }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  return (
    <div data-testid="topbar">
      <VPageHead
      className="lx-vh-head"
      title={
        <>
          {t('vhToday')}
          <span className="sr-only">, </span>
          <span className="sr-only" data-testid="today-date" data-day={today}>
            {dateLabelOf(today, lang)}
          </span>
        </>
      }
      right={loading ? <span className="lx-vh-ask-gap" aria-hidden="true" /> : <AskHeadButton />}
      />
    </div>
  );
}
