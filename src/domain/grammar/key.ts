import { asText } from '../text/str';

// Normalisierung und Aufgaben-Schlüssel der alten App (phase2-plan D2, §4.3).
// 1:1-Portierung von `norm` (models.js:223) und `key` (grammar.js:50). Der Schlüssel steht in
// `grammar/<topic>.seen` und im Pool; ein anderer Schlüssel zerbräche `seen`, den Pool-Abgleich
// und den Rückweg zur alten App. Deshalb hier nichts „verbessern".

/** Wie `norm` der alten App: Kleinschreibung, Apostrophe/Anführungszeichen vereinheitlicht, Kurzformen aufgelöst, Satzzeichen weg. */
export function legacyNorm(s: unknown): string {
  let x = asText(s)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  x = x
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/n't\b/g, ' not')
    .replace(/'ll\b/g, ' will')
    .replace(/'ve\b/g, ' have')
    .replace(/'re\b/g, ' are')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\bcan not\b/g, 'cannot');
  return x
    .replace(/[.,!?;:"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aufgaben-Schlüssel der alten App: nur Buchstaben des normalisierten Prompts, höchstens 80. */
export const legacyTaskKey = (prompt: string): string => legacyNorm(prompt).replace(/[^a-z]/g, '').slice(0, 80);
