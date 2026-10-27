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

/** Erscheinungstag „2026-09-19“ als kurzes Datum („19. Sep.“ / „Sep 19“), nie als ISO-Zeichenkette (UX-Audit U1). Unlesbar → leer. */
export function formatPubDay(lang: RdrLang, pub: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((pub ?? '').trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

/**
 * Zeitangabe des Artikels je Sprache („2026-01“ → „Januar 2026“ / „January 2026“, „2026“ → „2026“).
 * Das Modell liefert nur `JJJJ` oder `JJJJ-MM`; ältere Artikel tragen noch Freitext („general state as of early 2026“):
 * daraus wird nur die Jahreszahl übernommen, damit nie englischer Modelltext in der deutschen Oberfläche steht. Ohne Jahr: leer.
 */
export function formatAsOf(lang: RdrLang, asOf: string | null | undefined): string {
  const m = /\b(20\d{2}|19\d{2})(?:-(0[1-9]|1[0-2]))?\b/.exec(asOf ?? '');
  if (!m) return '';
  const year = m[1] ?? '';
  if (!m[2]) return year;
  const month = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), Number(m[2]) - 1, 1)));
  return `${month} ${year}`;
}
