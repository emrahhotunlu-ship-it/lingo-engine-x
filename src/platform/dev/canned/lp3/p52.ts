// Testantworten Lernplattform 3.0, Paket P52 (Wörter-Tutor, word-ctx@1). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';

type Line = { id: string; word: string; other: string | null };

/** Die Wortzeilen der Vorlage: `- id=… | word=… | … | confused with=X (…)`. */
export function wordCtxLines(input: string): Line[] {
  const out: Line[] = [];
  for (const m of input.matchAll(/^- id=([^|]+?) \| word=([^|]+?) \|.*$/gm)) {
    const other = /\| confused with=(.+?) \(/.exec(m[0])?.[1]?.trim() ?? null;
    out.push({ id: (m[1] ?? '').trim(), word: (m[2] ?? '').trim(), other });
  }
  return out;
}

const bare = (w: string): string => w.replace(/^to\s+/i, '');

/**
 * Feste, realistische Antwort für `word-ctx@1`: je Wort zwei Sätze, bei „confused with“ ein Kontrast-Satz mit dem anderen Wort.
 * Marker im Wort: `zzuk` → der erste Satz ist britisch geschrieben (fällt bei der Prüfung weg).
 */
export function wordCtxReply(input: string): string {
  const items = wordCtxLines(input).map((l) => {
    const w = bare(l.word);
    const first = /zzuk/i.test(l.word)
      ? `During the client call, Maria explained why the ${w} matters for our colour scheme.`
      : `During the client call, Maria explained why the ${w} matters for our project plan.`;
    return {
      id: l.id,
      sents: [
        {
          en: first,
          de: 'Im Kundentermin hat Maria erklärt, warum das für unseren Projektplan wichtig ist.',
          sit: 'client call',
        },
        {
          en: `Before Friday, please check the ${w} again and send a short update to the team.`,
          de: 'Bitte prüfe das bis Freitag noch einmal und schick dem Team ein kurzes Update.',
          sit: 'status update',
        },
      ],
      contrast: l.other
        ? {
            en: `We reviewed the ${bare(l.other)} numbers together before the board meeting on Monday morning.`,
            why: {
              de: `${bare(l.other)} und ${w} bedeuten nicht dasselbe, achte auf die Bedeutung im Satz.`,
              en: `${bare(l.other)} and ${w} do not mean the same thing, so check the meaning in context.`,
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
