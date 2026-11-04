import { ensureLang } from '../../src/i18n/dicts';

// Großpaket C: Englisch wird in der App erst bei Bedarf geladen; die Unit-Tests prüfen beide Sprachen synchron, also vorab laden.
await ensureLang('en');
