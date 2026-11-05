import type { InboxMail } from '../shared';

// Anrede und Gruß (W5 K7, Lehrer-Prüfung F3): die Aufgabe nennt Empfänger und eine passende Anrede, die Prüfung bewertet Anrede und Gruß mit (Ton). Rein.
// - Antworten: aus dem Material. Die geprüfte Musterantwort jeder Mail (`inbox.json` `reply`) beginnt mit der Anrede und endet mit dem Gruß.
// - Schreiben: die Situationen nennen nur die Rolle (`to`); Name, Anrede und Gruß stehen hier fest je Situation (erfundene Namen, US-Schreibweise „Ms.“/„Mr.“):
//   intern per Vorname („Hi Tom,“), extern förmlich („Dear Ms. Becker,“), eine Gruppe mit „Hello everyone,“.

export type Greet = {
  /** Wer die Mail bekommt (Name oder leer bei einer Gruppe), Englisch. */
  name: string;
  /** Passende Anrede mit Komma, z. B. „Hi Laura,“. */
  hello: string;
  /** Passender Gruß mit Komma, z. B. „Best regards,“. */
  close: string;
};

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
  };
}

/** Feste Empfänger der zwölf Mail-Situationen (Kennung → Name, Anrede, Gruß). */
const SITUATION_GREET: Readonly<Record<string, Greet>> = {
  ms01: { name: '', hello: 'Hello everyone,', close: 'Best regards,' },
  ms02: { name: 'Mr. Russo', hello: 'Dear Mr. Russo,', close: 'Kind regards,' },
  ms03: { name: 'Daniel', hello: 'Hi Daniel,', close: 'Best regards,' },
  ms04: { name: 'Mr. Carter', hello: 'Dear Mr. Carter,', close: 'Best regards,' },
  ms05: { name: 'Ms. Patel', hello: 'Dear Ms. Patel,', close: 'Kind regards,' },
  ms06: { name: 'Tom', hello: 'Hi Tom,', close: 'Best,' },
  ms07: { name: '', hello: 'Hello everyone,', close: 'Best regards,' },
  ms08: { name: 'Lisa', hello: 'Hi Lisa,', close: 'Best,' },
  ms09: { name: 'Daniel', hello: 'Hi Daniel,', close: 'Best regards,' },
  ms10: { name: 'Nina', hello: 'Hi Nina,', close: 'Best regards,' },
  ms11: { name: 'Mr. Grant', hello: 'Dear Mr. Grant,', close: 'Kind regards,' },
  ms12: { name: 'Ms. Becker', hello: 'Dear Ms. Becker,', close: 'Kind regards,' },
};

/** Empfänger einer Mail-Situation; unbekannte Situationen bekommen eine neutrale Anrede. */
export const situationGreet = (id: string): Greet => SITUATION_GREET[id] ?? { name: '', hello: 'Hello,', close: 'Best regards,' };

