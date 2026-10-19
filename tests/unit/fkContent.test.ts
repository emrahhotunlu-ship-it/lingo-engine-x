import { describe, expect, it } from 'vitest';
import b1Raw from '../../src/content/fk/b1.json?raw';
import b2Raw from '../../src/content/fk/b2.json?raw';
import { toUS } from '../../src/domain/answer/spelling';
import { b1Tasks, b2Tasks, checkB1, hasFk, pickFk } from '../../src/domain/repair/fk';
import { repairNorm } from '../../src/domain/repair/repair';

// Paket FK: Inhalts-Prüfung (Gate G0) für die Aufgabenformen B1 „Sag es richtig“ und B2 „Welche Fassung schickst du?“.

const rawCount = (raw: string): number => (JSON.parse(raw) as { tasks: unknown[] }).tasks.length;
const EMRAH_TOPICS = ['articles', 'c1-participle', 'conditionals', 'future-forms', 'future-perf-cont', 'gerund-inf', 'mixed-cond', 'modals-deduction', 'passive', 'past-perfect', 'past-simple-perfect', 'prepositions', 'pres-perf-cont', 'pres-simple-cont', 'reported', 'used-to'];
const strip = (w: string): string => w.toLowerCase().replace(/[.,!?;:]+$/, '');

describe('FK-Inhalt B1', () => {
  it('mindestens 40 Aufgaben, alle Muster existieren, Kennungen eindeutig', () => {
    expect(b1Tasks().length).toBeGreaterThanOrEqual(40);
    expect(b1Tasks()).toHaveLength(rawCount(b1Raw));
    expect(new Set(b1Tasks().map((t) => t.id)).size).toBe(b1Tasks().length);
  });
  it('deckt alle 16 Themen aus Emrahs Fehlerradar ab', () => {
    const topics = new Set(b1Tasks().map((t) => t.topic));
    for (const t of EMRAH_TOPICS) expect(topics.has(t), t).toBe(true);
    for (const t of EMRAH_TOPICS) expect(hasFk({ topic: t }), t).toBe(true);
  });
  it('Musterlösung und jede Variante sind „exact“, der typische Fehler ist „no“, Musterlösung in US-Schreibweise', () => {
    for (const t of b1Tasks()) {
      expect(checkB1(t.model, t), `${t.id} model`).toBe('exact');
      for (const v of t.ok) expect(checkB1(v, t), `${t.id} ok: ${v}`).toBe('exact');
      expect(checkB1(t.bad, t), `${t.id} bad`).toBe('no');
      expect([t.model, ...t.ok].some((v) => repairNorm(v) === repairNorm(t.bad)), `${t.id} bad steckt in ok`).toBe(false);
      for (const w of t.model.split(/\s+/)) expect(toUS(strip(w)), `${t.id} US: ${w}`).toBe(strip(w));
    }
  });
  it('beide Sprachen vollständig, keine echten Firmennamen', () => {
    for (const t of b1Tasks()) {
      for (const f of [t.sit, t.intent, t.hint, t.why]) {
        expect(f.de.length).toBeGreaterThan(5);
        expect(f.en.length).toBeGreaterThan(5);
        expect(f.de).not.toBe(f.en);
      }
      expect(JSON.stringify(t)).not.toMatch(/Google|Microsoft|SAP|Salesforce|Amazon|Siemens|DATEV/);
    }
  });
  it('eine ungesehene Aufgabe wird bevorzugt', () => {
    expect(pickFk('b1', { pat: 'cn.second' }, 'x', new Set())?.pat).toBe('cn.second');
    const ids = b1Tasks().filter((t) => t.topic === 'conditionals').map((t) => t.id);
    const left = ids[ids.length - 1];
    expect(pickFk('b1', { topic: 'conditionals' }, 'x', new Set(ids.slice(0, -1)))?.id).toBe(left);
  });
});

describe('FK-Inhalt B2', () => {
  it('mindestens 12 Aufgaben, Muster existieren, je zwei Stellen mit je zwei Optionen', () => {
    expect(b2Tasks().length).toBeGreaterThanOrEqual(12);
    expect(b2Tasks()).toHaveLength(rawCount(b2Raw));
    for (const t of b2Tasks()) {
      expect(t.good).not.toBe(t.bad);
      expect(t.next.s).toContain('{1}');
      expect(t.next.s).toContain('{2}');
      for (const g of t.next.gaps) expect(g.o[0]).not.toBe(g.o[1]);
      for (const f of [t.sit, t.why]) {
        expect(f.de.length).toBeGreaterThan(5);
        expect(f.en.length).toBeGreaterThan(5);
      }
    }
  });
});
