import { useMemo, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { dayKeyNoon, weekdayShort } from '../../domain/date';
import { streakWeek, weekGoal } from '../../domain/metrics';
import type { WeekDay } from '../../domain/streak';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { Icon } from '../../ui/Icon';
import { footParts, footText } from './goalLine';

// Wochenstreifen und „Diese Woche“ (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1 `weekStrip` screens.js:82–88, L1 `l1Ctx` desk.js:140–150).
// Eine Quelle: `streakWeek` (dieselbe Regel wie die Serie, Ruhetag inklusive) und `weekGoal`. Am Handy sieben Tageskreise mit der Serie rechts;
// am Laptop (≥ 1.280 px) steht die Woche nur einmal, rechts in der Kontextspalte, als Liste Mo–So mit dem echten Tageszustand
// (erledigt · Ruhetag · offen · heute · kein Lerntag). Tagesarten wie „Schreibtag“ gibt es noch nicht (F3).
// Der Kartenfuß „Serie 12 · Woche 4 von 6“ (Motivation §4.10) bleibt als Text für Screenreader (`today-streak`); sichtbar zeigen ihn die Häkchen
// der Woche und die Serienzahl. „Serie 0“ gibt es nie.

const EMPTY = new Map<string, Record<string, unknown>>();

export type StreakWeek = { week: WeekDay[]; foot: string | null; streak: number | null };

/** Serie, Woche und Fußzeile aus denselben Dokumenten wie überall (`streakWeek`, `weekGoal`). */
export function useStreakWeek(): StreakWeek {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const archive = useLive((s) => s.collections.archive) ?? EMPTY;
  return useMemo(() => {
    if (!profile) return { week: [], foot: null, streak: null };
    try {
      const r = streakWeek({ nowMs: now, profile, schema, archives: archive.values(), today });
      const parts = footParts({ streak: r.streak.count, goal: weekGoal(r.week) });
      return { week: r.week, foot: parts ? footText(parts, t) : null, streak: parts?.streak ?? null };
    } catch (err) {
      logWarn('today:week', err);
      return { week: [], foot: null, streak: null };
    }
  }, [profile, schema, archive, today, now, t]);
}

type Fmt = { short: (d: string) => string; long: (d: string) => string };

function useFmt(): Fmt {
  const { lang } = useT();
  return useMemo(() => {
    const long = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    return { short: (d: string) => weekdayShort(d, lang), long: (d: string) => long.format(dayKeyNoon(d)) };
  }, [lang]);
}

/** Ist der Tag als erledigt zu zeigen? Heute zählt nur der Pflichtstand der Tageskarte (`todayDone`), damit Häkchen, Ring und Knopf
 *  dasselbe sagen (Kap. 2 Nr. 2). Die Serie selbst rechnet weiter nach ihrer Regel (A6.13), nur die Anzeige für heute folgt der Karte. */
function shownDone(d: WeekDay, todayDone: boolean): boolean {
  return d.today ? todayDone : d.state === 'done';
}

/** Zustand eines Tags als Wort (Liste rechts, Screenreader). */
function dayWord(d: WeekDay, todayDone: boolean, t: ReturnType<typeof useT>['t']): string {
  if (d.today) return todayDone ? t('vhWeekTodayDone') : t('vhWeekToday');
  if (d.state === 'done') return t('vhWeekDone');
  if (d.state === 'rest') return t('vhWeekRest');
  if (d.state === 'open') return t('vhWeekNoStudy');
  return t('vhWeekOpen');
}

/** Sieben Tageskreise und die Serie (Handy, Laptop unter 1.280 px). Gleiche Klassen wie `VWeekStrip` (D1), mit Tageskennungen für Tests. */
export function TodayWeekStrip({ sw, todayDone }: { sw: StreakWeek; todayDone: boolean }) {
  const { t, tn } = useT();
  const fmt = useFmt();
  if (sw.week.length === 0) return null;
  return (
    <div className="lx-v-week lx-vh-week" data-testid="week-strip">
      <ul className="lx-v-week-days" aria-label={t('vWeek')}>
        {sw.week.map((d) => {
          const done = shownDone(d, todayDone);
          const label = `${fmt.long(d.day)}: ${dayWord(d, todayDone, t)}`;
          return (
            <li
              key={d.day}
              className="lx-v-wd"
              data-testid="week-day"
              data-day={d.day}
              data-state={d.state}
              data-done={done ? '' : undefined}
              data-today={d.today ? '' : undefined}
              data-rest={d.state === 'rest' ? '' : undefined}
              aria-current={d.today ? 'date' : undefined}
              title={label}
            >
              <i aria-hidden="true">{done && <Icon name="check" size={14} />}</i>
              <span aria-hidden="true">{fmt.short(d.day).slice(0, 1)}</span>
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
      </ul>
      {sw.streak !== null && (
        <div className="lx-v-streak" aria-hidden="true">
          <b className="lx-v-disp lx-v-num">{sw.streak}</b>
          {tn('vStreak', sw.streak)}
        </div>
      )}
      {sw.foot && (
        <p className="sr-only" data-testid="today-streak">
          {sw.foot}
        </p>
      )}
    </div>
  );
}

/** „Diese Woche“ in der Kontextspalte (Vorschau L1 `l1Ctx`): Mo–So mit Zustand; darunter optional eine Zeile (Wochenrückblick). */
export function WeekList({ sw, todayDone, extra }: { sw: StreakWeek; todayDone: boolean; extra?: ReactNode }) {
  const { t } = useT();
  const fmt = useFmt();
  if (sw.week.length === 0) return null;
  return (
    <div className="lx-v-card lx-vh-weeklist" data-testid="week-list">
      <ul className="lx-v-statelist" aria-label={t('vWeek')}>
        {sw.week.map((d) => {
          const done = shownDone(d, todayDone);
          // Heute erledigt: nur das Häkchen, kein Laufpunkt darüber; „heute“ sagt dann der Text und `aria-current`.
          const st = done ? 'done' : d.today ? 'run' : 'open';
          return (
            <li
              key={d.day}
              className="lx-v-st"
              data-state={st}
              data-day={d.day}
              aria-current={d.today ? 'date' : undefined}
              title={fmt.long(d.day)}
            >
              <span className="lx-v-st-mk" aria-hidden="true">
                {done && <Icon name="check" size={14} />}
              </span>
              <span className="lx-vh-wl-d">{fmt.short(d.day)}</span>
              <span className="lx-v-st-nm">{dayWord(d, todayDone, t)}</span>
            </li>
          );
        })}
      </ul>
      {sw.foot && (
        <p className="lx-vh-wl-foot lx-v-num" data-testid="today-streak">
          {sw.foot}
        </p>
      )}
      {extra}
    </div>
  );
}
