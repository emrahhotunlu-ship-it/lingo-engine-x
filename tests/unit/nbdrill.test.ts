import { describe, expect, it } from 'vitest';
import { collocations, objections, transforms } from '../../src/content/nb/load';
import type { Colloc } from '../../src/content/nb/schemas';
import {
  bestAnswer,
  calqueVerb,
  checkAnswer,
  checkTransform,
  collocDone,
  collocTry,
  collocVerdict,
  compactOut,
  firstSentence,
  hasKeyword,
  matchVerb,
  modelText,
  newCollocState,
  nextStep,
  OUT_DOC_MAX_BYTES,
  OUT_MAX_ITEMS,
  outEntry,
  outId,
  outPath,
  outRef,
  pickMail,
  pickRotating,
  shadowSentences,
  shadowSteps,
  transformStart,
  upsertOut,
  youMs,
  type OutItem,
} from '../../src/domain/nbdrill';
import { jsonBytes } from '../../src/domain/speak/talkDoc';

const DEAL: Colloc = {
  id: 'c01',
  noun: 'deal',
  de: 'Geschäft',
  verbs: [
    { v: 'close', de: 'abschließen', ex: 'We hope to close the deal.' },
    { v: 'strike', de: 'aushandeln', ex: 'They struck a deal.' },
    { v: 'seal', de: 'besiegeln', ex: 'A call sealed the deal.' },
  ],
  wrong: { phrase: 'finish a deal', right: 'close a deal', note: { de: 'close, nicht finish', en: 'close, not finish' } },
};

describe('checkAnswer', () => {
  it('ignoriert Groß-/Kleinschreibung, Satzzeichen und Kurzformen', () => {
    expect(checkAnswer('May not have received', ['may not have received']).verdict).toBe('ok');
    expect(checkAnswer("can't have seen.", ['cannot have seen']).verdict).toBe('ok');
    expect(checkAnswer('Let’s conclude', ["let's conclude"]).verdict).toBe('ok');
  });
  it('britische Schreibweise ist richtig, mit US-Hinweis', () => {
    const r = checkAnswer('we need to prioritise', ['we need to prioritize']);
    expect(r.verdict).toBe('ok');
    expect(r.uk).toBe(true);
  });
  it('kleiner Tippfehler = fast richtig, sonst falsch', () => {
    expect(checkAnswer('may not have recieved', ['may not have received']).verdict).toBe('close');
    expect(checkAnswer('did not get', ['may not have received']).verdict).toBe('wrong');
    expect(checkAnswer('', ['x']).verdict).toBe('wrong');
  });
});

describe('Kollokationen', () => {
  it('Verb auch gebeugt erkennen', () => {
    expect(matchVerb('closed', ['close', 'strike'])).toBe('close');
    expect(matchVerb('to strike', ['close', 'strike'])).toBe('strike');
    expect(matchVerb('finish', ['close'])).toBeNull();
  });
  it('Treffer → Lehnübersetzung (Hinweis) → Treffer', () => {
    let s = newCollocState();
    let r = collocTry(DEAL, s, 'close');
    expect(r.step).toEqual({ kind: 'hit', verb: 'close' });
    s = r.state;
    r = collocTry(DEAL, s, 'finish');
    expect(r.step.kind).toBe('calque');
    s = r.state;
    expect(s.misses).toBe(0);
    r = collocTry(DEAL, s, 'close');
    expect(r.step.kind).toBe('dup');
    r = collocTry(DEAL, s, 'seal');
    s = r.state;
    expect(collocDone(DEAL, s)).toBe(true);
    expect(collocVerdict(DEAL, s)).toBe('close');
  });
  it('zwei Fehlversuche: erst Hinweis, dann Lösung', () => {
    let r = collocTry(DEAL, newCollocState(), 'make');
    expect(r.step).toEqual({ kind: 'hint', first: 'c' });
    r = collocTry(DEAL, r.state, 'do');
    expect(r.step.kind).toBe('solution');
    expect(collocDone(DEAL, r.state)).toBe(true);
    expect(collocVerdict(DEAL, r.state)).toBe('wrong');
  });
  it('alle Inhalte: Lehnübersetzung erkennbar und kein richtiges Verb', () => {
    const list = collocations();
    expect(list.length).toBe(40);
    for (const c of list) {
      const cv = calqueVerb(c);
      expect(cv, c.id).not.toBe('');
      expect(matchVerb(cv, c.verbs.map((v) => v.v)), c.id).toBeNull();
      const r = collocTry(c, newCollocState(), cv);
      expect(r.step.kind, c.id).toBe('calque');
      for (const v of c.verbs) expect(matchVerb(v.v, c.verbs.map((x) => x.v)), `${c.id} ${v.v}`).toBe(v.v);
    }
  });
});

describe('Umformung', () => {
  it('jede Musterlösung ist richtig; Hinweise für Schlüsselwort und Anfang', () => {
    const list = transforms();
    expect(list.length).toBe(30);
    for (const t of list) {
      for (const a of t.answers) expect(checkTransform(t, a).verdict, `${t.id}: ${a}`).toBe('ok');
      expect(hasKeyword(t.answers[0] ?? '', t.key), t.id).toBe(true);
      expect(transformStart(t).length, t.id).toBeGreaterThan(0);
    }
    const t = list[0];
    if (!t) throw new Error('keine Umformungen');
    expect(checkTransform(t, 'did not get').hint).toBe('keyword');
    expect(checkTransform(t, `${t.key.toLowerCase()} have got`).hint).toBe('start');
  });
});

describe('out/<Monat>', () => {
  const base: OutItem = { id: 'x', k: 'inbox', d: '2026-09-28', t: 1_790_000_000_000, ok: true, text: 'Hello', fb: { verdict: 'ok' }, ms: 1234 };
  it('Pfad, Kennung und Verweis aus dem Lerntag', () => {
    expect(outPath('2026-09-30')).toBe('out/2026-09');
    expect(outId('colloc', 36)).toBe('colloc-10');
    expect(outRef({ id: 'inbox-1', d: '2026-10-01' })).toBe('out/2026-10#inbox-1');
  });
  it('Felder werden auf 2 KB gekappt', () => {
    const e = outEntry({ ...base, text: 'x'.repeat(5000), fb: { verdict: 'ok', effect: 'y'.repeat(5000), fixes: 'z'.repeat(5000) } });
    expect(new TextEncoder().encode(String(e.text)).length).toBeLessThanOrEqual(2048);
    expect(jsonBytes(e.fb)).toBeLessThanOrEqual(2048);
  });
  it('legt an, fügt idempotent ein und schreibt nie in ein ungültiges Dokument', () => {
    const created = upsertOut(undefined, base);
    expect(created && 'set' in created).toBe(true);
    const doc = created && 'set' in created ? created.set : {};
    const again = upsertOut(doc, { ...base, ok: false });
    const items = again && 'update' in again ? (again.update.items as unknown[]) : [];
    expect(items).toHaveLength(1);
    expect(upsertOut({ v: 1, items: 'kaputt' }, base)).toBeNull();
    expect(upsertOut({ v: 'eins', items: [] }, base)).toBeNull();
  });
  it('400 volle Einträge: Dokument < 200 KiB, höchstens 400, der neue bleibt vollständig', () => {
    const big = (i: number) => outEntry({ ...base, id: `e${i}`, t: base.t + i, text: 'w'.repeat(2000), fb: { verdict: 'ok', effect: 'e'.repeat(1900) } });
    const list = Array.from({ length: OUT_MAX_ITEMS }, (_, i) => big(i));
    const cur = { v: 1, month: '2026-09', items: list };
    const fresh: OutItem = { ...base, id: 'neu', t: base.t + 10_000, text: 'Meine Antwort', fb: { verdict: 'close', effect: 'gut' } };
    const op = upsertOut(cur, fresh);
    const items = op && 'update' in op ? (op.update.items as Array<Record<string, unknown>>) : [];
    expect(items.length).toBeLessThanOrEqual(OUT_MAX_ITEMS);
    expect(jsonBytes({ v: 1, month: '2026-09', items })).toBeLessThanOrEqual(OUT_DOC_MAX_BYTES);
    const last = items[items.length - 1];
    expect(last?.id).toBe('neu');
    expect(last?.text).toBe('Meine Antwort');
    expect(last?.fb).toEqual({ verdict: 'close', effect: 'gut' });
    // Verdichtet wird zuerst `fb` der ältesten Einträge.
    expect(items[0]?.fb).toBeUndefined();
  });
  it('mehr als 400 Einträge: die ältesten fallen weg', () => {
    const list = Array.from({ length: OUT_MAX_ITEMS + 5 }, (_, i) => ({ id: `e${i}`, k: 'colloc', d: '2026-09-01', t: i }));
    const out = compactOut(list, '2026-09') as Array<{ id: string }>;
    expect(out).toHaveLength(OUT_MAX_ITEMS);
    expect(out[0]?.id).toBe('e5');
  });
});

describe('Einwände, Posteingang, Nachsprechen, Auswahl', () => {
  it('Musterantwort und beste Antwort', () => {
    const o = objections()[0];
    if (!o) throw new Error('keine Einwände');
    expect(modelText(o)).toContain(o.model.acknowledge);
    const best = bestAnswer([
      { id: 'a', text: 'Short.', ms: 1, moves: { acknowledge: true, ask: false, answer: false, secure: false }, by: 'self' },
      { id: 'b', text: 'Longer but fewer moves.', ms: 1, moves: null, by: null },
      { id: 'c', text: 'I see. What matters most? We include support. Shall we compare?', ms: 1, moves: { acknowledge: true, ask: true, answer: true, secure: true }, by: 'ai' },
    ]);
    expect(best?.id).toBe('c');
    expect(bestAnswer([{ id: 'x', text: '  ', ms: 0, moves: null, by: null }])).toBeNull();
    expect(firstSentence('I understand. What else?')).toBe('I understand.');
  });
  it('Posteingang: Schritte je Teil und Auswahl der Mail', () => {
    expect(nextStep('read', 'full')).toBe('gist');
    expect(nextStep('gist', 'read')).toBe('done');
    expect(nextStep('gist', 'full')).toBe('reply');
    expect(nextStep('reply', 'reply')).toBe('done');
    const mails = [{ id: 'm01', theme: 't01' }, { id: 'm02', theme: 't02' }] as unknown as Parameters<typeof pickMail>[0];
    expect(pickMail(mails, 't02')?.id).toBe('m02');
    expect(pickMail(mails, 't09')?.id).toBe('m01');
    expect(pickMail(mails, 't02', 'm01')?.id).toBe('m01');
  });
  it('Nachsprechen: 3 Durchgänge mit 0,9 / 1,0 / 1,1, Dauer in Grenzen', () => {
    const steps = shadowSteps(3);
    expect(steps).toHaveLength(9);
    expect(steps.map((s) => s.rate)).toEqual([0.9, 0.9, 0.9, 1, 1, 1, 1.1, 1.1, 1.1]);
    expect(youMs(null, 'one two three four five', 1)).toBe(2000);
    expect(youMs(50, 'x', 1)).toBe(1500);
    expect(youMs(60_000, 'x', 1)).toBe(12_000);
    expect(shadowSentences([], ['  A b. ', 'A b.', 'C d.'])).toEqual(['A b.', 'C d.']);
    expect(shadowSentences(null, undefined)).toEqual([]);
  });
  it('reihum auswählen', () => {
    const l = [1, 2, 3, 4, 5, 6, 7];
    expect(pickRotating(l, 3, 0)).toEqual([1, 2, 3]);
    expect(pickRotating(l, 3, 1)).toEqual([4, 5, 6]);
    expect(pickRotating(l, 3, 2)).toEqual([7, 1, 2]);
    expect(pickRotating([], 3, 1)).toEqual([]);
  });
});
