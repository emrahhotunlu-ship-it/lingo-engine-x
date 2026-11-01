import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { writeVocabSettings } from '../../../src/modules/vocab/data/settings';

// Großpaket A S6 (Bild s2-13): Einstellungen Wörter. Ein Schreibvorgang auf app/profile, vcfg streng geprüft, nur bei Änderung.

const profile = (over: Record<string, unknown> = {}) => ({ name: 'Test', newPerDay: 5, vcfg: { min: 15, ret: 0.9, mod: 1 }, days: { '2026-11-01': 3 }, ...over });

describe('writeVocabSettings', () => {
  it('ändert Zielzeit, Sicherheit und neue Wörter; andere Felder bleiben', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': profile() } });
    const w = createWriter(h.db);
    expect(await writeVocabSettings(w, { min: 20 })).toBe(true);
    expect(await writeVocabSettings(w, { ret: 0.95 })).toBe(true);
    expect(await writeVocabSettings(w, { newPerDay: 0 })).toBe(true);
    const doc = h.dump()['app/profile'] as Record<string, unknown>;
    expect(doc.vcfg).toEqual({ min: 20, ret: 0.95, mod: 1 });
    expect(doc.newPerDay).toBe(0);
    expect(doc.name).toBe('Test');
    expect(doc.days).toEqual({ '2026-11-01': 3 });
  });
  it('gleicher Wert: true, aber kein Schreiben', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': profile() } });
    const w = createWriter(h.db);
    const before = h.writes().length;
    expect(await writeVocabSettings(w, { min: 15, ret: 0.9, newPerDay: 5 })).toBe(true);
    expect(h.writes().length).toBe(before);
  });
  it('ohne gültiges vcfg oder ohne Profil: false, nichts geschrieben; ungültige Werte werden abgelehnt', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': profile({ vcfg: { min: 12, ret: 0.9, mod: 1 } }) } });
    const w = createWriter(h.db);
    const before = h.writes().length;
    expect(await writeVocabSettings(w, { min: 20 })).toBe(false);
    expect(await writeVocabSettings(w, { newPerDay: 3 as 2 })).toBe(false);
    expect(h.writes().length).toBe(before);
    const empty = createMemoryDb({ seed: {} });
    expect(await writeVocabSettings(createWriter(empty.db), { newPerDay: 2 })).toBe(false);
    expect(empty.dump()['app/profile']).toBeUndefined();
  });
  it('Anki-Modus und „Satz vorher anhören“ (S6b-3): fehlend = aus bzw. an; geschrieben als 0/1 in vcfg, andere Werte bleiben', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': profile() } });
    const w = createWriter(h.db);
    expect(await writeVocabSettings(w, { anki: 1 })).toBe(true);
    expect(await writeVocabSettings(w, { pre: 0 })).toBe(true);
    expect((h.dump()['app/profile'] as Record<string, unknown>).vcfg).toEqual({ min: 15, ret: 0.9, mod: 1, anki: 1, pre: 0 });
    const before = h.writes().length;
    expect(await writeVocabSettings(w, { anki: 1, pre: 0 })).toBe(true);
    expect(h.writes().length).toBe(before);
    expect(await writeVocabSettings(w, { anki: 2 as 1 })).toBe(false);
    expect(h.writes().length).toBe(before);
  });
});
