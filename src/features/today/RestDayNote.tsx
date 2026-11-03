import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { dowOf } from '../../domain/unit/planFor';
import { restDowOf, vacationDays } from '../../domain/streak';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import type { StreakWeek } from './TodayWeek';

// Großpaket B10 „Ruhetag selbst wählen“ (Emrahs Wahl 03.11.2026): am gewählten Wochentag sagt Heute ruhig, dass Ruhetag ist – und ehrlich,
// ob die Serie auch ohne Lernen hält. Die Serienregel bleibt dieselbe (ein Ruhetag je Kalenderwoche, domain/streak.ts): Fiel diese Woche schon
// ein Tag aus (kein Urlaub), ist der Ruhetag verbraucht, und die Zeile sagt das. Der Tagesweg bleibt startbar (Lernen zählt immer).

export function RestDayNote({ sw }: { sw: StreakWeek }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const dow = restDowOf(profile?.restDow);
  if (dow === null || dowOf(today) !== dow) return null;
  const vac = vacationDays(profile?.vac);
  const used = sw.week.some((d) => d.day < today && (d.state === 'rest' || d.state === 'open') && !vac.has(d.day));
  return (
    <p className="lx-kh-note" data-testid="rest-day-note" data-used={used ? '' : undefined}>
      <Icon name="moon" size={16} />
      {t(used ? 'restDayUsed' : 'restDayFree')}
    </p>
  );
}
