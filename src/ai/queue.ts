import { cancelledFailure } from './errors';
import type { AiPriority } from './types';

// Begrenzer: höchstens `max` Anfragen gleichzeitig (Kap. 10: zwei). 'user' vor 'background',
// sonst in Ankunftsreihenfolge. Höchstens `maxBackground` (einen) der Plätze belegt eine
// Hintergrund-Anfrage, damit ein Nutzer-Aufruf (z. B. die Figur im Rollenspiel) nie hinter zwei
// langen Hintergrund-Aufrufen (Einschätzung, Wochenbericht, Analyse) wartet. Wer abbricht, während er wartet, verlässt die Schlange,
// ohne dass `sample` je aufgerufen wird.

type Waiter = { rank: number; seq: number; bg: boolean; grant: () => void };

const RANK: Record<AiPriority, number> = { user: 0, background: 1 };

export class AiQueue {
  private active = 0;
  private activeBg = 0;
  private seq = 0;
  private waiting: Waiter[] = [];

  constructor(
    readonly max = 2,
    readonly maxBackground = 1,
  ) {}

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
    const bg = priority === 'background';
    // Sofort, wenn ein Platz frei ist und kein Wartender ihn nehmen könnte (Reihenfolge bleibt).
    if (this.fits(bg) && !this.waiting.some((w) => this.fits(w.bg))) return Promise.resolve(this.take(bg));
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        rank: RANK[priority],
        seq: this.seq++,
        bg,
        grant: () => {
          signal.removeEventListener('abort', onAbort);
          resolve(this.take(bg));
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
    this.activeBg = 0;
    this.waiting = [];
  }

  private fits(bg: boolean): boolean {
    return this.active < this.max && (!bg || this.activeBg < this.maxBackground);
  }

  private take(bg: boolean): () => void {
    this.active += 1;
    if (bg) this.activeBg += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      if (bg) this.activeBg = Math.max(0, this.activeBg - 1);
      this.pump();
    };
  }

  /** Vergibt freie Plätze an die ersten Wartenden, die passen (ein Hintergrund-Aufruf kann übersprungen werden). */
  private pump(): void {
    for (;;) {
      const i = this.waiting.findIndex((w) => this.fits(w.bg));
      if (i < 0) return;
      const [next] = this.waiting.splice(i, 1);
      next?.grant();
    }
  }
}

/** Die eine Warteschlange der App. */
export const aiQueue = new AiQueue(2);
