import { useEffect, useState } from 'react';
import { useValidTodayDoc } from '../../data/todayDoc';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { SettingsButton } from './Chrome';
import { StartCard, TodaySkeletonCard } from '../today/DayCard';
import { markStart } from '../today/startPerf';

export { TodaySkeletonCard } from '../today/DayCard';

// U2: Ladeskelett von „Heute“. Gleicher Aufbau und gleiche Klassen wie das Start-Bild in index.html (#lx-boot) und wie die echte
// Tageskarte (D2 V-HEUTE: `.lx-vh-day`, Kopf „Heute“ vom Rahmen): Start-Bild → Ladeskelett → Tageskarte ohne Sprung.
// Änderungen hier immer auch in index.html nachziehen (Test: tests/e2e/perf.spec.ts „Start-Bild“).
// Relaunch P6 (stufe1-plan §4.3): Steht ein gültiges Startbild `app/today` für den JETZT berechneten Lerntag, zeigt der Rahmen schon Ring, Zahlen
// und den Knopf daraus (wartender Start); sonst das Skelett. Dauert die Verbindung zur Datenbank länger als 10 s, ein ruhiger Hinweis.

/** Nach so vielen ms ohne Daten der ruhige Hinweis (stufe1-plan §4.3 Nr. 5). */
export const SLOW_HINT_MS = 10_000;

/** Ein einmaliger Anzeige-Zeitgeber (kein Abbruch, keine Wiederholung, schreibt nichts). */
function useSlow(ms: number): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return slow;
}

/** Ladezustand der App (Rahmen „loading“): Datumstitel und Startbild bzw. Tageskarten-Skelett an genau der Stelle der späteren Heute-Ansicht. */
export function HomeSkeleton() {
  const { t } = useT();
  const doc = useValidTodayDoc();
  const slow = useSlow(SLOW_HINT_MS);
  useEffect(() => markStart('lx:skeleton'), []);
  return (
    <div className="lx-vh" role="status" aria-label={t('loadingData')}>
      <div className="lx-vh-stack">
        {doc ? <StartCard doc={doc} /> : <TodaySkeletonCard />}
        {/* Unter der Karte: der Hinweis schiebt Karte und Knopf nie. „Erneut versuchen“ lädt die Seite neu (die Fähigkeit wird je Seite nur einmal erfragt). */}
        {slow && (
          <div className="lx-glass flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3" data-testid="start-slow">
            <p className="text-sm text-muted">{t('stSlow')}</p>
            <div className="flex items-center gap-2">
              <Button icon="refresh" onClick={() => window.location.reload()} data-testid="start-slow-retry">
                {t('stSlowRetry')}
              </Button>
              {/* Diagnose und Sicherung bleiben erreichbar (das Zahnrad steht beim Laden nicht mehr oben, G2 Nora M1). */}
              <SettingsButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
