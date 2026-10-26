// Testantwort Kartenqualität (26.10.2026, docs/umbau/card-quality.md): `lexical-unit-check@1`.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';

function line(input: string, key: string): string {
  return new RegExp(`^${key}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';
}

/**
 * Keine Einheit, wenn die Gruppe auf „attempt(s)“ endet oder „unfamiliar“ enthält (freie Gruppen der Testdaten); `better` in Wörterbuchform:
 * bei „adaptive …“ die übliche Fassung „adaptive attack“, bei „adapt to …“ die Einheit darin. Sonst eine Einheit. Grund kurz (höchstens
 * 15 Wörter) in der Oberflächensprache, nennt richtiges Englisch nie falsch.
 */
export function lexicalUnitCheckReply(input: string): string {
  const phrase = line(input, 'Word group').toLowerCase();
  const de = /Explanation language: German/.test(input);
  const free = /\battempts?$/.test(phrase) || /\bunfamiliar\b/.test(phrase);
  if (!free) return JSON.stringify({ isUnit: true, better: null, why: de ? 'Das ist eine feste Verbindung, die man als Ganzes lernt.' : 'This is a fixed combination you learn as a whole.' });
  return JSON.stringify({
    isUnit: false,
    better: phrase.startsWith('adaptive ') ? 'adaptive attack' : phrase.startsWith('adapt to ') ? 'adapt to' : null,
    why: de ? 'Richtiges Englisch, aber eine freie Verbindung: Jedes Wort behält seine normale Bedeutung.' : 'Correct English, but a free combination: each word keeps its normal meaning.',
  });
}

export function registerCardQualityReplies(): void {
  registerCannedReply('lexical-unit-check', lexicalUnitCheckReply);
}
