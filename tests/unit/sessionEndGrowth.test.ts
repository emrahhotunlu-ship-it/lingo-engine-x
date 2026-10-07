import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { roundGrowth } from '../../src/domain/metrics/round';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { SessionEnd, type GrowthView } from '../../src/ui/SessionEnd';
import { berlin } from './helpers';

// P28: Rundenende mit Wachstum statt Antwortzahl. Jede gezeigte Zahl gleicht dem Selektor `roundGrowth`.

const NOW = berlin('2026-10-05', 10);
const D = 86_400_000;
const mk = (id: string, over: Record<string, unknown> = {}): TrainCard =>
  toTrainCard(id, { word: id, de: 'x', def: 'x y', ex: `We [${id}] it.`, pos: 'verb', state: 'review', S: 5, D: 5, due: NOW + 3 * D, last: NOW - 5 * D, stage: 2, reps: 4, lapses: 0, src: 'lookup', added: '2026-06-01', ...over }, true, NOW)!;
const answered = (id: string, days: number, over: Record<string, unknown> = {}): TrainCard => mk(id, { last: NOW, due: NOW + days * D, S: days, ...over });

const html = (growth: GrowthView | null, extra: { right?: number; total?: number } = {}): string =>
  renderToStaticMarkup(createElement(SessionEnd, { mode: 'growth', right: extra.right ?? 18, total: extra.total ?? 22, ms: 60_000, next: { label: 'Weiter', run: () => undefined }, growth }));

describe('Rundenende Wachstum', () => {
  it('nennt höchstens 6 Namen der Aufgestiegenen, den Rest als Zahl; keine Kachel x/y, nur eine kleine Zeile', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const before = ids.map((id) => mk(id, { stage: 3, S: 10 }));
    const after = ids.map((id) => answered(id, 40, { stage: 4, S: 40 }));
    const rg = roundGrowth(before, after);
    expect(rg.up).toHaveLength(8);
    const out = html({ up: rg.up, memory: rg.memory, down: rg.down, hard: false });
    expect(out.match(/data-testid="growth-chip"/g)).toHaveLength(6);
    expect(out).toContain('und 2 weitere');
    expect(out).not.toContain('session-end-right');
    expect(out).not.toContain('session-end-time');
    // „18 von 22 richtig“ bleibt eine kleine graue Zeile unter dem Titel.
    expect(out).toMatch(/lx-t-support m-0 text-muted[^>]*>[^<]*18[^<]*22/);
  });

  it('ohne Aufgestiegene: Gedächtnis-Zeit mit den Zahlen des Selektors; mit Aufgestiegenen entfällt sie', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const before = ids.map((id) => mk(id));
    const after = ids.map((id) => answered(id, 18));
    const rg = roundGrowth(before, after);
    expect(rg.up).toHaveLength(0);
    expect(rg.memory).toEqual({ n: 5, before: 8, after: 18 });
    const out = html({ up: rg.up, memory: rg.memory, down: rg.down, hard: false });
    expect(out).toContain('data-testid="growth-memory"');
    expect(out).toContain('Diese 5 Wörter hältst du jetzt länger');
    expect(out).toContain('in 18 statt 8 Tagen (geschätzt)');
    const withUp = html({ up: [{ id: 'x', word: 'phase out', to: 'safe' }], memory: rg.memory, down: 0, hard: false });
    expect(withUp).not.toContain('growth-memory');
    expect(withUp).toContain('phase out');
  });

  it('Rückfälle und schwerer Block als ruhige Sätze; leere Wachstumsdaten zeigen nichts', () => {
    const out = html({ up: [], memory: null, down: 2, hard: true });
    expect(out).toContain('2 Wörter sind wieder auf Lernt und kommen morgen.');
    expect(out).toContain('Schwerer Block, bei neuen Strukturen normal.');
    expect(html({ up: [], memory: null, down: 0, hard: false })).not.toContain('session-end-growth');
    expect(html(null)).not.toContain('session-end-growth');
  });
});
