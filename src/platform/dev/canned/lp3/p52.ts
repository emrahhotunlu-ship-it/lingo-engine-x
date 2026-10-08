// Testantworten Lernplattform 3.0, Paket P52 (Wörter-Tutor, word-ctx@1). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';

type Line = { id: string; word: string; meaning: string; other: string | null; otherMeaning: string };

/** Die Wortzeilen der Vorlage: `- id=… | word=… | … | meaning=… | … | confused with=X (…)`. */
export function wordCtxLines(input: string): Line[] {
  const out: Line[] = [];
  for (const m of input.matchAll(/^- id=([^|]+?) \| word=([^|]+?) \|.*$/gm)) {
    const conf = /\| confused with=(.+?) \((.*)\)$/.exec(m[0]);
    const meaning = /\| meaning=([^|]+?) \|/.exec(m[0])?.[1]?.trim() ?? '';
    out.push({ id: (m[1] ?? '').trim(), word: (m[2] ?? '').trim(), meaning: meaning === '-' ? '' : meaning, other: conf?.[1]?.trim() ?? null, otherMeaning: (conf?.[2] ?? '').trim() });
  }
  return out;
}

const bare = (w: string): string => w.replace(/^to\s+/i, '');

/**
 * Feste, realistische Antwort für `word-ctx@1`: je Wort zwei Sätze in einem neutralen Rahmen, der für jede Wortart passt (das Wort genau einmal),
 * bei „confused with“ ein Kontrast-Satz mit dem anderen Wort und einer Begründung wie im Beispiel der Vorlage (beide Wörter mit Bedeutung).
 * Marker im Wort: `zzuk` → der erste Satz ist britisch geschrieben (fällt bei der Prüfung weg).
 */
export function wordCtxReply(input: string): string {
  const items = wordCtxLines(input).map((l) => {
    const w = bare(l.word);
    const first = /zzuk/i.test(l.word)
      ? `In the client call, Maria used the word ${w} to describe our new colour scheme.`
      : `In the client call, Maria used the word ${w} to describe our new project plan.`;
    const o = l.other ? bare(l.other) : '';
    return {
      id: l.id,
      sents: [
        {
          en: first,
          de: 'Im Kundentermin hat Maria dieses Wort benutzt, um unseren neuen Projektplan zu beschreiben.',
          sit: 'client call',
        },
        {
          en: `At dinner last night, my sister said ${w} twice while telling us about her trip.`,
          de: 'Beim Abendessen gestern hat meine Schwester das Wort zweimal gesagt, als sie von ihrer Reise erzählt hat.',
          sit: 'family dinner',
        },
      ],
      contrast: l.other
        ? {
            en: `In the meeting on Monday morning, the team chose the word ${o} for the final slide.`,
            why: {
              de: `${o} heißt ${l.otherMeaning || 'etwas anderes'}, ${w} heißt ${l.meaning || 'etwas anderes'}: hier ist die Bedeutung von ${o} gemeint, deshalb passt nur dieses Wort.`,
              en: `${o} and ${w} have different meanings, and this sentence needs the meaning of ${o}, so ${w} would change what it says.`,
            },
          }
        : null,
    };
  });
  return JSON.stringify({ items });
}

export function registerLp3P52Replies(): void {
  registerCannedReply('word-ctx', wordCtxReply);
}
