// Testantworten Lernplattform 2.0, Paket P2 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';

const line = (input: string, label: string): string => new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';

/** Feste, realistische Antwort für `explain-answer@1`: nennt die Antwort des Lernenden und die richtige Lösung. */
export function explainAnswerReply(input: string): string {
  const given = line(input, 'Learner answer') || '…';
  const answer = line(input, 'Correct answer') || '…';
  return JSON.stringify({
    de: `„${given}“ passt hier nicht: Das Signalwort im Satz verlangt „${answer}“. Die Form, die du gewählt hast, meint etwas anderes.`,
    en: `“${given}” does not fit here: the signal in the sentence calls for “${answer}”. The form you chose means something different.`,
  });
}

/** Meldet die Testantworten von P2 an. */
export function registerLp2P2Replies(): void {
  registerCannedReply('explain-answer', explainAnswerReply);
}
