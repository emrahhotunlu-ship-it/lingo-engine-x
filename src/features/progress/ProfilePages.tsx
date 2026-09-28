import { useNav } from '../../app/nav';
import { useClock } from '../../app/clock';
import { dayKeyNoon } from '../../domain/date';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useCompanionSee } from '../companion/seeing';
import { LateRescueHint } from '../migration/LateRescueCard';
import { ChecksRow } from './ChecksCard';
import { WeeklyCard } from './WeeklyCard';

// Seiten aus dem Profil-Blatt (plan.md §1.2): „Wochen-Check“ (O11/O12: Start und bisherige Checks)
// und „Wochenbericht“ (O13). Dazu die zwei ruhigen Zeilen auf Heute (plan.md §1.3 Nr. 4):
// Nachtragen (A4, nur wenn nötig) und „Dein Wochenbericht ist da“ (nur montags).

export function ChecksPage() {
  const { t } = useT();
  useCompanionSee({ area: 'overview', label: t('ckTitle'), phase: 'idle' });
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 sm:py-10" data-testid="checks-page">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('ckTitle')}</h1>
      <p className="text-sm text-muted">{t('nbProfilCheckLead')}</p>
      <Card className="py-0">
        <ChecksRow />
      </Card>
    </div>
  );
}

export function WeeklyPage() {
  const { t } = useT();
  useCompanionSee({ area: 'overview', label: t('nbProfilWeekly'), phase: 'idle' });
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 sm:py-10" data-testid="weekly-page">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('nbProfilWeekly')}</h1>
      <WeeklyCard />
    </div>
  );
}

/** Ruhige Zeile auf Heute: „Aus diesem Browser nachtragen“ (nur wenn dieser Browser Kopien hat). */
export function TodayRescueRow() {
  return <LateRescueHint />;
}

/** Ruhige Zeile auf Heute, nur montags: der Wochenbericht der letzten Woche ist da. */
export function TodayWeeklyRow() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  if (new Date(dayKeyNoon(today)).getDay() !== 1) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-subtle" data-testid="today-weekly">
      <Icon name="book" size={14} />
      <span>{t('nbProfilWeeklyToday')}</span>
      <button type="button" className="inline-flex min-h-11 items-center font-medium text-cyan-text underline-offset-2 hover:underline" onClick={() => go({ name: 'weekly' })} data-testid="today-weekly-open">
        {t('nbProfilWeeklyOpen')}
      </button>
    </p>
  );
}
