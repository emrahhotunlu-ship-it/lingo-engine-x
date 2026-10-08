import { describe, expect, it } from 'vitest';
import { profileSchema } from '../../src/data/schemas';
import { cleanIi, CUE_IDS, formatTime, iiBytes, II_MAX_BYTES, iiOp, normTime, readIi } from '../../src/domain/studytime';
import { cueLabel, ifThenLine, studyTimeLine } from '../../src/features/settings/studyTimeText';
import { translate, type MessageKey } from '../../src/i18n';
import { moP53De as de } from '../../src/i18n/parts/lp3/p53.de';
import { moP53En as en } from '../../src/i18n/parts/lp3/p53.en';

// Lernplattform 3.0 P53: Lernzeit `app/profile.ii = {t, cue}` (< 100 Bytes), Zeile der Abschlusskarte und die iPhone-Anleitung.

const tDe = (key: MessageKey, vars?: Record<string, string | number>) => translate('de', key, vars);
const tEn = (key: MessageKey, vars?: Record<string, string | number>) => translate('en', key, vars);

describe('Lernzeit: Feld', () => {
  it('Uhrzeit normalisiert, ungültige Uhrzeit → null', () => {
    expect(normTime('7:30')).toBe('07:30');
    expect(normTime('07.05')).toBe('07:05');
    expect(normTime('24:00')).toBeNull();
    expect(normTime('7:60')).toBeNull();
    expect(cleanIi('', 'coffee')).toBeNull();
    expect(cleanIi('07:30', 'coffee')).toEqual({ t: '07:30', cue: 'coffee' });
    expect(cleanIi('07:30', '  in   der  Bahn ')).toEqual({ t: '07:30', cue: 'in der Bahn' });
  });

  it('eigener Text höchstens 40 Zeichen; das Feld bleibt auch im Höchstfall unter 100 Bytes', () => {
    const long = cleanIi('23:59', 'x'.repeat(80));
    expect(long?.cue).toHaveLength(40);
    for (const s of ['ä'.repeat(60), '😀'.repeat(60), '"\\'.repeat(40), 'ü'.repeat(40)]) {
      const ii = cleanIi('23:59', s);
      expect(ii).not.toBeNull();
      if (ii) expect(iiBytes(ii)).toBeLessThan(II_MAX_BYTES);
    }
    for (const id of CUE_IDS) expect(iiBytes({ t: '23:59', cue: id })).toBeLessThan(II_MAX_BYTES);
  });

  it('geschrieben wird nur das cleanIi-Ergebnis (< 100 Bytes); ungültig oder unverändert → kein Schreibvorgang', () => {
    for (const cue of ['coffee', 'ä'.repeat(80), '😀'.repeat(60), '  in   der  Bahn ']) {
      const op = iiOp({}, { t: '7:30', cue });
      expect(op?.update.ii).toEqual(cleanIi('7:30', cue));
      const ii = op?.update.ii;
      expect(ii).toBeTruthy();
      if (ii) expect(iiBytes(ii)).toBeLessThan(II_MAX_BYTES);
    }
    expect(iiOp({}, { t: 'morgens', cue: 'coffee' })).toBeNull();
    expect(iiOp({ ii: { t: '07:30', cue: 'coffee' } }, { t: '7:30', cue: 'coffee' })).toBeNull();
    expect(iiOp({ ii: { t: '07:30', cue: 'coffee' } }, null)).toEqual({ update: { ii: null } });
    expect(iiOp({}, null)).toBeNull();
  });

  it('tolerant lesen: fremder Aufbau → null, das Profil bleibt gültig', () => {
    expect(readIi({ ii: { t: '07:30', cue: 'train' } })).toEqual({ t: '07:30', cue: 'train' });
    expect(readIi({ ii: { t: 'morgens' } })).toBeNull();
    expect(readIi({ ii: 'abc' })).toBeNull();
    expect(readIi({ ii: null })).toBeNull();
    expect(readIi(null)).toBeNull();
    for (const ii of [{ t: '07:30', cue: 'train' }, 'abc', 7, null, [1]]) expect(profileSchema.safeParse({ ii }).success).toBe(true);
  });
});

describe('Lernzeit: Zeile der Abschlusskarte', () => {
  it('Deutsch 24 Stunden, Englisch 12 Stunden', () => {
    expect(formatTime('07:30', 'de')).toBe('7:30');
    expect(formatTime('19:05', 'de')).toBe('19:05');
    expect(formatTime('07:30', 'en')).toBe('7:30 AM');
    expect(formatTime('19:05', 'en')).toBe('7:05 PM');
    expect(formatTime('00:15', 'en')).toBe('12:15 AM');
    expect(formatTime('12:00', 'en')).toBe('12:00 PM');
  });

  it('„Morgen um 7:30 · nach dem ersten Kaffee“; eigener Text unverändert; ohne Lernzeit keine Zeile', () => {
    expect(studyTimeLine({ t: '07:30', cue: 'coffee' }, 'de', tDe)).toBe('Morgen um 7:30 Uhr · nach dem ersten Kaffee');
    expect(studyTimeLine({ t: '07:30', cue: 'coffee' }, 'en', tEn)).toBe('Tomorrow at 7:30 AM · after your first coffee');
    expect(studyTimeLine({ t: '18:00', cue: 'nach dem Sport' }, 'de', tDe)).toBe('Morgen um 18:00 Uhr · nach dem Sport');
    expect(studyTimeLine({ t: '18:00', cue: '' }, 'de', tDe)).toBe('Morgen um 18:00 Uhr');
    expect(studyTimeLine({ t: '18:00', cue: '' }, 'en', tEn)).toBe('Tomorrow at 6:00 PM');
    expect(studyTimeLine(null, 'de', tDe)).toBeNull();
  });

  it('die vier Anker in beiden Sprachen', () => {
    expect(CUE_IDS.map((c) => cueLabel(c, tDe))).toEqual(['nach dem ersten Kaffee', 'in der Bahn', 'nach dem Mittagessen', 'vor Feierabend']);
    expect(CUE_IDS.map((c) => cueLabel(c, tEn))).toEqual(['after your first coffee', 'on the train', 'after lunch', 'before you log off']);
  });

  it('Wenn-Dann-Vorschau: eigener Satz je Moment, eigener Text im Rahmen; ohne Moment keine Vorschau', () => {
    expect(ifThenLine('coffee', tDe)).toBe('Wenn ich meinen ersten Kaffee getrunken habe, starte ich meine Englisch-Runde.');
    expect(ifThenLine('coffee', tEn)).toBe('When I finish my first coffee, I start my English session.');
    for (const c of CUE_IDS) {
      expect(ifThenLine(c, tDe)).toMatch(/^(Wenn|Bevor) ich .+, starte ich meine Englisch-Runde\.$/);
      expect(ifThenLine(c, tEn)).toMatch(/^(When|Before) I .+, I start my English session\.$/);
    }
    // „vor Feierabend“ ist ein Vorher-Moment: der Satz beginnt mit „Bevor“, nicht mit „Wenn“.
    expect(ifThenLine('evening', tDe)).toBe('Bevor ich Feierabend mache, starte ich meine Englisch-Runde.');
    expect(ifThenLine('evening', tEn)).toBe('Before I log off for the day, I start my English session.');
    expect(ifThenLine('nach dem Team-Call', tDe)).toBe('Mein Moment: nach dem Team-Call. Dann starte ich meine Englisch-Runde.');
    expect(ifThenLine('  ', tDe)).toBeNull();
    expect(de.moStNoCueHint).toBe('Ein fester Moment im Alltag hilft mehr als die Uhrzeit allein.');
    expect(en.moStNoCueHint).toBe('A fixed moment in your day helps more than the time alone.');
  });

  it('sichtbarer Text ohne „Anker“ bzw. „cue“', () => {
    // Platzhalter `{cue}` ist kein sichtbarer Text.
    const visible = (v: string) => v.replace(/\{\w+\}/g, '');
    for (const v of Object.values(de)) expect(visible(v)).not.toMatch(/Anker/);
    for (const v of Object.values(en)) expect(visible(v)).not.toMatch(/\bcue\b/i);
  });
});

describe('Erinnerung im iPhone einrichten', () => {
  it('die genauen Tipps in der richtigen Reihenfolge (zuerst den Link kopieren)', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => de[`moRgStep${n}` as keyof typeof de]);
    expect(steps[0]).toMatch(/Safari.*„Teilen“.*„Kopieren“/);
    expect(steps[1]).toContain('„Erinnerungen“');
    expect(steps[2]).toContain('„＋ Neue Erinnerung“');
    expect(steps[3]).toContain('„Englisch 25 Min.“');
    expect(steps[4]).toContain('„ⓘ“');
    expect(steps[5]).toMatch(/„Datum“.*„Uhrzeit“/);
    expect(de.moRgStep6Time).toContain('{time} Uhr');
    expect(steps[6]).toMatch(/„Wiederholen“.*„Täglich“/);
    expect(steps[7]).toBe('Tippe auf „URL“, füge den Link ein und tippe oben rechts auf „Fertig“.');
    expect(de.moRgLead).toContain('ein Tipp darauf öffnet diese App');
    expect(en.moRgStep1).toBe('Open this app in Safari, tap “Share”, then tap “Copy”.');
    expect(de.moRgHome).toContain('„Teilen › Zum Home-Bildschirm“');
    expect(de.moRgHome).toContain('keine Installation');
    expect(en.moRgHome).toContain('Add to Home Screen');
    expect(en.moRgHome).toContain("This doesn't install anything: the app is still this page on claude.ai.");
  });

  it('ruhige Texte: kein Ausrufezeichen, „Vorschlag, keine Bedingung“, der ganze Tag bis 4 Uhr', () => {
    for (const [k, v] of [...Object.entries(de), ...Object.entries(en)]) expect(v, k).not.toContain('!');
    expect(de.moStLead).toContain('keine Bedingung');
    expect(de.moStLead).toContain('4 Uhr');
    expect(en.moStLead).toContain('not a rule');
    expect(en.moStLead).toContain('until 4 AM');
  });
});
