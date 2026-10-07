import { describe, expect, it } from 'vitest';
import { animFilms, filmFor, filmForTopics, parseFilmFiles, words } from '../../src/domain/c1/anim';
import { patternById } from '../../src/domain/grammar/patterns';
import { morphSteps, planMorph } from '../../src/engine/morphPlan';
import { filmSeconds } from '../../src/features/c1/film/timing';

// Lernplattform 3.0 P61: Struktur-Filme (Format, Pilotcharge a1) und die Wort-Zuordnung zwischen den Schritten.

const BRITISH = /\b(analys(e|ed|ing|is)?|organis(e|ed|ation)|colour|favour|behaviour|centre|realis(e|ed)|prioritis(e|ed)|labour|programme|licence|cheque|travelled|cancelled|modelling)\b/i;

describe('Struktur-Filme: Pilotcharge', () => {
  const films = animFilms();

  it('sechs Pilotfilme, jede Kennung einmal', () => {
    expect(films.length).toBeGreaterThanOrEqual(6);
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length);
    for (const id of ['f.inv.negative', 'f.em.it-cleft', 'f.pp.personal', 'f.mc.past-cond', 'f.cp.having', 'f.nm.noun-form']) expect(films.some((f) => f.id === id)).toBe(true);
  });

  it('Thema und Muster gibt es in den Musterdateien', () => {
    for (const f of films) {
      const p = patternById(f.pat);
      expect(p, f.id).not.toBeNull();
      expect(p?.topic, f.id).toBe(f.topic);
    }
  });

  it('jeder Film beginnt mit einer Vorhersage, die Lösung passt zum Film', () => {
    for (const f of films) {
      expect(f.predict.q.de.length).toBeGreaterThan(5);
      expect(f.predict.q.en.length).toBeGreaterThan(5);
      if (f.predict.kind === 'pick') {
        // Die richtige Option kommt im letzten Schritt (oder einem Schritt) wirklich vor.
        const right = f.predict.opts[f.predict.ans].replace(/\s*…$/, '').toLowerCase();
        expect(
          f.steps.some((s) => s.en.toLowerCase().includes(right)),
          f.id,
        ).toBe(true);
      }
    }
  });

  it('US-Englisch: keine britischen Schreibweisen', () => {
    for (const f of films) {
      for (const s of f.steps) expect(BRITISH.test(s.en), `${f.id}: ${s.en}`).toBe(false);
      if (f.predict.kind === 'pick') for (const o of f.predict.opts) expect(BRITISH.test(o), o).toBe(false);
    }
  });

  it('Schritte unterscheiden sich, Signalwörter liegen im Satz', () => {
    for (const f of films) {
      for (let i = 1; i < f.steps.length; i++) expect(f.steps[i]?.en).not.toBe(f.steps[i - 1]?.en);
      for (const s of f.steps) for (const h of s.hi ?? []) expect(h).toBeLessThan(words(s.en).length);
    }
  });

  it('filmFor / filmForTopics finden den Film', () => {
    expect(filmFor('inversion', 'inv.negative')?.id).toBe('f.inv.negative');
    expect(filmFor('inversion', 'gibt-es-nicht')).toBeNull();
    expect(filmFor(null, 'inv.negative')).toBeNull();
    expect(filmForTopics(['gibt-es-nicht', 'mixed-cond'])?.id).toBe('f.mc.past-cond');
    expect(filmForTopics([])).toBeNull();
  });

  it('Laufzeit ist kurz (≤ 30 s)', () => {
    for (const f of films) expect(filmSeconds(f)).toBeLessThanOrEqual(30);
  });
});

describe('Struktur-Filme: Format', () => {
  const ok = {
    id: 'f.x',
    topic: 't',
    pat: 'p',
    title: { de: 'a', en: 'a' },
    de: 'a',
    predict: { kind: 'tap', q: { de: 'a', en: 'a' }, ans: [0] },
    steps: [
      { en: 'a b', note: { de: 'a', en: 'a' } },
      { en: 'b a', note: { de: 'a', en: 'a' } },
    ],
  };

  it('gültige Datei wird gelesen', () => {
    expect(parseFilmFiles({ 'a.json': JSON.stringify({ v: 1, items: [ok] }) })).toHaveLength(1);
  });

  it('Index außerhalb, fehlende Vorhersage, kaputtes JSON und Dubletten fallen weg', () => {
    const badHi = { ...ok, steps: [{ ...ok.steps[0], hi: [5] }, ok.steps[1]] };
    const noPredict = { ...ok, predict: undefined };
    expect(parseFilmFiles({ 'a.json': JSON.stringify({ v: 1, items: [badHi] }) })).toHaveLength(0);
    expect(parseFilmFiles({ 'a.json': JSON.stringify({ v: 1, items: [noPredict] }) })).toHaveLength(0);
    expect(parseFilmFiles({ 'a.json': '{' })).toHaveLength(0);
    expect(parseFilmFiles({ 'a.json': JSON.stringify({ v: 1, items: [ok] }), 'b.json': JSON.stringify({ v: 1, items: [ok] }) })).toHaveLength(1);
  });
});

describe('planMorph', () => {
  it('Inversion: never wandert nach vorn, der Rest bleibt verbunden', () => {
    const a = words('We have never seen such strong demand.');
    const b = words('Never have we seen such strong demand.');
    const m = planMorph(a, b);
    expect(m).toEqual([2, 1, 0, 3, 4, 5, 6]);
  });

  it('move gilt zuerst (neue Form), neue Wörter sind null', () => {
    const m = planMorph(words('After we had analyzed the data,'), words('Having analyzed the data,'), [[2, 0]]);
    expect(m).toEqual([2, 3, 4, 5]);
    expect(planMorph(['a'], ['b'])).toEqual([null]);
  });

  it('morphSteps: weiterlebende Wörter behalten ihre Kennung', () => {
    const s = morphSteps([{ en: 'We have never seen it.' }, { en: 'Never have we seen it.', hi: [0] }]);
    const id = (k: number, w: string) => s[k]?.find((x) => x.text.toLowerCase().startsWith(w))?.id;
    expect(id(1, 'never')).toBe(id(0, 'never'));
    expect(id(1, 'we')).toBe(id(0, 'we'));
    expect(s[1]?.[0]?.hi).toBe(true);
    // Jede Kennung kommt je Schritt nur einmal vor.
    for (const step of s) expect(new Set(step.map((w) => w.id)).size).toBe(step.length);
  });

  it('jeder Pilotfilm ergibt eindeutige Kennungen je Schritt', () => {
    for (const f of animFilms()) for (const step of morphSteps(f.steps)) expect(new Set(step.map((w) => w.id)).size).toBe(step.length);
  });
});
