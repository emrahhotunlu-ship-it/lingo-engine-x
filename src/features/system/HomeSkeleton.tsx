import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { TabTitle } from './Chrome';
import { dateLabelOf } from '../today/dateLabel';

// U2: Ladeskelett von „Heute“. Gleicher Aufbau und gleiche Klassen wie das Start-Bild in index.html (#lx-boot) und wie die echte
// Tageskarte (`.lx-today-card`, feste Mindesthöhe, Knopf unten): Start-Bild → Ladeskelett → Tageskarte ohne Sprung.
// Änderungen hier immer auch in index.html nachziehen (Test: tests/e2e/perf.spec.ts „Start-Bild“).

/** Platzhalter der Tageskarte: Ring, Titel, drei Schritte, Knopf unten, Fußzeile. */
export function TodaySkeletonCard() {
  return (
    <div className="lx-card lx-today-card flex flex-col gap-4 p-[1.125rem] sm:p-6" aria-hidden="true" data-testid="today-skeleton">
      <div className="flex items-center gap-3.5">
        <div className="lx-skeleton size-28 flex-none rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="lx-skeleton h-5 w-4/5" />
          <div className="lx-skeleton h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
      </div>
      <div className="lx-skeleton mt-auto min-h-14 rounded-full" />
      <div className="min-h-4" />
    </div>
  );
}

/** Ladezustand der App (Rahmen „loading“): Datumstitel und Tageskarten-Skelett an genau der Stelle der späteren Heute-Ansicht. */
export function HomeSkeleton() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 pt-4 pb-10 sm:pt-8 lg:max-w-[70rem]" role="status" aria-label={t('loadingData')}>
      <TabTitle title={dateLabelOf(today, lang)} />
      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <TodaySkeletonCard />
        </div>
      </div>
    </div>
  );
}
