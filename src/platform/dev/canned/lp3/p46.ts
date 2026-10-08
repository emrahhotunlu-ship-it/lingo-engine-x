// Testantworten Lernplattform 3.0, Paket P46 (Satz-Klinik, sentence-clinic@1). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';

const NOT_JSON = 'Hier ist meine Einschätzung, aber leider ohne das verlangte Format.';

/** Der Satz zwischen den Markern der Vorlage. */
export function clinicSentenceOf(input: string): string {
  return /<<<TEXT\n([\s\S]*?)\nTEXT>>>/.exec(input)?.[1]?.trim() ?? '';
}

export type Rule = { from: string; to: string; kind: string; pat: string | null; de: string; en: string };
export const CLINIC_RULES: Rule[] = [
  { from: 'discussed about', to: 'discussed', kind: 'grammar', pat: 'prp.no-prep', de: 'Nach „discuss“ steht kein „about“.', en: 'There is no “about” after “discuss”.' },
  { from: 'informations', to: 'information', kind: 'grammar', pat: 'cnt.uncount', de: '„information“ ist nicht zählbar und hat kein -s.', en: '“Information” is uncountable and takes no -s.' },
  { from: 'depends of', to: 'depends on', kind: 'collocation', pat: 'prp.verb-prep', de: 'Es heißt „depend on“.', en: 'The fixed phrase is “depend on”.' },
  { from: 'I am agree', to: 'I agree', kind: 'grammar', pat: null, de: '„agree“ ist ein Verb, hier steht kein „am“.', en: '“Agree” is a verb, so there is no “am”.' },
  { from: 'in the next week', to: 'next week', kind: 'grammar', pat: null, de: 'Vor „next week“ steht keine Präposition.', en: 'There is no preposition before “next week”.' },
];

/**
 * Feste, realistische Antwort für `sentence-clinic@1`. Der Satz entscheidet: enthält er eine Stelle aus der Tabelle, kommt `minor` mit den
 * Änderungen, sonst `correct`. Marker im Satz steuern Fehlerfälle: `zzjson` → kein JSON, `zzschema` → beim ersten Aufruf ungültige Form (der Neuversuch
 * mit angehängtem Mangel ist gültig), `zzfake` → dazu eine erfundene Stelle (fällt weg), `zzcorrect` → beim ersten Aufruf `correct` mit Änderungen
 * (der Neuversuch ist gültig), `zzstyle` → `register: informal` mit Tonhinweis und eine reine Verbesserung (`upgrade`).
 */
export function sentenceClinicReply(input: string): string {
  const sentence = clinicSentenceOf(input);
  const de = /^Explanation language: German$/m.test(input);
  const retry = input.includes('did not match the required format');
  if (/zzjson/i.test(sentence)) return NOT_JSON;
  if (/zzschema/i.test(sentence) && !retry) return JSON.stringify({ verdict: 'minor', why: 'kaputt' });
  const clean = sentence.replace(/\bzz[a-z]+\b/gi, '').replace(/\s+/g, ' ').trim();
  const hits = CLINIC_RULES.filter((r) => clean.toLowerCase().includes(r.from.toLowerCase()));
  const edits: Array<Record<string, unknown>> = hits.map((r) => ({ from: r.from, to: r.to, kind: r.kind, sev: 'error', pat: r.pat, why: de ? r.de : r.en }));
  if (/zzfake/i.test(sentence)) {
    edits.push({ from: 'a phrase that is not in the sentence', to: 'x', kind: 'grammar', sev: 'error', pat: null, why: de ? 'Diese Stelle gibt es nicht.' : 'This span does not exist.' });
  }
  if (/zzstyle/i.test(sentence)) {
    edits.push({ from: 'tell you', to: 'let you know', kind: 'word', sev: 'upgrade', pat: null, why: de ? 'So klingt es in einer Mail höflicher.' : 'This sounds more polite in an email.' });
  }
  let fixed = clean;
  for (const r of hits) fixed = fixed.replace(new RegExp(r.from, 'i'), r.to);
  const style = /zzstyle/i.test(sentence);
  const wrongFirst = /zzcorrect/i.test(sentence) && !retry;
  const verdict = hits.length > 0 ? 'minor' : 'correct';
  if (wrongFirst) {
    return JSON.stringify({ verdict: 'correct', fixed: '', edits: [{ from: clean.split(' ')[0] ?? 'We', to: 'They', kind: 'word', sev: 'error', pat: null, why: de ? 'Ein anderes Wort passt besser.' : 'A different word fits better.' }], better: '', register: 'neutral', note: '', good: de ? 'Die Wortwahl passt gut zum Anlass.' : 'The word choice suits the occasion well.' });
  }
  return JSON.stringify({
    verdict,
    fixed: verdict === 'correct' ? '' : fixed,
    edits: verdict === 'correct' ? [] : edits,
    better: verdict === 'correct' ? 'We should align on the revised timeline before the audit starts.' : fixed.replace(/\bdiscussed\b/i, 'went over'),
    register: style ? 'informal' : 'neutral',
    good: de ? 'Der Satz ist klar gebaut und passt zum Anlass.' : 'The sentence is clearly built and suits the occasion.',
    note: style ? (de ? 'Für eine Mail an den CFO klingt das zu locker.' : 'This sounds too casual for an email to the CFO.') : '',
  });
}

/** Meldet die Testantworten von P46 an. */
export function registerLp3P46Replies(): void {
  registerCannedReply('sentence-clinic', sentenceClinicReply);
}
