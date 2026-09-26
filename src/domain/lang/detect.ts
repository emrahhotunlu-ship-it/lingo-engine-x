// Sprachtreue (Kap. 10): Ist ein Text Deutsch oder Englisch? Grobe, aber verlässliche
// Schätzung über häufige Funktionswörter und Umlaute. Zitierte Stellen („…“, “…”, "…", ‚…‘,
// «…», […]) zählen nicht mit, denn deutsche Erklärungen zitieren oft englische Wendungen.
// Im Zweifel lautet das Ergebnis 'unknown'; nur ein eindeutiges Ergebnis darf eine
// KI-Antwort als „falsche Sprache" zurückweisen.

export type DetectedLang = 'de' | 'en' | 'unknown';

// Wörter, die es in beiden Sprachen gibt (in, so, was, will, also, an, am, man, war …), fehlen absichtlich.
const DE_WORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'nicht', 'kein', 'keine', 'ist', 'sind', 'wird', 'werden', 'wurde', 'hat', 'haben',
  'kann', 'muss', 'soll', 'sollte', 'mit', 'auf', 'für', 'von', 'vom', 'zum', 'zur', 'im', 'ins', 'bei',
  'nach', 'aus', 'als', 'wie', 'auch', 'noch', 'schon', 'nur', 'sehr', 'hier', 'dass', 'wenn', 'weil',
  'sich', 'es', 'du', 'ich', 'wir', 'ihr', 'sie', 'dein', 'deine', 'deinem', 'deinen', 'ihre', 'zu',
  'bedeutet', 'heißt', 'steht', 'gibt', 'passt', 'klingt', 'fehlt', 'meist', 'oft', 'etwas', 'dieser',
  'diese', 'dieses', 'diesem', 'einfach', 'richtig', 'falsch', 'satz', 'wort', 'wörter',
]);

const EN_WORDS = new Set([
  'the', 'a', 'and', 'or', 'but', 'not', 'no', 'is', 'are', 'were', 'be', 'been', 'being',
  'of', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'as', 'it', 'its', 'this', 'that', 'these', 'those',
  'you', 'your', 'we', 'they', 'their', 'he', 'she', 'his', 'her', 'there', 'here', 'what', 'which',
  'who', 'how', 'when', 'if', 'than', 'more', 'can', 'could', 'would', 'should', 'do', 'does', 'did',
  'has', 'have', 'had', 'means', 'used', 'use', 'often', 'usually', 'very', 'sentence', 'word', 'words',
  'correct', 'wrong', 'about', 'into', 'only', 'because',
]);

const QUOTED = /„[^“”"]*[“”"]|“[^”]*”|"[^"]*"|‚[^‘’']*[‘’']|«[^»]*»|»[^«]*«|‘[^’]*’|\[[^\]]*\]/g;
const WORD = /[A-Za-zÄÖÜäöüß]+(?:['’][A-Za-z]+)?/g;
const UMLAUT = /[äöüÄÖÜß]/;

/** Entfernt zitierte Stellen, damit nur der erklärende Text zählt. */
export function stripQuoted(text: string): string {
  return text.replace(QUOTED, ' ');
}

/** Anzahl der Wörter (für die Regel „erst ab 4 Wörtern prüfen"). */
export function wordCount(text: string): number {
  return (stripQuoted(text).match(WORD) ?? []).length;
}

export function langScores(text: string): { de: number; en: number } {
  let de = 0;
  let en = 0;
  for (const raw of stripQuoted(text).match(WORD) ?? []) {
    const w = raw.toLowerCase().replace(/[’]/g, "'");
    if (UMLAUT.test(w)) de += 1;
    if (DE_WORDS.has(w)) de += 1;
    else if (EN_WORDS.has(w)) en += 1;
  }
  return { de, en };
}

/** 'de' oder 'en' nur bei deutlichem Übergewicht (mehr als doppelt so viele Treffer). */
export function detectLang(text: string): DetectedLang {
  const { de, en } = langScores(text);
  if (de === 0 && en === 0) return 'unknown';
  if (de > en * 2) return 'de';
  if (en > de * 2) return 'en';
  return 'unknown';
}

/** Liegt der Text erkennbar in der anderen Sprache als erwartet? Kurze Texte (< minWords) nie. */
export function isWrongLang(text: string, expected: 'de' | 'en', minWords = 4): boolean {
  if (wordCount(text) < minWords) return false;
  const got = detectLang(text);
  return got !== 'unknown' && got !== expected;
}
