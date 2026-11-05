import { describe, expect, it } from 'vitest';
import { articleStock } from '../../../src/content/nb/stock';
import { inboxMails } from '../../../src/content/nb/load';
import { mailSituations, seenPatterns, seenPhrases } from '../../../src/domain/tutor/mail';
import { FRESH_DAYS, historyDays, lastShown, pickFresh, rotate } from '../../../src/modules/apply/domain/fresh';
import { greetTone, mailGreet, situationGreet } from '../../../src/modules/apply/domain/greet';
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
    expect(first && mailGreet(first)).toEqual({ name: 'Laura Fischer', hello: 'Hi Laura,', close: 'Best regards,', ext: true });
    const intern = inboxMails().find((m) => m.id === 'm10');
    expect(intern && mailGreet(intern).ext).toBe(false);
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

  it('Ton der Anrede: „Dear …“ förmlich, mit Titel oder an alle höflich, per Vorname locker; ms12 an den Kunden, Direktorin in Kopie', () => {
    expect(greetTone('Dear Ms. Becker,')).toBe('formal');
    expect(greetTone('Hello Ms. Roth,')).toBe('polite');
    expect(greetTone('Hi Mr. Brandt,')).toBe('polite');
    expect(greetTone('Hello everyone,')).toBe('polite');
    expect(greetTone('Hi Tom,')).toBe('informal');
    expect(greetTone('Hey Mark,')).toBe('informal');
    expect(situationGreet('ms12')).toMatchObject({ name: 'Ms. Becker', ext: true });
    expect(situationGreet('ms12').reader).toMatch(/client, Ms\. Becker.*director.*cc/);
    expect(situationGreet('ms06').ext).toBe(false);
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
  const sits = mailSituations();
  const hits = (x: string, s: (typeof sits)[number]): string[] => [
    ...seenPatterns(x, s).filter((p) => p.ok).map((p) => p.id),
    ...seenPhrases(x, s).filter((p) => p.ok).map((p) => p.id),
    ...s.phrases.filter((p) => x.toLowerCase().includes(p.toLowerCase())),
  ];
  const general = (): string[] => [...starterGroups('reply'), ...starterGroups('summary'), ...starterGroups('write', 'unbekannt')].flat();

  it('drei Satzanfänge (Einstieg, Hauptteil, Schluss), fest je Material, ohne Anführungszeichen, alle mit „…“', () => {
    for (const [kind, id] of [['reply', 'm01'], ['write', 'ms01'], ['write', 'unbekannt'], ['summary', 'av01']] as const) {
      const a = startersFor(kind, id);
      expect(a).toHaveLength(3);
      expect(startersFor(kind, id)).toEqual(a);
      a.forEach((x, k) => expect(starterGroups(kind, id)[k]).toContain(x));
      for (const g of starterGroups(kind, id))
        for (const x of g) {
          expect(x).not.toMatch(/["“”]/);
          expect(x).toContain('…');
        }
    }
  });

  it('Mail schreiben: jede Situation ms01–ms12 hat ihre eigenen drei Anfänge', () => {
    expect(sits).toHaveLength(12);
    const seen = new Set<string>();
    for (const s of sits) {
      const a = startersFor('write', s.id);
      expect(a, s.id).toHaveLength(3);
      expect(a, s.id).not.toEqual(startersFor('write', 'unbekannt'));
      for (const x of a) {
        expect(seen.has(x), `${s.id}: ${x}`).toBe(false);
        seen.add(x);
      }
    }
  });

  it('kein Anfang enthält ein Zielmuster oder eine vorgegebene Wendung seiner Situation (Erkennungsmuster des Moduls)', () => {
    for (const s of sits) for (const x of startersFor('write', s.id)) expect(hits(x, s), `${s.id}: ${x}`).toEqual([]);
  });

  it('die allgemeinen Anfänge (Antworten, Zusammenfassen, unbekannte Situation) enthalten kein Muster und keine Wendung irgendeiner Situation', () => {
    for (const x of general()) for (const s of sits) expect(hits(x, s), `${s.id}: ${x}`).toEqual([]);
  });

  it('Lehrer-Prüfung W5b: keine bekannten Vorwegnahmen', () => {
    const all = [...sits.flatMap((s) => startersFor('write', s.id)), ...general()].join('\n');
    for (const bad of [/so far, we have/i, /if you were open to/i, /look forward to/i, /recommend that/i, /walk you through/i, /as soon as we heard/i]) expect(all).not.toMatch(bad);
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
