import { rdrDe, type RdrKey } from '../i18n/rdReader.de';
import { rdrEn } from '../i18n/rdReader.en';

// Texte des Lesers mit Platzhaltern {name}. Eigene Suche statt der App-Tabelle, damit der Leser auch läuft, bevor die Hauptsitzung
// `rdrDe`/`rdrEn` in src/i18n einträgt. Rein.

export type RdrLang = 'de' | 'en';
export type { RdrKey };

const DICTS: Record<RdrLang, Record<RdrKey, string>> = { de: rdrDe, en: rdrEn };

export function rdrText(lang: RdrLang, key: RdrKey, vars?: Record<string, string | number>): string {
  const template = DICTS[lang][key] ?? key;
  if (!vars) return template;
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : v;
  });
}

/** Schlüssel des Themas (`rdrTopic_<key>`); unbekannt = „Eigenes Thema“. */
export function topicKey(topic: string | null | undefined): RdrKey {
  const key = `rdrTopic_${topic ?? 'custom'}` as RdrKey;
  return key in rdrDe ? key : 'rdrTopic_custom';
}
