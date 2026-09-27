import { logError } from '../../platform/diagnostics';

// Analysespur (Plan §6.3, Befund B2): Analysen eines Gesprächs laufen NACHEINANDER (höchstens
// eine aktiv, FIFO). So bleibt in der KI-Warteschlange (2 Plätze) immer ein Platz für die Figur –
// der Gesprächsfluss hängt nie an der Spur. Ein Fehler einer Analyse blockiert die nächste nicht.
// `close()` (Aushängen, „Bericht jetzt“) bricht die laufende und alle wartenden ab.

export type LaneJob = (signal: AbortSignal) => Promise<void>;

export class AnalysisLane {
  private queue: Array<{ key: number; job: LaneJob }> = [];
  private running: { key: number; ctl: AbortController } | null = null;
  private closed = false;

  get active(): number | null {
    return this.running?.key ?? null;
  }

  get waiting(): number[] {
    return this.queue.map((q) => q.key);
  }

  /** Stellt eine Analyse an; gleiche Kennung doppelt wird ignoriert. */
  enqueue(key: number, job: LaneJob): void {
    if (this.closed) return;
    if (this.running?.key === key || this.queue.some((q) => q.key === key)) return;
    this.queue.push({ key, job });
    this.pump();
  }

  /** Bricht alle laufenden und wartenden Analysen ab. Rückgabe: die betroffenen Kennungen. */
  cancelAll(): number[] {
    const keys = [...(this.running ? [this.running.key] : []), ...this.queue.map((q) => q.key)];
    this.queue = [];
    this.running?.ctl.abort();
    return keys;
  }

  close(): void {
    this.closed = true;
    this.cancelAll();
  }

  /** Nach `close()` wieder öffnen (React StrictMode hängt doppelt ein). */
  open(): void {
    this.closed = false;
  }

  private pump(): void {
    if (this.running || this.closed) return;
    const next = this.queue.shift();
    if (!next) return;
    const ctl = new AbortController();
    this.running = { key: next.key, ctl };
    const done = () => {
      if (this.running?.ctl === ctl) this.running = null;
      this.pump();
    };
    let p: Promise<void>;
    try {
      p = next.job(ctl.signal);
    } catch (err) {
      logError('speak:lane', err, String(next.key));
      done();
      return;
    }
    p.then(done, (err: unknown) => {
      logError('speak:lane', err, String(next.key));
      done();
    });
  }
}
