import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { toTrainCard } from '../../src/domain/srs/cards';
import { EVENING_MAX, SAY_OWN_WORDS, eveningCheckKeys, sayOwnPick, sayOwnScene } from '../../src/domain/srs/offers';
import type { TrainCard } from '../../src/domain/srs/types';
import { activateCheck } from '../../src/prompts/activateCheck';
import { sayOwnVars } from '../../src/features/vocab/hub/SayOwnSheet';
import { berlin } from './helpers';

// Wort-Lernen 2, Teil 2: freiwillige Angebote „Abend-Check“ (heute eingeführte Wörter, freier Abruf) und „Sag es selbst“ (2 Wörter von gestern/vorgestern,
// Mini-Szene aus dem Berufsprofil, Prüfung über activate-check@1). Rein, nichts wird gespeichert.

type Doc = Record<string, unknown>;
const DAY = '2026-10-21';
const NOW = berlin(DAY, 20);
const doc = (word: string, intro: string | undefined, order: number, over: Doc = {}): Doc => ({
  word,
  de: `${word} (de)`,
  def: `to ${word}`,
  ex: `We [${word}] it.`,
  pos: 'verb',
  state: 'learning',
  stage: 1,
  S: 1,
  D: 5,
  reps: 1,
  last: NOW - 3_600_000,
  due: NOW + 3_600_000,
  added: intro ?? '2026-10-01',
  ...(intro ? { intro } : {}),
  order,
  hist: [],
  ...over,
});
const card = (key: string, d: Doc): TrainCard => toTrainCard(key.replace(/^vocab\//, ''), d, true, NOW) as TrainCard;

describe('Abend-Check', () => {
  it('nur heute eingeführte, sichtbare Karten mit Bedeutung, feste Reihenfolge, höchstens EVENING_MAX', () => {
    const cards = [
      card('vocab/b', doc('beta', DAY, 2)),
      card('vocab/a', doc('alpha', DAY, 1)),
      card('vocab/old', doc('old', addDays(DAY, -1), 0)),
      card('vocab/hid', doc('hidden', DAY, 3, { hidden: true })),
      card('vocab/new', doc('fresh', undefined, 4, { state: 'new', stage: 0, reps: 0, last: 0, due: 0 })),
    ];
    expect(eveningCheckKeys(cards, DAY, 'de')).toEqual(['vocab/a', 'vocab/b']);
    const many = Array.from({ length: EVENING_MAX + 3 }, (_, i) => card(`vocab/w${i}`, doc(`w${i}`, DAY, i)));
    expect(eveningCheckKeys(many, DAY, 'de')).toHaveLength(EVENING_MAX);
    expect(eveningCheckKeys([], DAY, 'de')).toEqual([]);
  });
});

describe('Sag es selbst', () => {
  const y = addDays(DAY, -1);
  const yy = addDays(DAY, -2);
  // Ein freier Abruf an einem Folgetag (Lernwissenschaft S9: nur Karten mit `freeLaterDays ≥ 1`).
  const freeNext = (intro: string): Doc => ({ hist: [{ t: berlin(intro, 9), m: 'type', g: 3, x: 'cloze_hint' }, { t: berlin(addDays(intro, 1), 9), m: 'type', g: 3, x: 'cloze' }] });
  const cards = [card('vocab/y1', doc('settle', y, 1, freeNext(y))), card('vocab/y2', doc('verify', y, 2, freeNext(y))), card('vocab/y3', doc('submit', y, 3, freeNext(y))), card('vocab/yy', doc('obtain', yy, 4, freeNext(yy))), card('vocab/t', doc('today', DAY, 5))];
  it('zwei Wörter, gestern zuerst; beim Neuzeichnen gleich (Kap. 15); vorgestern füllt auf', () => {
    const a = sayOwnPick(cards, DAY, 'de');
    expect(a).toHaveLength(SAY_OWN_WORDS);
    expect(a.every((c) => c.intro === y)).toBe(true);
    expect(sayOwnPick(cards, DAY, 'de').map((c) => c.key)).toEqual(a.map((c) => c.key));
    const onlyOne = [card('vocab/y1', doc('settle', y, 1, freeNext(y))), card('vocab/yy', doc('obtain', yy, 4, freeNext(yy)))];
    expect(sayOwnPick(onlyOne, DAY, 'de').map((c) => c.key)).toEqual(['vocab/y1', 'vocab/yy']);
    // Noch kein freier Abruf an einem Folgetag: kein Angebot für diese Karte.
    expect(sayOwnPick([card('vocab/y1', doc('settle', y, 1)), card('vocab/yy', doc('obtain', yy, 4, freeNext(yy)))], DAY, 'de').map((c) => c.key)).toEqual(['vocab/yy']);
    expect(sayOwnPick([cards[4]!], DAY, 'de')).toEqual([]);
  });
  it('Szene aus dem Berufsprofil (reihum), ohne Profil der allgemeine Arbeitsalltag, höchstens 160 Zeichen', () => {
    const ctx = { role: 'Sales manager', field: 'software', sit: ['negotiation', 'client email'] };
    expect(sayOwnScene(ctx, 0)).toBe('Your role: Sales manager in software. Situation: negotiation.');
    expect(sayOwnScene(ctx, 1)).toBe('Your role: Sales manager in software. Situation: client email.');
    expect(sayOwnScene(ctx, 2)).toBe('Your role: Sales manager in software. Situation: negotiation.');
    expect(sayOwnScene({ role: 'Controller', field: '', sit: [] }, 0)).toBe('Your role: Controller. Situation: a normal workday.');
    expect(sayOwnScene(null, 0)).toBe('Situation: a normal day at the office.');
    expect(sayOwnScene({ role: '', field: '', sit: ['Budgetrunde.'] }, 0)).toBe('Situation: Budgetrunde.');
    expect(sayOwnScene({ role: 'x'.repeat(200), field: '', sit: ['y'] }, 0).length).toBeLessThanOrEqual(160);
  });
  it('sayOwnVars: Szene ohne doppeltes „Situation:“ (Profil mit/ohne Situation, ohne Profil)', () => {
    const c = cards[0]!;
    const sc = (s: string) => sayOwnVars(c, 'x', s, 'de').task.scene;
    expect(sc('Your role: sales manager. Situation: a negotiation.')).toBe('a negotiation (learner role: sales manager)');
    expect(sc('Your role: sales manager. Situation: a normal workday.')).toBe('a normal workday (learner role: sales manager)');
    expect(sc('Situation: a normal day at the office.')).toBe('a normal day at the office.');
    const prompt = activateCheck.build(sayOwnVars(c, 'x', 'Your role: nurse. Situation: a night shift.', 'de'));
    expect(prompt).not.toContain('Situation: Your role');
    expect(prompt).not.toMatch(/Situation:[^\n]*Situation:/);
  });
  it('Anfrage: activate-check@1 als Mini-Szene mit genau einem gezeigten Zielwort, Eingabe weit unter 64 KiB, Schema prüft die Antwort', () => {
    const c = cards[0]!;
    const vars = sayOwnVars(c, 'We need to settle the invoice before Friday.', 'Situation: client email.', 'de');
    expect(vars.task.fmt).toBe('sc');
    expect(vars.targets).toEqual([{ word: 'settle', meaning: 'settle (de)', kind: 'word', shown: true }]);
    const prompt = activateCheck.build(vars);
    expect(prompt).toContain('Situation: client email.');
    expect(prompt).not.toContain('Situation: Situation');
    expect(prompt).toContain('Learner text: We need to settle the invoice before Friday.');
    expect(new TextEncoder().encode(prompt).length).toBeLessThan(64 * 1024);
    const ok = activateCheck.schema(vars).safeParse({
      verdict: 'correct',
      mainVerdict: 'correct',
      targets: [{ used: true, correct: true }],
      alt: '',
      fixed: '',
      why: '„settle the invoice“ ist die übliche Verbindung für eine Rechnung begleichen.',
      better: '',
      whyBetter: '',
      errType: null,
      reusable: true,
    });
    expect(ok.success).toBe(true);
  });
});
