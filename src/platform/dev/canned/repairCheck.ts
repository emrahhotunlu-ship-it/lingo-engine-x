import { repairNorm } from '../../../domain/repair/repair';

// Feste Antwort für repair-check@1 (Lernberatung 27.09., V2). Richtig, sobald die Neufassung
// nicht mehr der alte Satz ist; `zzno` in der Neufassung → falsch, `zzjson` → kein JSON.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();

const NOTE = {
  ok: { de: 'Der Fehler ist behoben, und der Satz ist richtig.', en: 'The mistake is fixed, and the sentence is correct.' },
  no: { de: 'Der alte Fehler steckt noch im Satz.', en: 'The old mistake is still in the sentence.' },
} as const;

export function repairCheckReply(input: string): string {
  const given = line(input, 'Learner rewrite');
  if (/\bzzjson\b/i.test(given)) return 'Sorry, I cannot give a clean answer for that right now.';
  const lang = /^English$/i.test(line(input, 'Explanation language')) ? 'en' : 'de';
  const ok = !/\bzzno\b/i.test(given) && repairNorm(given) !== repairNorm(line(input, 'Original sentence'));
  return JSON.stringify({ ok, note: NOTE[ok ? 'ok' : 'no'][lang] });
}
