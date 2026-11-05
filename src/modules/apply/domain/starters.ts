import { hash32 } from '../shared';
import type { WriteKind } from './count';

// Starthilfe (W5 K9, Lehrer-Prüfung F3): auf Wunsch drei Satzanfänge zur Aufgabe – einer für den Einstieg, einer für den Hauptteil, einer für den Schluss.
// Feste Listen, kein KI-Aufruf. Beim Schreiben je Situation (ms01–ms12) genau drei Anfänge, die zur konkreten Aufgabe passen; beim Antworten und Zusammenfassen
// allgemeine Listen, die Wahl ist fest je Material (dieselbe Aufgabe zeigt dieselben Anfänge).
// Lehrer-Prüfung W5b: Kein Anfang enthält ein Zielmuster oder eine vorgegebene Wendung seiner Situation oder nimmt sie vorweg (z. B. kein „So far, we have …“
// bei Present Perfect, kein „If you were open to …“ bei Second Conditional, kein „I look forward to …“ bei vp.look-forward); die allgemeinen Listen enthalten
// keins der Muster und keine Wendung irgendeiner Situation (tests/unit/apply/w5.test.ts).
// Die Nutzung wird im Ergebnis vermerkt (zählt als Hilfe), die Pflicht ändert sich nicht. Rein. Satzanfänge enden mit „…“; Emrah tippt selbst weiter.

type Groups = readonly [open: readonly string[], body: readonly string[], close: readonly string[]];

const REPLY: Groups = [
  ['Thanks for letting me know that …', 'I completely understand that …', 'I appreciate you taking the time to …', 'Thank you for your quick reply about …'],
  ['As for your question about …, …', 'To make this as easy as possible for you, …', 'The good news is that …', 'At this point, I can offer …'],
  ['Could we set up a short call to …?', 'I am happy to …', 'Please let me know whether …', 'Thanks again for …'],
];

/** Je Mail-Situation (mail-situations.json) Einstieg, Hauptteil, Schluss – passend zur Aufgabe, ohne ihre Zielmuster und Wendungen. */
const SITUATION: Readonly<Record<string, readonly [string, string, string]>> = {
  ms01: ["Ahead of Friday's meeting, here is a short update on …", 'The most important result of the archive migration is …', 'If the committee has any questions, …'],
  ms02: ['Thank you for your message about the onboarding …', 'The main reason for the delay is …', 'Please let me know which day works best for …'],
  ms03: ['You asked when the new invoicing system will be ready, so …', 'The part that will take the most time is …', 'The date I can commit to is …'],
  ms04: ['I would like to invite you to a workshop on …', 'During the session, …', 'To prepare for the workshop, we need …'],
  ms05: ['Thank you for your request regarding …', 'We have looked carefully at your request, and …', 'We value our partnership and …'],
  ms06: ['As promised, here is my short review of …', 'The biggest problem during the pilot was …', 'For our next project, my main recommendation is …'],
  ms07: ["Here is a short summary of yesterday's outage, which …", 'Regarding our immediate response, …', 'To avoid a similar outage in the future, …'],
  ms08: ['Since you missed the budget meeting, here is …', 'The first topic on the agenda was …', 'If anything is unclear, just let me know and …'],
  ms09: ['I wanted to give you a heads-up about …', 'Our vendor has told us that …', "Let's discuss the options briefly before …"],
  ms10: ['Thank you for asking me to compare …', 'The main difference between the two offers is …', 'If you agree with my recommendation, …'],
  ms11: ['I am pleased to share our results for …', 'Turning to the numbers, …', 'In the coming quarter, we plan to …'],
  ms12: ['Thank you for your message, and I am sorry that …', 'Regarding the delivery itself, …', 'I will personally keep you informed about …'],
};

/** Ersatz für eine unbekannte Situation. */
const WRITE_ANY: Groups = [
  ['The reason for this email is …', 'Just a short note to let you know that …', 'Thank you for …'],
  ['The main point is that …', 'One thing to keep in mind is that …', 'The key question for us is …'],
  ['Please let me know if …', 'I am happy to answer any questions about …', 'Thanks again for …'],
];

const SUMMARY: Groups = [
  ['The article reports that …', 'According to the article, …', 'The article describes how …'],
  ['The main reason is that …', 'This matters because …', 'One key point is that …'],
  ['The article concludes that …', 'For companies, this means that …', 'In the long run, …'],
];

/** Alle Satzanfänge einer Disziplin (für Tests und die Prüfung der Listen); beim Schreiben die drei Anfänge der Situation `id`. */
export function starterGroups(kind: WriteKind, id = ''): Groups {
  if (kind === 'reply') return REPLY;
  if (kind === 'summary') return SUMMARY;
  const own = SITUATION[id];
  return own ? [[own[0]], [own[1]], [own[2]]] : WRITE_ANY;
}

/** Drei Satzanfänge (Einstieg, Hauptteil, Schluss), fest je Material (beim Schreiben: Kennung der Situation). */
export function startersFor(kind: WriteKind, materialId: string): string[] {
  return starterGroups(kind, materialId).map((g, k) => g[hash32(`${kind}|${materialId}|${k}`) % g.length] ?? g[0] ?? '');
}
