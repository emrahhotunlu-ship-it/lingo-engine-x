import { KEY_PREFIX, local } from '../../platform/storage';

// „Was ist neu" (Funktionsabgleich M20): ein einmaliger, kurzer Hinweis nach einem Update. Der
// Merker steht nur im Browser (Bequemlichkeit, Kap. 3.1) – im nächsten Browser erscheint er einmal
// mehr, das ist gewollt. Bei einem neuen Update wird nur die Kennung erhöht.

export const WHATS_NEW_VERSION = '2026-09-27-stand';
export const WHATS_NEW_KEY = `${KEY_PREFIX}whats-new`;

export const whatsNewSeen = (): boolean => local.get(WHATS_NEW_KEY) === WHATS_NEW_VERSION;

export function markWhatsNewSeen(): void {
  local.set(WHATS_NEW_KEY, WHATS_NEW_VERSION);
}
