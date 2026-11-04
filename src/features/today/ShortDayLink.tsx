import { useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { shortDayAllowed, shortDaysLeft } from '../../domain/plan/shortDay';
import { useT } from '../../i18n';
import { takeShortDay, untouchedToday } from './shortDay';
import { useTodayPlan } from './store';

// Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): ruhiger Zweit-Link unter der Tageskarte, nur solange heute nichts angefasst ist und die
// Woche noch einen kurzen Tag erlaubt. Nach dem Verkürzen steht statt des Links ein Hinweis (der Plan steht dann fest).

export function ShortDayLink({ view }: { view: { done: number; fills: readonly number[] } }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const plan = useTodayPlan((s) => (s.day === today && s.status === 'ready' ? s.plan : null));
  const profile = useLive((s) => s.docs['app/profile']);
  const [busy, setBusy] = useState(false);
  if (plan?.u?.kt === 1) {
    return (
      <p className="lx-vh-short text-sm text-muted" data-testid="short-day-on">
        {t('shortDayOn')}
      </p>
    );
  }
  if (!shortDayAllowed({ plan, today, kt: profile?.kt, untouched: untouchedToday(profile, today, view) })) return null;
  const left = shortDaysLeft(profile?.kt, today);
  return (
    <div className="lx-vh-short flex flex-col gap-0.5" data-testid="short-day">
      <button
        type="button"
        className="lx-vh-link"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void takeShortDay(today, view).finally(() => setBusy(false));
        }}
        data-testid="short-day-go"
      >
        {t('shortDayGo')}
      </button>
      <span className="text-xs text-muted">{t(left === 1 ? 'shortDayLeft_one' : 'shortDayLeft_other', { n: left })}</span>
    </div>
  );
}
