import { KEY_PREFIX, local } from '../../platform/storage';

// „Antworten im Rollenspiel vorlesen“ (Plan D10): Bequemlichkeit im Browser, Standard an.

export const AUTOPLAY_KEY = `${KEY_PREFIX}speak-autoplay`;
export const autoplayOn = (): boolean => local.get(AUTOPLAY_KEY) !== '0';
