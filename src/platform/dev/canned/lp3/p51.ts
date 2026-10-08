// Testantworten Lernplattform 3.0, Paket P51 (Rollenspiel+, turn-analysis@3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { turnAnalysisReply } from '../../cannedSpeak';

/** Die Kennungen der Musterliste im Prompt (Zeilen `id: name` nach „Grammar patterns of the current chapter“). */
export function talkPatIds(input: string): string[] {
  const block = /Grammar patterns of the current chapter \(id: name\):\n([\s\S]*?)\nReply with only one JSON object/.exec(input)?.[1] ?? '';
  return block
    .split('\n')
    .map((l) => /^([a-z0-9]{2,6}\.[a-z0-9-]{2,32}): /.exec(l)?.[1] ?? '')
    .filter(Boolean);
}

/**
 * Feste Antwort für `turn-analysis@3`: dieselben drei Schichten wie @2 (`cannedSpeak.ts`), dazu je Fehler `pat` = die erste Kennung der Liste, `used` =
 * die erste Kennung bei sauberem Satz (Kapitelziel), `count` = Zahl der Fehler. Marker: `zzpat` → zusätzlich eine Kennung außerhalb der Liste (die App
 * entfernt sie), `zzused` → `used` mit der ersten und einer fremden Kennung, `zzcount` → zweite Zählung 3 (Mittelwert mit der Liste).
 * Ohne `[turn-analysis@3]` (Schalter aus, @2) bleibt die Antwort von @2.
 */
export function turnAnalysisV3Reply(input: string): string {
  const base = turnAnalysisReply(input);
  if (!input.startsWith('[turn-analysis@3]')) return base;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(base) as Record<string, unknown>;
  } catch {
    return base;
  }
  const sentence = (/^Learner sentence: (.*)$/m.exec(input)?.[1] ?? '').trim();
  const ids = talkPatIds(input);
  const first = ids[0] ?? null;
  const errors = Array.isArray(o.errors) ? (o.errors as Array<Record<string, unknown>>) : [];
  const withPat = errors.map((e) => ({ ...e, pat: /zzpat/i.test(sentence) ? 'zz.not-listed' : first }));
  const used = /zzused/i.test(sentence) ? [first, 'zz.foreign'].filter(Boolean) : o.verdict === 'clean' && first ? [first] : [];
  const count = /zzcount/i.test(sentence) ? 3 : errors.length;
  return JSON.stringify({ ...o, errors: withPat, used, count });
}

/** Meldet die Testantworten von P51 an (überschreibt die @2-Antwort unter derselben Kennung, @2 bleibt darin enthalten). */
export function registerLp3P51Replies(): void {
  registerCannedReply('turn-analysis', turnAnalysisV3Reply);
}
