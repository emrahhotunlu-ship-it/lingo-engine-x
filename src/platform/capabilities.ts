import { create } from 'zustand';
import { capability } from './runtime';
import type { Db, Downloads, SampleFn } from './types';

// Verfügbarkeit der Fähigkeiten als App-Zustand. `pending` = Laufzeit hat noch nicht
// geantwortet (bis zu 10 s), `ready` = nutzbar, `absent` = in dieser Ansicht nicht verfügbar.

export type CapStatus = 'pending' | 'ready' | 'absent';

type CapState = {
  db: CapStatus;
  sample: CapStatus;
  downloads: CapStatus;
  /** `sample` wurde abgelehnt (not_granted & Co.) – Funktion für diese Ansicht ausblenden. */
  sampleRevoked: boolean;
};

export const useCapabilities = create<CapState>(() => ({
  db: 'pending',
  sample: 'pending',
  downloads: 'pending',
  sampleRevoked: false,
}));

let dbNs: Db | null = null;
let sampleNs: SampleFn | null = null;
let downloadsNs: Downloads | null = null;
let started = false;

export function initCapabilities(): void {
  if (started) return;
  started = true;
  void capability('db').then((ns) => {
    dbNs = ns;
    useCapabilities.setState({ db: ns ? 'ready' : 'absent' });
  });
  void capability('sample').then((ns) => {
    sampleNs = ns;
    useCapabilities.setState({ sample: ns ? 'ready' : 'absent' });
  });
  void capability('downloads').then((ns) => {
    downloadsNs = ns;
    useCapabilities.setState({ downloads: ns ? 'ready' : 'absent' });
  });
}

export const getDb = (): Db | null => dbNs;
export const getSample = (): SampleFn | null => (useCapabilities.getState().sampleRevoked ? null : sampleNs);
export const getDownloads = (): Downloads | null => downloadsNs;

/** Wartet auf die Antwort der Laufzeit zur Datenbank. */
export async function waitForDb(): Promise<Db | null> {
  return capability('db');
}

export function markSampleRevoked(): void {
  useCapabilities.setState({ sampleRevoked: true });
}
