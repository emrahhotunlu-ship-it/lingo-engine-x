import { describe, expect, it } from 'vitest';
import { applyUpdate, reviewWrite, stageStep } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { isFest } from '../../src/domain/metrics/definitions';
import { wantsFreeRecall } from '../../src/domain/srs/spacing';
import type { AnswerEvent, ExerciseId } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Wort-Lernen 2, Korrekturrunde nach den Prüfungen (21.10.2026): Tipp im Verlauf (`h`), Pausenbeleg `lg`, Rückfälle am Einführungstag.

type Doc = Record<string, unknown>;
const at = (day: string, h = 9) => berlin(day, h);
const row = (day: string, x: string, g = 3, extra: Doc = {}) => ({ t: at(day), m: 'type', g, x, ...extra });

const reviewDoc = (over: Doc = {}): Doc => ({
  word: 'leverage',
  de: 'nutzen',
  def: 'to use something to get an advantage',
  ex: 'We can [leverage] our network.',
  pos: 'verb',
  state: 'review',
  S: 30,
  D: 5,
  last: at('2026-09-01'),
  due: at('2026-10-01'),
  reps: 8,
  lapses: 0,
  stage: 5,
  src: 'lookup',
  added: '2026-08-01',
  intro: '2026-08-01',
  hist: [row('2026-08-10', 'cloze', 3, { s: 'sA' }), row('2026-08-20', 'type', 3, { s: 'sB' }), row('2026-09-01', 'cloze', 3, { s: 'sC' })],
  ...over,
});

const ev = (day: string, ex: ExerciseId, grade: 1 | 2 | 3 | 4, extra: Partial<AnswerEvent> = {}): AnswerEvent => ({
  t: at(day),
  day,
  kind: 'v',
  id: 'leverage',
  ex,
  grade,
  given: grade >= 3 ? 'leverage' : 'levrage',
  ans: 'leverage',
  ms: 4000,
  lang: 'de',
  ctx: 'rev',
  sx: 'sD',
  ...extra,
});

function write(cur: Doc, a: AnswerEvent): Doc {
  const w = reviewWrite('vocab/leverage', cur, a, null);
  if (w.kind !== 'update') throw new Error(`kein Update: ${JSON.stringify(w)}`);
  return w.patch;
}

describe('Muss 1: Antworten mit Tipp sind im Verlauf erkennbar und nie ein freier Beleg', () => {
  it('der Verlaufseintrag speichert den Tipp (`h`)', () => {
    const p = write(reviewDoc(), ev('2026-10-01', 'cloze', 3, { hint: 1 }));
    expect((p.hist as Doc[]).at(-1)).toMatchObject({ x: 'cloze', g: 3, h: 1 });
    const q = write(reviewDoc(), ev('2026-10-01', 'cloze', 3));
    expect((q.hist as Doc[]).at(-1)).not.toHaveProperty('h');
  });
  it('Stufe-4-Tor: eine Antwort mit Tipp zählt nicht als freier Tag', () => {
    const cur = reviewDoc({ stage: 3, hist: [row('2026-09-20', 'cloze')] });
    expect(stageStep(cur, ev('2026-10-01', 'cloze', 3)).stage).toBe(4);
    const hinted = stageStep(cur, ev('2026-10-01', 'cloze', 3, { hint: 1 }));
    expect(hinted.stage).toBe(3);
    expect(hinted.missing).toBe(1);
    // Ein früherer Tag mit Tipp im Verlauf ist ebenfalls kein Beleg.
    const histHint = reviewDoc({ stage: 3, hist: [row('2026-09-20', 'cloze', 3, { h: 1 })] });
    expect(stageStep(histHint, ev('2026-10-01', 'cloze', 3)).stage).toBe(3);
  });
  it('Pausenbeleg: ein Abruf mit Tipp nach langer Pause setzt `lg` nicht', () => {
    expect(write(reviewDoc(), ev('2026-10-01', 'cloze', 3, { hint: 1 }))).not.toHaveProperty('lg');
  });
});

describe('Muss 2: eigenes Feld `lg` für den freien Abruf nach ≥ 21 Lerntagen Pause', () => {
  it('der erste gute freie Abruf nach ≥ 21 Tagen schreibt `lg` (einmal), eine kürzere Pause nicht', () => {
    const p = write(reviewDoc(), ev('2026-10-01', 'cloze', 3));
    expect(p.lg).toBe('2026-10-01');
    expect(write(reviewDoc(), ev('2026-09-21', 'cloze', 3))).not.toHaveProperty('lg');
    expect(write(reviewDoc(), ev('2026-10-01', 'mc_en', 3))).not.toHaveProperty('lg');
    expect(write(reviewDoc(), ev('2026-10-01', 'cloze', 2))).not.toHaveProperty('lg');
    // Schon gesetzt: bleibt stehen.
    expect(write(reviewDoc({ lg: '2026-09-15' }), ev('2026-10-01', 'cloze', 3))).not.toHaveProperty('lg');
  });
  it('Partnerwort-Fehler und „Welches Wort passt?“ dazwischen unterbrechen die Pause nicht', () => {
    const hist = [...(reviewDoc().hist as Doc[]), row('2026-09-10', 'contrast', 1), row('2026-09-12', 'colloc', 1, { ci: 0 })];
    expect(write(reviewDoc({ hist }), ev('2026-10-01', 'cloze', 3)).lg).toBe('2026-10-01');
  });
  it('Altkarte, die nach der alten Regel fest war (`ff`, auch ab Stichtag), gilt erst mit `lg` als lang belegt; derselbe Abruf macht sie wieder fest', () => {
    const old = reviewDoc({ ff: '2026-10-22', last: at('2026-10-20'), due: at('2026-11-30'), hist: [row('2026-10-01', 'cloze', 3, { s: 'sA' }), row('2026-10-20', 'type', 3, { s: 'sB' })] });
    const now = at('2026-10-23');
    const card = toTrainCard('leverage', old, true, now)!;
    expect(isFest(card, now)).toBe(false);
    // Freier Abruf 25 Tage nach dem letzten: `lg` gesetzt, Fest wieder belegt.
    const after = applyUpdate(old, write(old, ev('2026-11-14', 'cloze', 3)));
    expect(after.lg).toBe('2026-11-14');
    expect(isFest(toTrainCard('leverage', after, true, at('2026-11-14', 10))!, at('2026-11-14', 10))).toBe(true);
  });
});

describe('Soll 4: Fehler am Einführungstag sind kein Rückfall', () => {
  it('`lapses` steigt nur nach dem Einführungstag', () => {
    const intro = reviewDoc({ state: 'learning', stage: 1, intro: '2026-10-21', last: at('2026-10-21', 8), hist: [row('2026-10-21', 'cloze_hint')], lapses: 0 });
    expect(write(intro, ev('2026-10-21', 'cloze', 1)).lapses).toBe(0);
    expect(write(intro, ev('2026-10-22', 'cloze', 1)).lapses).toBe(1);
  });
});

describe('Soll 3: Tag 2–21 frei, sobald ein freier Tag belegt ist', () => {
  const learning = (hist: Doc[]): Doc => reviewDoc({ state: 'review', stage: 3, intro: '2026-10-01', hist });
  it('ein freier Folgetag und letzte Antwort richtig → frei abfragen', () => {
    expect(wantsFreeRecall(learning([row('2026-10-01', 'cloze_hint'), row('2026-10-02', 'cloze')]))).toBe(true);
  });
  it('noch kein freier Tag → Leiter der Stufe', () => {
    expect(wantsFreeRecall(learning([row('2026-10-01', 'cloze_hint'), row('2026-10-02', 'cloze_hint')]))).toBe(false);
  });
  it('letzte Antwort falsch → Leiter der Stufe (Stütze/Auswahl)', () => {
    expect(wantsFreeRecall(learning([row('2026-10-01', 'cloze_hint'), row('2026-10-02', 'cloze'), row('2026-10-05', 'cloze', 1)]))).toBe(false);
  });
  it('neue Karte → nie', () => {
    expect(wantsFreeRecall(reviewDoc({ state: 'new', hist: [] }))).toBe(false);
  });
});
