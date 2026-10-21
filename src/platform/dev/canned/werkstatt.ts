// Testantworten Wort-Lernen 2, Wort-Werkstatt (mnemonic-options@1). Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

/**
 * Feste Antwort für `mnemonic-options@1`: je Wortzeile zwei Merkhilfen (Schlüsselwort, Szene aus dem Berufsalltag) in der verlangten Sprache,
 * beide nennen das Wort. Marker `zzjson` im Wort: gar kein JSON (Fehlerpfad).
 */
export function mnemonicOptionsReply(input: string): string {
  const de = line(input, 'Language of the memory aids') === 'German';
  const words = [...input.matchAll(/^- id=([^|]+?) \| word=([^|]+?) \|.*$/gm)].map((m) => ({ id: (m[1] ?? '').trim(), w: (m[2] ?? '').trim().replace(/^to\s+/i, '') }));
  if (words.some((x) => /zzjson/i.test(x.w))) return 'Here are some ideas for you.';
  const items = words.map(({ id, w }) => ({
    id,
    options: de
      ? [`Denk bei „${w}“ an ein Bild, das du dir gut merken kannst: Der Klang führt dich zur Bedeutung.`, `Im Wochenmeeting mit deinem Team sagst du „${w}“, wenn genau diese Lage eintritt – stell dir die Gesichter vor.`]
      : [`Think of “${w}” as a picture you can easily remember: the sound leads you to the meaning.`, `In the weekly meeting with your team you say “${w}” exactly when this situation comes up – picture their faces.`],
  }));
  return JSON.stringify({ items });
}

export function registerWerkstattReplies(): void {
  registerCannedReply('mnemonic-options', mnemonicOptionsReply);
}
