import { describe, expect, it } from 'vitest';
import { mergeOps } from '../../src/domain/answer/mergeOps';
import { alignWords } from '../../src/domain/answer/align';
import { caseFix, isAbbrevKey, isVariant, kwtLayout, kwtModeFor, stripModelLead } from '../../src/domain/grammar/learnerView';
import { isContentChange, repairsFromText, tidyWhy } from '../../src/domain/repair/sources';
import { keepEdits, repairsFromEdits } from '../../src/domain/tutor/edits';
import type { Kwt } from '../../src/domain/c1x/types';

// Paket Q0: Bausteine der Lernenden-Ansicht (Variante, Abkürzung, Wortzähler) und des Fehlersatzes aus eigenem Text.

const kwt = (keys: Array<[string, string]>, words?: [number, number]): Kwt => ({
  id: 'kwt-v2-1', kind: 'kwt', area: 'gram', pat: 'x', topic: 'articles', level: 'B2', dom: 'biz', src: 'seed',
  why: { ok: { de: 'x', en: 'x' }, wrong: [] }, lead: 'Lead sentence here.', key: 'MBA', before: 'She has', after: '.',
  keys: keys.map(([a, b]) => ({ a: [a], b: [b] })), tiles: [], extra: [], ...(words ? { words } : {}),
});

describe('Variante (Auch richtig)', () => {
  it('erkennt eine andere gültige Fassung, nicht aber Kurzformen oder Schreibung', () => {
    expect(isVariant('have gotten longer lately', 'have been getting longer lately', { kwtKey: 'LATELY' })).toBe(true);
    expect(isVariant("'ve been getting longer lately", 'have been getting longer lately', { kwtKey: 'LATELY' })).toBe(false);
    expect(isVariant('an mba', 'an MBA', { kwtKey: 'MBA' })).toBe(false);
    expect(isVariant('’s signed off', 'has signed off')).toBe(false);
    expect(isVariant('signs off', 'has signed off')).toBe(true);
  });
  it('entfernt nur den Vorspann „Richtig: <Musterlösung>.“', () => {
    expect(stripModelLead('Richtig: have been getting longer lately. lately zeigt eine Entwicklung.', 'have been getting longer lately')).toBe('Lately zeigt eine Entwicklung.');
    expect(stripModelLead('Right: an MBA. MBA starts with a vowel sound.', 'an MBA')).toBe('MBA starts with a vowel sound.');
    // „Richtig: Nach once steht …“ ist schon die Begründung: bleibt.
    expect(stripModelLead('Richtig: Nach „once“ steht has approved: erst genehmigt.', 'once the board has approved')).toBe('Nach „once“ steht has approved: erst genehmigt.');
    expect(stripModelLead('Ohne Vorspann bleibt alles.', 'x')).toBe('Ohne Vorspann bleibt alles.');
  });
});

describe('Abkürzung als Schlüsselwort', () => {
  it('nur bei Großschreibung in der Musterlösung', () => {
    expect(isAbbrevKey('MBA', 'an MBA')).toBe(true);
    expect(isAbbrevKey('LATELY', 'have been getting longer lately')).toBe(false);
  });
  it('zeigt die richtige Schreibung, ändert sonst nichts', () => {
    expect(caseFix('an mba', 'MBA', 'an MBA')).toBe('an MBA');
    expect(caseFix('An Mba degree', 'MBA', 'an MBA')).toBe('An MBA degree');
    expect(caseFix('an MBA', 'MBA', 'an MBA')).toBeNull();
    expect(caseFix('lately', 'LATELY', 'have lately')).toBeNull();
  });
});

describe('Umformung: ein Wortzähler, Teile nur bei langen Lösungen', () => {
  it('kurze Lösung (2 Wörter): am Handy getippt, ein Zähler, keine Teile', () => {
    const item = kwt([['an', 'MBA']], [2, 3]);
    expect(kwtModeFor(item, 'touch', 0.95)).toBe('desk');
    expect(kwtLayout(item, 'touch', 0.95)).toEqual({ mode: 'desk', task: [2, 3], counters: [[2, 3]], parts: false });
  });
  it('lange Lösung: Teil A/B bleibt, trotzdem genau ein Zähler (Bereich der Aufgabenzeile)', () => {
    const item = kwt([['is said', 'to be']], [3, 6]);
    const lay = kwtLayout(item, 'touch', 0.95);
    expect(lay.mode).toBe('part');
    expect(lay.counters).toEqual([[3, 6]]);
  });
});

describe('Fehlersatz aus eigenem Text (Emrahs Foto 31.10.2026)', () => {
  it('eine Inhaltsänderung ist kein Fehler und wird kein Fehlersatz', () => {
    expect(isContentChange({ wrong: 'each other', right: 'the challenges' })).toBe(true);
    expect(isContentChange({ wrong: 'make a photo', right: 'take a photo' })).toBe(false);
    expect(isContentChange({ wrong: 'informations', right: 'information' })).toBe(false);
    expect(isContentChange({ wrong: 'a lot', right: 'many', why: 'Klingt natürlicher.' })).toBe(true);
    // Echte Grammatikfehler bleiben Fehler, auch ohne gemeinsames Wort.
    expect(isContentChange({ wrong: 'has went', right: 'had gone', kind: 'grammar' })).toBe(false);
    expect(isContentChange({ wrong: 'each other', right: 'the challenges', kind: 'word' })).toBe(true);
    expect(isContentChange({ wrong: 'on Monday', right: 'by Monday', why: 'Die Präposition by ist hier präziser.' })).toBe(false);
    const text = 'We have to cope with each other in the project team.';
    // Schreibkorrektur: `keepEdits` stuft die Stelle zur Verbesserung herab (kein Fehler, kein Fehlersatz).
    const kept = keepEdits([{ from: 'each other', to: 'the challenges', kind: 'word', sev: 'error', why: 'Gemeint sind die Herausforderungen.' }], text, []);
    expect(kept[0]?.sev).toBe('upgrade');
    expect(repairsFromEdits(text, kept, 'write', 5)).toEqual([]);
    expect(repairsFromText(text, [{ wrong: 'each other', right: 'the challenges', why: 'Klingt natürlicher.' }], 'write')).toEqual([]);
    expect(repairsFromText('He go home.', [{ wrong: 'go', right: 'goes', why: 'he → goes' }], 'write')).toHaveLength(1);
  });
  it('ersetzte Wortgruppe steht als ein Block', () => {
    const ops = mergeOps(alignWords('We cope with each other here', 'We cope with the challenges here'));
    expect(ops.filter((o) => o.op !== 'eq')).toEqual([{ op: 'sub', given: 'each other', expected: 'the challenges' }]);
  });
  it('mitten im Wort gekürzte Begründung endet am letzten ganzen Satz', () => {
    expect(tidyWhy('Cope with heißt bewältigen. Gemeint ist miteinand…')).toBe('Cope with heißt bewältigen.');
    expect(tidyWhy('Ein langer Satz ohne Ende miteinand…')).toBe('Ein langer Satz ohne Ende …');
    expect(tidyWhy('Vollständig.')).toBe('Vollständig.');
  });
});
