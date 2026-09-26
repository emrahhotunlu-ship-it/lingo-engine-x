import { useEffect } from 'react';
import { create } from 'zustand';
import { dayKey } from '../domain/date';

// Uhr der App: `today` wird immer aktuell berechnet (Wechsel um 04:00), nie nur beim Laden.
// Takt 30 s und beim Sichtbarwerden der Seite.

type ClockState = { now: number; today: string; tick: () => void };

export const useClock = create<ClockState>((set) => ({
  now: Date.now(),
  today: dayKey(Date.now()),
  tick() {
    const now = Date.now();
    set((s) => {
      const today = dayKey(now);
      return today === s.today && now === s.now ? s : { now, today };
    });
  },
}));

export function useClockTicker(): void {
  useEffect(() => {
    const tick = () => useClock.getState().tick();
    const id = window.setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
