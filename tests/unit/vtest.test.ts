import { describe, expect, it } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { buildActive, buildMeaning, buildYesNo, meaningOf, PSEUDO_N, VT_WORDS } from '../../src/domain/vtest/build';
import { vtestPatch } from '../../src/domain/vtest/persist';
import { scoreVtest, type VtestResult } from '../../src/domain/vtest/score';
import { vtestMachine } from '../../src/features/vtest/machine';
import { loadSeed } from './helpers';

// Wortschatztest (Plan §8, docs/vtest.md).

const seed = loadSeed();
const all = new Set(VT_WORDS.map((w) => w.w));
const meta = { t: 1_790_000_000_000, d: '2026-09-20', dur: 480_000 };

describe('Aufbau', () => {
  it('100 Wörter und 12 Pseudowörter, fester Startwert je Tag', () => {
    const a = buildYesNo('2026-09-20');
    expect(a).toHaveLength(100 + PSEUDO_N);
    expect(a.filter((x) => x.pseudo)).toHaveLength(PSEUDO_N);
    expect(buildYesNo('2026-09-20')).toEqual(a);
    expect(buildYesNo('2026-09-21')).not.toEqual(a);
  });
  it('Bedeutung: 2 je Band, höhere zuerst, 4 Optionen gleicher Wortart, genau eine richtig; EN aus vtest-en.json', () => {
    const m = buildMeaning(all, 'en', 's');
    expect(m).toHaveLength(20);
    expect(m[0]!.band).toBe(10);
    for (const it of m) {
      expect(it.options).toHaveLength(4);
      expect(it.options.filter((o) => o.correct)).toHaveLength(1);
      const pos = VT_WORDS.find((w) => w.w === it.w)!.pos;
      for (const o of it.options) expect(VT_WORDS.find((w) => w.w === o.id)!.pos).toBe(pos);
      for (const o of it.options) expect(o.label).not.toMatch(/[äöüß]/);
    }
    expect(meaningOf(VT_WORDS[0]!, 'de')).toBe('zuhören');
  });
  it('Aktiv: ein Ja-Wort je Band, möglichst nicht aus den Bedeutungsproben', () => {
    const m = buildMeaning(all, 'de', 's');
    const a = buildActive(all, new Set(m.map((x) => x.w)), 'de', 's');
    expect(a).toHaveLength(10);
    expect(a.some((x) => m.some((y) => y.w === x.w))).toBe(false);
    expect(buildActive(new Set(), new Set(), 'de', 's')).toEqual([]);
  });
});

describe('Rechnung (Plan §8.2)', () => {
  const pseudo = buildYesNo('x')
    .filter((y) => y.pseudo)
    .map((y) => y.w);
  it('nur Ja: f = 1 → alle Bänder 0', () => {
    const r = scoreVtest({ yes: new Set([...all, ...pseudo]), pseudoShown: pseudo, meaning: { right: 0, n: 0 }, active: { right: 0, n: 0 } }, meta);
    expect(r.bands.every((b) => b === 0)).toBe(true);
    expect(r.passive).toBe(0);
    expect(r.fa).toBe(12);
  });
  it('nur Nein: 0 Wörter', () => {
    const r = scoreVtest({ yes: new Set(), pseudoShown: pseudo, meaning: { right: 0, n: 0 }, active: { right: 0, n: 0 } }, meta);
    expect(r.passive).toBe(0);
    expect(r.mAcc).toBe(1);
  });
  it('Formeln: Fehlalarm-Korrektur, Bedeutungsquote, Streuung, aktiv', () => {
    const yes = new Set(VT_WORDS.filter((w) => w.band <= 6).map((w) => w.w));
    yes.add(pseudo[0]!);
    const r = scoreVtest({ yes, pseudoShown: pseudo, meaning: { right: 10, n: 12 }, active: { right: 6, n: 8 } }, meta);
    const f = 1 / 12;
    const m = 11 / 14;
    expect(r.bands[0]).toBeCloseTo(Math.round(((1 - f) / (1 - f)) * m * 100) / 100, 5);
    expect(r.bands[7]).toBe(0);
    expect(r.passive % 50).toBe(0);
    expect(r.passive).toBe(Math.round(r.bands.reduce((s, x) => s + 1000 * x, 0) / 50) * 50);
    expect(r.pLo).toBeLessThanOrEqual(r.passive);
    expect(r.pHi).toBeGreaterThanOrEqual(r.passive);
    expect(r.aAcc).toBeCloseTo(0.7, 5);
    expect(r.active).toBe(Math.round((r.passive * (7 / 10)) / 50) * 50);
  });
  it('das Seed-Beispiel hat dasselbe Format (Schlüssel wie profile.vtests[])', () => {
    const seedV = (seed['app/profile']!.vtests as Array<Record<string, unknown>>)[0]!;
    const r = scoreVtest({ yes: all, pseudoShown: pseudo, meaning: { right: 1, n: 1 }, active: { right: 1, n: 1 } }, meta);
    expect(Object.keys(r).sort()).toEqual(Object.keys(seedV).sort());
  });
});

describe('Speichern (Plan §8.3)', () => {
  const r = { ...scoreVtest({ yes: all, pseudoShown: [], meaning: { right: 0, n: 0 }, active: { right: 0, n: 0 } }, meta) };
  it('doppelt ausgeführt wirkt einmal; höchstens 20; act und Minuten', () => {
    const cur = { vtests: Array.from({ length: 25 }, (_, i) => ({ t: i })), act: { '2026-09-20': { cards: 1 } }, minutes: { '2026-09-20': 10 } };
    const p = vtestPatch(cur, r, '2026-09-20')!;
    expect((p.vtests as unknown[]).length).toBe(20);
    expect((p.vtests as Array<Record<string, unknown>>).at(-1)).toMatchObject({ t: r.t, v: 'lx1' });
    expect(p.act).toEqual({ '2026-09-20': { vtest: 1 } });
    expect(p.minutes).toEqual({ '2026-09-20': 18 });
    expect(r.dur).toBe(480); // Sekunden wie die alte App (Befund H4)
    expect(vtestPatch({ ...cur, vtests: [...cur.vtests, { t: r.t }] }, r, '2026-09-20')).toBeNull();
  });
});

describe('Ablauf (XState)', () => {
  const run = (save: (r: VtestResult) => Promise<void>) => createActor(vtestMachine, { input: { seed: 's', lang: 'de', day: '2026-09-20', now: () => meta.t, save } }).start();

  it('Abbruch mit Rückfrage speichert nichts', () => {
    let saved = 0;
    const a = run(() => {
      saved++;
      return Promise.resolve();
    });
    a.send({ type: 'START' });
    a.send({ type: 'YES' });
    a.send({ type: 'CANCEL' });
    expect(a.getSnapshot().value).toBe('asking');
    a.send({ type: 'RESUME' });
    expect(a.getSnapshot().value).toBe('yesno');
    a.send({ type: 'CANCEL' });
    a.send({ type: 'CONFIRM_CANCEL' });
    expect(a.getSnapshot().value).toBe('cancelled');
    expect(saved).toBe(0);
  });

  it('ganzer Durchlauf: speichert genau einmal; Speicherfehler → Erneut speichern', async () => {
    let calls = 0;
    const a = run(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve();
    });
    a.send({ type: 'START' });
    for (const y of a.getSnapshot().context.yesno) a.send({ type: y.pseudo ? 'NO' : 'YES' });
    expect(a.getSnapshot().value).toBe('meaning');
    while (a.getSnapshot().value === 'meaning') {
      const it = a.getSnapshot().context.meaning[a.getSnapshot().context.i]!;
      a.send({ type: 'CHOOSE', id: it.options.find((o) => o.correct)!.id });
      a.send({ type: 'NEXT' });
    }
    expect(a.getSnapshot().value).toBe('active');
    while (a.getSnapshot().value === 'active') {
      a.send({ type: 'TYPED', correct: true });
      a.send({ type: 'NEXT' });
    }
    await waitFor(a, (s) => s.value === 'saveError');
    a.send({ type: 'RETRY' });
    await waitFor(a, (s) => s.value === 'result');
    expect(calls).toBe(2);
    expect(a.getSnapshot().context.result?.passive).toBeGreaterThan(9000);
  });
});
