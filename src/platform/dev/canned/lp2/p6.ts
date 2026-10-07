// Testantworten Lernplattform 2.0, Paket P6 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { cardExamplesReply, produceCheckReply } from '../../cannedReplies';

function line(input: string, key: string): string {
  return new RegExp(`^${key}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';
}

/**
 * `synonym-check@1`: gleichwertig, wenn die Antwort mit „syn“ beginnt (E2E), sonst nicht; kurzer Grund in der Oberflächensprache.
 */
export function synonymCheckReply(input: string): string {
  const given = line(input, 'Learner answer').toLowerCase();
  const de = /Explanation language: German/.test(input);
  const ok = given.startsWith('syn');
  return JSON.stringify({
    ok,
    why: ok ? (de ? 'Das passt hier genauso gut und bedeutet dasselbe.' : 'It fits here just as well and means the same.') : de ? 'Das passt hier nicht ganz: Die Bedeutung oder die Verbindung ist eine andere.' : 'It does not quite fit here: the meaning or the collocation is different.',
  });
}

/**
 * `produce-check@1` wie bisher, aber bei „wrong“ mit einer echten Korrektur (ein anderer Satz als der des Lernenden): nur dann wird
 * der Satz zum Fehlersatz (`src:'write'`, Lernplattform 2.0 §5.6).
 */
export function produceCheckReplyV2(input: string): string {
  const out = JSON.parse(produceCheckReply(input)) as { verdict?: string; fixed?: string };
  if (out.verdict === 'wrong' && typeof out.fixed === 'string') {
    const target = /^Target (?:word|phrase): (.*) \(meaning: /m.exec(input)?.[1]?.trim() ?? 'the word';
    out.fixed = `At work, we always use ${target} in a clear sentence.`;
  }
  return JSON.stringify(out);
}

/** Meldet die Testantworten von P6 an. */
export function registerLp2P6Replies(): void {
  registerCannedReply('card-examples', cardExamplesReply);
  registerCannedReply('synonym-check', synonymCheckReply);
  registerCannedReply('produce-check', produceCheckReplyV2);
}
