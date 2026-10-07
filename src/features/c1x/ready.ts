import { useSyncExternalStore } from 'react';
import { kindEnabled } from '../../app/flags';
import { preloadC1x } from '../../domain/c1x/preload';
import { C1_KINDS } from '../../domain/c1x/types';
import { logWarn } from '../../platform/diagnostics';

// Die gepackten c1x-Inhalte sind geladen, bevor die App „bereit“ ist (Lernplattform 3.0 P14): der Rundenbau ist synchron und liest nur, was im Speicher
// steht. Ist keine Art eingeschaltet, ist die App sofort bereit (kein Mehraufwand). Ein Ladefehler hält den Start nie auf (die Arten fehlen dann, Meldung im Protokoll).

let ready = false;
let started = false;
const listeners = new Set<() => void>();
const set = (v: boolean): void => {
  ready = v;
  listeners.forEach((l) => l());
};

/** Startet das Laden aller eingeschalteten Arten (einmal). */
export function startC1xPreload(): void {
  if (started) return;
  started = true;
  const kinds = C1_KINDS.filter((k) => kindEnabled(k));
  if (!kinds.length) {
    ready = true;
    return;
  }
  void preloadC1x(kinds)
    .catch((err: unknown) => logWarn('c1x:preload', err))
    .finally(() => set(true));
}

export function useC1xReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready || !started,
    () => true,
  );
}
