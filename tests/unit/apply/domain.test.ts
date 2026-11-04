import { describe, expect, it } from 'vitest';
import { copyCheck, COPY_RATIO_MAX } from '../../../src/modules/apply/domain/copy';
import { applyCountPatch, applyOfCount, applyOfDay, readApplyCount } from '../../../src/modules/apply/domain/count';
import { countSentences, countWords, joinParts, lengthGoal, lengthState } from '../../../src/modules/apply/domain/kinds';
import { findKeypoints, keypointsItem, pickMail } from '../../../src/modules/apply/domain/material';
import { errorsOf, evidenceWords, fromReply, outItemOf, praiseOf, prodOf, repairsOf, selfFixOk, selfSpots, wordUses, type ApplyRun } from '../../../src/modules/apply/domain/result';
import { resolveStep } from '../../../src/modules/apply/domain/step';
import { inboxMails } from '../../../src/content/nb/load';
import type { Edit } from '../../../src/domain/tutor/edits';
import type { ApplyReply } from '../../../src/prompts/applyReply';

const ARTICLE =
  'The city council approved a new budget for public transport on Monday. The plan adds forty electric buses and extends night service on six lines. Officials said ticket prices will stay the same until next summer, while the opposition warned that the project could run over budget.';

describe('Abschreib-Schutz (lokal)', () => {
  it('markiert Folgen ab 6 Wörtern und meldet > 25 % übernommene 4-Wort-Folgen', () => {
    const own = 'The plan adds forty electric buses and extends night service. Prices stay flat for now.';
    const c = copyCheck(own, ARTICLE);
    expect(c.runs.length).toBe(1);
    expect(own.slice(c.runs[0]?.start, c.runs[0]?.end)).toBe('The plan adds forty electric buses and extends night service');
    expect(c.ratio).toBeGreaterThan(COPY_RATIO_MAX);
    expect(c.hint).toBe(true);
  });

  it('eigene Worte: keine Markierung, kein Hinweis; fünf gleiche Wörter sind noch keine Übernahme', () => {
    const own = 'The council wants more electric buses at night. Riders will not pay more this year, but critics fear rising costs.';
    const c = copyCheck(own, ARTICLE);
    expect(c.runs).toEqual([]);
    expect(c.hint).toBe(false);
    expect(copyCheck('a new budget for public money', ARTICLE).runs).toEqual([]);
  });

  it('ohne Groß-/Kleinschreibung und Satzzeichen; leerer Text ist 0', () => {
    expect(copyCheck('THE CITY COUNCIL APPROVED A NEW BUDGET!', ARTICLE).runs.length).toBe(1);
    expect(copyCheck('', ARTICLE)).toEqual({ runs: [], ratio: 0, hint: false });
  });
});

describe('Disziplin des Tages: Zähler statt Datum', () => {
  it('Rotation combo → reply → write → summary', () => {
    expect([0, 1, 2, 3, 4, 7].map(applyOfCount)).toEqual(['combo', 'reply', 'write', 'summary', 'combo', 'summary']);
    expect(applyOfDay({})).toBe('combo');
    expect(applyOfDay({ apc: { n: 2, d: '2026-09-20' } })).toBe('write');
    // Unerwarteter Aufbau: nie raten, eigener Satz.
    expect(applyOfDay({ apc: 'x' })).toBe('combo');
    expect(readApplyCount({ apc: { n: -1 } })).toBeNull();
  });

  it('Patch nur einmal je Lerntag und nie an einem kurzen Tag (die Disziplin wandert zum nächsten vollen Tag)', () => {
    expect(applyCountPatch({}, '2026-09-21')).toEqual({ apc: { n: 1, d: '2026-09-21' } });
    expect(applyCountPatch({ apc: { n: 1, d: '2026-09-21' } }, '2026-09-21')).toBeNull();
    expect(applyCountPatch({ apc: { n: 1, d: '2026-09-21' } }, '2026-09-22')).toEqual({ apc: { n: 2, d: '2026-09-22' } });
    expect(applyCountPatch({ apc: { n: 1, d: '2026-09-21' }, kt: { '2026-09-22': 1 } }, '2026-09-22')).toBeNull();
    expect(applyCountPatch({ apc: [] }, '2026-09-22')).toBeNull();
  });

  it('Schritt 3: ohne Claude Satzbau, kurzer Tag ein eigener Satz, sonst die eingefrorene Disziplin', () => {
    expect(resolveStep({ ap: 'reply', short: false, ai: false })).toEqual({ to: 'order' });
    expect(resolveStep({ ap: 'summary', short: true, ai: true })).toEqual({ to: 'combo', n: 1 });
    expect(resolveStep({ ap: 'write', short: false, ai: true })).toEqual({ to: 'task', kind: 'write' });
    expect(resolveStep({ ap: undefined, short: false, ai: true })).toEqual({ to: 'combo', n: 3 });
    expect(resolveStep({ ap: 'bogus', short: false, ai: true })).toEqual({ to: 'combo', n: 3 });
  });
});

describe('Längen', () => {
  it('Handy kürzer: Antwort 40–80, Zusammenfassung 3 Sätze ≤ 70 Wörter; Laptop wie die Wochen-Mail', () => {
    expect(lengthGoal('reply', 'touch').words).toEqual([40, 80]);
    expect(lengthGoal('write', 'keys').words).toEqual([120, 180]);
    expect(lengthGoal('summary', 'touch')).toMatchObject({ words: [30, 70], sentences: [3, 3] });
    expect(lengthGoal('summary', 'keys').sentences).toEqual([3, 5]);
  });

  it('Wörter, Sätze, Zustand; Felder der Handy-Antwort werden Absätze', () => {
    expect(countWords("We're on track, aren't we?")).toBe(5);
    expect(countSentences('One two. Three four! Five six?\nSeven eight')).toBe(4);
    const goal = lengthGoal('summary', 'touch');
    const ok = 'The city council approved forty more electric buses for the city. Night service grows on six busy lines this winter. Prices stay the same until next summer, but critics fear rising costs.';
    expect(lengthState(ok, goal).state).toBe('ok');
    expect(lengthState('Too short. Really.', goal).state).toBe('short');
    expect(joinParts([' Hi Laura, ', '', 'Best regards'])).toBe('Hi Laura,\n\nBest regards');
  });
});

describe('Material', () => {
  it('Mail fest je Lerntag; Kernpunkte einmal je Artikel (Eintrag `sumkp`), gelesen aus `out/<Monat>`', () => {
    const mails = inboxMails();
    expect(mails.length).toBe(16);
    expect(pickMail(mails, '2026-09-21')?.id).toBe(pickMail(mails, '2026-09-21')?.id);
    expect(pickMail([], '2026-09-21')).toBeNull();
    const item = keypointsItem('r-2026-09-20-1', 'Buses', ['Point one is long enough.', 'Point two is long enough.', 'Point three is long enough.'], '2026-09-21', 1);
    expect(item).toMatchObject({ id: 'sumkp-r-2026-09-20-1', k: 'sumkp', d: '2026-09-21' });
    expect(findKeypoints([null, { items: [{ id: 'x', k: 'reply' }, item] }], 'r-2026-09-20-1')).toHaveLength(3);
    expect(findKeypoints([{ items: [{ ...item, fb: { pts: ['nur einer'] } }] }], 'r-2026-09-20-1')).toBeNull();
  });
});

const edit = (from: string, to: string, kind: Edit['kind'], sev: Edit['sev'] = 'error'): Edit => ({ from, to, kind, sev, pat: null, why: 'Weil es so heißt.' });

const TEXT = 'Hi Laura, I am agree that your team is busy. We discussed about the price and I send you more informations next week. It depends of the setup.';
const reply = (edits: Edit[], extra: Partial<ApplyReply> = {}): ApplyReply => ({
  points: [
    { i: 1, covered: 'yes', quote: 'your team is busy' },
    { i: 2, covered: 'no', quote: '' },
  ],
  edits,
  used: [],
  tone: { fit: 'fits', why: '' },
  good: null,
  upgraded: 'Hi Laura, I agree that your team is busy.',
  summary: 'Klar gegliedert.',
  errorCount: null,
  ...extra,
});
const runOf = (fbEdits: Edit[], check = 1, extra: Partial<ApplyRun> = {}): ApplyRun => ({
  kind: 'reply',
  id: 'reply-abc',
  check,
  day: '2026-09-21',
  now: 1,
  text: TEXT,
  pasted: false,
  material: 'm01',
  ctx: 'Your call yesterday',
  feedback: fromReply(reply(fbEdits)),
  length: 'ok',
  copy: null,
  peeked: false,
  words: ['setup'],
  ...extra,
});

describe('Ergebnis', () => {
  const ERRS = [edit('I am agree', 'I agree', 'grammar'), edit('discussed about', 'discussed', 'grammar'), edit('informations', 'information', 'spelling'), edit('depends of', 'depends on', 'collocation'), edit('next week', 'soon', 'word', 'upgrade')];

  it('Selbst verbessern: höchstens 3 Fehler, Grammatik/Wortpartner vor Tippfehlern; Vergleich tolerant', () => {
    const spots = selfSpots(ERRS);
    expect(spots.map((e) => e.from)).toEqual(['I am agree', 'discussed about', 'depends of']);
    expect(selfFixOk(' i AGREE. ', ERRS[0] as Edit)).toBe(true);
    expect(selfFixOk('I agreed', ERRS[0] as Edit)).toBe(false);
    expect(selfFixOk('', ERRS[0] as Edit)).toBe(false);
  });

  it('Fehlersätze: nur erste Prüfung, höchstens 3, ohne Doppelte, Situation als ctx, Quelle write', () => {
    const r = repairsOf(runOf(ERRS));
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.src === 'write' && x.ctx === 'Your call yesterday')).toBe(true);
    expect(new Set(r.map((x) => x.wrong)).size).toBe(r.length);
    expect(repairsOf(runOf(ERRS, 2))).toEqual([]);
  });

  it('Fehlerzahl wie die Wochen-Mail; „Das sitzt“ ohne Fehler mit Zitat und Grund', () => {
    expect(errorsOf({ edits: ERRS, second: null })).toBe(4);
    expect(errorsOf({ edits: ERRS, second: 10 })).toBe(6);
    const f = fromReply(reply([], { good: { quote: 'your team is busy', why: 'Zeigt Verständnis.' } }));
    expect(praiseOf(f, TEXT)).toEqual({ quote: 'your team is busy', why: 'Zeigt Verständnis.' });
    expect(praiseOf(fromReply(reply([])), TEXT)?.why).toBe('Klar gegliedert.');
  });

  it('Lernwörter: Claudes Urteil, sonst lokal; Beleg nur, wenn richtig benutzt und nicht im Material', () => {
    const f = fromReply(reply([edit('depends of', 'depends on', 'collocation')], { used: [{ pat: 'busy', ok: true, quote: 'busy' }] }));
    const uses = wordUses(['busy', 'setup', 'depends', 'invoice'], f, TEXT);
    expect(uses.map((u) => u.state)).toEqual(['ok', 'ok', 'bad', 'none']);
    expect(evidenceWords(uses, 'my team is busy right now')).toEqual(['setup']);
  });

  it('Speicherform `out/<Monat>`: Art reply, Punkte kompakt, Text; K7 nur erste Prüfung, nie bei der Zusammenfassung', () => {
    const item = outItemOf(runOf(ERRS));
    expect(item).toMatchObject({ id: 'reply-abc', k: 'reply', d: '2026-09-21', theme: 'm01', ok: false, text: TEXT });
    expect(item.fb).toMatchObject({ pts: 'yn', err: 4, len: 'ok', n: 1, w: ['setup'] });
    expect(prodOf(runOf(ERRS))).toMatchObject({ s: 'mail', e: 4, pasted: false, id: 'reply-abc' });
    expect(prodOf(runOf(ERRS, 2))).toBeNull();
    expect(prodOf(runOf(ERRS, 1, { kind: 'summary' }))).toBeNull();
    expect(outItemOf(runOf(ERRS, 1, { kind: 'write' })).k).toBe('c1mail');
  });
});
