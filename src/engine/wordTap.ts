import { create } from 'zustand';
import type { Token } from '../domain/text/types';

// Wort-Antippen (Plan §5.6): Anfrage eines angetippten Worts und der offene Zustand des
// Nachschlage-Fensters. Die Zeit, in der das Fenster offen ist, zählt nicht zur Antwortzeit.

export type WordTapArea = 'trainer' | 'intro' | 'summary' | 'lookup';

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
  /**
   * Was vor dem Antippen den Fokus hatte (z. B. die Lücke). Nach dem Schließen geht der Fokus
   * dorthin zurück, sonst auf das Wort – so kommt am iPhone auch die Tastatur wieder.
   */
  returnFocus?: HTMLElement | null;
};

type LookupState = { req: WordTapRequest | null; openedAt: number; openMsTotal: number };

export const useLookup = create<LookupState>(() => ({ req: null, openedAt: 0, openMsTotal: 0 }));

export function openLookup(req: WordTapRequest): void {
  const s = useLookup.getState();
  const now = performance.now();
  const add = s.req ? now - s.openedAt : 0;
  useLookup.setState({ req, openedAt: now, openMsTotal: s.openMsTotal + add });
}

/** Wohin der Fokus nach dem Schließen geht: vorheriger Fokus, sonst das Wort. */
export function focusTargetOf(req: Pick<WordTapRequest, 'anchor' | 'returnFocus'>): HTMLElement | null {
  const back = req.returnFocus;
  if (back && back.isConnected && back !== document.body) return back;
  return req.anchor && req.anchor.isConnected ? req.anchor : null;
}

/**
 * Schließt das Fenster. Der Fokus geht SYNCHRON zurück (im selben Tippen/Klick), denn nur
 * dann öffnet iOS die Tastatur wieder (A7.4). Liegt der Fokus schon woanders außerhalb des
 * Fensters, bleibt er dort.
 */
export function closeLookup(opts: { restoreFocus?: boolean } = {}): void {
  const s = useLookup.getState();
  const req = s.req;
  if (!req) return;
  useLookup.setState({ req: null, openedAt: 0, openMsTotal: s.openMsTotal + (performance.now() - s.openedAt) });
  if (opts.restoreFocus === false) return;
  const active = document.activeElement;
  const inDialog = active instanceof Element && !!active.closest('[data-testid="lookup"]');
  if (active && active !== document.body && !inDialog) return;
  focusTargetOf(req)?.focus({ preventScroll: true });
}

/** Gesamtzeit mit offenem Nachschlage-Fenster (ms, steigt nur) – für die Antwortzeit. */
export function lookupOpenMs(): number {
  const s = useLookup.getState();
  return s.openMsTotal + (s.req ? performance.now() - s.openedAt : 0);
}
