import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import {
  addFacts,
  cleanFact,
  factsForPrompt,
  MEMORY_FACT_MAX,
  MEMORY_MAX,
  MEMORY_PER_SOURCE,
  memoryWritable,
  readMemory,
  removeFact,
  transcriptOf,
  type MemoryFact,
} from '../../src/domain/memory/memory';
import { companionChat, type CompanionVars } from '../../src/prompts/companionChat';
import { memoryExtract } from '../../src/prompts/memoryExtract';
import { MEMORY_LINE_MAX, memoryLine } from '../../src/prompts/work';

// Backlog B5 „Claude merkt sich“: Grenzen des Dokuments `app/memory` und der Weg in die Vorlagen.

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('app/memory (domain/memory)', () => {
  it('höchstens 5 Fakten je Gespräch, ohne Dubletten, gekürzt auf 160 Zeichen', () => {
    const long = 'x'.repeat(400);
    const next = addFacts([], ['Messe in London am 14.10.', 'messe in London am 14.10!', 'CFO bei Kunde X skeptisch', 'a', long, 'Fakt vier', 'Fakt fünf', 'Fakt sechs'], 'chat:1', 1000, 'de');
    expect(next).not.toBeNull();
    const items = next as MemoryFact[];
    expect(items).toHaveLength(MEMORY_PER_SOURCE);
    expect(items.map((f) => f.text)).toEqual(['Messe in London am 14.10.', 'CFO bei Kunde X skeptisch', `${'x'.repeat(MEMORY_FACT_MAX - 1)}…`, 'Fakt vier', 'Fakt fünf']);
    expect(items.every((f) => f.text.length <= MEMORY_FACT_MAX && f.src === 'chat:1' && f.lang === 'de')).toBe(true);
    expect(new Set(items.map((f) => f.id)).size).toBe(items.length);
  });

  it('erneutes Merken derselben Quelle ersetzt deren Fakten; andere Quellen bleiben; gleicher Stand → null', () => {
    const a = addFacts([], ['Fakt eins', 'Fakt zwei'], 'chat:1', 1, 'de') as MemoryFact[];
    const b = addFacts(a, ['Termin mit Anna am Freitag'], 'meeting:m1', 2, 'de') as MemoryFact[];
    const c = addFacts(b, ['Fakt eins', 'Fakt drei'], 'chat:1', 3, 'de') as MemoryFact[];
    expect(c.map((f) => `${f.src}|${f.text}`)).toEqual(['meeting:m1|Termin mit Anna am Freitag', 'chat:1|Fakt eins', 'chat:1|Fakt drei']);
    expect(addFacts(c, ['Fakt eins', 'Fakt drei'], 'chat:1', 4, 'de')).toBeNull();
    // Nichts Neues aus einer neuen Quelle (nur Dubletten) → nichts zu schreiben.
    expect(addFacts(c, ['Termin mit Anna am Freitag'], 'chat:9', 5)).toBeNull();
  });

  it('insgesamt höchstens 40 Fakten – die ältesten fallen heraus; Dokument bleibt klein', () => {
    let items: MemoryFact[] = [];
    for (let i = 0; i < 20; i++) items = addFacts(items, Array.from({ length: 5 }, (_, k) => `Quelle ${i} Fakt ${k} ${'y'.repeat(150)}`), `chat:${i}`, i + 1, 'de') ?? items;
    expect(items).toHaveLength(MEMORY_MAX);
    expect(items[0]?.src).toBe('chat:12');
    expect(items[items.length - 1]?.src).toBe('chat:19');
    expect(bytes({ v: 1, items })).toBeLessThan(16 * 1024);
  });

  it('einzeln löschen; unbekannte Kennung → null', () => {
    const items = addFacts([], ['Eins eins', 'Zwei zwei'], 'chat:1', 1) as MemoryFact[];
    const next = removeFact(items, items[0]!.id) as MemoryFact[];
    expect(next.map((f) => f.text)).toEqual(['Zwei zwei']);
    expect(removeFact(items, 'gibtsnicht')).toBeNull();
  });

  it('liest tolerant; ein unerwarteter Aufbau wird nie überschrieben; Schema akzeptiert das Dokument', () => {
    const doc = { v: 1, items: [{ id: 'a', text: 'Messe', src: 'chat:1', t: 1, lang: 'de' }] };
    expect(readMemory(doc)).toHaveLength(1);
    expect(memoryWritable(doc)).toBe(true);
    expect(memoryWritable(undefined)).toBe(true);
    expect(memoryWritable({ items: 'kaputt' })).toBe(false);
    expect(memoryWritable({ items: [{ id: 'a', text: 'ok', t: 1 }, { text: 'ohne id' }] })).toBe(false);
    expect(validateDoc('app/memory', doc).ok).toBe(true);
    expect(validateDoc('app/memory', { items: [{ id: 'a', text: 1 }] }).ok).toBe(false);
  });

  it('Aufräumen eines Fakts: Aufzählungszeichen und Anführungszeichen außen weg', () => {
    expect(cleanFact('- „Messe in London“ ')).toBe('Messe in London');
    expect(cleanFact('2. Präsentiert   Q3-Zahlen')).toBe('Präsentiert Q3-Zahlen');
  });

  it('Verlauf: Lerner/Coach je Zeile, älteste fallen bei Überlänge heraus; ohne eigene Nachricht leer', () => {
    expect(transcriptOf([{ role: 'assistant', content: 'Hallo' }])).toBe('');
    const msgs = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `Nachricht ${i} ${'z'.repeat(500)}` }));
    const tr = transcriptOf(msgs, 3_000);
    expect(tr.length).toBeLessThanOrEqual(3_000);
    expect(tr.split('\n').at(-1)).toMatch(/^Coach: Nachricht 29/);
  });

  it('für die Vorlagen: neueste zuerst, höchstens max', () => {
    const items = [
      { id: 'a', text: 'alt', src: 's', t: 1 },
      { id: 'b', text: 'neu', src: 's', t: 5 },
    ];
    expect(factsForPrompt(items, 1)).toEqual(['neu']);
  });
});

describe('Vorlagen (prompts/work.ts, companion-chat@3, memory-extract@1)', () => {
  it('memoryLine: leer ohne Fakten, sonst eine Liste in der Längengrenze', () => {
    expect(memoryLine([])).toBe('');
    expect(memoryLine(undefined)).toBe('');
    const line = memoryLine(Array.from({ length: 30 }, (_, i) => `Fakt ${i} ${'w'.repeat(150)}`));
    expect(line.startsWith('What you already know about the learner')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(MEMORY_LINE_MAX);
    expect(line.split('\n- ').length - 1).toBeLessThanOrEqual(12);
  });

  it('companion-chat@3 nimmt die gemerkten Fakten in die Einleitung auf', () => {
    const vars: CompanionVars = { uiLang: 'de', learner: 'B2', work: 'Sales', seeing: null, attach: null, history: [], message: 'Hallo', memory: ['Hat am 14. Oktober eine Messe in London.'] };
    const lead = companionChat.buildTurns(vars)[0]!.content;
    expect(lead.split('\n')[0]).toBe('[companion-chat@3]');
    expect(lead).toContain('- Hat am 14. Oktober eine Messe in London.');
    const without = companionChat.buildTurns({ ...vars, memory: [] })[0]!.content;
    expect(without).not.toContain('What you already know');
  });

  it('memory-extract@1: Kopfzeile, Sprache, bekannte Fakten; Antwort mit mehr als 5 Fakten wird gekürzt', () => {
    const p = memoryExtract.build({ uiLang: 'en', transcript: 'Learner: I have a fair in London.', known: ['Works in sales.'] });
    expect(p.split('\n')[0]).toBe('[memory-extract@1]');
    expect(p).toContain('sentence in English');
    expect(p).toContain('- Works in sales.');
    const schema = memoryExtract.schema({ uiLang: 'de', transcript: '', known: [] });
    const r = schema.safeParse({ facts: ['- Eins eins', 'Zwei zwei', 'Drei drei', 'Vier vier', 'Fünf fünf', 'Sechs sechs'] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.facts).toEqual(['Eins eins', 'Zwei zwei', 'Drei drei', 'Vier vier', 'Fünf fünf']);
    expect(schema.safeParse({ facts: 'nein' }).success).toBe(false);
  });
});
