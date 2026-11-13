import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { addDays, dayKey } from '../../../src/domain/date';
import { readTempo, writeTempo } from '../../../src/modules/vocab/data/tempo';
import { vmodTempoWriteSchema } from '../../../src/modules/vocab/data/schemas';
import { FLAG } from '../../../src/modules/vocab/domain/planner';
import { nextDayRecall, nextTempo, startTempo, TEMPO_DAYS, TEMPO_MAX, TEMPO_MIN, TEMPO_MIN_N, tempoText, type Tempo } from '../../../src/modules/vocab/domain/tempo';
import { tuple, vlogDocId, vlogKey, type VlogTuple } from '../../../src/modules/vocab/domain/vlog';
import type { Form, Outcome } from '../../../src/modules/vocab/domain/types';
import { emptyLex } from '../../../src/modules/vocab/domain/planner';
import { D, learned, PROFILE, T0, wordDoc, world } from './p2World';

// Politur P2 (Emrah 13.11.2026, E3 „neue Wörter nach Behalten, 3–10“): Quote „am Folgetag frei richtig“, Regel des Tempos, Speichern in
// `vmod/tempo`, Wirkung auf den Tagesplan und die eine Zeile am Rundenstart.

const tp = (t: number, path: string, form: Form, note: number, outcome: Outcome, o: { hint?: number; flags?: number } = {}): VlogTuple =>
  tuple({ t, path, track: note > 0 ? 1 : 0, form, note, outcome, ms: 5000, fk: 1000, hint: o.hint ?? 0, sentence: null, lv: 2, flags: o.flags ?? 0 });

/** Verlauf: an jedem der letzten `days` Lerntage `perDay` Wörter eingeführt, am Folgetag `okPerDay` davon frei richtig. */
function history(days: number, perDay: number, okPerDay: number, nowMs = T0): VlogTuple[] {
  const out: VlogTuple[] = [];
  for (let d = days; d >= 1; d--) {
    const introAt = nowMs - (d + 1) * D;
    for (let i = 0; i < perDay; i++) {
      const path = `vocab/h${d}-${i}`;
      out.push(tp(introAt + i * 1000, path, 'intro', 0, 'dunno'));
      out.push(tp(introAt + D + i * 1000 + 500, path, 'gap', i < okPerDay ? 3 : 1, i < okPerDay ? 'ok' : 'wrong'));
    }
  }
  return out;
}

describe('Quote „am Folgetag frei richtig“ (nextDayRecall)', () => {
  it('zählt je Wort den ersten gebuchten Abruf nach dem Einführungstag: frei, ohne Hilfe, richtig', () => {
    const t = T0 - 3 * D;
    const rec = nextDayRecall(
      [
        tp(t, 'vocab/a', 'intro', 0, 'dunno'),
        tp(t + 60_000, 'vocab/a', 'gap_hint', 0, 'ok', { flags: FLAG.step }), // Schritt A am selben Tag: zählt nicht
        tp(t + 300_000, 'vocab/a', 'gap', 3, 'ok', { flags: FLAG.step }), // Schritt B am selben Tag: zählt nicht
        tp(t + D, 'vocab/a', 'gap', 3, 'ok'), // Folgetag frei richtig
        tp(t + 2 * D, 'vocab/a', 'gap', 1, 'wrong'), // zweiter Abruf: zählt nicht mehr
        tp(t, 'vocab/b', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/b', 'gap', 1, 'wrong'), // vergessen
        tp(t, 'vocab/c', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/c', 'gap', 2, 'ok', { hint: 1 }), // mit Tipp: nicht frei
        tp(t, 'vocab/d', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/d', 'nosent', 2, 'typo'), // Tippfehler zählt als gewusst
        tp(t, 'vocab/e', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/e', 'gap', 0, 'syn'), // ohne Buchung: zählt nicht
        tp(t + D + 1000, 'vocab/e', 'gap', 3, 'ok'), // … der erste gebuchte danach schon
        // Politur P2: eine Verstehen-Abfrage am Folgetag (Bedeutung, Hören) ist kein freier Abruf – sie zählt weder als gewusst noch als vergessen;
        // es zählt der erste freie Abruf danach.
        tp(t, 'vocab/f', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/f', 'tone_mean', 1, 'wrong'),
        tp(t + D + 2000, 'vocab/f', 'listen', 3, 'ok'),
        tp(t + 2 * D, 'vocab/f', 'gap', 3, 'ok'),
      ],
      T0,
    );
    expect(rec).toMatchObject({ ok: 4, all: 6 });
    expect(rec.last).toEqual({ d: dayKey(t + 2 * D), ok: 1, all: 1 });
  });
  it('nicht gezählt: Probe „Kenne ich schon“ (keine Einführung), Belege von außen, umgerechnete Einträge, erster Abruf nach mehr als 2 Tagen, außerhalb des Fensters', () => {
    const t = T0 - 5 * D;
    const rec = nextDayRecall(
      [
        tp(t, 'vocab/known', 'probe', 3, 'ok'),
        tp(t + D, 'vocab/known', 'gap', 3, 'ok'),
        tp(t, 'vocab/ext', 'intro', 0, 'dunno'),
        tp(t + D, 'vocab/ext', 'gap', 3, 'ok', { flags: FLAG.ext }),
        tp(t, 'vocab/mig', 'intro', 0, 'dunno', { flags: FLAG.mig }),
        tp(t + D, 'vocab/mig', 'gap', 3, 'ok'),
        tp(t, 'vocab/late', 'intro', 0, 'dunno'),
        tp(t + 3 * D, 'vocab/late', 'gap', 1, 'wrong'),
        tp(T0 - 30 * D, 'vocab/old', 'intro', 0, 'dunno'),
        tp(T0 - 29 * D, 'vocab/old', 'gap', 3, 'ok'),
      ],
      T0,
    );
    expect(rec).toEqual({ ok: 0, all: 0, last: null });
    // Der Beleg von außen schließt den ersten Abruf nicht: der nächste echte zählt.
    expect(nextDayRecall([tp(t, 'vocab/ext', 'intro', 0, 'dunno'), tp(t + D, 'vocab/ext', 'gap', 3, 'ok', { flags: FLAG.ext }), tp(t + D + 5000, 'vocab/ext', 'gap', 3, 'ok')], T0).all).toBe(1);
    expect(TEMPO_DAYS).toBe(14);
  });
  it('„Gestern“: der jüngste Lerntag vor heute mit Folgetag-Abrufen', () => {
    const rec = nextDayRecall(history(3, 10, 6), T0);
    expect(rec).toMatchObject({ ok: 18, all: 30 });
    expect(rec.last).toEqual({ d: dayKey(T0 - D), ok: 6, all: 10 });
  });
});

describe('Regel des Tempos (nextTempo)', () => {
  const day = dayKey(T0);
  const prev = (n: number, base = 10) => ({ d: addDays(day, -1), n, base });
  it('Start = Einstellung, auf 3–10 begrenzt; unter 3 fest; geänderte Einstellung beginnt neu', () => {
    expect(nextTempo(null, 10, { ok: 0, all: 0 }, false, day)).toMatchObject({ n: 10, base: 10, why: 'start', d: day });
    expect(nextTempo(null, 15, { ok: 0, all: 0 }, false, day)).toMatchObject({ n: TEMPO_MAX, base: 15, why: 'start' });
    expect(nextTempo(null, 5, { ok: 50, all: 50 }, false, day)).toMatchObject({ n: 5, why: 'start' });
    expect(nextTempo(prev(7), 5, { ok: 50, all: 50 }, false, day)).toMatchObject({ n: 5, base: 5, why: 'start' });
    expect(nextTempo(prev(7), 0, { ok: 50, all: 50 }, false, day)).toMatchObject({ n: 0, why: 'fixed' });
    expect(nextTempo(null, 2, { ok: 50, all: 50 }, false, day)).toMatchObject({ n: 2, why: 'fixed' });
    expect([startTempo(0), startTempo(2), startTempo(5), startTempo(15)]).toEqual([0, 2, 5, 10]);
  });
  it('≥ 85 % und ohne Rückstand → +1 (höchstens 10); mit Rückstand bleibt es', () => {
    expect(nextTempo(prev(6), 10, { ok: 34, all: 40 }, false, day)).toMatchObject({ n: 7, why: 'up', ok: 34, all: 40 });
    expect(nextTempo(prev(6), 10, { ok: 34, all: 40 }, true, day)).toMatchObject({ n: 6, why: 'backlog' });
    expect(nextTempo(prev(10), 10, { ok: 40, all: 40 }, false, day)).toMatchObject({ n: 10, why: 'top' });
  });
  it('< 70 % → −2 (nie unter 3); dazwischen bleibt es; unter 40 Abrufen keine Änderung', () => {
    expect(nextTempo(prev(8), 10, { ok: 27, all: 40 }, false, day)).toMatchObject({ n: 6, why: 'down' });
    expect(nextTempo(prev(4), 10, { ok: 20, all: 40 }, true, day)).toMatchObject({ n: 3, why: 'down' });
    expect(nextTempo(prev(TEMPO_MIN), 10, { ok: 20, all: 40 }, false, day)).toMatchObject({ n: 3, why: 'floor' });
    expect(nextTempo(prev(8), 10, { ok: 28, all: 40 }, false, day)).toMatchObject({ n: 8, why: 'keep' });
    expect(nextTempo(prev(8), 10, { ok: 33, all: 40 }, false, day)).toMatchObject({ n: 8, why: 'keep' });
    expect(nextTempo(prev(8), 10, { ok: 0, all: TEMPO_MIN_N - 1 }, false, day)).toMatchObject({ n: 8, why: 'few' });
    expect(nextTempo(prev(8), 10, { ok: 39, all: TEMPO_MIN_N - 1 }, false, day)).toMatchObject({ n: 8, why: 'few' });
  });
  it('derselbe Lerntag: der Stand bleibt (eingefroren, kein zweiter Schritt)', () => {
    expect(nextTempo({ d: day, n: 6, base: 10 }, 10, { ok: 40, all: 40 }, false, day)).toMatchObject({ n: 6, why: 'keep' });
  });
});

describe('Zeile am Rundenstart (tempoText)', () => {
  it('Grund mit Zahlen; ohne Zahlen im Grund (Start, zu wenige Abrufe) steht davor das jüngste Tagesergebnis', () => {
    expect(tempoText({ n: 4, why: 'down', ok: 26, all: 40, last: { ago: 1, ok: 6, all: 10 } })).toEqual({ main: 'vmTempoDown', vars: { n: 4, ok: 26, all: 40 }, last: null });
    expect(tempoText({ n: 10, why: 'few', ok: 6, all: 10, last: { ago: 1, ok: 6, all: 10 } })?.last).toEqual({ key: 'vmTempoLast1', vars: { ok: 6, all: 10 } });
    expect(tempoText({ n: 10, why: 'start', ok: 6, all: 10, last: { ago: 3, ok: 6, all: 10 } })?.last?.key).toBe('vmTempoLastN');
    expect(tempoText({ n: 10, why: 'few', ok: 1, all: 2, last: { ago: 1, ok: 1, all: 2 } })?.last).toBeNull();
    expect(tempoText({ n: 2, why: 'fixed', ok: 0, all: 0, last: null })).toBeNull();
    for (const why of ['start', 'few', 'up', 'down', 'keep', 'backlog', 'top', 'floor'] as const) expect(tempoText({ n: 5, why, ok: 1, all: 2, last: null })?.main).toMatch(/^vmTempo/);
  });
});

describe('vmod/tempo speichern (data-guard: ergänzend, nie ein fremdes Dokument anfassen)', () => {
  const next: Tempo = { d: '2026-11-12', n: 7, base: 10, why: 'up', ok: 36, all: 40 };
  const setup = (seed: Record<string, Record<string, unknown>> = {}) => {
    const h = createMemoryDb({ seed });
    return { h, w: createWriter(h.db) };
  };
  it('anlegen, am nächsten Lerntag fortschreiben; derselbe Lerntag behält den ersten Stand (zweites Gerät)', async () => {
    const { h, w } = setup();
    expect(await writeTempo(w, next, T0)).toEqual(next);
    expect(vmodTempoWriteSchema.safeParse(h.dump()['vmod/tempo']).success).toBe(true);
    expect(readTempo(h.dump()['vmod/tempo'])).toEqual(next);
    // Zweites Gerät am selben Tag rechnet etwas anderes: es gilt der gespeicherte Stand.
    expect(await writeTempo(w, { ...next, n: 6, why: 'keep' }, T0 + 1000)).toEqual(next);
    const tomorrow: Tempo = { ...next, d: '2026-11-13', n: 8 };
    expect(await writeTempo(w, tomorrow, T0 + D)).toEqual(tomorrow);
    expect(readTempo(h.dump()['vmod/tempo'])).toEqual(tomorrow);
    // Ein älterer Lerntag überschreibt nie einen neueren.
    expect(await writeTempo(w, next, T0 + D + 1000)).toEqual(tomorrow);
    expect(readTempo(h.dump()['vmod/tempo'])).toEqual(tomorrow);
  });
  it('geänderte Einstellung am selben Tag: neuer Stand ersetzt', async () => {
    const { h, w } = setup();
    await writeTempo(w, next, T0);
    const other: Tempo = { ...next, base: 5, n: 5, why: 'start' };
    expect(await writeTempo(w, other, T0 + 1000)).toEqual(other);
    expect(readTempo(h.dump()['vmod/tempo'])).toEqual(other);
  });
  it('unerwarteter Aufbau (neuere Fassung) bleibt unberührt; gelesen wie „kein Stand“', async () => {
    const odd = { v: 2, d: '2026-11-12', n: 7, more: true };
    const { h, w } = setup({ 'vmod/tempo': odd });
    expect(readTempo(odd)).toBeNull();
    expect(await writeTempo(w, next, T0)).toBeNull();
    expect(h.dump()['vmod/tempo']).toEqual(odd);
  });
});

describe('Tempo in der Runde (LearnRun)', () => {
  /** Verlaufsdokumente aus Tupeln (wie `writeVlog` sie ablegt), samt Verzeichnis. */
  const vlogSeed = (tuples: VlogTuple[]) => {
    const docs: Record<string, Record<string, unknown>> = {};
    const ix: Record<string, 1> = {};
    for (const x of tuples) {
      const id = vlogDocId(x[0]);
      (docs[id] ??= { v: 1, e: {} });
      (docs[id].e as Record<string, unknown>)[vlogKey(x[0], 'phone')] = x;
      ix[id.slice('vlog/'.length)] = 1;
    }
    return { ...docs, 'vmod/ix': { v: 1, docs: ix } };
  };
  const tenFresh = () => Array.from({ length: 12 }, (_, i) => wordDoc(i, emptyLex('w', 'edge', T0 - 5 * D)));

  it('erster Tag: Start bei der Einstellung, gespeichert; der Plan nimmt höchstens so viele neue, wie in die Zeit passen', async () => {
    const w = world({ docs: tenFresh() });
    await w.start();
    const v = w.run.get();
    expect(v.k).toBe('start');
    if (v.k !== 'start') return;
    expect(v.s.tempo).toMatchObject({ n: 10, why: 'start' });
    expect(readTempo(w.h.dump()['vmod/tempo'])).toMatchObject({ n: 10, base: 10, why: 'start', d: dayKey(T0) });
    // 18 Wörter-Minuten, nichts fällig: 6 neue (je 2,6 Min.), obwohl das Tempo 10 erlaubt.
    expect(v.s.fresh).toBe(6);
  });

  it('zu viel vergessen (60 % über 14 Tage): −2, die Zeile nennt die Zahlen; der Plan hält sich an das Tempo', async () => {
    const seed = { ...vlogSeed(history(7, 10, 6)), 'vmod/tempo': { v: 1, d: dayKey(T0 - D), n: 6, base: 10, why: 'keep', ok: 0, all: 0, t: T0 - D } };
    const w = world({ docs: tenFresh(), seed });
    await w.start();
    const v = w.run.get();
    if (v.k !== 'start') throw new Error(v.k);
    expect(v.s.tempo).toEqual({ n: 4, why: 'down', ok: 42, all: 70, last: { ago: 1, ok: 6, all: 10 } });
    expect(v.s.fresh).toBe(4);
    expect(readTempo(w.h.dump()['vmod/tempo'])).toMatchObject({ n: 4, why: 'down', d: dayKey(T0), ok: 42, all: 70 });
  });

  it('gut behalten (90 %): +1 ohne Rückstand; mit Rückstand bleibt es', async () => {
    const stored = { v: 1, d: dayKey(T0 - D), n: 4, base: 10, why: 'keep', ok: 0, all: 0, t: T0 - D };
    const a = world({ docs: tenFresh(), seed: { ...vlogSeed(history(7, 10, 9)), 'vmod/tempo': stored } });
    await a.start();
    const va = a.run.get();
    if (va.k !== 'start') throw new Error(va.k);
    expect(va.s.tempo).toMatchObject({ n: 5, why: 'up', ok: 63, all: 70 });
    expect(va.s.fresh).toBe(5);
    // Rückstand: 60 fällige Wiederholungen (42 Min.) bei 18 Wörter-Minuten.
    const many = [...Array.from({ length: 60 }, (_, i): [string, Record<string, unknown>] => [`vocab/r${i}`, { word: `rword${i}`, de: `Wort ${i}`, pos: 'noun', ex: `We use the rword${i} every day.`, order: 100 + i, lex: learned(`vocab/r${i}`, T0 - 10 * D) }]), ...tenFresh()];
    const b = world({ docs: many, seed: { ...vlogSeed(history(7, 10, 9)), 'vmod/tempo': stored } });
    await b.start();
    const vb = b.run.get();
    if (vb.k !== 'start') throw new Error(vb.k);
    expect(vb.s.tempo).toMatchObject({ n: 4, why: 'backlog' });
    expect(vb.s.fresh).toBe(2);
    expect(vb.s.fewer).toBe(true);
  });

  it('derselbe Lerntag (zweites Öffnen, anderes Gerät): der gespeicherte Stand gilt, es wird nicht noch einmal gerechnet', async () => {
    const stored = { v: 1, d: dayKey(T0), n: 7, base: 10, why: 'up', ok: 36, all: 40, t: T0 - 1000 };
    const w = world({ docs: tenFresh(), seed: { ...vlogSeed(history(7, 10, 2)), 'vmod/tempo': stored } });
    await w.start();
    const v = w.run.get();
    if (v.k !== 'start') throw new Error(v.k);
    expect(v.s.tempo).toMatchObject({ n: 7, why: 'up', ok: 36, all: 40 });
    expect(w.h.dump()['vmod/tempo']).toEqual(stored);
  });

  it('Einstellung 0 und 2 bleiben fest; kurzer Tag: kein Tempo, höchstens 2 neue', async () => {
    const zero = world({ docs: tenFresh(), profile: { ...PROFILE, newPerDay: 0 }, seed: vlogSeed(history(7, 10, 9)) });
    await zero.start();
    expect(zero.run.get().k).toBe('done');
    const two = world({ docs: tenFresh(), profile: { ...PROFILE, newPerDay: 2 }, seed: vlogSeed(history(7, 10, 9)) });
    await two.start();
    const v2 = two.run.get();
    if (v2.k !== 'start') throw new Error(v2.k);
    expect(v2.s.fresh).toBe(2);
    expect(v2.s.tempo).toMatchObject({ n: 2, why: 'fixed' });
    // `vocabCfg` liest den kurzen Tag mit der echten Uhr: beide Tage markieren.
    const short = world({ docs: tenFresh(), profile: { ...PROFILE, kt: { [dayKey(T0)]: 1, [dayKey(Date.now())]: 1 } }, seed: vlogSeed(history(7, 10, 9)) });
    await short.start();
    const vs = short.run.get();
    if (vs.k !== 'start') throw new Error(vs.k);
    expect(vs.s.tempo ?? null).toBeNull();
    expect(vs.s.fresh).toBeLessThanOrEqual(2);
    expect(short.h.dump()['vmod/tempo']).toBeUndefined();
  });

  it('freie Runde vor der Pflicht: nimmt das letzte Tempo, schreibt nichts', async () => {
    const stored = { v: 1, d: dayKey(T0 - D), n: 3, base: 10, why: 'down', ok: 20, all: 40, t: T0 - D };
    const w = world({ docs: tenFresh(), seed: { ...vlogSeed(history(7, 10, 9)), 'vmod/tempo': stored } });
    await w.start('free10');
    let intros = 0;
    for (let i = 0; i < 60; i++) {
      const v = w.run.get();
      if (v.k === 'pick') {
        w.run.pickChoose(v.right);
        w.run.pickNext();
      } else if (v.k === 'card' && v.kind === 'intro') {
        intros++;
        w.run.introSeen({ ms: 1000, fk: 0 });
      } else if (v.k === 'card') {
        w.run.check(v.card.answer, { ms: 1000, fk: 500 });
        w.run.next();
      } else break;
    }
    expect(intros).toBe(3);
    expect(w.h.dump()['vmod/tempo']).toEqual(stored);
  });
});
