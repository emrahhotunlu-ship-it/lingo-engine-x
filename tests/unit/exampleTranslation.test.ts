import { describe, expect, it } from 'vitest';
import { EX_DE_MAX, exDeKey, storedTranslation, translationPatch } from '../../src/domain/srs/examples';

// Deutsche Übersetzung der Beispielsätze (Emrah 02.10.2026): einmal erzeugt, an der Karte gespeichert, nur ergänzt.

const EN = 'We need to postpone the meeting until Friday.';

describe('exDeKey', () => {
  it('ist stabil und unabhängig von Groß-/Kleinschreibung und Satzzeichen', () => {
    expect(exDeKey(EN)).toBe(exDeKey('we need to postpone the meeting until friday'));
    expect(exDeKey(EN)).not.toBe(exDeKey('We need to cancel the meeting.'));
    expect(exDeKey(EN)).toMatch(/^s[0-9a-z]+$/);
  });
});

describe('storedTranslation / translationPatch', () => {
  it('liest tolerant: kein Feld, falscher Typ, leerer Text', () => {
    expect(storedTranslation({}, EN)).toBeNull();
    expect(storedTranslation({ exDe: [1] }, EN)).toBeNull();
    expect(storedTranslation({ exDe: { [exDeKey(EN)]: '  ' } }, EN)).toBeNull();
    expect(storedTranslation({ exDe: { [exDeKey(EN)]: ' Wir müssen das Meeting auf Freitag verschieben. ' } }, EN)).toBe('Wir müssen das Meeting auf Freitag verschieben.');
  });

  it('ergänzt nur, was fehlt: nie ersetzen, nie ohne Dokument', () => {
    const p = translationPatch({ word: 'postpone' }, EN, 'Wir müssen das Meeting auf Freitag verschieben.');
    expect(p).toEqual({ exDe: { [exDeKey(EN)]: 'Wir müssen das Meeting auf Freitag verschieben.' } });
    expect(translationPatch({ exDe: { [exDeKey(EN)]: 'vorhanden' } }, EN, 'neu')).toBeNull();
    expect(translationPatch(undefined, EN, 'x')).toBeNull();
    expect(translationPatch({}, EN, '   ')).toBeNull();
  });

  it('begrenzt Anzahl und Länge (Dokumentgröße)', () => {
    const full = Object.fromEntries(Array.from({ length: EX_DE_MAX }, (_, i) => [`k${i}`, 'x']));
    expect(translationPatch({ exDe: full }, EN, 'Text')).toBeNull();
    const long = translationPatch({}, EN, 'a'.repeat(900));
    expect(Object.values(long?.exDe ?? {})[0]).toHaveLength(400);
  });
});
