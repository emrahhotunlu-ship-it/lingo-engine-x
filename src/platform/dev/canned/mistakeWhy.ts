// Testantwort für `mistake-why@1` (Neustart E1, 08.11.2026). Nur Entwicklung und Tests – nie Teil des Produktions-Builds.
import { registerCannedReply } from '../fakeSample';

const line = (input: string, label: string): string => new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';

/** `zzjson` in der Antwort → kein JSON; `zzschema` → erst ungültig (nennt die Form nicht), der Neuversuch mit angehängtem Mangel ist gültig. */
export function mistakeWhyReply(input: string): string {
  const given = line(input, 'Learner answer');
  const du = line(input, 'Wrong part \\(learner\\)') || given;
  const richtig = line(input, 'Correct part');
  if (/zzjson/i.test(given)) return 'Leider kein JSON.';
  if (/zzschema/i.test(given) && !/did not match the required format/.test(input)) {
    return JSON.stringify({ warum: { de: 'Hier gilt eine allgemeine Regel.', en: 'A general rule applies here.' }, nochmal: null });
  }
  if (/zzalso/i.test(given)) {
    return JSON.stringify({ warum: { de: `„${du}“ ist hier auch gutes Englisch.`, en: `“${du}” is also good English here.` }, alsoOk: true, nochmal: null });
  }
  // Der Hinweis im Satz: das erste längere Wort der Aufgabe, das weder die eigene noch die richtige Form ist (wie es das Schema verlangt).
  const own = new Set(`${du} ${richtig}`.toLowerCase().split(/[^a-z']+/));
  const clue = line(input, 'Task').toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z']+/).find((w) => w.length >= 4 && !own.has(w)) ?? 'here';
  return JSON.stringify({
    warum: {
      de: `„${du}“ passt hier nicht, weil „${clue}“ im Satz „${richtig}“ verlangt.`,
      en: `“${du}” does not fit here because “${clue}” in the sentence calls for “${richtig}”.`,
    },
    alsoOk: false,
    nochmal: { en: 'If the client ___ (sign) the contract today, we will start next week.', answer: 'signs', accepted: [] },
  });
}

export function registerMistakeWhyReplies(): void {
  registerCannedReply('mistake-why', mistakeWhyReply);
}
