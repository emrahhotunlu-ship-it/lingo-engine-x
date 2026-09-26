import pronRaw from '../../content/pron/us-ipa.json?raw';
import { logError } from '../../platform/diagnostics';
import { usSpelling } from '../text/lemma';
import { normalizeWord } from '../text/tokenize';

// Amerikanische Lautschrift (IPA) aus der eingebetteten CMU-Teilmenge (Entwurf §0.9, §10.2).
// Die Datei wird als Text eingebettet und erst beim ersten Gebrauch geparst: kein Aufwand beim Start.
// Erzeugt von scripts/build-pron.mjs (npm run pron); Daten © Carnegie Mellon University, BSD-Lizenz.

let table: Map<string, string> | null = null;

function pron(): Map<string, string> {
  if (table) return table;
  const map = new Map<string, string>();
  try {
    const parsed: unknown = JSON.parse(pronRaw);
    if (parsed && typeof parsed === 'object') {
      for (const [word, ipa] of Object.entries(parsed)) if (typeof ipa === 'string') map.set(word, ipa);
    }
  } catch (err) {
    logError('lexicon:pron', err, 'us-ipa.json nicht lesbar');
  }
  table = map;
  return map;
}

function single(word: string): string | null {
  const t = pron();
  return t.get(word) ?? t.get(usSpelling(word)) ?? null;
}

/** Nachschlage-Form: Kleinschreibung, gerade Apostrophe; bei Wendungen ohne führendes „to" und ohne Auslassungszeichen. */
function lookupForm(word: string): string {
  const n = normalizeWord(word)
    .replace(/(\s*(…|\.\.\.))+$/u, '')
    .trim();
  return n.includes(' ') ? n.replace(/^to /, '') : n;
}

/**
 * US-Lautschrift ohne Schrägstriche, z. B. reliable → „rɪˈlaɪəbəl", oder `null`.
 * Britische Schreibweisen gehen über die US-Form (analyse → analyze). Wendungen und
 * Bindestrich-Wörter ohne eigenen Eintrag werden aus ihren Teilen zusammengesetzt
 * (carry out → „ˈkæri aʊt"), aber nur, wenn jeder Teil bekannt ist.
 */
export function ipaOf(word: string): string | null {
  const n = lookupForm(word);
  if (!n) return null;
  const direct = single(n);
  if (direct) return direct;
  const parts = n.match(/\p{L}+(?:'\p{L}+)*/gu) ?? [];
  if (parts.length < 2) return null;
  const ipas = parts.map(single);
  return ipas.every((x): x is string => x !== null) ? ipas.join(' ') : null;
}

/** Steht das Wort (oder seine US-Form) in der Lautschrift-Liste? Die Liste enthält nur in CMU belegte Wörter. */
export function hasIpa(word: string): boolean {
  const n = normalizeWord(word);
  return n.length > 0 && single(n) !== null;
}
