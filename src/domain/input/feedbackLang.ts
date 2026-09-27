import { detectLang } from '../lang/detect';

// Anzeige-Regel für gespeicherte KI-Rückmeldungen (Plan F19, R8, Kap. 15 „gemischte Sprache"):
// Eine Rückmeldung erscheint nur, wenn sie in der Oberflächensprache vorliegt. Neue Einträge
// tragen `lang`; bei Altdaten ohne `lang` entscheidet die Spracherkennung der Texte.
// Passt sie nicht: Hinweis und „auf {Sprache} neu prüfen", nie gemischt anzeigen.

export function feedbackLang(lang: unknown, texts: readonly string[]): 'de' | 'en' | null {
  if (lang === 'de' || lang === 'en') return lang;
  const joined = texts.filter(Boolean).join(' ');
  const d = detectLang(joined);
  return d === 'unknown' ? null : d;
}

/** Darf die Rückmeldung in der Oberflächensprache `ui` gezeigt werden? Unbekannt → ja. */
export function feedbackFits(lang: unknown, texts: readonly string[], ui: 'de' | 'en'): boolean {
  const l = feedbackLang(lang, texts);
  return l === null || l === ui;
}
