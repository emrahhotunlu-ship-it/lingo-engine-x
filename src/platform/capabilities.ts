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
  /**
   * In dieser Ansicht wurde ein vom Nutzer ausgelöster Aufruf beantwortet, ohne `not_granted` (der Vertrag bietet keine Abfrage der
   * Zustimmung, `contract/sample.d.ts`). Erst dann darf ein Hintergrundaufruf gesendet werden (kein Zustimmungsdialog ungefragt).
   */
  sampleConfirmed: boolean;
  /** Nach `not_granted` oder `rate_limited` ruhen alle Hintergrundaufrufe für den Rest der Ansicht. */
  backgroundPaused: boolean;
};

export const useCapabilities = create<CapState>(() => ({
  db: 'pending',
  sample: 'pending',
  downloads: 'pending',
  sampleRevoked: false,
  sampleConfirmed: false,
  backgroundPaused: false,
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

/**
 * „Sag es“ im Tagesplan: Ist `sample` nutzbar? Wartet höchstens `maxMs` auf die Antwort der
 * Laufzeit (sonst `false` – der Plan nimmt dann die bisherige Wahl). Kein Aufruf von `sample`.
 */
export async function sampleUsableWithin(maxMs: number): Promise<boolean> {
  const usable = (ns: unknown) => !!ns && !useCapabilities.getState().sampleRevoked;
  const s = useCapabilities.getState();
  if (s.sample !== 'pending') return s.sample === 'ready' && !s.sampleRevoked;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), maxMs);
  });
  try {
    return await Promise.race([capability('sample').then(usable), late]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function markSampleRevoked(): void {
  useCapabilities.setState({ sampleRevoked: true, backgroundPaused: true });
}

/** Ein Nutzer-Aufruf wurde beantwortet: Hintergrundaufrufe sind jetzt erlaubt (solange nicht pausiert). */
export function markSampleConfirmed(): void {
  if (!useCapabilities.getState().sampleConfirmed) useCapabilities.setState({ sampleConfirmed: true });
}

/** `rate_limited`: Hintergrundaufrufe ruhen für den Rest der Ansicht. */
export function pauseBackground(): void {
  if (!useCapabilities.getState().backgroundPaused) useCapabilities.setState({ backgroundPaused: true });
}

/** Nur für Tests. */
export function resetSampleConsent(): void {
  useCapabilities.setState({ sampleConfirmed: false, backgroundPaused: false });
}
