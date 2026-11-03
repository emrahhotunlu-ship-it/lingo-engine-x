import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { TabHead } from '../system/TabHead';
import { dateLabelOf } from './dateLabel';

// Kopf „Heute“ (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1 `phead` screens.js:174, L1 desk.js:96–97; seit Großpaket B1 der gemeinsame
// Reiter-Kopf `TabHead` mit Übersetzer · Fragen · Zahnrad). Das Datum (Tageswechsel 04:00, `useClock`) bleibt Teil der Überschrift für
// Screenreader und Tests (`today-date`); sichtbar zeigt der Wochenstreifen den Tag. Gerendert vom Rahmen (`TopBar` auf der Reiter-Wurzel
// „Heute“, beim Laden `Shell`), damit Start-Bild, Ladezustand und Heute denselben Kopf haben.

/** Kopf von Heute. `loading`: beim Laden ohne Knöpfe (die Stelle bleibt frei, gleiche Höhe). */
export function TodayHead({ loading = false }: { loading?: boolean }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  return (
    <TabHead
      loading={loading}
      testId="today"
      meta={dateLabelOf(today, lang)}
      title={
        <>
          {t('vhToday')}
          <span className="sr-only">, </span>
          <span className="sr-only" data-testid="today-date" data-day={today}>
            {dateLabelOf(today, lang)}
          </span>
        </>
      }
    />
  );
}
