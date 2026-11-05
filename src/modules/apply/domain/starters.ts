import { hash32 } from '../shared';
import type { WriteKind } from './count';

// Starthilfe (W5 K9, Lehrer-Prüfung F3): auf Wunsch drei Satzanfänge zur Aufgabe – einer für den Einstieg, einer für den Hauptteil, einer für den Schluss.
// Feste Listen je Disziplin (beim Schreiben je Situationsart), kein KI-Aufruf. Die Wahl ist fest je Material (dieselbe Aufgabe zeigt dieselben Anfänge).
// Die Nutzung wird im Ergebnis vermerkt (zählt als Hilfe), die Pflicht ändert sich nicht. Rein. Satzanfänge enden mit „…“; Emrah tippt selbst weiter.

type Groups = readonly [open: readonly string[], body: readonly string[], close: readonly string[]];

const REPLY: Groups = [
  ['Thanks for letting me know that …', 'I completely understand that …', 'I appreciate you taking the time to …', 'Thank you for your quick reply about …'],
  ['As for your question about …, …', 'To make this as easy as possible for you, …', 'The good news is that …', 'What I can offer at this point is …'],
  ['Would it make sense to …?', 'Could we set up a short call to …?', 'I would be happy to …', 'Please let me know whether …'],
];

const WRITE: Readonly<Record<string, Groups>> = {
  'status update': [
    ['I wanted to give you a quick update on …', 'Here is where we stand on …', 'Ahead of …, here is a short summary of …'],
    ['So far, we have …', 'This week, the team is focusing on …', 'One point that needs your attention is …'],
    ['Our next step is to …', 'I will keep you posted on …', 'Please let me know if you need …'],
  ],
  'client email': [
    ['Thank you for raising this with us.', 'I am writing to explain …', 'I would like to invite you to …'],
    ['Over the past few weeks, we have …', 'To give you a clear picture, …', 'What we need from your side is …'],
    ['I would be happy to walk you through …', 'Please do not hesitate to contact me if …', 'I look forward to …'],
  ],
  negotiation: [
    ['Thank you for your request regarding …', 'I have looked closely at …', 'I appreciate your openness about …'],
    ['What we can offer is …', 'We would be able to … if …', 'Unfortunately, we are not in a position to …'],
    ['I hope this gives us a good basis to …', 'If you were open to …, we could …', 'I look forward to finding a solution that …'],
  ],
  escalation: [
    ['I am sorry for the trouble this has caused.', 'I want to update you on …', 'Thank you for your patience while we …'],
    ['As soon as we heard about …, we …', 'Our first analysis shows that …', 'To prevent this from happening again, we …'],
    ['I will keep you updated on …', 'I recommend that we …', 'Please let me know if you would like to …'],
  ],
};

const WRITE_ANY: Groups = [
  ['I am writing to …', 'Just a short note to let you know that …', 'Thank you for …'],
  ['The main point is that …', 'At the moment, we are …', 'One thing to keep in mind is that …'],
  ['Our next step is to …', 'Please let me know if …', 'I look forward to …'],
];

const SUMMARY: Groups = [
  ['The article reports that …', 'According to the article, …', 'The article describes how …'],
  ['The main reason is that …', 'This matters because …', 'One key point is that …'],
  ['As a result, …', 'The article concludes that …', 'Looking ahead, …'],
];

/** Alle Satzanfänge einer Disziplin (für Tests und die Prüfung der Listen). */
export function starterGroups(kind: WriteKind, sit = ''): Groups {
  if (kind === 'reply') return REPLY;
  if (kind === 'summary') return SUMMARY;
  return WRITE[sit.toLowerCase()] ?? WRITE_ANY;
}

/** Drei Satzanfänge (Einstieg, Hauptteil, Schluss), fest je Material. */
export function startersFor(kind: WriteKind, materialId: string, sit = ''): string[] {
  return starterGroups(kind, sit).map((g, k) => g[hash32(`${kind}|${materialId}|${k}`) % g.length] ?? g[0] ?? '');
}
