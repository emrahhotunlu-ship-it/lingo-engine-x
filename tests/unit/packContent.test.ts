import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PACK } from '../../src/domain/c1pack/pack';
import { PackExtraSchema, packExtraOf, packExtras } from '../../src/domain/c1pack/packFields';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Lernplattform 2.0, P3: Zusatzfelder des C1-Pakets. Gültigkeit, Abdeckung, nichts Vorhandenes verändert.

type Row = Record<string, unknown> & { id: string; cat: string; en: string };
const rows = (JSON.parse(readFileSync('src/content/c1/pack.json', 'utf8')) as { items: Row[] }).items;
const base = JSON.parse(readFileSync('tests/fixtures/lp2-p3-base.json', 'utf8')) as { pack: Record<string, { all: string; nowhy: string }> };
const h = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);
// Vier sachlich falsche Begründungen (Betonung, Schreibung, on the other hand, to put it differently) wurden bewusst berichtigt.
const CORRECTED_WHY = new Set(['frame-02', 'frame-18', 'family-14', 'family-18']);
const toks = (s: string) => (s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []) as string[];

describe('C1-Paket: Zusatzfelder', () => {
  it('alle 443 Einträge haben gültige Zusatzfelder (nichts fällt weg)', () => {
    expect(rows.length).toBe(PACK.length);
    expect(packExtras().length).toBe(rows.length);
    for (const r of rows) {
      const { id: _i, cat: _c, en: _e, de: _d, def: _f, ex: _x, register: _r, why: _w, pos: _p, ...rest } = r;
      void [_i, _c, _e, _d, _f, _x, _r, _w, _p];
      expect(PackExtraSchema.safeParse(rest).success, r.id).toBe(true);
      expect(Object.keys(rest).filter((k) => !['col', 'gap', 'trap', 'fam', 'alt', 'scene', 'starts'].includes(k)), r.id).toEqual([]);
    }
  });

  it('mindestens 95 % haben Register und mindestens zwei Wortpartner; Kollokationen und Phrasal Verbs haben gap', () => {
    const withReg = rows.filter((r) => ['formal', 'neutral', 'informal'].includes(String(r.register))).length;
    const withCol = rows.filter((r) => Array.isArray(r.col) && (r.col as unknown[]).length >= 2).length;
    expect(withReg / rows.length).toBeGreaterThanOrEqual(0.95);
    expect(withCol / rows.length).toBeGreaterThanOrEqual(0.95);
    for (const r of rows.filter((x) => x.cat === 'colloc' || x.cat === 'phrasal')) expect(r.gap, r.id).toBeTruthy();
  });

  it('gap: das Partnerwort steht in der Wendung, die Fehlwahl nicht', () => {
    for (const r of rows) {
      const g = r.gap as { at: string; wrong: string[] } | undefined;
      if (!g) continue;
      const t = toks(r.en);
      expect(t, `${r.id} at`).toContain(g.at.toLowerCase());
      for (const w of g.wrong) expect(t, `${r.id} wrong ${w}`).not.toContain(w.toLowerCase());
    }
  });

  it('Situationssatz verrät die Wendung nicht, Satzanfänge verraten das Zielwort nicht', () => {
    const stem = (t: string) => (t.length >= 6 ? t.slice(0, 5) : t);
    for (const r of rows) {
      const keys = toks(r.en).filter((t) => t.length >= 4).map(stem);
      const sc = r.scene as { de: string; en: string } | undefined;
      if (sc) expect(sc.en.toLowerCase(), r.id).not.toContain(r.en.toLowerCase());
      for (const s of (r.starts as string[] | undefined) ?? []) {
        const st = new Set(toks(s).map(stem));
        expect(keys.some((k) => st.has(k)), `${r.id}: ${s}`).toBe(false);
      }
    }
    for (const cat of ['colloc', 'frame', 'phrasal', 'idiom']) for (const r of rows.filter((x) => x.cat === cat)) expect(r.scene, r.id).toBeTruthy();
    for (const cat of ['word', 'tech', 'family']) for (const r of rows.filter((x) => x.cat === cat)) expect((r.starts as unknown[] | undefined)?.length, r.id).toBe(2);
  });

  it('Sprache und Zeichen: keine geraden Anführungszeichen, keine eckigen Klammern, US-Schreibweise', () => {
    const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
    for (const r of rows) for (const t of strings([r.col, r.gap, r.fam, r.alt, r.scene, r.starts])) expect(/["[\]]/.test(t), `${r.id}: ${t}`).toBe(false);
    const english = rows.flatMap((r) => [...((r.col as { en: string; ex?: string }[] | undefined) ?? []).flatMap((c) => [c.en, c.ex ?? '']), ...((r.alt as string[] | undefined) ?? []), (r.scene as { en: string } | undefined)?.en ?? '', ...((r.starts as string[] | undefined) ?? [])]).join(' ');
    expect(english).not.toMatch(/\b(colour|(?:organis|realis)(?:e|ed|es|ing|ation)\b|programmes?\b|centre|licence|cheque|whilst|learnt|favour|behaviour|honour|analys(?:e|ed|es|ing)\b|catalogue)\w*/i);
  });

  it('Kein vorhandenes Feld wurde geändert oder entfernt (außer die vier berichtigten Begründungen)', () => {
    expect(Object.keys(base.pack).length).toBe(rows.length);
    for (const r of rows) {
      const b = base.pack[r.id] as { all: string; nowhy: string };
      expect(b, r.id).toBeTruthy();
      const now = h([r.cat, r.en, r.de, r.def, r.ex, r.register, r.why ?? null, r.pos ?? null]);
      if (CORRECTED_WHY.has(r.id)) expect(h([r.cat, r.en, r.de, r.def, r.ex, r.register, r.pos ?? null]), r.id).toBe(b.nowhy);
      else expect(now, r.id).toBe(b.all);
    }
  });

  it('trap verweist auf eine vorhandene Falle', async () => {
    const { trapById } = await import('../../src/content/nb/traps');
    const hit = rows.filter((r) => r.trap);
    expect(hit.length).toBeGreaterThan(0);
    for (const r of hit) expect(trapById(r.trap), r.id).toBeTruthy();
  });
});

describe('packExtraOf (Überlagerung beim Lesen)', () => {
  const NOW = berlin('2026-10-05', 9);
  it('findet Einträge über Kennung und englischen Text', () => {
    expect(packExtraOf('colloc-01')?.col?.length).toBeGreaterThanOrEqual(2);
    expect(packExtraOf('address concerns')?.id).toBe('colloc-01');
    expect(packExtraOf('gibt es nicht')).toBeNull();
  });
  it('Karte ohne register bekommt den Wert aus dem Paket', () => {
    const card = toTrainCard('address-concerns', { word: 'address concerns', de: 'x', ex: 'We address concerns.', state: 'new', added: '2026-10-05', order: 1 }, true, NOW) as TrainCard;
    expect(packExtraOf(card)?.register).toBe('neutral');
    expect(card.doc.register).toBeUndefined();
  });
  it('vorhandene Kartenfelder gewinnen und werden nicht verändert', () => {
    const doc = { word: 'address concerns', de: 'x', ex: 'We address concerns.', state: 'new', added: '2026-10-05', order: 1, register: 'formal', why: 'eigene Notiz', origin: { v: 1, kind: 'pack', ref: 'c1pack/colloc-01', title: 'C1-Paket', t: NOW } };
    const card = toTrainCard('address-concerns', doc, true, NOW) as TrainCard;
    const before = JSON.stringify(card.doc);
    const x = packExtraOf(card);
    expect(x?.register).toBe('formal');
    expect(x?.why).toBe('eigene Notiz');
    expect(JSON.stringify(card.doc)).toBe(before);
  });
});
