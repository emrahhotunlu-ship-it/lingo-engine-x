import { describe, expect, it } from 'vitest';
import { articleStock } from '../../../src/content/nb/stock';
import { inboxMails } from '../../../src/content/nb/load';
import { mailSituations } from '../../../src/domain/tutor/mail';
import { FRESH_DAYS, historyDays, lastShown, pickFresh, rotate } from '../../../src/modules/apply/domain/fresh';
import { mailGreet, situationGreet } from '../../../src/modules/apply/domain/greet';
import { mailOrder, pickMail, situationOrder, stockOrder } from '../../../src/modules/apply/domain/material';
import { countWords } from '../../../src/modules/apply/domain/kinds';
import { fromReply, outItemOf, type ApplyRun } from '../../../src/modules/apply/domain/result';
import { starterGroups, startersFor } from '../../../src/modules/apply/domain/starters';

// W5 „Anwenden-Feinschliff“ (Lehrer-Prüfung F3): K7 Anrede/Empfänger, K8 Artikel-Vorrat, K9 Starthilfe, K14 keine Wiederholung binnen 14 Tagen,
// Speicherform der neuen Felder (K1 Stil, K7, K9). Rein, ohne Oberfläche.

const DAY = '2026-09-22';
const BRITISH = /\b(organisation|digitise|digitised|realise|analyse|behaviour|favour|labour|centre|catalogue|cancelled|travelling|modelling|programme)\b/i;

describe('K14: keine Wiederholung binnen 14 Tagen', () => {
  const out = (items: unknown[]) => ({ items });
  it('liest nur die eigene Disziplin, nur Tage VOR heute, je Material den letzten Tag', () => {
    const last = lastShown(
      [
        out([
          { id: 'a', k: 'reply', d: '2026-09-10', theme: 'm01' },
          { id: 'b', k: 'reply', d: '2026-09-15', theme: 'm01' },
          { id: 'c', k: 'reply', d: DAY, theme: 'm02' },
          { id: 'd', k: 'c1mail', d: '2026-09-15', theme: 'ms01' },
          { id: 'e', k: 'reply', d: 'kaputt', theme: 'm03' },
          null,
        ]),
        out([{ id: 'f', k: 'reply', d: '2026-08-30', theme: 'm04' }, 'Unsinn']),
        { items: 'kein Feld' },
      ],
      'reply',
      DAY,
    );
    expect([...last.entries()].sort()).toEqual([
      ['m01', '2026-09-15'],
      ['m04', '2026-08-30'],
    ]);
    expect(lastShown([out([{ k: 'c1mail', d: '2026-09-15', theme: 'ms01' }])], 'write', DAY).get('ms01')).toBe('2026-09-15');
    expect(historyDays(DAY)).toEqual([DAY, '2026-09-08']);
  });

  it('erstes Material, das seit ≥ 14 Tagen nicht dran war; sonst das am längsten nicht gezeigte', () => {
    const ids = ['a', 'b', 'c'];
    const id = (x: string) => x;
    expect(pickFresh(ids, id, new Map(), DAY)).toBe('a');
    expect(pickFresh(ids, id, new Map([['a', '2026-09-20']]), DAY)).toBe('b');
    expect(pickFresh(ids, id, new Map([['a', '2026-09-08']]), DAY)).toBe('a');
    expect(pickFresh(ids, id, new Map([['a', '2026-09-09']]), DAY)).toBe('b');
    const all = new Map([
      ['a', '2026-09-20'],
      ['b', '2026-09-12'],
      ['c', '2026-09-18'],
    ]);
    expect(pickFresh(ids, id, all, DAY)).toBe('b');
    expect(pickFresh([], id, all, DAY)).toBeNull();
    expect(FRESH_DAYS).toBe(14);
    expect(rotate([1, 2, 3], 4)).toEqual([2, 3, 1]);
  });

  it('feste Reihenfolgen je Lerntag: die erste Mail ist die bisherige Mail des Tages; jede Situation genau einmal, passende zuerst', () => {
    const mails = inboxMails();
    const order = mailOrder(mails, DAY);
    expect(order).toHaveLength(mails.length);
    expect(order[0]?.id).toBe(pickMail(mails, DAY)?.id);
    expect(new Set(order.map((m) => m.id)).size).toBe(mails.length);
    const sits = situationOrder(DAY, 1, ['status update']);
    expect(sits).toHaveLength(mailSituations().length);
    expect(new Set(sits.map((s) => s.id)).size).toBe(sits.length);
    expect(sits[0]?.ch).toBe(1);
    expect(stockOrder(articleStock(), DAY)).toHaveLength(articleStock().length);
  });
});

describe('K7: Empfänger, Anrede und Gruß', () => {
  it('jede Mail bekommt ihre Anrede und ihren Gruß aus der geprüften Musterantwort', () => {
    for (const m of inboxMails()) {
      const g = mailGreet(m);
      expect(g.hello, m.id).toMatch(/^(Dear|Hi|Hello|Hey) .+,$/);
      expect(g.close, m.id).toMatch(/^[A-Z][a-z]+( [a-z]+)?,$/);
      expect(g.name).toBe(m.from);
      expect(m.reply.startsWith(g.hello), m.id).toBe(true);
    }
    const first = inboxMails()[0];
    expect(first && mailGreet(first)).toEqual({ name: 'Laura Fischer', hello: 'Hi Laura,', close: 'Best regards,' });
  });

  it('jede Situation hat einen Empfänger mit Anrede (US-Schreibweise „Ms.“/„Mr.“) und Gruß; die Anrede nennt den Namen', () => {
    for (const s of mailSituations()) {
      const g = situationGreet(s.id);
      expect(g.hello, s.id).toMatch(/^(Dear|Hi|Hello) .+,$/);
      expect(g.close, s.id).toMatch(/,$/);
      if (g.name) expect(g.hello, s.id).toContain(g.name);
      expect(`${g.hello} ${g.name}`, s.id).not.toMatch(/\b(Ms|Mr|Mrs|Dr) /);
    }
    expect(situationGreet('unbekannt').hello).toBe('Hello,');
  });
});

describe('K8: Artikel-Vorrat', () => {
  const stock = articleStock();
  it('mindestens 12 Texte, je 180–260 Wörter, 3–4 Kernpunkte, eindeutige Kennungen, Themen aus Beruf, Wirtschaft und Technik', () => {
    expect(stock.length).toBeGreaterThanOrEqual(12);
    expect(new Set(stock.map((a) => a.id)).size).toBe(stock.length);
    expect(new Set(stock.map((a) => a.topic))).toEqual(new Set(['dms', 'saas', 'work', 'tech', 'economy']));
    for (const a of stock) {
      const n = countWords(a.text);
      expect(n, a.id).toBeGreaterThanOrEqual(180);
      expect(n, a.id).toBeLessThanOrEqual(260);
      expect(a.points.length, a.id).toBeGreaterThanOrEqual(3);
      for (const p of a.points) expect(countWords(p), `${a.id}: ${p}`).toBeLessThanOrEqual(25);
    }
  });

  it('keine Zahlen, keine Zitate, keine britischen Schreibweisen (keine erfundenen Belege, US-Englisch)', () => {
    for (const a of stock) {
      const all = `${a.title}\n${a.text}\n${a.points.join('\n')}`;
      expect(all, a.id).not.toMatch(/\d/);
      expect(all, a.id).not.toMatch(/["“”]/);
      expect(all, a.id).not.toMatch(BRITISH);
    }
  });
});

describe('K9: Starthilfe', () => {
  it('drei Satzanfänge (Einstieg, Hauptteil, Schluss), fest je Material, ohne Anführungszeichen', () => {
    for (const kind of ['reply', 'write', 'summary'] as const) {
      const a = startersFor(kind, 'm01', 'status update');
      expect(a).toHaveLength(3);
      expect(startersFor(kind, 'm01', 'status update')).toEqual(a);
      a.forEach((x, k) => expect(starterGroups(kind, 'status update')[k]).toContain(x));
    }
    for (const sit of ['status update', 'client email', 'negotiation', 'escalation', 'unbekannt'])
      for (const g of starterGroups('write', sit)) for (const x of g) expect(x).not.toMatch(/["“”]/);
    expect(starterGroups('write', 'Negotiation')).toBe(starterGroups('write', 'negotiation'));
  });
});

describe('Speicherform der W5-Felder (out/<Monat>, tolerant: `fb` ist frei)', () => {
  it('Stil-Verbesserungen kompakt, Anrede-Urteil, Starthilfe vermerkt', () => {
    const fb = fromReply({
      points: [{ i: 1, covered: 'yes', quote: 'Hi Laura', why: '' }],
      edits: [],
      used: [],
      tone: { fit: 'fits', why: '' },
      good: null,
      style: [{ from: 'very busy', to: 'stretched thin', why: 'Natürlicher.' }],
      greet: { fit: 'off', why: 'Zu locker.' },
      upgraded: 'Hi Laura, I understand your team is stretched thin.',
      summary: 'Gut.',
      errorCount: 0,
    });
    const run: ApplyRun = { kind: 'reply', id: 'reply-1', check: 1, day: DAY, now: 1, text: 'Hi Laura, your team is very busy.', pasted: false, material: 'm01', ctx: 'x', feedback: fb, length: 'ok', copy: null, peeked: false, words: [], offered: [], helped: true };
    expect(outItemOf(run).fb).toMatchObject({ st: [['very busy', 'stretched thin']], gr: 'off', help: 1 });
    const plain = outItemOf({ ...run, helped: false, feedback: { ...fb, style: [], greet: null } }).fb as Record<string, unknown>;
    expect(['st', 'gr', 'help'].filter((k) => k in plain)).toEqual([]);
  });
});
