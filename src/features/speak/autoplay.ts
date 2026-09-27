import { KEY_PREFIX, local } from '../../platform/storage';

// „Antworten im Rollenspiel vorlesen“ (Plan D10): Bequemlichkeit im Browser, Standard an.

export const AUTOPLAY_KEY = `${KEY_PREFIX}speak-autoplay`;
export const autoplayOn = (): boolean => local.get(AUTOPLAY_KEY) !== '0';

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
