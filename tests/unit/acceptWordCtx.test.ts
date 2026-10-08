import { describe, expect, it, vi } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise, contrastOf } from '../../src/domain/srs/exercise';
import { rotatedContext, WX_FROM_STAGE, WX_ROTATE_MAX, wxContexts } from '../../src/domain/srs/rotate';
import { explainWord } from '../../src/domain/srs/explainWord';
import type { TrainCard } from '../../src/domain/srs/types';
import { sentKey } from '../../src/domain/srs/variety';
import { acceptWordCtx, CFX_MAX, cfxPatch, isWeak, knownKeys, markBad, needsWordCtx, readWx, wordRepeats, WX_MAX, wxPatch, type WordCtxWord } from '../../src/domain/tutor/acceptWordCtx';
import { confusionOf, contrastReady, noteConfusion, resetWordCtx } from '../../src/features/vocab/wordCtx';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { WORD_CTX_EXAMPLE, wordCtx, type WordCtxVarsWord } from '../../src/prompts/wordCtx';
import { TEMPLATES } from '../../src/prompts/registry';
import { wordCtxReply } from '../../src/platform/dev/canned/lp3/p52';
import { berlin } from './helpers';

vi.mock('../../src/domain/srs/crossLink', () => ({ crossSentences: () => [] }));

// Lernplattform 3.0 P52 (Wörter-Tutor, word-ctx@1): formale Prüfung, ergänzendes Speichern, Satzwechsel ab Stufe 2 und Kontrast-Regel.

const NOW = berlin('2026-10-02', 9);
const DAY = 86_400_000;
const PV = 'word-ctx@1';
type Doc = Record<string, unknown>;

const WORD: WordCtxWord = {
  id: 'leverage',
  en: 'leverage',
  pos: 'noun',
  de: 'Hebelwirkung',
  ex: 'We use leverage in every price talk.',
  other: null,
};
const WITH_OTHER: WordCtxWord = {
  ...WORD,
  other: { en: 'influence', de: 'Einfluss' },
};
const S1 = {
  en: 'During the supplier talks, Tom used our leverage to get better payment terms.',
  de: 'In den Lieferantengesprächen hat Tom unsere Hebelwirkung für bessere Zahlungsbedingungen genutzt.',
  sit: 'supplier talks',
};
const S2 = {
  en: 'Our leverage in this negotiation is smaller than the sales team expected.',
  de: 'Unsere Hebelwirkung in dieser Verhandlung ist kleiner, als das Vertriebsteam erwartet hat.',
  sit: 'negotiation',
};
const CONTRAST = {
  en: 'Her influence on the final budget decision was clear to everyone in the room.',
  why: {
    de: 'influence ist allgemeiner Einfluss, leverage ist ein Druckmittel in Verhandlungen.',
    en: 'Influence is general sway; leverage is a bargaining advantage you can use.',
  },
};

const doc = (over: Doc = {}): Doc => ({
  id: 'leverage',
  word: 'leverage',
  pos: 'noun',
  de: 'Hebelwirkung',
  def: 'the power to influence a result',
  ex: 'We use [leverage] in every price talk.',
  col: [],
  level: 'C1',
  state: 'review',
  S: 10,
  D: 5,
  last: NOW - 10 * DAY,
  due: NOW - 1000,
  reps: 0,
  lapses: 0,
  modes: {},
  order: 900,
  src: 'ai',
  added: '2026-08-01',
  stage: 2,
  hist: [],
  intro: '2026-08-01',
  ...over,
});
const card = (over: Doc = {}): TrainCard => toTrainCard('leverage', doc(over), true, NOW) as TrainCard;
const other = (stage: number): TrainCard =>
  toTrainCard(
    'influence',
    {
      ...doc(),
      id: 'influence',
      word: 'influence',
      de: 'Einfluss',
      def: 'the power to affect',
      ex: 'She has [influence] in the team.',
      stage,
    },
    true,
    NOW,
  ) as TrainCard;

describe('acceptWordCtx: formale Prüfung', () => {
  it('nimmt zwei gute Sätze an (mit Zeit und Prompt-Version)', () => {
    const r = acceptWordCtx({ id: 'leverage', sents: [S1, S2], contrast: null }, WORD, new Set(), NOW, PV);
    expect(r.rejected).toEqual([]);
    expect(r.wx).toEqual([
      { ...S1, t: NOW, pv: PV },
      { ...S2, t: NOW, pv: PV },
    ]);
    expect(r.cfx).toBeNull();
  });

  it('Wort fehlt → abgelehnt', () => {
    const r = acceptWordCtx(
      {
        id: 'leverage',
        sents: [
          {
            ...S1,
            en: 'During the supplier talks, Tom asked for much better payment terms.',
          },
        ],
      },
      WORD,
      new Set(),
      NOW,
      PV,
    );
    expect(r.wx).toEqual([]);
    expect(r.rejected).toEqual(['missing_word']);
  });

  it('britische Schreibweise → abgelehnt', () => {
    const r = acceptWordCtx(
      {
        id: 'leverage',
        sents: [
          {
            ...S1,
            en: 'We used our leverage to change the colour of the whole product line.',
          },
        ],
      },
      WORD,
      new Set(),
      NOW,
      PV,
    );
    expect(r.wx).toEqual([]);
    expect(r.rejected).toEqual(['british']);
  });

  it('Dublette → abgelehnt (bekannter Satz und doppelt in derselben Antwort)', () => {
    const known = knownKeys(doc({ wx: [{ ...S1, t: NOW - DAY, pv: PV }] }), WORD.ex);
    const r = acceptWordCtx({ id: 'leverage', sents: [S1, S2] }, WORD, known, NOW, PV);
    expect(r.wx.map((x) => x.en)).toEqual([S2.en]);
    expect(r.rejected).toEqual(['duplicate']);
    const twice = acceptWordCtx(
      {
        id: 'leverage',
        sents: [S2, { ...S2, en: S2.en.toUpperCase().replace('.', '') + '.' }],
      },
      WORD,
      new Set(),
      NOW,
      PV,
    );
    expect(twice.wx).toHaveLength(1);
    expect(twice.rejected).toEqual(['duplicate']);
  });

  it('Kontrast mit dem Zielwort → abgelehnt; ohne das andere Wort → abgelehnt; gültig → übernommen', () => {
    const target = acceptWordCtx(
      {
        id: 'leverage',
        sents: [S1],
        contrast: {
          ...CONTRAST,
          en: 'Her influence gave us more leverage in the final budget decision.',
        },
      },
      WITH_OTHER,
      new Set(),
      NOW,
      PV,
    );
    expect(target.cfx).toBeNull();
    expect(target.rejected).toEqual(['contrast_target']);
    const missing = acceptWordCtx(
      {
        id: 'leverage',
        sents: [S1],
        contrast: {
          ...CONTRAST,
          en: 'The final budget decision was clear to everyone in the room today.',
        },
      },
      WITH_OTHER,
      new Set(),
      NOW,
      PV,
    );
    expect(missing.rejected).toEqual(['contrast_other']);
    const ok = acceptWordCtx({ id: 'leverage', sents: [S1], contrast: CONTRAST }, WITH_OTHER, new Set(), NOW, PV);
    expect(ok.cfx).toEqual({
      w: 'influence',
      en: CONTRAST.en,
      why: CONTRAST.why,
      t: NOW,
      pv: PV,
    });
  });

  it('Kontrast ohne `other` (eine Karte unter Stufe 2) wird nie übernommen', () => {
    const r = acceptWordCtx({ id: 'leverage', sents: [S1], contrast: CONTRAST }, WORD, new Set(), NOW, PV);
    expect(r.cfx).toBeNull();
  });

  it('lückentauglich: das Wort (auch gebeugt) zweimal im Satz → abgelehnt (repeat)', () => {
    const twice = { ...S1, en: 'Our leverage is small, so Tom wants to leverage the new contract next week.' };
    const r = acceptWordCtx({ id: 'leverage', sents: [twice, S2] }, WORD, new Set(), NOW, PV);
    expect(r.rejected).toEqual(['repeat']);
    expect(r.wx.map((x) => x.en)).toEqual([S2.en]);
    expect(wordRepeats('He convinced me, and later he convinces the whole board as well.', 'convince')).toBe(true);
    expect(wordRepeats('He convinced the whole board to approve a smaller pilot project.', 'convince')).toBe(false);
    expect(wordRepeats(S1.en, 'leverage')).toBe(false);
  });

  it('weitere Fehler: falsche id, Länge, deutsche Übersetzung auf Englisch', () => {
    expect(acceptWordCtx({ id: 'other', sents: [S1] }, WORD, new Set(), NOW, PV).rejected).toEqual(['id']);
    expect(acceptWordCtx({ sents: [{ ...S1, en: 'Use leverage now.' }] }, WORD, new Set(), NOW, PV).rejected).toEqual(['length']);
    expect(
      acceptWordCtx(
        {
          sents: [
            {
              ...S1,
              de: 'During the talks Tom used our leverage for better terms.',
            },
          ],
        },
        WORD,
        new Set(),
        NOW,
        PV,
      ).rejected,
    ).toEqual(['de_lang']);
    expect(acceptWordCtx('nope', WORD, new Set(), NOW, PV).rejected).toEqual(['shape']);
  });
});

describe('schwache Wörter und Bedarf', () => {
  it('schwach: ≥ 2 Rückfälle oder ≥ 2 Fehler in 14 Tagen', () => {
    expect(isWeak(doc({ lapses: 2 }), NOW)).toBe(true);
    expect(isWeak(doc({ fsrs: { lapses: 3 } }), NOW)).toBe(true);
    expect(
      isWeak(
        doc({
          hist: [
            { t: NOW - DAY, m: 'type', g: 1 },
            { t: NOW - 2 * DAY, m: 'type', g: 1 },
          ],
        }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isWeak(
        doc({
          hist: [
            { t: NOW - DAY, m: 'type', g: 1 },
            { t: NOW - 20 * DAY, m: 'type', g: 1 },
          ],
        }),
        NOW,
      ),
    ).toBe(false);
    expect(isWeak(doc(), NOW)).toBe(false);
  });

  it('ab Stufe 4 nie schwach (alte Rückfälle zählen dann nicht mehr)', () => {
    expect(isWeak(doc({ lapses: 3, stage: 3 }), NOW)).toBe(true);
    expect(isWeak(doc({ lapses: 3, stage: 4 }), NOW)).toBe(false);
  });

  it('Bedarf: weniger als 2 frische, nicht gemeldete Sätze', () => {
    expect(needsWordCtx(doc(), NOW)).toBe(true);
    expect(
      needsWordCtx(
        doc({
          wx: [
            { ...S1, t: NOW },
            { ...S2, t: NOW },
          ],
        }),
        NOW,
      ),
    ).toBe(false);
    expect(
      needsWordCtx(
        doc({
          wx: [
            { ...S1, t: NOW },
            { ...S2, t: NOW, bad: 1 },
          ],
        }),
        NOW,
      ),
    ).toBe(true);
    expect(
      needsWordCtx(
        doc({
          wx: [
            { ...S1, t: NOW - 40 * DAY },
            { ...S2, t: NOW },
          ],
        }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('ergänzend speichern', () => {
  it('wxPatch hängt an, höchstens 4; fremde Roh-Einträge bleiben immer stehen, ohne Platz wird nichts ergänzt; nichts Neues → null', () => {
    const cur = [{ en: 'a', zz: 1 }, { en: 'b' }, { en: 'c' }];
    const next = wxPatch(cur, [
      { ...S1, t: NOW, pv: PV },
      { ...S2, t: NOW, pv: PV },
    ]);
    expect(next).toHaveLength(WX_MAX);
    expect(next?.slice(0, 3)).toEqual(cur);
    expect(next?.[3]).toMatchObject({ en: S1.en });
    expect(cur).toHaveLength(3);
    expect(wxPatch([...cur, { en: 'd' }], [{ ...S1, t: NOW, pv: PV }])).toBeNull();
    expect(wxPatch(cur, [])).toBeNull();
    expect(cfxPatch(undefined, null)).toBeNull();
  });

  it('volle Liste: zuerst weichen die ältesten ungemeldeten Claude-Einträge, gemeldete (bad: 1) nie', () => {
    const old1 = { en: 'old one', de: 'x', sit: 'x', t: NOW - 3 * DAY, pv: PV };
    const old2 = { en: 'old two', de: 'x', sit: 'x', t: NOW - 2 * DAY, pv: PV };
    const bad = { en: 'reported', de: 'x', sit: 'x', t: NOW - 9 * DAY, pv: PV, bad: 1 };
    const raw = { en: 'raw entry' };
    const next = wxPatch([old2, bad, old1, raw], [
      { ...S1, t: NOW, pv: PV },
      { ...S2, t: NOW, pv: PV },
    ]);
    expect(next).toEqual([bad, raw, { ...S1, t: NOW, pv: PV }, { ...S2, t: NOW, pv: PV }]);
    // Nur ein Platz frei zu machen: der älteste ungemeldete (old1) weicht, old2 bleibt.
    expect(wxPatch([old2, bad, old1, raw], [{ ...S1, t: NOW, pv: PV }])).toEqual([old2, bad, raw, { ...S1, t: NOW, pv: PV }]);
    // Nur gemeldete und fremde Einträge: kein Platz → nichts ergänzt.
    expect(wxPatch([bad, raw, { ...bad, en: 'r2' }, { en: 'raw2' }], [{ ...S1, t: NOW, pv: PV }])).toBeNull();
    const c = { w: 'influence', en: CONTRAST.en, why: CONTRAST.why, t: NOW, pv: PV };
    expect(cfxPatch([{ ...c, en: 'older', t: 1 }, { ...c, en: 'newer', t: 2 }], c)).toEqual([{ ...c, en: 'newer', t: 2 }, c]);
    expect(cfxPatch([{ ...c, bad: 1 }, { en: 'raw' }], c)).toBeNull();
    expect(CFX_MAX).toBe(2);
  });

  it('markBad markiert genau einen Eintrag, ein zweites Mal → null', () => {
    const cur = [
      { ...S1, t: 1 },
      { ...S2, t: 1 },
    ];
    const once = markBad(cur, S2.en);
    expect(once?.[1]).toMatchObject({ bad: 1 });
    expect(markBad(once, S2.en)).toBeNull();
    expect(readWx({ wx: once })).toHaveLength(1);
  });
});

describe('Prompt word-ctx@1', () => {
  it('ist registriert, quick, ohne Zwischenspeicher, höchstens 1 Hintergrund-Aufruf je Tag', () => {
    expect(TEMPLATES).toContain(wordCtx);
    expect(wordCtx.tier).toBe('quick');
    expect(wordCtx.cache).toBe(false);
    expect(wordCtx.budget).toEqual({ bgPerDay: 1 });
  });

  it('Höchstfall bleibt unter 8 KB', () => {
    const long = (n: number) => 'x'.repeat(n);
    const words: WordCtxVarsWord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `id${i}${long(80)}`,
      en: long(200),
      pos: long(50),
      de: long(300),
      ex: long(600),
      other: { en: long(200), de: long(300) },
    }));
    const prompt = wordCtx.build({
      words,
      ctx: long(2000),
      avoid: Array.from({ length: 30 }, () => long(500)),
    });
    expect(promptBytes(prompt)).toBeLessThan(8 * 1024);
    expect(promptBytes(prompt)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('die Beispielantwort besteht Schema und Prüfung', () => {
    const parsed = wordCtx.schema({ words: [], ctx: '', avoid: [] }).parse(JSON.parse(WORD_CTX_EXAMPLE));
    const word: WordCtxWord = {
      id: 'v_current',
      en: 'current',
      pos: 'adj',
      de: 'aktuell',
      ex: '',
      other: { en: 'actual', de: 'tatsächlich' },
    };
    const r = acceptWordCtx(parsed.items[0], word, new Set(), NOW, PV);
    expect(r.rejected).toEqual([]);
    expect(r.wx).toHaveLength(2);
    expect(r.cfx?.w).toBe('actual');
    // Zweites Beispiel ohne Verwechslung: contrast null.
    const second = acceptWordCtx(parsed.items[1], { ...word, id: 'v_reliable', en: 'reliable', de: 'zuverlässig', other: null }, new Set(), NOW, PV);
    expect(second.rejected).toEqual([]);
    expect(second.wx).toHaveLength(2);
    expect(second.cfx).toBeNull();
  });

  it('die Testantwort des Entwicklungs-Adapters besteht die Prüfung (Marker zzuk → britischer Satz fällt weg)', () => {
    const prompt = wordCtx.build({
      words: [{ ...WITH_OTHER }, { ...WORD, id: 'zz', en: 'budgetzzuk' }],
      ctx: '',
      avoid: [],
    });
    const items = wordCtx.schema({ words: [], ctx: '', avoid: [] }).parse(JSON.parse(wordCtxReply(prompt))).items;
    const a = acceptWordCtx(items[0], WITH_OTHER, new Set(), NOW, PV);
    expect(a.rejected).toEqual([]);
    expect(a.wx).toHaveLength(2);
    expect(a.cfx).not.toBeNull();
    const b = acceptWordCtx(items[1], { ...WORD, id: 'zz', en: 'budgetzzuk' }, new Set(), NOW, PV);
    expect(b.rejected).toEqual(['british']);
  });
});

describe('Satzwechsel ab Stufe 2 und Kennzeichnung', () => {
  const WX = [{ ...S1, t: NOW, pv: PV }];

  it('ab Stufe 2 wechselt „Wort zuordnen“ zwischen Ursprungssatz und wx-Satz; der wx-Satz trägt die KI-Kennzeichnung', () => {
    expect(WX_FROM_STAGE).toBe(2);
    const shown = sentKey('We use leverage in every price talk.');
    const c = card({
      wx: WX,
      hist: [{ t: NOW - DAY, m: 'type', g: 3, x: 'match', s: shown }],
    });
    expect(rotatedContext(c, 'match')?.sentence).toBe(S1.en);
    const e = buildExercise(c, 'cloze_hint', 'de', [c], 'seed');
    expect(e.sentence?.sentence).toBe(S1.en);
    expect(e.ai).toEqual({ tpl: PV, kind: 'wx', en: S1.en });
  });

  it('Stufe 2: höchstens 3 Kontexte (Ursprungssatz und die 2 neuesten ungemeldeten wx-Sätze)', () => {
    expect(WX_ROTATE_MAX).toBe(2);
    const many = [
      { en: 'Last year the bank gave us more leverage in the talks with the new owners.', de: 'x', sit: 'a', t: NOW - 5 * DAY, pv: PV },
      { ...S1, t: NOW - 2 * DAY, pv: PV },
      { ...S2, t: NOW - DAY, pv: PV },
      { en: 'Without any leverage, the small shop had to accept the higher rent again.', de: 'x', sit: 'b', t: NOW, pv: PV, bad: 1 },
    ];
    const ctx = wxContexts(card({ wx: many }));
    expect(ctx).toHaveLength(3);
    expect(ctx.map((c) => c.sentence)).toEqual(['We use leverage in every price talk.', S2.en, S1.en]);
  });

  it('gemeldete wx-Sätze kommen nicht mehr; Stufe 1 bleibt beim Ursprungssatz', () => {
    const shown = sentKey('We use leverage in every price talk.');
    const hist = [{ t: NOW - DAY, m: 'type', g: 3, x: 'match', s: shown }];
    expect(rotatedContext(card({ wx: [{ ...WX[0], bad: 1 }], hist }), 'match')?.sentence).toBe('We use leverage in every price talk.');
    expect(rotatedContext(card({ wx: WX, hist, stage: 1 }), 'match')?.sentence).toBe('We use leverage in every price talk.');
    expect(buildExercise(card({ stage: 1, wx: WX, hist }), 'match', 'de', [], 'seed').ai).toBeUndefined();
  });
});

describe('Kontrast-Übung', () => {
  const CFX = [{ w: 'influence', en: CONTRAST.en, why: CONTRAST.why, t: NOW, pv: PV }];

  it('nur wenn beide Karten mindestens Stufe 2 haben', () => {
    const a = card({ cfx: CFX });
    expect(contrastReady(a, [a, other(2)])).toBe(true);
    expect(contrastReady(a, [a, other(1)])).toBe(false);
    expect(contrastReady(card({ cfx: CFX, stage: 1 }), [other(3)])).toBe(false);
    expect(contrastReady(card(), [other(3)])).toBe(false);
  });

  it('Lücke am anderen Wort, Auswahl zwischen beiden Wörtern, Begründung zweisprachig', () => {
    const a = card({ cfx: CFX });
    expect(contrastOf(a)?.cfx.w).toBe('influence');
    const e = buildExercise(a, 'contrast', 'de', [a, other(2)], 'seed');
    expect(e.sentence?.gap).toBe('influence');
    expect(e.options.map((o) => [o.label, o.correct]).sort()).toEqual([
      ['influence', true],
      ['leverage', false],
    ]);
    expect(e.ai).toEqual({ tpl: PV, kind: 'cfx', en: CONTRAST.en });
    expect(e.contrastWhy).toEqual(CONTRAST.why);
  });

  it('Erklärung: Kopfzeile nennt das richtige Wort, die Kontrastzeile steht auch bei richtiger Antwort (a = richtiges Wort, b = Kartenwort)', () => {
    const a = card({ cfx: CFX });
    const e = buildExercise(a, 'contrast', 'de', [a, other(2)], 'seed');
    const ok = e.options.find((o) => o.correct);
    expect(ok?.fromWord).toBe('influence');
    const m = explainWord({
      card: a,
      ex: 'contrast',
      verdict: 'ok',
      given: 'influence',
      check: { verdict: 'correct' },
      lang: 'de',
      contrastWhy: CONTRAST.why.de,
      contrastOther: { word: 'influence', meaning: ok?.fromMeaning ?? null },
    });
    expect(m.lines[0]).toMatchObject({ k: 'pattern', name: 'influence' });
    expect(m.lines.find((l) => l.k === 'contrast')).toMatchObject({ k: 'contrast', a: 'influence', b: 'leverage', diff: 'Einfluss ≠ Hebelwirkung' });
    expect(m.lines.find((l) => l.k === 'why')).toMatchObject({ text: CONTRAST.why.de });
  });

  it('ohne brauchbaren Kontrast-Satz: „Wort zuordnen“', () => {
    expect(buildExercise(card(), 'contrast', 'de', [], 'seed').ex).toBe('match');
  });
});

describe('Verwechslung merken (beugungstolerant)', () => {
  it('gebeugte Form des anderen Worts zählt; gebeugte Form des Kartenworts und ganze Sätze nicht', () => {
    resetWordCtx();
    const conv = toTrainCard('convince', { ...doc(), id: 'convince', word: 'to convince', de: 'überzeugen', ex: 'He [convinced] me.' }, true, NOW) as TrainCard;
    const avoid = toTrainCard('avoid', { ...doc(), id: 'avoid', word: 'to avoid', de: 'vermeiden', ex: 'We [avoid] risks.' }, true, NOW) as TrainCard;
    noteConfusion(conv, 'convinces', [conv, avoid]);
    expect(confusionOf(conv.key)).toBeUndefined();
    noteConfusion(conv, 'we should avoid long meetings today', [conv, avoid]);
    expect(confusionOf(conv.key)).toBeUndefined();
    noteConfusion(conv, 'avoided', [conv, avoid]);
    expect(confusionOf(conv.key)).toBe(avoid.key);
    resetWordCtx();
  });
});
