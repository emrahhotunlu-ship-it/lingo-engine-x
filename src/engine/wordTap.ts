import { create } from 'zustand';
import type { Token } from '../domain/text/types';

// Wort-Antippen (Plan §5.6): Anfrage eines angetippten Worts und der offene Zustand des
// Nachschlage-Fensters. Die Zeit, in der das Fenster offen ist, zählt nicht zur Antwortzeit.

// Phase 5: 'companion' (Antwort im Begleiter), 'translate' (Übersetzer), 'preply' (Plan, Import)
export type WordTapArea = 'trainer' | 'intro' | 'summary' | 'lookup' | 'companion' | 'translate' | 'preply';

export type WordTapRequest = {
  surface: string;
  /** Der ganze Satz (ohne Lückenklammern). */
  text: string;
  start: number;
  end: number;
  tokens: readonly Token[];
  index: number;
  area: WordTapArea;
  /** Quelle, z. B. `vocab/persuade` → `origin.ref` einer gespeicherten Karte. */
  source: string | null;
  /** Titel der Quelle (Wort der Karte). */
  title?: string | null;
  anchor: HTMLElement | null;
};

type LookupState = { req: WordTapRequest | null; openedAt: number; openMsTotal: number };

export const useLookup = create<LookupState>(() => ({ req: null, openedAt: 0, openMsTotal: 0 }));

export function openLookup(req: WordTapRequest): void {
  const s = useLookup.getState();
  const now = performance.now();
  const add = s.req ? now - s.openedAt : 0;
  useLookup.setState({ req, openedAt: now, openMsTotal: s.openMsTotal + add });
}

export function closeLookup(): void {
  const s = useLookup.getState();
  if (!s.req) return;
  useLookup.setState({ req: null, openedAt: 0, openMsTotal: s.openMsTotal + (performance.now() - s.openedAt) });
}

/** Gesamtzeit mit offenem Nachschlage-Fenster (ms, steigt nur) – für die Antwortzeit. */
export function lookupOpenMs(): number {
  const s = useLookup.getState();
  return s.openMsTotal + (s.req ? performance.now() - s.openedAt : 0);
}
