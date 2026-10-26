// Testantwort Kartenqualität (26.10.2026, docs/umbau/card-quality.md): `lexical-unit-check@1`.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';

function line(input: string, key: string): string {
  return new RegExp(`^${key}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';
}

/**
 * Keine Einheit, wenn die Gruppe auf „attempt(s)“ endet oder „unfamiliar“ enthält (freie Gruppen der Testdaten); bei „adaptive …“ mit der
 * üblichen Fassung „adaptive attacks“. Sonst eine Einheit. Grund kurz in der Oberflächensprache.
 */
export function lexicalUnitCheckReply(input: string): string {
  const phrase = line(input, 'Word group').toLowerCase();
  const de = /Explanation language: German/.test(input);
  const free = /\battempts?$/.test(phrase) || /\bunfamiliar\b/.test(phrase);
  if (!free) return JSON.stringify({ isUnit: true, better: null, why: de ? 'Das ist eine feste Verbindung, die man als Ganzes lernt.' : 'This is a fixed combination you learn as a whole.' });
  return JSON.stringify({
    isUnit: false,
    better: phrase.startsWith('adaptive ') ? 'adaptive attacks' : null,
    why: de ? 'Die Wörter stehen hier nur zufällig zusammen; jedes behält seine normale Bedeutung.' : 'The words only happen to stand together here; each keeps its normal meaning.',
  });
}

export function registerCardQualityReplies(): void {
  registerCannedReply('lexical-unit-check', lexicalUnitCheckReply);
}
