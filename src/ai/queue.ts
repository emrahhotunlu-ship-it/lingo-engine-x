import { cancelledFailure } from './errors';
import type { AiPriority } from './types';

// Begrenzer: höchstens `max` Anfragen gleichzeitig (Kap. 10: zwei). 'user' vor 'background',
// sonst in Ankunftsreihenfolge. Wer abbricht, während er wartet, verlässt die Schlange,
// ohne dass `sample` je aufgerufen wird.

type Waiter = { rank: number; seq: number; grant: () => void };

const RANK: Record<AiPriority, number> = { user: 0, background: 1 };

export class AiQueue {
  private active = 0;
  private seq = 0;
  private waiting: Waiter[] = [];

  constructor(readonly max = 2) {}

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiting.length;
  }

  /**
   * Wartet auf einen Platz und liefert die Freigabe-Funktion (mehrfacher Aufruf schadet nicht).
   * `onQueued` wird nur gerufen, wenn wirklich gewartet werden muss.
   */
  acquire(signal: AbortSignal, priority: AiPriority = 'user', onQueued?: () => void): Promise<() => void> {
    if (signal.aborted) return Promise.reject(cancelledFailure());
    if (this.active < this.max && this.waiting.length === 0) {
      this.active += 1;
      return Promise.resolve(this.releaser());
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        rank: RANK[priority],
        seq: this.seq++,
        grant: () => {
          signal.removeEventListener('abort', onAbort);
          this.active += 1;
          resolve(this.releaser());
        },
      };
      const onAbort = () => {
        this.waiting = this.waiting.filter((w) => w !== waiter);
        reject(cancelledFailure());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiting.push(waiter);
      this.waiting.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
      onQueued?.();
    });
  }

  /** Nur für Tests: Zustand verwerfen. */
  reset(): void {
    this.active = 0;
    this.waiting = [];
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      this.pump();
    };
  }

  private pump(): void {
    while (this.active < this.max) {
      const next = this.waiting.shift();
      if (!next) return;
      next.grant();
    }
  }
}

/** Die eine Warteschlange der App. */
export const aiQueue = new AiQueue(2);
