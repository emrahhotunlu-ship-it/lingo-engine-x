import { Icon } from '../Icon';

// D1 V-BAU: Wochenstreifen (`.week`, Vorschau style.css:186–193; screens.js:82–88): sieben Tageskreise Mo–So und die Serie.
// Zustand je Tag über Zeichen und Text (Häkchen, Ring, gestrichelter Ruhetag) und für Screenreader als Wort, nie nur über Farbe.

export type VDayState = 'done' | 'today' | 'todayDone' | 'rest' | 'open';

export type VWeekDay = { /** Kurzname („M“, „D“ …). */ short: string; /** Voller Name für Screenreader („Montag“). */ name: string; state: VDayState };

type Props = {
  days: readonly VWeekDay[];
  /** Beschriftung der Liste („Diese Woche“). */
  label: string;
  /** Wörter je Zustand für Screenreader. */
  stateLabels: Record<VDayState, string>;
  /** Serie: Zahl groß, darunter die Beschriftung („Tage Serie“). Ohne Wert kein Serienblock. */
  streak?: { value: string; label: string };
  'data-testid'?: string;
};

export function VWeekStrip({ days, label, stateLabels, streak, ...rest }: Props) {
  return (
    <div className="lx-v-week" data-testid={rest['data-testid']}>
      <ul className="lx-v-week-days" aria-label={label}>
        {days.map((d, i) => {
          const done = d.state === 'done' || d.state === 'todayDone';
          const today = d.state === 'today' || d.state === 'todayDone';
          return (
            <li
              key={i}
              className="lx-v-wd"
              data-done={done ? '' : undefined}
              data-today={today ? '' : undefined}
              data-rest={d.state === 'rest' ? '' : undefined}
              aria-current={today ? 'date' : undefined}
            >
              <i aria-hidden="true">{done && <Icon name="check" size={14} />}</i>
              <span aria-hidden="true">{d.short}</span>
              <span className="sr-only">{`${d.name}: ${stateLabels[d.state]}`}</span>
            </li>
          );
        })}
      </ul>
      {streak && (
        <div className="lx-v-streak">
          <b className="lx-v-disp lx-v-num">{streak.value}</b>
          {streak.label}
        </div>
      )}
    </div>
  );
}
