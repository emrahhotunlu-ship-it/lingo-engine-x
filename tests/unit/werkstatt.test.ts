import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/domain/date';
import { applyUpdate, reviewWrite } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { availableExercises, canListen, makeEnv, supports, SAY_IT_FREE_DAYS } from '../../src/domain/srs/modes';
import { exDeKey } from '../../src/domain/srs/examples';
import { checkSayIt, sayItIntent, SAY_IT_MIN_WORDS } from '../../src/domain/srs/sayIt';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import {
  askNeed,
  canPause,
  contrastLines,
  diagnose,
  editDistance,
  nextWk,
  partsCoreFirst,
  readWk,
  restDay,
  struggling,
  werkstattDue,
  werkstattRoom,
  WERKSTATT_PER_DAY,
} from '../../src/domain/srs/werkstatt';
import { berlin } from './helpers';

// Wort-Lernen 2, Teil 2: Wort-Werkstatt (Auslöser, Diagnose, Ruhe, Pause) und „Sag es“ (lokale Prüfung), Hören am Handy.

type Doc = Record<string, unknown>;
const DAY = '2026-10-21';
const NOW = berlin(DAY, 9);
const at = (d: string, h = 9): number => berlin(d, h);
const fail = (d: string, x = 'cloze', extra: Doc = {}): Doc => ({ t: at(d), m: x, g: 1, x, ...extra });
const good = (d: string, x = 'cloze'): Doc => ({ t: at(d), m: x, g: 3, x });

const base = (over: Doc = {}): Doc => ({
  word: 'leverage',
  pos: 'verb',
  de: 'nutzen',
  def: 'to use something to get an advantage',
  ex: 'We can [leverage] our network.',
  state: 'review',
  S: 4,
  D: 6,
  last: NOW - 86_400_000,
  due: NOW - 1000,
  reps: 6,
  lapses: 1,
  stage: 3,
  src: 'ai',
  added: '2026-10-01',
  intro: '2026-10-01',
  hist: [],
  ...over,
});
const card = (key: string, over: Doc = {}): TrainCard => toTrainCard(key, base(over), true, NOW) as TrainCard;

describe('Auslöser', () => {
  it('3 freie Fehlversuche seit der letzten Werkstatt lösen aus, 2 nicht; je Lerntag zählen höchstens 2 (also an mindestens 2 Tagen)', () => {
    const two = base({ hist: [fail('2026-10-21'), fail('2026-10-21', 'type')] });
    expect(struggling(two, DAY)).toBe(false);
    // Drei Fehlversuche an EINEM Tag: nur 2 zählen (Lehrer-Prüfung 21.10.2026).
    const oneDay = base({ hist: [fail('2026-10-21'), fail('2026-10-21', 'type'), fail('2026-10-21', 'cloze')] });
    expect(struggling(oneDay, DAY)).toBe(false);
    // Über 14 Tage verteilt (die Regel „2 Fehlertage in 14 Tagen“ greift nicht): 2 + 1 an zwei Tagen lösen aus.
    const spread = base({ hist: [fail('2026-10-02'), fail('2026-10-02', 'type'), fail('2026-10-21', 'cloze')] });
    expect(struggling(spread, DAY)).toBe(true);
    expect(struggling(base({ hist: [fail('2026-10-02'), fail('2026-10-02', 'type'), fail('2026-10-02', 'cloze')] }), DAY)).toBe(false);
  });
  it('ein einzelner Ein-Buchstaben-Tippfehler zählt nicht mit; wiederholt zählt er (Diagnose „Schreibung“)', () => {
    const once = base({ hist: [fail('2026-10-02', 'type', { v: 'leverag' }), fail('2026-10-02', 'type', { v: 'use' }), fail('2026-10-21', 'cloze', { v: 'exploit' })] });
    expect(struggling(once, DAY)).toBe(false);
    const twice = base({ hist: [fail('2026-10-02', 'type', { v: 'leverag' }), fail('2026-10-02', 'type', { v: 'leverag' }), fail('2026-10-21', 'cloze', { v: 'exploit' })] });
    expect(struggling(twice, DAY)).toBe(true);
    expect(diagnose(card('vocab/leverage', { hist: [fail('2026-10-02', 'type', { v: 'leverag' }), fail('2026-10-05', 'type', { v: 'leverag' })] }), []).kind).toBe('form');
    // Ein Tippfehler an einem zweiten Tag macht allein keinen Fehlertag.
    expect(struggling(base({ hist: [fail('2026-10-15', 'type', { v: 'leverge' }), fail('2026-10-20', 'mc_de')] }), DAY)).toBe(false);
  });
  it('Fehler an 2 verschiedenen Lerntagen in 14 Tagen lösen aus; älter als 14 Tage zählt nicht', () => {
    expect(struggling(base({ hist: [fail('2026-10-15', 'mc_de'), fail('2026-10-20', 'mc_de')] }), DAY)).toBe(true);
    expect(struggling(base({ hist: [fail('2026-10-02', 'mc_de'), fail('2026-10-20', 'mc_de')] }), DAY)).toBe(false);
  });
  it('der Einführungstag, Partnerwort, „Welches Wort passt?“ und ungeprüfte Sätze zählen nicht', () => {
    const intro = base({ intro: '2026-10-20', hist: [fail('2026-10-20'), fail('2026-10-20'), fail('2026-10-20'), fail('2026-10-21', 'mc_de')] });
    expect(struggling(intro, DAY)).toBe(false);
    const partner = base({ hist: [fail('2026-10-21', 'colloc', { ci: 0 }), fail('2026-10-20', 'colloc', { ci: 1 }), fail('2026-10-19', 'contrast')] });
    expect(struggling(partner, DAY)).toBe(false);
    const unverified = base({ hist: [fail('2026-10-21', 'produce', { u: 1 }), fail('2026-10-21', 'produce', { u: 1 }), fail('2026-10-21', 'produce', { u: 1 })] });
    expect(struggling(unverified, DAY)).toBe(false);
  });
  it('neue und ausgeblendete Karten nie; eine wieder eingeblendete pausierte Karte wieder', () => {
    const hist = [fail('2026-10-20'), fail('2026-10-21'), fail('2026-10-21')];
    expect(struggling(base({ state: 'new', hist }), DAY)).toBe(false);
    expect(struggling(base({ hidden: true, hist, wk: { n: 1, t: at('2026-10-10'), d: '2026-10-10', p: 1 } }), DAY)).toBe(false);
    expect(struggling(base({ hidden: false, hist, wk: { n: 1, t: at('2026-10-10'), d: '2026-10-10', p: 1 } }), DAY)).toBe(true);
  });
  it('nach einer Werkstatt zählen nur neue Fehler', () => {
    const hist = [fail('2026-10-17'), fail('2026-10-18'), fail('2026-10-18')];
    const after = base({ hist, wk: { n: 1, t: at('2026-10-18', 12), d: '2026-10-18' } });
    expect(struggling(after, DAY)).toBe(false);
    expect(struggling({ ...after, hist: [...hist, fail('2026-10-21')] }, DAY)).toBe(false);
    expect(struggling({ ...after, hist: [...hist, fail('2026-10-20'), fail('2026-10-21')] }, DAY)).toBe(true);
  });
});

describe('Ruhe, Tageshöchstzahl, Pause, Frage', () => {
  const hist = [fail('2026-10-20'), fail('2026-10-21')];
  it('am Werkstatt-Tag und am Tag danach nicht wieder, ab dem übernächsten Tag schon', () => {
    const wk = { n: 1, t: at('2026-10-19'), d: '2026-10-19' };
    expect(werkstattDue(base({ hist: [...hist], wk }), '2026-10-20')).toBe(false);
    expect(werkstattDue(base({ hist: [...hist], wk }), '2026-10-21')).toBe(true);
  });
  it('restDay: frühestens Tag + 2, höchstens Tag + 3, dazwischen gilt FSRS', () => {
    expect(restDay('2026-10-21', DAY)).toBe('2026-10-23');
    expect(restDay('2026-10-23', DAY)).toBe('2026-10-23');
    expect(restDay('2026-10-24', DAY)).toBe('2026-10-24');
    expect(restDay('2026-11-30', DAY)).toBe('2026-10-24');
  });
  it('höchstens 2 Werkstatt-Wörter je Lerntag', () => {
    const today = { wk: { n: 1, t: NOW, d: DAY } };
    expect(werkstattRoom([base(), base()], DAY)).toBe(WERKSTATT_PER_DAY);
    expect(werkstattRoom([base(today), base()], DAY)).toBe(1);
    expect(werkstattRoom([base(today), base(today), base(today)], DAY)).toBe(0);
  });
  it('„pausieren“ ab 6 Vergessen, Frage nach dem Bedarf ab 3 Runden', () => {
    expect(canPause(base({ lapses: 5 }))).toBe(false);
    expect(canPause(base({ lapses: 2, fsrs: { lapses: 6 } }))).toBe(true);
    expect(askNeed(base({ wk: { n: 2, t: NOW, d: DAY } }))).toBe(false);
    expect(askNeed(base({ wk: { n: 3, t: NOW, d: DAY } }))).toBe(true);
  });
  it('readWk liest tolerant, nextWk zählt hoch', () => {
    expect(readWk(base({ wk: 'kaputt' }))).toBeNull();
    expect(readWk(base({ wk: { n: 2, t: NOW } }))).toEqual({ n: 2, t: NOW, d: DAY });
    expect(nextWk(base({ wk: { n: 2, t: NOW, d: DAY } }), NOW + 1, '2026-10-22')).toEqual({ n: 3, t: NOW + 1, d: '2026-10-22' });
    expect(nextWk(base(), NOW, DAY)).toEqual({ n: 1, t: NOW, d: DAY });
  });
});

describe('Diagnose', () => {
  const pool = [card('lev'), card('exp', { word: 'exploit', de: 'ausnutzen', def: 'to use unfairly' })];
  it('Verwechslung aus der getippten Eingabe (hist v) mit Kontrastzeilen', () => {
    const c = card('lev', { hist: [fail('2026-10-20', 'cloze', { v: 'exploit' })] });
    const d = diagnose(c, pool);
    expect(d.kind).toBe('confusion');
    expect(d.other?.word).toBe('exploit');
    // Lehrer-Prüfung 21.10.2026: nie ein einzelnes deutsches Grundwort („nutzen → leverage“), stattdessen die Definition.
    const lines = contrastLines(d, c, 'de');
    expect(lines).toEqual([
      { think: 'to use something to get an advantage', say: 'leverage', mine: true, en: true },
      { think: 'to use unfairly', say: 'exploit', mine: false, en: true },
    ]);
  });
  it('Anker-Zeile: geprüfte Wortpartner-Verbindung der Karte zuerst, sonst eine deutsche Wendung, nie ein einzelnes Grundwort', () => {
    const col = [{ index: 0, p: 'leverage our network', de: 'unser Netzwerk gezielt einsetzen', gap: 'network', opts: ['network', 'idea', 'time'], ctx: null, ai: true }];
    const c = { ...card('lev'), col };
    expect(contrastLines({ kind: 'meaning' }, c, 'de')).toEqual([{ think: 'unser Netzwerk gezielt einsetzen', say: 'leverage our network', mine: true }]);
    expect(contrastLines({ kind: 'meaning' }, c, 'en')).toEqual([{ think: 'to use something to get an advantage', say: 'leverage our network', mine: true, en: true }]);
    expect(contrastLines({ kind: 'meaning' }, { word: 'leverage', de: 'gezielt einsetzen', def: null }, 'de')).toEqual([{ think: 'gezielt einsetzen', say: 'leverage', mine: true }]);
    expect(contrastLines({ kind: 'meaning' }, { word: 'leverage', de: 'nutzen', def: null }, 'de')).toEqual([]);
    for (const lang of ['de', 'en'] as const) for (const l of contrastLines({ kind: 'meaning' }, card('lev'), lang)) expect(l.think).not.toBe('nutzen');
  });
  it('Partnerwort-Diagnose nennt die verfehlte Verbindung (`col[ci]`)', () => {
    const col = [
      { index: 0, p: 'leverage our network', de: 'unser Netzwerk gezielt einsetzen', gap: 'network', opts: ['network', 'idea', 'time'], ctx: null, ai: true },
      { index: 1, p: 'leverage data', de: 'Daten gezielt einsetzen', gap: 'data', opts: ['data', 'idea', 'time'], ctx: null, ai: true },
    ];
    const c = { ...card('lev', { hist: [fail('2026-10-19', 'colloc', { ci: 0 }), fail('2026-10-20', 'colloc', { ci: 1 })] }), col };
    const d = diagnose(c, pool);
    expect(d.kind).toBe('partner');
    expect(d.partner).toEqual({ p: 'leverage data', de: 'Daten gezielt einsetzen' });
    expect(contrastLines(d, c, 'de')[0]).toEqual({ think: 'Daten gezielt einsetzen', say: 'leverage data', mine: true });
  });
  it('Verwechslung aus der Runde (confusedKey) gewinnt', () => {
    expect(diagnose(card('lev'), pool, { confusedKey: pool[1]!.key }).kind).toBe('confusion');
  });
  it('Schreibung bei kleinem Tippabstand, Klang bei Hörfehlern, Partnerwort, sonst Bedeutung', () => {
    expect(diagnose(card('lev', { hist: [fail('2026-10-20', 'cloze', { v: 'leverge' })] }), pool).kind).toBe('form');
    expect(diagnose(card('lev', { hist: [fail('2026-10-19', 'listen_mc'), fail('2026-10-20', 'dictation')] }), pool).kind).toBe('sound');
    expect(diagnose(card('lev', { hist: [fail('2026-10-19', 'colloc', { ci: 0 }), fail('2026-10-20', 'colloc', { ci: 1 })] }), pool).kind).toBe('partner');
    expect(diagnose(card('lev', { hist: [fail('2026-10-20', 'mc_de')] }), pool).kind).toBe('meaning');
  });
  it('Deutsch-Falle aus dem Fallen-Index', () => {
    const c = card('bec', { word: 'become', de: 'werden', def: 'to begin to be', ex: 'Prices [become] higher.', hist: [fail('2026-10-20', 'mc_de')] });
    const d = diagnose(c, pool);
    if (d.kind === 'false_friend') {
      expect(d.trap).toBeTruthy();
      expect(contrastLines(d, c, 'de')[0]!.say).toBe(d.trap!.right);
    } else expect(d.kind).toBe('meaning');
  });
  it('editDistance', () => {
    expect(editDistance('leverage', 'leverge')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'ab')).toBe(2);
  });
  it('Wendung: Teile, Kern zuerst; Wort: keine Teile', () => {
    expect(partsCoreFirst({ kind: 'vocab', word: 'leverage' })).toEqual([]);
    const parts = partsCoreFirst({ kind: 'chunk', word: 'take something into account' });
    if (parts.length) expect(parts[0]!.kind).toBe('core');
  });
});

describe('Werkstatt-Abruf im Schreibweg', () => {
  const ev = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: DAY, kind: 'v', id: 'lev', ex: 'cloze_hint', grade: 3, given: 'leverage', ans: 'leverage', ms: 4000, lang: 'de', ctx: 'rev', sx: 's1', ...over });
  it('setzt wk, legt die Fälligkeit in die Ruhe (2–3 Tage) und speichert die falsche Eingabe', () => {
    const cur = base({ hist: [fail('2026-10-20'), fail('2026-10-21')] });
    const w = reviewWrite('vocab/lev', cur, ev({ wk: true }), null);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const next = applyUpdate(cur, w.patch);
    expect(readWk(next)).toEqual({ n: 1, t: NOW, d: DAY });
    const dueDay = dayKey(Number(next.due));
    expect(dueDay >= addDays(DAY, 2) && dueDay <= addDays(DAY, 3)).toBe(true);
    expect(werkstattDue(next, addDays(DAY, 1))).toBe(false);
    const wrong = reviewWrite('vocab/lev', cur, ev({ grade: 1, given: 'exploit', wrong: 'exploit' }), null);
    if (wrong.kind !== 'update') throw new Error('kein Update');
    const h = (applyUpdate(cur, wrong.patch).hist as Doc[]).at(-1)!;
    expect(h.v).toBe('exploit');
  });
  it('Fehler beim Werkstatt-Abruf: wk gezählt, aber keine Ruhe (FSRS-Fälligkeit); Wiederholung am selben Tag zählt keine neue Runde', () => {
    const cur = base({ hist: [fail('2026-10-20'), fail('2026-10-21')] });
    const w = reviewWrite('vocab/lev', cur, ev({ wk: true, grade: 1, given: 'exploit' }), null);
    if (w.kind !== 'update') throw new Error('kein Update');
    const mid = applyUpdate(cur, w.patch);
    expect(readWk(mid)).toEqual({ n: 1, t: NOW, d: DAY });
    expect(dayKey(Number(mid.due)) < addDays(DAY, 2)).toBe(true);
    const again = reviewWrite('vocab/lev', mid, ev({ wk: true, t: NOW + 600_000 }), null);
    if (again.kind !== 'update') throw new Error('kein Update');
    expect(readWk(applyUpdate(mid, again.patch))).toMatchObject({ n: 1, d: DAY });
  });
  it('ohne Werkstatt bleibt wk unberührt', () => {
    const cur = base();
    const w = reviewWrite('vocab/lev', cur, ev(), null);
    if (w.kind !== 'update') throw new Error('kein Update');
    expect(w.patch.wk).toBeUndefined();
  });
});

describe('„Sag es“ und Hören', () => {
  const c = { kind: 'vocab' as const, word: 'leverage', lemma: 'leverage' };
  it('Zielwort da und lang genug: Gut, geprüft; sonst Schwer und ungeprüft; leer: Nochmal', () => {
    expect(checkSayIt('We leveraged our network last year.', c)).toMatchObject({ found: true, grade: 3, verified: true });
    expect(checkSayIt('We used our network.', c)).toMatchObject({ found: false, grade: 2, verified: false, noteOnly: true });
    expect(checkSayIt('leverage it', c)).toMatchObject({ found: true, longEnough: SAY_IT_MIN_WORDS <= 2, grade: 2, verified: false });
    expect(checkSayIt('   ', c)).toMatchObject({ grade: 1, verified: true });
    expect(checkSayIt('leverage it', c).noteOnly).toBeUndefined();
  });
  it('„Sag es“: gleichwertige Fassungen einer Wendung zählen; praktisch der deutsche Text ist kein Treffer', () => {
    const chunk = { kind: 'chunk' as const, word: 'to raise interest rates', lemma: 'to raise interest rates' };
    expect(checkSayIt('The central bank will raise interest rates in March.', chunk)).toMatchObject({ found: true, verified: true });
    expect(checkSayIt('The central bank will hike rates again in March.', chunk)).toMatchObject({ found: true, verified: true });
    expect(checkSayIt('They want to put interest rates up next year.', chunk)).toMatchObject({ found: true, verified: true });
    expect(checkSayIt('The bank will rise interest rates soon.', chunk)).toMatchObject({ found: false, noteOnly: true });
    const de = 'Wir können unser Netzwerk nutzen, um leverage zu zeigen.';
    expect(checkSayIt('wir können unser Netzwerk leverage nutzen', c, de)).toMatchObject({ found: false, german: true, noteOnly: true });
    expect(checkSayIt('We can leverage our network.', c, de)).toMatchObject({ found: true, verified: true });
  });
  it('„Sag es“ erst ab 2 freien Lerntagen nach der Einführung und nur mit gespeicherter deutscher Absicht', () => {
    const env = makeEnv(true, false, true);
    const exDe = { [exDeKey('We can leverage our network.')]: 'Wir können unser Netzwerk nutzen.' };
    const zero = card('lev', { exDe, hist: [good('2026-10-01')] });
    expect(supports(zero, 'say_it', 'de', 8, env)).toBe(false);
    const hist = [good('2026-10-01'), good('2026-10-05'), good('2026-10-10')];
    const two = card('lev', { exDe, hist });
    expect(SAY_IT_FREE_DAYS).toBe(2);
    expect(supports(two, 'say_it', 'de', 8, env)).toBe(true);
    expect(sayItIntent(two)).toEqual({ de: 'Wir können unser Netzwerk nutzen.', model: 'We can leverage our network.' });
    // UX-Prüfung M3: Ohne Übersetzung kein „Sag es“ (keine englische Erklärung als Ersatz-Absicht).
    const bare = card('lev', { hist });
    expect(sayItIntent(bare)).toBeNull();
    expect(supports(bare, 'say_it', 'de', 8, env)).toBe(false);
    expect(supports(bare, 'say_it', 'en', 8, env)).toBe(false);
  });
  it('Hören auch am Handy, wenn die Sprachausgabe da ist; ohne Sprachausgabe nie', () => {
    expect(canListen(makeEnv(true, false, true))).toBe(true);
    expect(canListen(makeEnv(false, false, true))).toBe(false);
    const c2 = card('lev', { stage: 2, hist: [good('2026-10-02')] });
    expect(supports(c2, 'listen_mc', 'de', 8, makeEnv(true, false, true))).toBe(true);
    expect(supports(c2, 'listen_mc', 'de', 8, makeEnv(false, false, true))).toBe(false);
    expect(availableExercises({ ...c2, stage: 1 }, 'de', 8, makeEnv(false, false, true))).not.toContain('listen_mc');
  });
});
