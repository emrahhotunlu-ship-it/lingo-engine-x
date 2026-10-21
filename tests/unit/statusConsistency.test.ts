import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../../src/app/settings';
import { addDays } from '../../src/domain/date';
import { buildTrainCards, cardStatus, counts, festCount, unitState, UNIT_STATES } from '../../src/domain/metrics';
import type { UnitState } from '../../src/domain/metrics/definitions';
import { skyTones } from '../../src/domain/atlas/sky';
import { sentKey } from '../../src/domain/srs/variety';
import { toTrainCard } from '../../src/domain/srs/cards';
import { vocabStatistics } from '../../src/domain/srs/retention';
import { filterCards } from '../../src/domain/srs/vocabList';
import type { TrainCard } from '../../src/domain/srs/types';
import { StatusHeader, StatusLadder } from '../../src/features/vocab/StatusBlock';
import { WordRow } from '../../src/features/vocab/list/VocabScreen';
import { statusDetail } from '../../src/features/vocab/statusText';
import { translate } from '../../src/i18n';
import { ExerciseStatus } from '../../src/ui/exercise/ExerciseStatus';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Paket ST: Liste, Wortblatt, Übungsbildschirm, Wort-Hub, Atlas und Fortschritt zeigen für DIESELBE Karte nie widersprüchliche Aussagen.
// Geprüft werden die echten Bausteine (WordRow, StatusHeader, StatusLadder, ExerciseStatus) mit Seed-Daten und synthetischen Grenzfällen,
// auf Deutsch und Englisch.

const D = 86_400_000;
const NOW = berlin('2026-10-19', 10);
const free = (dt: number, g = 3, s = 'sA', x = 'cloze') => ({ t: NOW - dt * D, g, x, s });
const choice = (dt: number, g = 3, x = 'mc_en') => ({ t: NOW - dt * D, g, x });

function mk(id: string, over: Doc = {}): TrainCard {
  return toTrainCard(id, { word: id, de: 'x', def: 'x y', ex: `We [${id}] it.`, pos: 'verb', state: 'review', S: 10, D: 5, due: NOW, last: NOW - 8 * D, stage: 3, reps: 5, lapses: 0, src: 'lookup', added: '2026-06-01', hist: [], ...over }, true, NOW)!;
}

/** Grenzfälle: Name → Karte, erwarteter Zustand. */
const CASES: Array<[string, TrainCard, UnitState]> = [
  ['neu', mk('neu', { state: 'new', stage: 0, reps: 0, S: 0, last: 0 }), 'new'],
  ['Stufe 4, hohe Stabilität, 2 freie Tage', mk('s4hoch', { stage: 4, S: 30, last: NOW - 3 * D, hist: [free(8), free(3)] }), 'safe'],
  ['Stufe 4, niedrige Stabilität, lange überfällig', mk('s4tief', { stage: 4, S: 3, last: NOW - 60 * D, due: NOW - 57 * D, hist: [free(70), free(60)] }), 'wobbly'],
  ['Stufe 4, Fehler zuletzt', mk('s4fehler', { stage: 4, S: 30, last: NOW - 2 * D, hist: [free(9), free(5), free(2, 1)] }), 'wobbly'],
  ['Stufe 4, Fehler vor 6 Tagen, seitdem erst ein freier Tag', mk('s4erholt1', { stage: 4, S: 20, last: NOW - 2 * D, hist: [free(14), free(10), free(6, 1), free(2)] }), 'wobbly'],
  ['Stufe 4, Fehler vor 9 Tagen, seitdem 2 freie Tage', mk('s4erholt2', { stage: 4, S: 20, last: NOW - 2 * D, hist: [free(14), free(10), free(9, 1), free(5), free(2)] }), 'safe'],
  ['Stufe 4 ohne freie Tage (nur Auswahl)', mk('s4auswahl', { stage: 4, S: 30, last: NOW - 3 * D, hist: [choice(9), choice(6), choice(3, 3, 'mc_de')] }), 'learning'],
  ['nur Auswahl-Antworten, Stufe 3', mk('auswahl', { stage: 3, S: 8, last: NOW - 3 * D, hist: [choice(9), choice(3)] }), 'learning'],
  ['Anki-Karte (Aufdecken)', mk('anki', { stage: 2, S: 9, last: NOW - 4 * D, hist: [{ t: NOW - 9 * D, g: 3, x: 'flip' }, { t: NOW - 4 * D, g: 3, x: 'flip' }] }), 'learning'],
  // Wort-Lernen 2: `choice(40)` liefert die Pause ≥ 21 Tage vor dem freien Abruf, die „Fest“ zusätzlich verlangt.
  ['Stufe 5, fest, im neuen Satz', mk('fest', { stage: 5, S: 40, last: NOW - 5 * D, lg: '2026-09-01', hist: [choice(40), free(12, 3, 'sA'), free(5, 3, 'sB')] }), 'firm'],
  ['Stufe 5, Stabilität 40, ein anderer Satz als der Ursprungssatz', mk('einsatz', { stage: 5, S: 40, last: NOW - 5 * D, lg: '2026-09-01', hist: [choice(40), free(12, 3, 'sA'), free(5, 3, 'sA')] }), 'firm'],
  ['Stufe 5, im neuen Satz, aber noch ohne Abruf nach 3 Wochen Pause', mk('ohnepause', { stage: 5, S: 40, last: NOW - 5 * D, hist: [free(12, 3, 'sA'), free(5, 3, 'sB')] }), 'safe'],
  ['Stufe 5, Stabilität 40, nur im Ursprungssatz gekonnt', mk('ursprung', { stage: 5, S: 40, last: NOW - 5 * D, hist: [free(12, 3, sentKey('We ursprung it.')), free(5, 3, sentKey('We ursprung it.'))] }), 'safe'],
  ['Stufe 5 ohne Verlauf (alte Karte)', mk('alt', { stage: 5, S: 60, last: NOW - 5 * D, hist: [] }), 'learning'],
  ['gerade beantwortet (kein Abstand)', mk('heute', { stage: 4, S: 5, last: NOW - 3_600_000, hist: [free(8), free(0.04)] }), 'safe'],
  ['fest, aber über ein Jahr Pause', mk('pause', { stage: 5, S: 25, last: NOW - 400 * D, due: NOW - 375 * D, hist: [free(410, 3, 'sA'), free(400, 3, 'sB')] }), 'wobbly'],
];

const seed = loadSeed();
const seedCards = (now: number): TrainCard[] => buildTrainCards(new Map(Object.entries(seed).filter(([p]) => p.startsWith('vocab/')).map(([p, d]) => [p.slice(6), d])), now);
const SEED_NOW = berlin(addDays(SEED_ANCHOR, 6), 9);

const textOf = (html: string, testId: string): string => {
  const m = new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</(?:span|p)>`).exec(html);
  return (m?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
};
const attr = (html: string, testId: string, name: string): string | null => {
  const m = new RegExp(`data-testid="${testId}"[^>]*?${name}="([^"]*)"`).exec(html) ?? new RegExp(`${name}="([^"]*)"[^>]*?data-testid="${testId}"`).exec(html);
  return m?.[1] ?? null;
};

function surfaces(card: TrainCard, now: number, lang: 'de' | 'en') {
  const st = cardStatus(card, now);
  const row = renderToStaticMarkup(createElement(WordRow, { card, nowMs: now, lang, onOpen: () => undefined, selecting: false, selected: false }));
  const head = renderToStaticMarkup(createElement(StatusHeader, { card, now }));
  const ladder = renderToStaticMarkup(createElement(StatusLadder, { card, now }));
  const exercise = renderToStaticMarkup(createElement(ExerciseStatus, { area: 'words', state: st.tier, kindLabel: 'x' }));
  return { st, row, head, ladder, exercise };
}

describe('Status: Liste, Wortblatt, Übung, Hub, Atlas und Fortschritt widersprechen sich nie', () => {
  // Die Bausteine werden auf Deutsch gerendert (der Server-Rendering-Speicher von zustand kennt nur den Anfangszustand); Englisch prüft der Textblock unten.
  for (const lang of ['de'] as const) {
    describe(lang, () => {
      beforeEach(() => useSettings.getState().setLangLocal(lang));

      for (const [name, card, expected] of CASES) {
        it(`${name}: überall „${expected}“ und derselbe Beleg`, () => {
          const s = surfaces(card, NOW, lang);
          expect(s.st.tier).toBe(expected);
          expect(unitState(card, NOW)).toBe(expected);
          // Zustand: Liste, Wortblatt und Übung zeigen dasselbe.
          expect(attr(s.row, 'vocab-row', 'data-state')).toBe(expected);
          expect(attr(s.head, 'word-status', 'data-state')).toBe(expected);
          expect(attr(s.exercise, 'status', 'data-state')).toBe(expected);
          // Beleg: derselbe Text an allen drei Stellen.
          const detail = textOf(s.head, 'word-status-detail');
          expect(detail.length).toBeGreaterThan(0);
          expect(textOf(s.row, 'vocab-row-detail')).toBe(detail);
          // Übung: der Beleg steht im ⓘ-Fenster (ExerciseShell), nicht in der Kopfzeile.
          expect(s.exercise).not.toContain('status-detail');
          // Genau ein Filter der Liste enthält die Karte (außer Neu: eigener Filter), und es ist der des Zustands.
          const hits = (['new', 'learning', 'wobbly', 'safe', 'firm'] as const).filter((f) => filterCards([card], { filter: f, query: '', sort: 'az', nowMs: NOW }).length === 1);
          expect(hits).toEqual([expected]);
          // Hub und Fortschritt: dieselbe Karte zählt im selben Zustand und Fest nur, wenn es Fest ist.
          expect(vocabStatistics([card], NOW).byState[expected]).toBe(1);
          expect(counts([card], NOW).byState[expected]).toBe(1);
          expect(festCount([card], NOW)).toBe(expected === 'firm' ? 1 : 0);
          // Atlas: der Stern trägt denselben Zustand.
          expect(skyTones([card.id], () => true, () => expected)).toEqual([expected]);
        });

        it(`${name}: keine Aussage widerspricht dem Zustand`, () => {
          const { st, head, ladder } = surfaces(card, NOW, lang);
          const detail = textOf(head, 'word-status-detail');
          const mind = attr(head, 'word-mind', 'data-mind');
          // Sicher und Fest sind nie „wackelig“ oder „vermutlich vergessen“ im Kopf.
          if (st.tier === 'safe' || st.tier === 'firm') expect(['good', 'noGap']).toContain(st.mind);
          if (st.tier === 'safe' || st.tier === 'firm') expect(mind === 'shaky' || mind === 'forgotten').toBe(false);
          // Sicher heißt: mindestens 2 freie Tage; Fest heißt: im neuen Satz oder selbst benutzt, Stufe 5, 21 Tage, letzte Antwort richtig.
          if (st.tier === 'safe') expect(st.freeDays).toBeGreaterThanOrEqual(2);
          if (st.tier === 'firm') {
            expect(st.newSentence || st.own).toBe(true);
            expect(card.stage).toBe(5);
            expect(card.fsrs.stability).toBeGreaterThanOrEqual(21);
            expect(st.unrecovered).toBe(false);
            expect(ladder).toContain('data-step="sentence"');
          }
          // Wackelt: nennt nie „frei abgerufen“ als Beleg und nur ab Stufe 4 oder mit 2 freien Tagen.
          if (st.tier === 'wobbly') {
            expect(detail).not.toMatch(/frei abgerufen|recalled freely/);
            expect(card.stage >= 4 || st.freeDays >= 2).toBe(true);
            expect(st.unrecovered || (st.r !== null && st.r < 0.7)).toBe(true);
            expect(['shaky', 'forgotten', 'noGap']).toContain(st.mind);
          }
          // „zuletzt falsch am …“ steht genau dann da, wenn es einen Fehler im Verlauf gibt (nie bei Neu).
          const hasWrong = st.lastWrong !== null && st.tier !== 'new';
          expect(/falsch am|wrong on/.test(detail)).toBe(hasWrong);
          // … und nie doppelt.
          expect((detail.match(/falsch am|wrong on/g) ?? []).length).toBeLessThanOrEqual(1);
          // „Noch kein Abstand“ nur, wenn die Abrufwahrscheinlichkeit nicht belastbar ist.
          if (st.mind === 'noGap') expect(st.r).toBeNull();
          if (st.mind !== 'noGap' && st.mind !== 'none') expect(st.r).not.toBeNull();
          // Die Leiter widerspricht dem Zustand nicht: ohne freien Tag steht „Frei abgerufen“ nie als erledigt.
          if (st.freeDays === 0 && !card.isNew) expect(ladder).not.toMatch(/data-step="free" data-done/);
        });
      }

      it('Seed-Daten: Zahlen im Hub, in der Liste und im Fortschritt sind gleich; jede Karte hat überall denselben Zustand', () => {
        for (const now of [SEED_NOW, berlin(addDays(SEED_ANCHOR, 45), 9)]) {
          const cards = seedCards(now);
          const visible = cards.filter((c) => !c.hidden);
          const byState = Object.fromEntries(UNIT_STATES.map((k) => [k, 0])) as Record<UnitState, number>;
          for (const c of visible) {
            const s = surfaces(c, now, lang);
            byState[s.st.tier]++;
            expect(attr(s.row, 'vocab-row', 'data-state')).toBe(s.st.tier);
            expect(attr(s.head, 'word-status', 'data-state')).toBe(s.st.tier);
            expect(attr(s.exercise, 'status', 'data-state')).toBe(s.st.tier);
            expect(textOf(s.row, 'vocab-row-detail')).toBe(textOf(s.head, 'word-status-detail'));
          }
          expect(vocabStatistics(cards, now).byState).toEqual(byState);
          expect(counts(cards, now).byState).toEqual(byState);
          expect(festCount(cards, now)).toBe(byState.firm);
          for (const f of ['new', 'learning', 'wobbly', 'safe', 'firm'] as const) expect(filterCards(cards, { filter: f, query: '', sort: 'az', nowMs: now }).length).toBe(byState[f]);
          expect(vocabStatistics(cards, now).sure).toBe(byState.safe + byState.firm);
        }
      });
    });
  }

  it('Englisch: dieselben Aussagen, kein deutsches Wort, US-Schreibweise', () => {
    const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('en', k, v);
    const short = (ms: number) => new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(ms);
    for (const [name, card] of CASES) {
      const st = cardStatus(card, NOW);
      const detail = statusDetail(st, t, short);
      expect(detail, name).not.toMatch(/noch|Tage|zuletzt|frei abgerufen|Pause|Satz\b|geübt/);
      expect(detail, name).not.toMatch(/colour|favour|practise|recognise/);
      expect(detail.length).toBeGreaterThan(0);
    }
    expect(t('stxMindNoGap')).toBe('no gap yet');
    expect(t('exStateWobbly')).toBe('Wobbly');
  });

  it('schreibt nie in stage, S, D oder due: die Ableitung liest nur', () => {
    const card = CASES[2]![1];
    const before = JSON.stringify(card.doc);
    cardStatus(card, NOW);
    unitState(card, NOW);
    expect(JSON.stringify(card.doc)).toBe(before);
  });
});
