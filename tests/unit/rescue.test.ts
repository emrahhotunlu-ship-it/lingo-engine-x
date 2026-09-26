import { describe, expect, it } from 'vitest';
import { applyUpdate, classifyLegacyPath, mergeLegacyLocal } from '../../src/domain/migration/rescue';
import { applyRescueItem } from '../../src/domain/migration/applyRescue';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { createWriter } from '../../src/data/writer';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Kopien der alten App aus dem Browser: nur sicher ergänzen, alles andere melden (Kap. 9, Regel 1 und 6).

const NOW = berlin(SEED_ANCHOR, 21);
const D1 = '2026-09-18';
const D2 = '2026-09-19';

const after = (path: string, remote: Doc, local: Doc) => {
  const d = mergeLegacyLocal(path, remote, local, NOW);
  return d.kind === 'merge' ? applyUpdate(remote, d.patch) : d.kind === 'create' ? d.data : remote;
};

describe('Kopien der alten App sicher ergänzen', () => {
  it('Profil: Lerntage, Aktivitäten und Zähler mit dem höheren Wert – sonst nichts, Rest wird gemeldet', () => {
    const remote = { lang: 'en', xp: 900, days: { [D1]: 40 }, act: { [D1]: { cards: 10 } }, sprints: [{ t: 2 }, { t: 1 }], ema: { all: 0.7 } };
    const local = { lang: 'de', xp: 950, days: { [D1]: 30, [D2]: 12 }, act: { [D1]: { cards: 14, gram: 2 } }, sprints: [{ t: 3 }, { t: 2 }, { t: 1 }], ema: { all: 0.5 } };
    const d = mergeLegacyLocal('app/profile', remote, local, NOW);
    expect(d).toMatchObject({ kind: 'merge', rest: true });
    expect(after('app/profile', remote, local)).toEqual({
      lang: 'en',
      xp: 950,
      days: { [D1]: 40, [D2]: 12 },
      act: { [D1]: { cards: 14, gram: 2 } },
      sprints: [{ t: 2 }, { t: 1 }], // Listen werden nicht angefasst
      ema: { all: 0.7 },
    });
  });

  it('Kurs: nur fehlende abgeschlossene Lektionen, ohne Rest wenn sonst alles enthalten ist', () => {
    const remote = { done: { l01: { n: 1 } }, res: {} };
    const d = mergeLegacyLocal('app/course', remote, { done: { l02: { n: 2 } }, res: {} }, NOW);
    expect(d).toMatchObject({ kind: 'merge', rest: false });
    expect(after('app/course', remote, { done: { l02: { n: 2 } } })).toEqual({ done: { l01: { n: 1 }, l02: { n: 2 } }, res: {} });
    expect(after('app/course', remote, { done: { l01: { n: 9 } } })).toEqual(remote); // bestehende Lektion bleibt
  });

  it('Listen-Dokumente mit Wiederholungen (Radar, Log, Chat) verlieren nie einen Eintrag – sie werden gemeldet', () => {
    const seed = loadSeed();
    for (const path of ['app/radar', 'app/chat', 'log/2026-09-20', 'grammar/passive', 'vocab/reliable']) {
      const remote = seed[path] as Doc;
      const local = { ...remote, extra: [1], last: 9_999_999_999_999 };
      const d = mergeLegacyLocal(path, remote, local, NOW);
      expect(d, path).toEqual({ kind: 'skip', reason: 'not_merged' });
      expect(after(path, remote, local), path).toEqual(remote);
    }
  });

  it('fehlt das Dokument, wird die Kopie angelegt; gleiche Kopie ist unverändert', () => {
    expect(mergeLegacyLocal('vocab/neu', undefined, { word: 'neu' }, NOW)).toEqual({ kind: 'create', data: { word: 'neu' } });
    expect(mergeLegacyLocal('vocab/neu', { word: 'neu' }, { word: 'neu' }, NOW)).toEqual({ kind: 'skip', reason: 'unchanged' });
  });

  it('eine in der Datenbank bereits enthaltene Kopie gilt als unverändert', () => {
    expect(mergeLegacyLocal('app/profile', { days: { [D1]: 5, [D2]: 3 }, lang: 'de' }, { days: { [D1]: 5 } }, NOW)).toEqual({ kind: 'skip', reason: 'unchanged' });
  });

  it('keine Zahl wird durch kleinere Werte ersetzt', () => {
    const remote = { days: { [D1]: 9, [D2]: 7 }, xp: 10 };
    expect(after('app/profile', remote, { days: { [D1]: 3, [D2]: 2 }, xp: null })).toEqual(remote);
  });

  it('Pfade mit Prototyp-Namen werfen nicht, sondern gelten als unbekannt', () => {
    for (const p of ['constructor/x', '__proto__/x', 'toString/a']) {
      expect(classifyLegacyPath(p, 1, { a: 1 }, undefined, NOW)).toEqual({ skip: 'unknown_path' });
    }
  });
});

describe('Datenbank-Dokument mit unerwartetem Aufbau wird nie überschrieben (Regel 6)', () => {
  const cases: Array<[string, Doc, Doc]> = [
    ['app/course', { done: ['l01', 'l02'] }, { done: { l03: { n: 1 } } }],
    ['app/profile', { days: [1, 2, 3] }, { days: { [D1]: 4 } }],
    ['app/profile', { xp: '1200' }, { xp: 10 }],
    ['app/profile', { act: { [D1]: 7 } }, { act: { [D1]: { cards: 1 } } }],
  ];

  it.each(cases)('%s %j bleibt unangetastet und wird gemeldet', (path, remote, local) => {
    expect(mergeLegacyLocal(path, remote, local, NOW)).toEqual({ kind: 'skip', reason: 'db_invalid' });
    expect(classifyLegacyPath(path, 1, local, remote, NOW)).toEqual({ skip: 'db_invalid' });
  });
});

describe('Nur plausible Lerntage werden ergänzt', () => {
  it('künftige Tage, Schlüssel ohne Datum und negative Werte bleiben draußen – als Rest gemeldet', () => {
    const remote = { days: { [D1]: 1 } };
    const local = { days: { [D1]: 1, [D2]: 2, '2099-01-01': 5, foo: 3, '2026-9-5': 1 }, xp: -4, minutes: { [D2]: -10 } };
    const d = mergeLegacyLocal('app/profile', remote, local, NOW);
    expect(d).toMatchObject({ kind: 'merge', rest: true });
    expect(after('app/profile', remote, local)).toEqual({ days: { [D1]: 1, [D2]: 2 } });
  });

  it('heute zählt, morgen nicht', () => {
    const today = SEED_ANCHOR;
    const d = mergeLegacyLocal('app/profile', { days: {} }, { days: { [today]: 1, '2026-09-21': 1 } }, NOW);
    expect(d).toMatchObject({ kind: 'merge', patch: { days: { [today]: 1 } }, rest: true });
  });
});

describe('Erledigt entscheidet der frische Abgleich beim Schreiben', () => {
  const setup = (seed: Record<string, Doc> = {}) => {
    const h = createMemoryDb({ seed });
    return { h, writer: createWriter(h.db) };
  };

  it('Dokument entsteht zwischen Prüfen und Ergänzen mit anderem Inhalt → gemeldet, nicht erledigt', async () => {
    const local = { entries: [{ id: 'a' }, { id: 'b' }] };
    const c = classifyLegacyPath('log/2026-09-19', 1, local, undefined, NOW);
    if (!('item' in c)) throw new Error('erwartet: anlegen');
    expect(c.item.action).toBe('create');

    const { h, writer } = setup();
    await h.db.doc('log/2026-09-19').set({ entries: [{ id: 'c' }] });
    const out = await applyRescueItem(c.item, writer, NOW);
    expect(out).toEqual({ handled: false, reason: 'not_merged' });
    expect(h.dump()['log/2026-09-19']).toEqual({ entries: [{ id: 'c' }] }); // nichts überschrieben
  });

  it('Profil ändert sich zwischen Prüfen und Ergänzen → Lerntage ergänzt, Rest gemeldet', async () => {
    const local = { days: { [D2]: 3 }, history: [{ t: 1 }, { t: 2 }] };
    const c = classifyLegacyPath('app/profile', 1, local, undefined, NOW);
    if (!('item' in c)) throw new Error('erwartet: anlegen');

    const { h, writer } = setup({ 'app/profile': { lang: 'de' } });
    const out = await applyRescueItem(c.item, writer, NOW);
    expect(out).toEqual({ handled: false, reason: 'partial' });
    expect(h.dump()['app/profile']).toEqual({ lang: 'de', days: { [D2]: 3 } });
  });

  it('beschädigtes Dokument in der Datenbank → gemeldet, nichts geschrieben', async () => {
    const c = classifyLegacyPath('app/course', 1, { done: { l03: { n: 1 } } }, undefined, NOW);
    if (!('item' in c)) throw new Error('erwartet: anlegen');
    const { h, writer } = setup({ 'app/course': { done: ['l01', 'l02'] } });
    expect(await applyRescueItem(c.item, writer, NOW)).toEqual({ handled: false, reason: 'db_invalid' });
    expect(h.dump()['app/course']).toEqual({ done: ['l01', 'l02'] });
  });

  it('vollständig übernommen → erledigt', async () => {
    const c = classifyLegacyPath('vocab/neu', 1, { word: 'neu' }, undefined, NOW);
    if (!('item' in c)) throw new Error('erwartet: anlegen');
    const { writer } = setup();
    expect(await applyRescueItem(c.item, writer, NOW)).toEqual({ handled: true, result: 'created' });
  });
});
