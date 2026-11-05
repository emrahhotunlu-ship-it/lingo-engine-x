import type { InboxMail } from '../shared';

// Anrede und Gruß (W5 K7, Lehrer-Prüfung F3): die Aufgabe nennt Empfänger und eine passende Anrede, die Prüfung bewertet Anrede und Gruß mit (Ton). Rein.
// - Antworten: aus dem Material. Die geprüfte Musterantwort jeder Mail (`inbox.json` `reply`) beginnt mit der Anrede und endet mit dem Gruß.
// - Schreiben: die Situationen nennen nur die Rolle (`to`); Name, Anrede und Gruß stehen hier fest je Situation (erfundene Namen, US-Schreibweise „Ms.“/„Mr.“):
//   intern per Vorname („Hi Tom,“), extern förmlich („Dear Ms. Becker,“), eine Gruppe mit „Hello everyone,“.
// Lehrer-Prüfung W5b: Die Aufgabe nennt nur Empfänger und Ton (`ext`, `greetTone`: „extern, förmlich“ / „intern, locker“), nicht die fertige Anrede; der
// Vorschlag (Anrede + Gruß) steht erst im Ergebnis. ms12 geht an den Kunden, die Direktorin steht in Kopie (`reader` ist die Zeile für Claude).

export type Greet = {
  /** Wer die Mail bekommt (Name oder leer bei einer Gruppe), Englisch. */
  name: string;
  /** Passende Anrede mit Komma, z. B. „Hi Laura,“. */
  hello: string;
  /** Passender Gruß mit Komma, z. B. „Best regards,“. */
  close: string;
  /** Außerhalb der eigenen Firma (Kunde, Investor, Partner). */
  ext: boolean;
  /** Leser für Claude (Englisch), falls genauer als Rolle und Name (z. B. mit Kopie). */
  reader?: string;
};

export type GreetTone = 'formal' | 'polite' | 'informal';

/** Ton der passenden Anrede: „Dear …“ förmlich; mit Titel oder an eine Gruppe höflich; per Vorname locker. */
export function greetTone(hello: string): GreetTone {
  if (/^dear\b/i.test(hello)) return 'formal';
  if (/^(hi|hello|hey|good (morning|afternoon))\s+(mr|ms|mrs|dr)\.?\s/i.test(hello) || /^hello(\s+(everyone|all|team))?,$/i.test(hello)) return 'polite';
  return 'informal';
}

/** Eingegangene Mail aus der eigenen Firma (Rolle nennt das eigene Team, die eigene Firma oder einen Kollegen). */
const INTERNAL_ROLE = /\byour (team|company)\b|^colleague\b/i;

const HELLO_RE = /^(dear|hi|hello|hey|good (morning|afternoon))\b[^\n]{0,48},$/i;
const CLOSE_RE = /^(best( regards| wishes)?|kind regards|regards|many thanks|thanks|thank you|cheers|warm regards|sincerely)[,.!]?$/i;

const withComma = (s: string): string => `${s.trim().replace(/[,.!]+$/, '')},`;

/** Anrede und Gruß zu einer eingegangenen Mail aus ihrer Musterantwort; Ersatz: „Hello <Vorname>,“ und „Best regards,“. */
export function mailGreet(m: InboxMail): Greet {
  const lines = m.reply
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] ?? '';
  const last = lines[lines.length - 1] ?? '';
  const given = m.from.trim().split(/\s+/)[0] ?? '';
  return {
    name: m.from.trim(),
    hello: HELLO_RE.test(first) ? first : `Hello ${given},`,
    close: CLOSE_RE.test(last) ? withComma(last) : 'Best regards,',
    ext: !INTERNAL_ROLE.test(m.role.trim()),
  };
}

/** Feste Empfänger der zwölf Mail-Situationen (Kennung → Name, Anrede, Gruß). */
const SITUATION_GREET: Readonly<Record<string, Greet>> = {
  ms01: { name: '', hello: 'Hello everyone,', close: 'Best regards,', ext: false },
  ms02: { name: 'Mr. Russo', hello: 'Dear Mr. Russo,', close: 'Kind regards,', ext: true },
  ms03: { name: 'Daniel', hello: 'Hi Daniel,', close: 'Best regards,', ext: false },
  ms04: { name: 'Mr. Carter', hello: 'Dear Mr. Carter,', close: 'Best regards,', ext: true },
  ms05: { name: 'Ms. Patel', hello: 'Dear Ms. Patel,', close: 'Kind regards,', ext: true },
  ms06: { name: 'Tom', hello: 'Hi Tom,', close: 'Best,', ext: false },
  ms07: { name: '', hello: 'Hello everyone,', close: 'Best regards,', ext: false },
  ms08: { name: 'Lisa', hello: 'Hi Lisa,', close: 'Best,', ext: false },
  ms09: { name: 'Daniel', hello: 'Hi Daniel,', close: 'Best regards,', ext: false },
  ms10: { name: 'Nina', hello: 'Hi Nina,', close: 'Best regards,', ext: false },
  ms11: { name: 'Mr. Grant', hello: 'Dear Mr. Grant,', close: 'Kind regards,', ext: true },
  ms12: { name: 'Ms. Becker', hello: 'Dear Ms. Becker,', close: 'Kind regards,', ext: true, reader: 'the client, Ms. Becker (your director is in cc)' },
};

/** Empfänger einer Mail-Situation; unbekannte Situationen bekommen eine neutrale Anrede. */
export const situationGreet = (id: string): Greet => SITUATION_GREET[id] ?? { name: '', hello: 'Hello,', close: 'Best regards,', ext: false };

