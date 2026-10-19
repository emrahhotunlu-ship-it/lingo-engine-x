import { describe, expect, it } from 'vitest';
import raw from '../../src/content/tutor/l1.json';
import { patternById } from '../../src/domain/grammar/patterns';
import { L1FileSchema, l1Entries, l1Matches, l1NotesFor, l1Text } from '../../src/domain/tutor/l1';
import { isUseId } from '../../src/domain/tutor/tutorTypes';

// Übertragungstabelle (Tutor-Engine v3 §1.1): Aufbau, Verweise, Muster. Inhaltlich gegengelesen wird sie vom Englischlehrer.

describe('l1.json', () => {
  const file = L1FileSchema.safeParse(raw);
  const entries = l1Entries();

  it('ist gültig, rund 40 Einträge, eindeutige Kennungen', () => {
    expect(file.success).toBe(true);
    expect(entries.length).toBe(raw.entries.length);
    expect(entries.length).toBeGreaterThanOrEqual(35);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(entries.some((e) => e.kind === 'note')).toBe(true);
  });

  it('jedes Grammatik-Muster existiert (pat und vs, soweit kein Gebrauchsmuster)', () => {
    for (const e of entries) {
      if (e.pat) expect(patternById(e.pat), `${e.id}.pat ${e.pat}`).not.toBeNull();
      if (!isUseId(e.vs)) expect(patternById(e.vs), `${e.id}.vs ${e.vs}`).not.toBeNull();
      expect(e.vs, e.id).not.toBe(e.pat ?? e.use);
    }
  });

  it('jedes Erkennungsmuster kompiliert und trifft das richtige Beispiel nie', () => {
    for (const e of entries) {
      if (e.bad) expect(e.badRe, `${e.id}.bad`).not.toBeNull();
      if (e.when) expect(e.whenRe, `${e.id}.when`).not.toBeNull();
      if (e.badRe) expect(e.badRe.test(l1Text(e.example.en)), `${e.id}: bad trifft „${e.example.en}“`).toBe(false);
    }
  });

  it('ein Treffer im erwarteten Satz zählt nie (richtiges Englisch ist kein Fehler)', () => {
    const e = entries.find((x) => x.id === 'l1:seit-praesens');
    expect(e).toBeDefined();
    expect(l1Matches('We use the new tool since January.', 'We have been using the new tool since January.').map((x) => x.id)).toContain('l1:seit-praesens');
    expect(l1Matches('We use the new tool since January.', 'We use the new tool since January.').map((x) => x.id)).not.toContain('l1:seit-praesens');
  });

  it('der Treffer muss die Antwort berühren', () => {
    const s = 'We use the new tool since January.';
    const hit = l1Matches(s, 'We have been using the new tool since January.', [0, 2]);
    expect(hit.map((x) => x.id)).toContain('l1:seit-praesens');
    expect(l1Matches(s, 'We have been using the new tool since January.', [40, 45])).toEqual([]);
  });

  it('Hinweise stehen nach den Fehlern und sind als Hinweis markiert', () => {
    expect(l1NotesFor('ut.used-to').map((x) => x.id)).toContain('l1:used-to-oder-past');
    for (const n of l1NotesFor('ut.used-to')) expect(n.kind).toBe('note');
    const all = l1Entries().filter((e) => e.badRe);
    for (const e of all) {
      const hits = l1Matches(e.example.en.replace(/\.$/, ' since x.'), 'zzz');
      const firstNote = hits.findIndex((x) => x.kind === 'note');
      if (firstNote >= 0) expect(hits.slice(firstNote).every((x) => x.kind === 'note')).toBe(true);
    }
  });
});
