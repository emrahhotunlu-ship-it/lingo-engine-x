import { useEffect, useState } from 'react';
import { useCapabilities } from '../platform/capabilities';
import { linkAbort } from './abort';

// Abbruch beim Bildschirmwechsel (Kap. 10) und Sichtbarkeit der KI-Funktionen.

export type AiScope = {
  /** Signal des Bildschirms; wird beim Aushängen abgebrochen. */
  readonly signal: AbortSignal;
  /** Eigener Controller für EINE Anfrage (Stopp-Knopf), an den Bildschirm gekoppelt. */
  controller(): AbortController;
};

export type ManagedAiScope = AiScope & {
  /** Beim Einhängen: nach einem Abbruch (React StrictMode hängt doppelt ein) neu beginnen. */
  open(): void;
  /** Beim Aushängen: alle laufenden und wartenden Anfragen dieses Bildschirms abbrechen. */
  close(): void;
};

export function createAiScope(): ManagedAiScope {
  let ctl = new AbortController();
  return {
    get signal() {
      return ctl.signal;
    },
    controller() {
      const child = new AbortController();
      linkAbort(ctl.signal, child);
      return child;
    },
    open() {
      if (ctl.signal.aborted) ctl = new AbortController();
    },
    close() {
      ctl.abort();
    },
  };
}

/** Ein AbortController je eingehängtem Bildschirm; beim Aushängen abgebrochen. */
export function useAiScope(): AiScope {
  const [scope] = useState(createAiScope);
  useEffect(() => {
    scope.open();
    return () => scope.close();
  }, [scope]);
  return scope;
}

type CapSnapshot = { sample: 'pending' | 'ready' | 'absent'; sampleRevoked: boolean };

/** KI nutzbar: Fähigkeit bereit und in dieser Ansicht nicht abgelehnt (not_granted & Co.). */
export const selectAiAvailable = (s: CapSnapshot): boolean => s.sample === 'ready' && !s.sampleRevoked;

/** Knöpfe, die Claude fragen, nur zeigen, wenn dies `true` ist. */
export function useAiAvailable(): boolean {
  return useCapabilities(selectAiAvailable);
}
