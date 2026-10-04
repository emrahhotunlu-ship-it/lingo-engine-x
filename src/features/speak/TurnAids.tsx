import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { KEY_PREFIX, local } from '../../platform/storage';

// Neubau N77 (Soll, Lehrer I4): im Rollenspiel ein Zeitlimit je Zug (45 s, abschaltbar, nur Anzeige – bricht nichts ab, Kap. 3.1 / A6.2).

export const TURN_SEC = 45;
const KEY = `${KEY_PREFIX}rp-turn-timer`;

export function turnTimerOn(): boolean {
  return local.get(KEY) !== '0';
}

/** Zeitbalken je Zug: läuft ab der letzten Antwort der Figur (neuer `key` je Zug beim Aufrufer). */
export function TurnTimer({ active }: { active: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(turnTimerOn);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on || !active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [on, active]);
  const left = Math.max(0, TURN_SEC - Math.floor((now - start) / 1000));
  const toggle = () => {
    const next = !on;
    setOn(next);
    local.set(KEY, next ? '1' : '0');
  };
  return (
    <div className="flex items-center gap-3 text-xs text-muted" data-testid="rp-turn-timer" data-on={on ? 'yes' : 'no'} data-left={on ? left : undefined}>
      {on && active && (
        <>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${(left / TURN_SEC) * 100}%` }} />
          </div>
          <span className="lx-tnum">{left > 0 ? t('nbSprechenTurnLeft', { s: left }) : t('nbSprechenTurnUp')}</span>
        </>
      )}
      <button type="button" className="ml-auto min-h-8 hover:text-fg" onClick={toggle} aria-pressed={on} data-testid="rp-turn-timer-toggle">
        {on ? t('nbSprechenTurnTimerOff') : t('nbSprechenTurnTimerOn')}
      </button>
    </div>
  );
}
