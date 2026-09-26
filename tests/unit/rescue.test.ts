import { describe, expect, it } from 'vitest';
import { applyUpdate, classifyLegacyPath, mergeLegacyLocal } from '../../src/domain/migration/rescue';

// Ergänzen statt überschreiben (Kap. 9, Regel 1): Kopien der alten App aus dem Browser.

const merged = (path: string, remote: Record<string, unknown>, local: Record<string, unknown>) => {
  const d = mergeLegacyLocal(path, remote, local);
  return d.kind === 'merge' ? applyUpdate(remote, d.patch) : d.kind === 'create' ? d.data : remote;
};

describe('Kopien der alten App ergänzen', () => {
  it('Profil: Tageswerte mit Maximum, wachsende Listen vereinigt, Karten-Maps ergänzt, Einstellungen bleiben', () => {
    const remote = {
      lang: 'en',
      rate: 1,
      xp: 900,
      days: { '2026-09-20': 40 },
      act: { '2026-09-20': { cards: 10 } },
      sprints: [{ t: 1, score: 100 }],
      history: [{ d: '2026-09-19', o: 0.6 }],
      canDo: { l01: '2026-09-01' },
      ema: { all: 0.7 },
    };
    const local = {
      lang: 'de',
      rate: 0.9,
      xp: 950,
      days: { '2026-09-20': 30, '2026-09-21': 12 },
      act: { '2026-09-20': { cards: 14, gram: 2 } },
      sprints: [{ t: 1, score: 100 }, { t: 2, score: 140 }],
      history: [{ d: '2026-09-19', o: 0.6 }, { d: '2026-09-20', o: 0.7 }],
      canDo: { l01: '2026-09-01', l02: '2026-09-21' },
      ema: { all: 0.5 },
      vtests: [{ t: 3 }],
    };
    expect(merged('app/profile', remote, local)).toEqual({
      lang: 'en',
      rate: 1,
      xp: 950,
      days: { '2026-09-20': 40, '2026-09-21': 12 },
      act: { '2026-09-20': { cards: 14, gram: 2 } },
      sprints: [{ t: 1, score: 100 }, { t: 2, score: 140 }],
      history: [{ d: '2026-09-19', o: 0.6 }, { d: '2026-09-20', o: 0.7 }],
      canDo: { l01: '2026-09-01', l02: '2026-09-21' },
      ema: { all: 0.7 },
      vtests: [{ t: 3 }],
    });
  });

  it('Karte, lokal neuer: Werte der Kopie, Verlauf und Fehler vereinigt statt ersetzt', () => {
    const remote = { word: 'x', stage: 2, last: 100, S: 3, hist: [{ t: 100, m: 'devB', g: 3 }], modes: { recog: { c: 2, w: 0 } } };
    const local = { word: 'x', stage: 3, last: 200, S: 5, hist: [{ t: 50, m: 'devA', g: 3 }, { t: 200, m: 'devA', g: 4 }], modes: { type: { c: 1, w: 0 } } };
    expect(merged('vocab/x', remote, local)).toEqual({
      word: 'x',
      stage: 3,
      last: 200,
      S: 5,
      hist: [{ t: 50, m: 'devA', g: 3 }, { t: 100, m: 'devB', g: 3 }, { t: 200, m: 'devA', g: 4 }],
      modes: { recog: { c: 2, w: 0 }, type: { c: 1, w: 0 } },
    });
  });

  it('Grammatikthema: Fehlersätze über den Satz zusammengeführt, bei gleichem Stand nur ergänzt', () => {
    const remote = { p: 0.5, last: 100, errors: [{ q: 'A', box: 1 }], hist: [{ d: '2026-09-19', p: 0.5 }], recent: [1, 0] };
    const local = { p: 0.4, last: 100, errors: [{ q: 'A', box: 0 }, { q: 'B', box: 0 }], hist: [{ d: '2026-09-20', p: 0.4 }], recent: [0, 0] };
    const d = mergeLegacyLocal('grammar/passive', remote, local);
    expect(d.kind).toBe('merge');
    expect(merged('grammar/passive', remote, local)).toEqual({
      p: 0.5, // gleicher Stand: Einzelwerte der Datenbank bleiben
      last: 100,
      errors: [{ q: 'A', box: 1 }, { q: 'B', box: 0 }],
      hist: [{ d: '2026-09-19', p: 0.5 }, { d: '2026-09-20', p: 0.4 }],
      recent: [1, 0],
    });
  });

  it('ältere Karte ohne Neues wird mit Grund „Datenbank neuer" übersprungen', () => {
    const remote = { word: 'x', last: 200, stage: 4, hist: [{ t: 1 }] };
    expect(mergeLegacyLocal('vocab/x', remote, { word: 'x', last: 100, stage: 1, hist: [{ t: 1 }] })).toEqual({ kind: 'skip', reason: 'db_newer' });
  });

  it('Tagesprotokoll: Einträge vereinigt, nichts gekappt', () => {
    const remote = { date: 'd', entries: Array.from({ length: 300 }, (_, i) => ({ t: 1000 + i, ok: true })) };
    const local = { date: 'd', entries: [{ t: 5000, ok: false }, { t: 5001, ok: true }] };
    const out = merged('log/2026-09-20', remote, local) as { entries: Array<{ t: number }> };
    expect(out.entries).toHaveLength(302);
    expect(out.entries[0]?.t).toBe(1000);
  });

  it('Pfade mit Prototyp-Namen werfen nicht, sondern gelten als unbekannt', () => {
    for (const p of ['constructor/x', '__proto__/x', 'toString/a']) {
      expect(classifyLegacyPath(p, 1, { a: 1 }, undefined)).toEqual({ skip: 'unknown_path' });
    }
  });

  it('fehlt das Dokument, wird die Kopie angelegt', () => {
    expect(mergeLegacyLocal('vocab/neu', undefined, { word: 'neu' })).toEqual({ kind: 'create', data: { word: 'neu' } });
  });
});
