import { describe, expect, it } from 'vitest';
import { compactBiz, upsertBizItem, BIZ_DOC_MAX_BYTES } from '../../src/domain/business/bizDoc';
import { coverageCount } from '../../src/domain/business/coverage';
import { changesOf, composeMail, pickList, segmentMail, wordCount } from '../../src/domain/business/mailCompose';
import { drillQuestions, drillScore, PLAYBOOKS, walk } from '../../src/domain/business/playbook';
import type { BizItem } from '../../src/domain/business/types';
import { containsPhrase } from '../../src/domain/chunks/newChunk';
import { usSpelling } from '../../src/domain/text/lemma';
import { jsonBytes } from '../../src/domain/monthDoc';
import { validateDoc } from '../../src/data/validate';

// Business-Domäne (Plan §9.1): Baukasten-Inhalt, Refiner-Zusammensetzung, biz-Dokument.

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

describe('Phrasen-Baukasten (Inhalt)', () => {
  it('vier Bäume, alle Knoten erreichbar, keine Zyklen', () => {
    expect(PLAYBOOKS.map((p) => p.id)).toEqual(['meeting', 'decline', 'agree', 'objection']);
    for (const pb of PLAYBOOKS) {
      const reached = walk(pb);
      expect(reached.sort(), pb.id).toEqual(Object.keys(pb.nodes).sort());
    }
  });

  it('jedes Blatt hat 3–5 Wendungen, jedes Beispiel enthält die Wendung, DE/EN vollständig', () => {
    for (const pb of PLAYBOOKS) {
      expect(pb.title.de && pb.title.en && pb.purpose.de && pb.purpose.en, pb.id).toBeTruthy();
      for (const n of Object.values(pb.nodes)) {
        if (n.kind === 'question') {
          expect(n.q.de && n.q.en, n.id).toBeTruthy();
          expect(n.options.length, n.id).toBeGreaterThanOrEqual(2);
          for (const o of n.options) expect(o.label.de && o.label.en, n.id).toBeTruthy();
          continue;
        }
        expect(n.phrases.length, n.id).toBeGreaterThanOrEqual(3);
        expect(n.phrases.length, n.id).toBeLessThanOrEqual(5);
        for (const p of n.phrases) {
          expect(containsPhrase(p.ex, p.en), `${n.id}: ${p.en}`).toBe(true);
          expect(p.de && p.note.de && p.note.en, p.en).toBeTruthy();
        }
      }
    }
  });

  it('amerikanische Schreibweise in allen englischen Texten', () => {
    for (const pb of PLAYBOOKS) {
      const texts: string[] = [pb.title.en, pb.purpose.en];
      for (const n of Object.values(pb.nodes)) {
        if (n.kind === 'question') texts.push(n.q.en, ...n.options.map((o) => o.label.en));
        else for (const p of n.phrases) texts.push(p.en, p.ex, p.note.en);
      }
      for (const d of pb.drill) texts.push(d.situation.en, ...d.options, d.note.en, d.ex);
      for (const t of texts) for (const w of words(t)) expect(usSpelling(w), `${pb.id}: ${w} in "${t}"`).toBe(w);
    }
  });

  it('Drill: ≥ 6 Fragen je Baum, genau 3 Antworten, Beispiel enthält die richtige', () => {
    for (const pb of PLAYBOOKS) {
      expect(pb.drill.length, pb.id).toBeGreaterThanOrEqual(6);
      for (const d of pb.drill) {
        expect(d.options).toHaveLength(3);
        expect(containsPhrase(d.ex, d.options[d.answer] as string), `${pb.id}: ${d.ex}`).toBe(true);
      }
      const qs = drillQuestions(pb, 7);
      for (const q of qs) expect([...q.order].sort()).toEqual([0, 1, 2]);
    }
    expect(drillScore([{ chosen: 0, answer: 0 }, { chosen: 1, answer: 2 }])).toEqual({ n: 2, right: 1 });
  });
});

describe('E-Mail-Refiner: Zerlegen und Zusammensetzen', () => {
  const mail = 'Dear Mr Walker,\n\nThe scanners come later. We are sorry! The version 3.5 is fine.\n\nBest regards\nEmrah';

  it('Zerlegen erhält Zeilen und Sätze; Zusammensetzen ohne Auswahl ergibt den Text', () => {
    const segs = segmentMail(mail);
    expect(segs.map((s) => s.text)).toEqual(['Dear Mr Walker,', 'The scanners come later.', 'We are sorry!', 'The version 3.5 is fine.', 'Best regards', 'Emrah']);
    expect(composeMail(segs, [], {})).toBe(mail);
  });

  it('Auswahl ersetzt nur den gewählten Baustein; Änderungen und Wörter', () => {
    const segs = segmentMail(mail);
    const opts = [{ i: 1, options: [{ text: 'The scanners are running two weeks behind schedule.' }] }];
    const out = composeMail(segs, opts, { 1: 0 });
    expect(out).toContain('The scanners are running two weeks behind schedule. We are sorry!');
    expect(changesOf({ 1: 0, 2: -1 })).toBe(1);
    expect(pickList({ 3: 1, 1: 0, 2: -1 })).toEqual([
      [1, 0],
      [3, 1],
    ]);
    expect(wordCount(out)).toBeGreaterThan(wordCount(mail));
  });

  it('höchstens 25 Bausteine', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i + 1}.`).join(' ');
    const segs = segmentMail(long);
    expect(segs).toHaveLength(25);
    expect(composeMail(segs, [], {})).toBe(long);
  });
});

describe('biz/<Monat>', () => {
  const mailItem = (i: number, size = 10): BizItem => ({ id: `mail-${i}`, t: 1_790_000_000_000 + i, day: '2026-09-20', kind: 'mail', recipient: 'client', intent: 'inform', orig: 'o'.repeat(size), final: 'f'.repeat(size), picks: [[1, 0]], changes: 1, taken: [], lang: 'de' });

  it('fehlt → set, sonst update, idempotent über id', () => {
    const first = upsertBizItem(undefined, mailItem(1));
    expect(first).toMatchObject({ set: { v: 1, month: '2026-09' } });
    const doc = (first as { set: Record<string, unknown> }).set;
    expect(validateDoc('biz/2026-09', doc).ok).toBe(true);
    const again = upsertBizItem(doc, mailItem(1)) as { update: { items: unknown[] } };
    expect(again.update.items).toHaveLength(1);
  });

  it('Verdichtung: bleibt ≤ 200 KiB, leert zuerst die Texte der ältesten, Kennzahlen bleiben', () => {
    const items = Array.from({ length: 100 }, (_, i) => mailItem(i, 3000));
    const out = compactBiz(items, '2026-09') as Array<Record<string, unknown>>;
    expect(jsonBytes({ v: 1, month: '2026-09', items: out })).toBeLessThanOrEqual(BIZ_DOC_MAX_BYTES);
    expect(out).toHaveLength(100);
    expect(out[0]!.orig).toBe('');
    expect(out[99]!.orig).toBe('o'.repeat(3000));
    expect(out[0]!.changes).toBe(1);
  });

  it('Abdeckung der Folienpunkte als Tatsache', () => {
    expect(coverageCount(['A', 'B', 'C'], [{ point: 'a', covered: true, note: '' }, { point: 'B', covered: false, note: 'x' }])).toEqual({ covered: 1, total: 3, missing: ['B', 'C'] });
  });
});
