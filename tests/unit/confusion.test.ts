import { describe, expect, it } from 'vitest';
import { confusionOf, dayOfMs, dxLines, evidenceText, EVIDENCE_MAX_BYTES, newMappedErrors, NEW_ERRORS_MIN, pairsOf, parseContrast, patStats, attemptsOf, windowOf, type ConfusionSources } from '../../src/domain/tutor/confusion';

// P49 (Lernplattform 3.0, KI-Tutor T5): Belege der Wochen-Diagnose. Rein, mit festem Datum. TZ = Europe/Berlin (npm test); die Zeitumstellung
// ist der 25.10.2026 (03:00 Sommerzeit → 02:00 Winterzeit).

const at = (iso: string): number => Date.parse(iso);
type Doc = Record<string, unknown>;
const entry = (pat: string, ok: boolean, t: number): Doc => ({ k: 'g', pat, ok, t, topic: 'articles', type: 'gap' });
const logsOf = (rows: Array<[string, Doc[]]>): Map<string, Doc> => new Map(rows.map(([d, entries]) => [d, { date: d, entries }]));
const TODAY = '2026-11-01';

describe('Fenster: 28 Lerntage, Wechsel um 04:00', () => {
  it('28 Tage bis heute und die 28 davor, als reine Kalenderrechnung (auch über die Zeitumstellung)', () => {
    expect(windowOf('2026-11-01')).toEqual({ from: '2026-10-05', to: '2026-11-01', prevFrom: '2026-09-07', prevTo: '2026-10-04' });
    // Das Fenster läuft über den 25.10. und bleibt 28 Kalendertage lang.
    const w = windowOf('2026-10-25');
    expect(w.from).toBe('2026-09-28');
    expect(w.prevTo).toBe('2026-09-27');
  });

  it('die Grenze liegt bei 04:00: 03:59 gehört zum Vortag, 04:00 zum neuen Tag', () => {
    expect(dayOfMs(at('2026-10-05T03:59:00+02:00'))).toBe('2026-10-04');
    expect(dayOfMs(at('2026-10-05T04:00:00+02:00'))).toBe('2026-10-05');
    const logs = logsOf([['2026-10-05', [entry('art.definite', false, at('2026-10-05T03:59:00+02:00')), entry('art.definite', false, at('2026-10-05T04:00:00+02:00'))]]]);
    const s = patStats(attemptsOf(logs), windowOf(TODAY));
    // Der erste Eintrag (Vortag, 04.10.) liegt im Vorfenster, der zweite im Fenster.
    expect(s).toEqual([{ pat: 'art.definite', n: 1, w: 1, prevN: 1, prevW: 1 }]);
  });

  it('am Tag der Zeitumstellung (25.10.): Winterzeit 02:30 und 03:59 zählen noch zum 24., 04:00 zum 25.', () => {
    expect(dayOfMs(at('2026-10-25T00:30:00Z'))).toBe('2026-10-24'); // 02:30 Sommerzeit
    expect(dayOfMs(at('2026-10-25T01:30:00Z'))).toBe('2026-10-24'); // 02:30 Winterzeit (die Stunde läuft doppelt)
    expect(dayOfMs(at('2026-10-25T02:59:00Z'))).toBe('2026-10-24'); // 03:59 Winterzeit
    expect(dayOfMs(at('2026-10-25T03:00:00Z'))).toBe('2026-10-25'); // 04:00 Winterzeit
    // Der Lerntag des 25.10. hat 25 Stunden; der Eintrag um 03:30 Winterzeit des 26.10. gehört noch dazu.
    expect(dayOfMs(at('2026-10-26T02:30:00Z'))).toBe('2026-10-25');
    // Fenster bis heute = 25.10.: ein Eintrag um 02:00 UTC des 26.10. (03:00 Winterzeit) liegt im Fenster, einer um 03:00 UTC (04:00) nicht.
    const logs = logsOf([
      ['2026-10-25', [entry('art.definite', false, at('2026-10-26T02:00:00Z')), entry('art.definite', false, at('2026-10-26T03:00:00Z'))]],
    ]);
    const s = patStats(attemptsOf(logs), windowOf('2026-10-25'));
    expect(s).toEqual([{ pat: 'art.definite', n: 1, w: 1, prevN: 0, prevW: 0 }]);
  });
});

describe('Zahlen je Muster und Paare', () => {
  it('Versuche, falsche Antworten und Vorfenster; unbekannte Muster und Einträge ohne Muster zählen nie', () => {
    const logs = logsOf([
      ['2026-10-30', [entry('art.definite', false, at('2026-10-30T10:00:00+01:00')), entry('art.definite', true, at('2026-10-30T10:01:00+01:00')), entry('erfunden.xyz', false, at('2026-10-30T10:02:00+01:00')), { k: 'g', ok: false, t: at('2026-10-30T10:03:00+01:00') }, { k: 'v', pat: 'art.definite', ok: false, t: at('2026-10-30T10:04:00+01:00') }]],
      ['2026-09-20', [entry('art.definite', false, at('2026-09-20T10:00:00+02:00'))]],
    ]);
    expect(patStats(attemptsOf(logs), windowOf(TODAY))).toEqual([{ pat: 'art.definite', n: 2, w: 1, prevN: 1, prevW: 1 }]);
  });

  it('bestätigte Paare aus `cf` (mindestens 2 Belege), mit Beispiel; Wochenbalken stimmen mit den Protokollen überein', () => {
    const grammar = new Map<string, Doc>([
      [
        'articles',
        {
          errors: [
            { q: 'We need ___ approval.', given: 'the', ans: 'an', t: at('2026-10-30T10:00:00+01:00'), pat: 'art.indefinite', cf: 'art.definite' },
            { q: 'She is ___ manager.', given: 'the', ans: 'a', t: at('2026-10-20T10:00:00+02:00'), pat: 'art.indefinite', cf: 'articles:art.definite' },
            { q: 'Eins allein.', given: 'x', ans: 'y', t: at('2026-10-21T10:00:00+02:00'), pat: 'art.zero', cf: 'art.definite' },
            { q: 'Zu alt.', given: 'x', ans: 'y', t: at('2026-08-01T10:00:00+02:00'), pat: 'art.indefinite', cf: 'art.definite' },
          ],
        },
      ],
    ]);
    const logs = logsOf([
      ['2026-10-30', [entry('art.indefinite', false, at('2026-10-30T10:00:00+01:00'))]],
      ['2026-10-20', [entry('art.definite', false, at('2026-10-20T10:00:00+02:00'))]],
    ]);
    const pairs = pairsOf({ grammar, logs }, TODAY);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 'art.indefinite', b: 'art.definite', n: 2, confirmed: true });
    expect(pairs[0]?.ex[0]).toEqual({ q: 'We need ___ approval.', given: 'the', ans: 'an' });
    // Fenster 05.10.–01.11. in vier Wochen von hinten (je 7 Tage ab heute): 30.10. liegt in der letzten, 20.10. in der vorletzten Woche.
    expect(pairs[0]?.weeks).toEqual([0, 0, 1, 1]);
  });

  it('ein vom Kurs vorgegebenes Kontrastpaar braucht mindestens 3 falsche Antworten im ersten Muster', () => {
    const wrong = (n: number) => Array.from({ length: n }, (_, k) => entry('art.definite', false, at('2026-10-30T10:00:00+01:00') + k * 1000));
    expect(pairsOf({ logs: logsOf([['2026-10-30', wrong(2)]]) }, TODAY)).toEqual([]);
    const p = pairsOf({ logs: logsOf([['2026-10-30', wrong(3)]]) }, TODAY);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ a: 'art.definite', b: 'art.indefinite', n: 3, confirmed: false });
  });

  it('höchstens 3 Paare, nach Belegen geordnet; ein Muster steht nie in zwei Paaren', () => {
    const rows = ['art.definite', 'dip.wondering', 'dm.concede', 'art.zero'].map((p, i) => [`2026-10-${20 + i}`, Array.from({ length: 5 - i }, (_, k) => entry(p, false, at(`2026-10-${20 + i}T10:00:00+02:00`) + k * 1000))] as [string, Doc[]]);
    const pairs = pairsOf({ logs: logsOf(rows) }, TODAY);
    expect(pairs.length).toBeLessThanOrEqual(3);
    const all = pairs.flatMap((p) => [p.a, p.b]);
    expect(new Set(all).size).toBe(all.length);
    expect(pairs.map((p) => p.n)).toEqual([...pairs.map((p) => p.n)].sort((a, b) => b - a));
  });
});

describe('Belegzeilen für diagnose@1', () => {
  const src: ConfusionSources = {
    grammar: new Map([['articles', { errors: [{ q: 'q1', given: 'the', ans: 'an', t: at('2026-10-30T10:00:00+01:00'), pat: 'art.indefinite', cf: 'art.definite' }, { q: 'q2', given: 'the', ans: 'a', t: at('2026-10-29T10:00:00+01:00'), pat: 'art.indefinite', cf: 'art.definite' }] }]]),
    logs: logsOf([['2026-10-30', [entry('art.indefinite', false, at('2026-10-30T10:00:00+01:00')), entry('art.indefinite', true, at('2026-10-30T10:01:00+01:00')), entry('art.definite', false, at('2026-10-30T10:02:00+01:00'))]]]),
    repair: { items: [{ pat: 'art.zero', src: 'write', t: at('2026-10-28T10:00:00+01:00') }, { pat: 'art.zero', src: 'write', t: at('2026-10-27T10:00:00+01:00') }, { pat: 'art.zero', src: 'c1x', t: at('2026-10-27T11:00:00+01:00') }] },
  };

  it('Kennungen, Text, erlaubte Aktionen; jede Aktion und jede Kennung gibt es in den Zeilen', () => {
    const c = confusionOf(src, TODAY);
    expect(c.ids).toEqual(expect.arrayContaining(['p:art.indefinite', 'p:art.definite', 'cf:art.indefinite>art.definite', 'src:write:art.zero']));
    expect(c.allowed).toEqual(expect.arrayContaining(['contrast:art.indefinite|art.definite', 'pattern:art.indefinite']));
    const text = evidenceText(c.lines);
    for (const id of c.ids) expect(text).toContain(`[${id}]`);
    for (const a of c.allowed.filter((x) => x.startsWith('pattern:'))) expect(c.ids).toContain(`p:${a.slice(8)}`);
    expect(text).toContain('2 attempts, 1 wrong');
    expect(text).toContain('2 mistakes in own writing');
  });

  it('die Belegzeilen bleiben unter der Bytegrenze', () => {
    const many = Array.from({ length: 400 }, (_, k) => entry(k % 2 ? 'art.definite' : 'art.indefinite', false, at('2026-10-30T10:00:00+01:00') + k * 1000));
    const c = confusionOf({ ...src, logs: logsOf([['2026-10-30', many]]) }, TODAY);
    expect(new TextEncoder().encode(evidenceText(c.lines)).length).toBeLessThanOrEqual(EVIDENCE_MAX_BYTES);
    expect(c.lines.length).toBeGreaterThan(0);
  });

  it('zugeordnete Fehler im Fenster: falsche Antworten mit Muster plus Fehlersätze aus eigenen Texten (nicht c1x)', () => {
    expect(confusionOf(src, TODAY).mapped).toBe(2 + 2);
  });

  it('neue zugeordnete Fehler seit der letzten Diagnose (Schwelle 12)', () => {
    const t0 = at('2026-10-30T10:00:00+01:00');
    const rows = Array.from({ length: 14 }, (_, k) => entry('art.definite', false, t0 + k * 60_000));
    const s: ConfusionSources = { logs: logsOf([['2026-10-30', rows]]) };
    expect(newMappedErrors(s, TODAY, 0)).toBe(14);
    expect(newMappedErrors(s, TODAY, t0 + 5 * 60_000)).toBe(8);
    expect(newMappedErrors(s, TODAY, 0)).toBeGreaterThanOrEqual(NEW_ERRORS_MIN);
    // Auch ein sehr alter Zeitpunkt zählt nur Fehler im Fenster.
    expect(newMappedErrors({ logs: logsOf([['2026-08-01', [entry('art.definite', false, at('2026-08-01T10:00:00+02:00'))]]]) }, TODAY, 0)).toBe(0);
  });
});

describe('Aktionen und [dx:…]-Zeilen für assess@4', () => {
  it('parseContrast liest nur die feste Form', () => {
    expect(parseContrast('contrast:art.definite|art.indefinite')).toEqual({ a: 'art.definite', b: 'art.indefinite' });
    expect(parseContrast('pattern:art.definite')).toBeNull();
    expect(parseContrast('contrast:a')).toBeNull();
  });

  const diag = (t: number, extra: Doc = {}): Doc => ({ w: '2026-W44', t, st: 'done', out: { headline: 'x', findings: [{ title: 'Artikel', action: 'contrast:art.definite|art.indefinite' }, { title: 'Wirr', action: 'contrast:fake.a|fake.b' }, { title: 'Muster', action: 'pattern:art.zero' }] }, ...extra });

  it('die jüngste fertige Diagnose liefert je Kontrast-Befund eine Zeile; gemeldete, erfundene und alte fallen weg', () => {
    const t = at('2026-10-30T10:00:00+01:00');
    const lines = dxLines([diag(t - 86_400_000 * 2, { out: null }), diag(t)], TODAY);
    expect(lines.map((l) => l.id)).toEqual(['dx:art.definite|art.indefinite']);
    expect(dxLines([diag(t, { bad: [0] })], TODAY)).toEqual([]);
    expect(dxLines([diag(t)], '2027-01-15')).toEqual([]);
    expect(dxLines([], TODAY)).toEqual([]);
    expect(dxLines([diag(t, { st: 'pending' })], TODAY)).toEqual([]);
  });
});
