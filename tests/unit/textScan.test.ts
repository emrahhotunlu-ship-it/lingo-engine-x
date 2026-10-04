import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

// Textscan (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 8 Nr. 1, UX-Regel R12): Auf den
// vier Reitern (Heute, Wörter, Grammatik, Fortschritt), in den Blättern und den Einstellungen
// kommt kein Wort zu Lesen, Hören, Schreiben, Entdecken, Preply oder Business vor. Gescannt werden
// ALLE Texte beider Sprachen (so rutscht auch ein Text eines anderen Bildschirms nicht durch);
// Ausnahmen stehen unten einzeln mit Grund.

const BANNED_DE = /\b(Lesen|Hören|Schreiben|Entdecken|Preply|Business\w*|Lesetexte?|Hörtexte?|Hörverstehen|Leseergebnisse|Schreibaufgaben|Entdecken-Beiträge|Sag es|Flüssigkeit|Drei Tonlagen|Posteingang)\b/;
const BANNED_EN = /\b(Reading|Listening|Writing|Discover|Preply|Business)\b|\b(?:reading and listening|writing tasks|listening texts|reading results|discover posts)\b|“Say it”|“Fluency”|“Three tones”/;

/** Schlüssel, die bewusst bleiben (mit Grund). */
const ALLOWED: ReadonlyArray<RegExp> = [
  // Sprechen-Extra (freiwillig, Rollenspiel + Einwand-Training): Mikrofon-Zustände („Listening…“, „Sprechen“).
  /^(sp[A-Z]|tab(Speak)|mic[A-Z]|nbSprechen)/,
  // Umstellungs-Bildschirm der alten Daten: nennt die alten Datenbereiche beim Namen, die unangetastet bleiben (Kap. 9).
  /^(col[A-Z]|mig[A-Z])/,
  // OFFEN (Entscheidung Koordination, W4/W5): Hör-Modus der Karten, Hörschleife und Diktat sind noch gebaut. Das Gesamtkonzept
  // (Standardwert „Diktat/Sprint/Hören entfallen“) sieht sie nicht mehr vor; ihr Entfernen ist eine Funktions-, keine Textänderung.
  /^(nbWsModeListen|nbWsListenHint|nbWsListenNoTts|nbWsLoop|exName_listen_mc|exMode_listen|purposeListen|purposeDictate|lhDictateSub|drDictate)/,
  // Fehlerprotokoll (Diagnose) zeigt Schreibzugriffe der Datenbank, keine Fertigkeit.
  /^diagMsg_/,
];
const allowed = (key: string) => ALLOWED.some((re) => re.test(key));

describe('Textscan DE und EN', () => {
  it('kein Text zu Lesen, Hören, Schreiben, Entdecken, Preply oder Business (Deutsch)', () => {
    const hits = Object.entries(de).filter(([k, v]) => !allowed(k) && BANNED_DE.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(hits).toEqual([]);
  });
  it('dasselbe auf Englisch', () => {
    const hits = Object.entries(en).filter(([k, v]) => !allowed(k) && BANNED_EN.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(hits).toEqual([]);
  });
});
