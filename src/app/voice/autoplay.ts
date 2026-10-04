import { create } from 'zustand';
import { KEY_PREFIX, local } from '../../platform/storage';

// „Antworten im Rollenspiel vorlesen“ (Plan D10): Bequemlichkeit im Browser, Standard an.

// Anruf-Modus (B9, Markt DU5): Die Figur spricht per Sprachausgabe, ihr Text bleibt verdeckt, bis
// Emrah tippt; er antwortet laut und diktiert mit der Diktiertaste der iPhone-Tastatur. Nur eine
// Bequemlichkeit im Browser (Standard aus); im Anruf-Modus wird immer vorgelesen.
export const CALL_KEY = `${KEY_PREFIX}speak-call`;
export const useCallMode = create<{ on: boolean }>(() => ({ on: local.get(CALL_KEY) === '1' }));
export function setCallMode(on: boolean): void {
  local.set(CALL_KEY, on ? '1' : '0');
  useCallMode.setState({ on });
}

export const AUTOPLAY_KEY = `${KEY_PREFIX}speak-autoplay`;
/** Einstellung „Antworten vorlesen“ (Standard an). */
export const autoplayOn = (): boolean => local.get(AUTOPLAY_KEY) !== '0';
/** Wird vorgelesen? Laut Einstellung – im Anruf-Modus immer. */
export const speakRepliesOn = (): boolean => autoplayOn() || useCallMode.getState().on;

/**
 * Eröffnung der Szene vorlesen, sobald das Rollenspiel steht (nicht schon im Einweisungsblatt):
 * Der Bildschirmwechsel hängt die Einweisung sofort aus, und deren Aufräumen würde eine eben
 * begonnene Ausgabe wieder abbrechen. `unlockSpeech()` passiert weiterhin im Tipp selbst.
 */
let pendingOpening: string | null = null;
export function queueOpening(text: string | null): void {
  pendingOpening = text;
}
export function takeOpening(): string | null {
  const t = pendingOpening;
  pendingOpening = null;
  return t;
}
