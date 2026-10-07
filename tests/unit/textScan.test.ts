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
  // Emrahs Entscheidung „Go Anwenden“ (04.10.2026): Diktat, Hörschleife und Hör-Modus der Karten bleiben im Reiter „Anwenden“
  // (sie ersetzen den Standardwert „Hören entfällt“ des Gesamtkonzepts). Der Reiter und seine Texte (`ap*`) dürfen Hören nennen.
  /^(ap[A-Z]|hxApply|lrBackToApply|nbShTabApply)/,
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

// Ein Wort pro Ding (Gesamtkonzept 3.6, Glossar `05` §3.6): Altwörter, die nicht mehr in Texten stehen dürfen.
const OLD_DE = /Reparatur|[Rr]ückstand|der Rest morgen|[Gg]efestigt|Aktiv fest|[Ff]reie (Runde|Grammatikrunde)|Tageseinheit|Block \{?\d|Hilfe:|Dein Stand|Lohnt sich|Mehr üben/;
const OLD_EN = /[Rr]epair sentence|[Bb]acklog|[Ff]ree (grammar |vocabulary )?rounds?|[Dd]aily (session|unit)|[Bb]lock (\d|\{)|Hint: \{meaning\}|Your standing|Where you stand|Worth doing now|Practice more|[Mm]astered|Consolidated|Active and solid/;

describe('Ein Wort pro Ding (Glossar 3.6)', () => {
  it('keine Altwörter in den deutschen Texten', () => {
    const hits = Object.entries(de).filter(([, v]) => OLD_DE.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(hits).toEqual([]);
  });
  it('keine Altwörter in den englischen Texten', () => {
    const hits = Object.entries(en).filter(([, v]) => OLD_EN.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(hits).toEqual([]);
  });
});
