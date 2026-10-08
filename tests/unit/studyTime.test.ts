import { describe, expect, it } from 'vitest';
import { profileSchema } from '../../src/data/schemas';
import { cleanIi, CUE_IDS, formatTime, iiBytes, II_MAX_BYTES, normTime, readIi } from '../../src/domain/studytime';
import { cueLabel, studyTimeLine } from '../../src/features/settings/studyTimeText';
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
    expect(studyTimeLine({ t: '07:30', cue: 'coffee' }, 'de', tDe)).toBe('Morgen um 7:30 · nach dem ersten Kaffee');
    expect(studyTimeLine({ t: '07:30', cue: 'coffee' }, 'en', tEn)).toBe('Tomorrow at 7:30 AM · after the first coffee');
    expect(studyTimeLine({ t: '18:00', cue: 'nach dem Sport' }, 'de', tDe)).toBe('Morgen um 18:00 · nach dem Sport');
    expect(studyTimeLine({ t: '18:00', cue: '' }, 'en', tEn)).toBe('Tomorrow at 6:00 PM');
    expect(studyTimeLine(null, 'de', tDe)).toBeNull();
  });

  it('die vier Anker in beiden Sprachen', () => {
    expect(CUE_IDS.map((c) => cueLabel(c, tDe))).toEqual(['nach dem ersten Kaffee', 'in der Bahn', 'nach dem Mittag', 'vor Feierabend']);
    expect(CUE_IDS.map((c) => cueLabel(c, tEn)).every((s) => s.length > 0)).toBe(true);
  });
});

describe('Erinnerung im iPhone einrichten', () => {
  it('die genauen Tipps in der richtigen Reihenfolge', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7].map((n) => de[`moRgStep${n}` as keyof typeof de]);
    expect(steps[0]).toContain('„Erinnerungen“');
    expect(steps[1]).toContain('„＋ Neue Erinnerung“');
    expect(steps[2]).toContain('„Englisch 25 Min.“');
    expect(steps[3]).toContain('„ⓘ“');
    expect(steps[4]).toMatch(/„Datum“.*„Uhrzeit“/);
    expect(steps[5]).toMatch(/„Wiederholen“.*„Täglich“/);
    expect(steps[6]).toMatch(/Safari.*Adresszeile.*„URL“/);
    expect(de.moRgHome).toContain('„Teilen › Zum Home-Bildschirm“');
    expect(de.moRgHome).toContain('keine Installation');
    expect(en.moRgHome).toContain('Add to Home Screen');
    expect(en.moRgHome).toContain('not an install');
  });

  it('ruhige Texte: kein Ausrufezeichen, „Vorschlag, keine Bedingung“, der ganze Tag bis 4 Uhr', () => {
    for (const [k, v] of [...Object.entries(de), ...Object.entries(en)]) expect(v, k).not.toContain('!');
    expect(de.moStLead).toContain('keine Bedingung');
    expect(de.moStLead).toContain('4 Uhr');
    expect(en.moStLead).toContain('not a rule');
  });
});
