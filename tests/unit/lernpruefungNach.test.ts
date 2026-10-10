import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { readDecks } from '../../src/domain/srs/decks';
import { isPatternGap } from '../../src/domain/srs/partner';
import { NOTE_WEIGHT, noteWeight } from '../../src/domain/srs/weight';
import type { StoredPlan } from '../../src/domain/plan/types';
import { findHead } from '../../src/ui/exercise/findHead';
import type { Answer } from '../../src/features/vocab/session';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

// Lernprüfung (10.10.2026), Nacharbeit: Fehler finden (Kopf und Korrektur), Wortpartner „decided not to ___“,
// „Wieder in …“ = gespeicherter Abstand, eigener Satz ohne Satzanfang (Gewicht und Aufgabentext).

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: () => undefined, setUnitDoneHandler: () => undefined }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');
const { useDecks } = await import('../../src/features/vocab/decksStore');

describe('Fehler finden: Kopf nennt die eingesetzte Korrektur', () => {
  it('Stelle gefunden, Korrektur falsch: „Du hast … getippt und … eingesetzt.“ (DE + EN)', () => {
    const f = { verdict: 'wrong' as const, errWord: 'Used', tapped: 'Used', found: true, fix: 'Use' };
    const d = findHead(f, 'de');
    expect(d.title).toBe('Richtige Stelle, Korrektur falsch');
    expect(d.sub).toBe('Du hast „Used“ getippt und „Use“ eingesetzt.');
    expect(findHead(f, 'en').sub).toBe('You tapped “Used” and wrote “Use”.');
  });
  it('richtig oder ohne Korrektur: wie bisher nur das getippte Wort', () => {
    expect(findHead({ verdict: 'ok', errWord: 'Used', tapped: 'Used', found: true, fix: 'Using' }, 'de').sub).toBe('Du hast „Used“ getippt.');
    expect(findHead({ verdict: 'wrong', errWord: 'Used', tapped: 'Used', found: true }, 'de').sub).toBe('Du hast „Used“ getippt.');
    // Stelle verfehlt: die Korrektur wird nicht genannt, dafür wo der Fehler steckt.
    expect(findHead({ verdict: 'wrong', errWord: 'Used', tapped: 'clerk', found: false, fix: 'x' }, 'de').sub).toBe('Du hast „clerk“ getippt. Der Fehler steckt in „Used“.');
  });
});

describe('Wortpartner: „Verb + not to + ___“ ist ein Satzmuster', () => {
  it('erkennt „decided not to ___“ wie „decided to ___“', () => {
    const s = 'We decided not to renew the contract.';
    expect(isPatternGap('decide', 'x', { sentence: s, start: s.indexOf('renew') })).toBe(true);
    const s2 = 'We decided to renew the contract.';
    expect(isPatternGap('decide', 'x', { sentence: s2, start: s2.indexOf('renew') })).toBe(true);
    // Ein anderes Wort vor „not to“ bleibt keine Musterlücke.
    const s3 = 'It is important not to renew the contract.';
    expect(isPatternGap('decide', 'x', { sentence: s3, start: s3.indexOf('renew') })).toBe(false);
  });
});

describe('Eigener Satz ohne Satzanfang', () => {
  it('wiegt wie „Satz bilden“ (1,1), mit Satzanfang wie bisher 0,8', () => {
    expect(noteWeight('complete', 0, false, true)).toBe(NOTE_WEIGHT.produce);
    expect(noteWeight('complete')).toBe(NOTE_WEIGHT.help);
  });
  it('Aufgabentext DE + EN', () => {
    const d = de as unknown as Record<string, string>;
    const e = en as unknown as Record<string, string>;
    expect(d.task_complete_free).toBe('Schreib einen ganzen eigenen Satz (mindestens 4 Wörter) mit diesem Wort, z. B. aus einem Kundengespräch oder einer Projektbesprechung.');
    expect(e.task_complete_free).toBe('Write a full sentence of your own (at least 4 words) with this word, e.g. from a client call or project meeting.');
  });
});

const NOW = Date.now();
const DAY = dayKey(NOW);
const DAY_MS = 86_400_000;
const review = (i: number): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'review', S: 12, D: 5, last: NOW - 15 * DAY_MS, due: NOW - 3 * DAY_MS, reps: 5, lapses: 0, stage: 3, src: 'lookup', added: '2026-09-01', order: i });
const fresh = (i: number): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, stage: 0, src: 'lookup', added: DAY, order: i });
const plan: StoredPlan = { d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review: 3, due: 0, new: 3, ahead: 0 }, lesson: null, at: 0 };
const settle = () => new Promise((r) => setTimeout(r, 30));

describe('„Wieder in …“ zeigt genau den gespeicherten Abstand', () => {
  let h: MemoryDbHandle;
  const boot = (docs: Map<string, Doc>) => {
    persist.resetPersistForTests();
    store.resetTodayForTests();
    h = createMemoryDb({ seed: Object.fromEntries([...docs].map(([k, v]) => [`vocab/${k}`, v])) });
    holder.db = h.db;
    holder.writer = createWriter(h.db);
    useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
    useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 3 } }, collections: { vocab: docs, chunk: new Map() } });
    store.useTodayPlan.setState({ day: DAY, plan, status: 'ready', exhausted: null });
  };
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    S.commitHeld();
    await persist.flush();
    await settle();
    vi.restoreAllMocks();
    S.useSession.setState({ active: false });
  });

  /** Wie `ExerciseView`: Vorschau mit dem Zeitstempel t, dann dieselbe Antwort mit `t` speichern. */
  const commitAndRead = async (ans: Answer, preview: Answer): Promise<{ shown: number; stored: number }> => {
    const e = S.useSession.getState().exercise;
    if (!e) throw new Error('keine Abfrage');
    const key = e.card.key;
    const t = persist.nextT();
    const shown = S.answerDueIn(e, preview, t);
    S.commitAnswer({ ...ans, t });
    S.commitHeld();
    await persist.flush();
    await settle();
    const doc = h.dump()[key] as Doc;
    return { shown, stored: (doc.due as number) - t };
  };

  it('gewöhnliche Antwort: Vorschau und Speichern mit demselben Zeitpunkt', async () => {
    boot(new Map(Array.from({ length: 4 }, (_, i) => [`word${i}`, review(i)] as [string, Doc])));
    S.startSession('pflicht');
    const a: Answer = { grade: 3, given: 'x', ms: 2000, ok: true, hint: 0 };
    const r = await commitAndRead(a, a);
    expect(r.stored).toBeGreaterThan(DAY_MS);
    expect(r.shown).toBe(r.stored);
  });

  it('Einspruch „Ich lag richtig“: angezeigt wird der Abstand mit Note 3', async () => {
    boot(new Map(Array.from({ length: 4 }, (_, i) => [`word${i}`, review(i)] as [string, Doc])));
    S.startSession('pflicht');
    // Erst als falsch bewertet (Note 1, Hilfe 2), dann Einspruch: gespeichert wird Note 3 ohne Hilfe.
    const r = await commitAndRead({ grade: 3, given: 'x', ms: 2000, ok: true, override: true }, { grade: 1, given: 'x', ms: 2000, ok: true, override: true, hint: 2 });
    expect(r.shown).toBe(r.stored);
    expect(r.stored).toBeGreaterThan(DAY_MS);
  });

  it('„Kenne ich“ bestanden: 10 Tage angezeigt und gespeichert', async () => {
    boot(new Map(Array.from({ length: 6 }, (_, i) => [`word${i}`, fresh(i)] as [string, Doc])));
    S.startSession('pflicht');
    expect(S.startKnownProbe()).toBe('typed');
    const a: Answer = { grade: 3, given: 'word0', ms: 2000, ok: true, hint: 0 };
    const r = await commitAndRead(a, a);
    expect(r.shown).toBe(10 * DAY_MS);
    expect(r.stored).toBe(10 * DAY_MS);
  });
});
