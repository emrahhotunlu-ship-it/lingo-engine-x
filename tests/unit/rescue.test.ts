import { describe, expect, it } from 'vitest';
import { applyUpdate, classifyLegacyPath, mergeLegacyLocal } from '../../src/domain/migration/rescue';
import { loadSeed, type Doc } from './helpers';

// Kopien der alten App aus dem Browser: nur sicher ergänzen, alles andere melden (Kap. 9, Regel 1 und 6).

const after = (path: string, remote: Doc, local: Doc) => {
  const d = mergeLegacyLocal(path, remote, local);
  return d.kind === 'merge' ? applyUpdate(remote, d.patch) : d.kind === 'create' ? d.data : remote;
};

describe('Kopien der alten App sicher ergänzen', () => {
  it('Profil: Lerntage, Aktivitäten und Zähler mit dem höheren Wert – sonst nichts, Rest wird gemeldet', () => {
    const remote = { lang: 'en', xp: 900, days: { a: 40 }, act: { a: { cards: 10 } }, sprints: [{ t: 2 }, { t: 1 }], ema: { all: 0.7 } };
    const local = { lang: 'de', xp: 950, days: { a: 30, b: 12 }, act: { a: { cards: 14, gram: 2 } }, sprints: [{ t: 3 }, { t: 2 }, { t: 1 }], ema: { all: 0.5 } };
    const d = mergeLegacyLocal('app/profile', remote, local);
    expect(d).toMatchObject({ kind: 'merge', rest: true });
    expect(after('app/profile', remote, local)).toEqual({
      lang: 'en',
      xp: 950,
      days: { a: 40, b: 12 },
      act: { a: { cards: 14, gram: 2 } },
      sprints: [{ t: 2 }, { t: 1 }], // Listen werden nicht angefasst
      ema: { all: 0.7 },
    });
  });

  it('Kurs: nur fehlende abgeschlossene Lektionen, ohne Rest wenn sonst alles enthalten ist', () => {
    const remote = { done: { l01: { n: 1 } }, res: {} };
    const d = mergeLegacyLocal('app/course', remote, { done: { l02: { n: 2 } }, res: {} });
    expect(d).toMatchObject({ kind: 'merge', rest: false });
    expect(after('app/course', remote, { done: { l02: { n: 2 } } })).toEqual({ done: { l01: { n: 1 }, l02: { n: 2 } }, res: {} });
    expect(after('app/course', remote, { done: { l01: { n: 9 } } })).toEqual(remote); // bestehende Lektion bleibt
  });

  it('Listen-Dokumente mit Wiederholungen (Radar, Log, Chat) verlieren nie einen Eintrag – sie werden gemeldet', () => {
    const seed = loadSeed();
    for (const path of ['app/radar', 'app/chat', 'log/2026-09-20', 'grammar/passive', 'vocab/reliable']) {
      const remote = seed[path] as Doc;
      const local = { ...remote, extra: [1], last: 9_999_999_999_999 };
      const d = mergeLegacyLocal(path, remote, local);
      expect(d, path).toEqual({ kind: 'skip', reason: 'not_merged' });
      expect(after(path, remote, local), path).toEqual(remote);
    }
  });

  it('fehlt das Dokument, wird die Kopie angelegt; gleiche Kopie ist unverändert', () => {
    expect(mergeLegacyLocal('vocab/neu', undefined, { word: 'neu' })).toEqual({ kind: 'create', data: { word: 'neu' } });
    expect(mergeLegacyLocal('vocab/neu', { word: 'neu' }, { word: 'neu' })).toEqual({ kind: 'skip', reason: 'unchanged' });
  });

  it('eine in der Datenbank bereits enthaltene Kopie gilt als unverändert', () => {
    expect(mergeLegacyLocal('app/profile', { days: { a: 5, b: 3 }, lang: 'de' }, { days: { a: 5 } })).toEqual({ kind: 'skip', reason: 'unchanged' });
  });

  it('keine Zahl wird durch Nicht-Zahlen oder kleinere Werte ersetzt', () => {
    const remote = { days: { a: 'viel', b: 7 }, xp: 10 };
    expect(after('app/profile', remote, { days: { a: 3, b: 2 }, xp: null })).toEqual(remote);
  });

  it('Pfade mit Prototyp-Namen werfen nicht, sondern gelten als unbekannt', () => {
    for (const p of ['constructor/x', '__proto__/x', 'toString/a']) {
      expect(classifyLegacyPath(p, 1, { a: 1 }, undefined)).toEqual({ skip: 'unknown_path' });
    }
  });
});
