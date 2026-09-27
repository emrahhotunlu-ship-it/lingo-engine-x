import { useEffect, useState } from 'react';
import { lookupOpenMs } from '../../engine/wordTap';

// Aktive Zeit einer Einheit (Plan §2.6): läuft nur, solange die Seite sichtbar ist; die Zeit
// mit offenem Nachschlage-Fenster zählt nicht. Je Einheit höchstens 30 Minuten.

export const ACTIVE_CAP_MS = 30 * 60_000;

export class ActiveClock {
  private total = 0;
  private since: number | null = null;
  private lookupAtStart = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly lookup: () => number = lookupOpenMs,
  ) {}

  start(): void {
    if (this.since !== null) return;
    this.since = this.now();
    this.lookupAtStart = this.lookup();
  }

  pause(): void {
    if (this.since === null) return;
    const span = this.now() - this.since;
    const inLookup = Math.max(0, this.lookup() - this.lookupAtStart);
    this.total += Math.max(0, span - inLookup);
    this.since = null;
  }

  /** Aktive Millisekunden bisher (gedeckelt). */
  ms(): number {
    let t = this.total;
    if (this.since !== null) t += Math.max(0, this.now() - this.since - Math.max(0, this.lookup() - this.lookupAtStart));
    return Math.min(ACTIVE_CAP_MS, Math.round(t));
  }
}

/** Eine Uhr je eingehängter Einheit; pausiert bei verborgener Seite. */
export function useActiveClock(): ActiveClock {
  const [clock] = useState(() => new ActiveClock());
  useEffect(() => {
    const sync = () => (document.visibilityState === 'visible' ? clock.start() : clock.pause());
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      clock.pause();
    };
  }, [clock]);
  return clock;
}
