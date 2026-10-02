import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containsPhrase } from '../../src/domain/chunks/newChunk';
import { PACK, PACK_CATS, PACK_MIX, PACK_PER_DAY, PACK_RAW_COUNT, PACK_REF, PACK_STOCK, nextPackEntries, packDoc, packEntry, packOp, packState, type PackCat, type PackEntry, type PackState } from '../../src/domain/c1pack/pack';
import { slug } from '../../src/domain/content';
import { buildChunkCards } from '../../src/domain/srs/chunkCards';
import { toTrainCard } from '../../src/domain/srs/cards';
import { locate } from '../../src/domain/srs/context';
import { isWrongLang } from '../../src/domain/lang/detect';
import { INBOX_TIERS, inboxTier, newCards } from '../../src/domain/srs/queue';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// C1-Paket (Emrah 02.10.2026): geprüfter Inhalt, Auswahl nach Soll-Mix, Dokumente, Reihenfolge im Korb.

const NOW = berlin('2026-10-05', 9);
const TODAY = '2026-10-05';
const raw = JSON.parse(readFileSync('src/content/c1/pack.json', 'utf8')) as { items: Array<Record<string, unknown>> };
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const CHUNK: ReadonlySet<PackCat> = new Set(['colloc', 'frame', 'phrasal', 'idiom']);
const share = (c: PackCat) => PACK.filter((e) => e.cat === c).length / PACK.length;

describe('Inhalt des C1-Pakets', () => {
  it('kein Eintrag fällt beim Lesen weg, mindestens 100 Einträge', () => {
    expect(PACK_RAW_COUNT).toBe(raw.items.length);
    expect(PACK.length).toBe(raw.items.length);
    expect(PACK.length).toBeGreaterThanOrEqual(100);
  });

  it('Anteile je Kategorie liegen nahe am Soll-Mix des Englischlehrers (± 6 Prozentpunkte, seit 250 Einträgen)', () => {
    expect(Object.values(PACK_MIX).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    for (const c of PACK_CATS) expect(Math.abs(share(c) - PACK_MIX[c]), c).toBeLessThanOrEqual(0.06);
  });

  it('Kennungen eindeutig, englische Texte eindeutig (Groß/klein egal), Kennungen der Karten (Pfade) eindeutig', () => {
    expect(new Set(PACK.map((e) => e.id)).size).toBe(PACK.length);
    expect(new Set(PACK.map((e) => e.en.toLowerCase())).size).toBe(PACK.length);
    const paths = PACK.map((e) => packDoc(e, TODAY, NOW)?.path);
    expect(paths.every((p) => typeof p === 'string')).toBe(true);
    expect(new Set(paths).size).toBe(PACK.length);
  });

  it('jeder Eintrag: Beispielsatz enthält die Wendung bzw. das Wort, 8–20 Wörter, mit Satzende, Wendung ≤ 8 Wörter', () => {
    for (const e of PACK) {
      expect(containsPhrase(e.ex, e.en) || !!locate(e.ex, e.en), `${e.id}: ${e.en} → ${e.ex}`).toBe(true);
      expect(words(e.ex).length, e.ex).toBeGreaterThanOrEqual(8);
      expect(words(e.ex).length, e.ex).toBeLessThanOrEqual(20);
      expect(e.ex, e.ex).toMatch(/[.?!]$/);
      expect(words(e.en).length, e.en).toBeLessThanOrEqual(8);
    }
  });

  it('Sprache: Deutsch in de und why, Englisch in def und ex; keine geraden Anführungszeichen, keine eckigen Klammern', () => {
    for (const e of PACK) {
      expect(isWrongLang(e.def, 'en', 3), e.def).toBe(false);
      expect(isWrongLang(e.ex, 'en'), e.ex).toBe(false);
      if (e.why) expect(isWrongLang(e.why, 'de'), e.why).toBe(false);
      for (const t of [e.en, e.de, e.def, e.ex, e.why ?? '']) {
        expect(t, e.id).not.toContain('"');
        expect(t, e.id).not.toMatch(/[[\]]/);
      }
      expect(e.de.trim().length, e.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('US-Schreibweise: keine britischen Formen', () => {
    const all = PACK.flatMap((e) => [e.en, e.def, e.ex]).join(' ');
    expect(all).not.toMatch(/\b(colour|organis|realis|programme|centre|licence|cheque|whilst|learnt|favour|behaviour|honour)\w*/i);
    expect(PACK.find((e) => e.en === 'honor a commitment')).toBeTruthy();
  });

  it('Wendungen (Wortpartner, Rahmen, Phrasal Verbs, Idiome) haben eine deutsche Anmerkung, Wörter und Fachbegriffe eine Wortart', () => {
    for (const e of PACK) {
      if (CHUNK.has(e.cat)) expect(e.why && e.why.length > 20, `${e.id} hat keine Anmerkung`).toBe(true);
      else expect(e.pos, e.id).toMatch(/^(noun|verb|adjective|adverb)$/);
    }
  });

  it('packEntry findet Einträge über die Kennung', () => {
    expect(packEntry(PACK[0]!.id)).toBe(PACK[0]);
    expect(packEntry('nope-00')).toBeUndefined();
  });
});

describe('Dokumente', () => {
  it('Wendungen werden Wendungskarten (src.kind pack, Herkunft c1pack/<id>), Wörter Vokabelkarten (src pack, Stufe C1)', () => {
    const c = PACK.find((e) => e.cat === 'colloc') as PackEntry;
    const w = PACK.find((e) => e.cat === 'word') as PackEntry;
    const cd = packDoc(c, TODAY, NOW)!;
    expect(cd.kind).toBe('chunk');
    expect(cd.path).toBe(`chunk/c-${slug(c.en)}`);
    expect(cd.doc).toMatchObject({ en: c.en, de: c.de, state: 'new', level: 'C1', whyLang: 'de', kind: 'collocation', src: { kind: 'pack', ref: `${PACK_REF}${c.id}`, upgraded: c.ex, utterance: '' } });
    const wd = packDoc(w, TODAY, NOW)!;
    expect(wd.kind).toBe('vocab');
    expect(wd.path).toBe(`vocab/${slug(w.en)}`);
    expect(wd.doc).toMatchObject({ de: w.de, state: 'new', level: 'C1', src: 'pack', added: TODAY, origin: { kind: 'pack', ref: `${PACK_REF}${w.id}` } });
    expect(String(wd.doc.ex)).toMatch(/\[[^\]]+\]/);
  });

  it('jeder Eintrag ergibt eine gültige, abfragbare Karte (Satz mit Lücke, Bedeutung)', () => {
    for (const e of PACK) {
      const made = packDoc(e, TODAY, NOW)!;
      const card = (made.kind === 'chunk' ? buildChunkCards(new Map([[made.id, made.doc]]), NOW)[0] : toTrainCard(made.id, made.doc, true, NOW)) as TrainCard | undefined;
      expect(card, e.id).toBeTruthy();
      expect(card?.isNew, e.id).toBe(true);
      expect(card?.context, `${e.id} ohne Lücke im Satz`).toBeTruthy();
      expect(card?.de, e.id).toBeTruthy();
      expect(card?.src, e.id).toBe('pack');
    }
  });

  it('Schreibvorgang: nur anlegen; gibt es das Dokument schon, passiert nichts mit Wendungen und nichts Zerstörendes mit Wörtern', () => {
    const c = packDoc(PACK.find((e) => e.cat === 'frame') as PackEntry, TODAY, NOW)!;
    expect(packOp(undefined, c)).toEqual({ set: c.doc });
    expect(packOp({ en: 'x' }, c)).toBeNull();
    const w = packDoc(PACK.find((e) => e.cat === 'tech') as PackEntry, TODAY, NOW)!;
    expect(packOp(undefined, w)).toEqual({ set: w.doc });
    expect(packOp({ word: 'x', ex: 'We have a [x] here.', hidden: true }, w)).toBeNull();
    expect(packOp({ word: 'x', ex: 'We have a [x] here.' }, w)).toBeNull();
  });
});

describe('Auswahl nach Soll-Mix', () => {
  const empty = (over: Partial<PackState> = {}): PackState => ({ have: new Set(), mine: { colloc: 0, frame: 0, phrasal: 0, word: 0, tech: 0, family: 0, idiom: 0 }, unused: 0, addedToday: 0, ...over });

  it('höchstens zwei am Tag; bei Kontingent 0 keine', () => {
    expect(nextPackEntries(empty(), 5)).toHaveLength(PACK_PER_DAY);
    expect(nextPackEntries(empty(), 0)).toEqual([]);
    expect(nextPackEntries(empty({ addedToday: 2 }), 5)).toEqual([]);
    expect(nextPackEntries(empty({ addedToday: 1 }), 5)).toHaveLength(1);
  });

  it('Vorrat: ab 6 ungenutzten Karten im Korb kommt nichts, bei 5 genau eine', () => {
    expect(nextPackEntries(empty({ unused: PACK_STOCK }), 5)).toEqual([]);
    expect(nextPackEntries(empty({ unused: PACK_STOCK - 1 }), 5)).toHaveLength(1);
  });

  it('schon vorhandene Einträge (auch eigene Karten mit gleicher Kennung) werden übersprungen', () => {
    const first = nextPackEntries(empty(), 5);
    const again = nextPackEntries(empty({ have: new Set(first.map((e) => e.id)) }), 5);
    expect(again.every((e) => !first.some((f) => f.id === e.id))).toBe(true);
  });

  it('über viele Tage nähert sich der Anteil je Kategorie dem Soll-Mix, jeder Eintrag genau einmal', () => {
    const have = new Set<string>();
    const mine: Record<PackCat, number> = { colloc: 0, frame: 0, phrasal: 0, word: 0, tech: 0, family: 0, idiom: 0 };
    const picked: PackEntry[] = [];
    for (let day = 0; day < 130; day++) {
      const next = nextPackEntries({ have, mine, unused: 0, addedToday: 0 }, 5);
      for (const e of next) {
        have.add(e.id);
        mine[e.cat]++;
        picked.push(e);
      }
      if (day === 24) {
        // nach 50 Einträgen: je Kategorie höchstens ein Eintrag Abweichung vom Soll
        for (const c of PACK_CATS) expect(Math.abs(mine[c] - PACK_MIX[c] * 50), `Tag 25 ${c}`).toBeLessThanOrEqual(1.5);
      }
    }
    expect(picked).toHaveLength(PACK.length);
    expect(new Set(picked.map((e) => e.id)).size).toBe(PACK.length);
  });

  it('ist eine Kategorie leer, geht es mit den anderen weiter', () => {
    const only = PACK.filter((e) => e.cat === 'idiom');
    const out = nextPackEntries(empty(), 5, only);
    expect(out.map((e) => e.cat)).toEqual(['idiom', 'idiom']);
    expect(nextPackEntries(empty(), 5, [])).toEqual([]);
  });
});

describe('Zustand aus der Datenbank', () => {
  it('zählt Paket-Karten je Kategorie, ungenutzte und heutige; eigene Karte mit gleicher Kennung gilt als vorhanden, nicht als Paket', () => {
    const c = PACK.find((e) => e.cat === 'colloc') as PackEntry;
    const w = PACK.find((e) => e.cat === 'word') as PackEntry;
    const t = PACK.find((e) => e.cat === 'tech') as PackEntry;
    const cd = packDoc(c, TODAY, NOW)!;
    const wd = packDoc(w, TODAY, NOW)!;
    const td = packDoc(t, TODAY, NOW)!;
    const vocab = new Map<string, Record<string, unknown>>([
      [wd.id, { ...wd.doc, added: '2026-10-01' }], // Paket-Karte, nicht heute
      [td.id, { word: 'eigene Karte', ex: 'x', state: 'review', added: '2026-08-01' }], // gleiche Kennung, aber eigene Karte
    ]);
    const chunks = new Map<string, Record<string, unknown>>([[cd.id, cd.doc]]);
    const st = packState(vocab, chunks, TODAY, NOW);
    expect([...st.have].sort()).toEqual([c.id, t.id, w.id].sort());
    expect(st.mine.colloc).toBe(1);
    expect(st.mine.word).toBe(1);
    expect(st.mine.tech).toBe(0);
    expect(st.unused).toBe(2);
    expect(st.addedToday).toBe(1); // nur die Wendungskarte von heute (created)
  });

  it('ausgeblendete Paket-Karten zählen nicht als ungenutzt', () => {
    const w = PACK.find((e) => e.cat === 'word') as PackEntry;
    const wd = packDoc(w, TODAY, NOW)!;
    expect(packState(new Map([[wd.id, { ...wd.doc, hidden: true }]]), new Map(), TODAY, NOW).unused).toBe(0);
  });

  it('nachts zwischen 2 und 4 Uhr angelegte Wendung gehört zum Lerntag davor (Tageswechsel 04:00, nicht UTC)', () => {
    const c = PACK.find((e) => e.cat === 'colloc') as PackEntry;
    const night = berlin('2026-10-06', 2, 30); // Kalendertag 06.10., Lerntag 05.10.
    const cd = packDoc(c, TODAY, night)!;
    const chunks = new Map<string, Record<string, unknown>>([[cd.id, cd.doc]]);
    expect(packState(new Map(), chunks, '2026-10-05', night).addedToday).toBe(1);
    expect(packState(new Map(), chunks, '2026-10-06', berlin('2026-10-06', 9)).addedToday).toBe(0);
  });
});

describe('Reihenfolge im Eingangskorb', () => {
  it('Paket nach eigenen Funden, vor Lektion und Vorschlägen; Tagesauftrag-Wörter dahinter', () => {
    expect(INBOX_TIERS.findIndex((t) => t.includes('pack'))).toBeGreaterThan(INBOX_TIERS.findIndex((t) => t.includes('lookup')));
    expect(INBOX_TIERS.findIndex((t) => t.includes('pack'))).toBeLessThan(INBOX_TIERS.findIndex((t) => t.includes('ai')));
    expect(inboxTier('lookup')).toBeLessThan(inboxTier('pack'));
    expect(inboxTier('pack')).toBeLessThan(inboxTier('ai'));
    expect(inboxTier('pack')).toBeLessThan(inboxTier('daily'));
    const mk = (id: string, src: string, added: string): TrainCard => toTrainCard(id, { word: id, de: 'x', ex: `The [${id}] matters.`, state: 'new', src, added, order: 900 }, true, NOW) as TrainCard;
    const cards = [mk('ai1', 'ai', '2026-09-01'), mk('pk1', 'pack', '2026-10-04'), mk('lk1', 'lookup', '2026-10-05'), mk('ls1', 'lesson', '2026-09-02')];
    expect(newCards(cards).map((c) => c.id)).toEqual(['lk1', 'pk1', 'ai1', 'ls1']);
  });
});
