import { describe, expect, it } from 'vitest';
import { deriveToday, type DayEntry } from '../../src/domain/plan/buildPlan';
import { entryCardKey, logEntry, mergeLogEntries } from '../../src/domain/progress/logPatch';
import { applyUpdate, chunkMode, chunkPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
import { buildTrainCards, toTrainCard } from '../../src/domain/srs/cards';
import { buildChunkCards, chunkStage, chunkWhy, locateChunk, toChunkCard } from '../../src/domain/srs/chunkCards';
import { buildExercise, buildTiles, inflectLike, speedLimitMs, tilesAnswer } from '../../src/domain/srs/exercise';
import { autoGrade, produceGrade } from '../../src/domain/srs/grade';
import { availableExercises, CATALOG, chooseExercise, NO_ENV } from '../../src/domain/srs/modes';
import { selfCheckProduce } from '../../src/domain/srs/produce';
import { buildQueue, dueCards, planRound } from '../../src/domain/srs/queue';
import { isPhraseCard, matchesFilter } from '../../src/domain/srs/vocabList';
import type { AnswerEvent, ExerciseId, Grade, Stage, TrainCard } from '../../src/domain/srs/types';
import { mulberry32 } from '../../src/domain/random';
import { produceCheckReply } from '../../src/platform/dev/cannedReplies';
import { produceCheck, produceVerdict } from '../../src/prompts/produceCheck';
import { berlin, loadSeed } from './helpers';

// Wendungen in der täglichen Wiederholung (FSRS wie Vokabeln), Abfragearten je Stufe
// (phase1-plan §4.2) und die neuen Bausteine der Übungen. Zeitpunkte über mehrere Tage (Kap. 15).

type Doc = Record<string, unknown>;
const seed = loadSeed();
const T = berlin('2026-09-20', 21);
const MOMENTS = [berlin('2026-09-20', 21), berlin('2026-09-23', 9), berlin('2026-10-15', 12)];
const vocab = new Map(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), v]));
const chunks = new Map(Object.entries(seed).filter(([k]) => k.startsWith('chunk/')).map(([k, v]) => [k.slice(6), v]));

/** Wendung im Format der alten App (altapp-analyse §5): ohne `def`, `fsrs`, `xs`, `hist`. */
const LEGACY_CHUNK: Doc = {
  id: 'c-meet-sb-halfway',
  en: 'meet sb halfway',
  de: 'jdm. entgegenkommen',
  kind: 'phrase',
  register: 'neutral',
  why: 'Klingt kooperativ, ohne nachzugeben.',
  src: { scene: 'sc-vida', sceneTitle: 'Holding the Q2 e-invoicing deadline', utterance: 'We can make a compromise.', upgraded: 'We are happy to meet you halfway on the timeline.', turn: 3, ts: 1789668000000 },
  level: 'C1',
  created: 1789668000000,
  also: [],
  state: 'review',
  S: 6.5,
  D: 4.2,
  due: berlin('2026-09-20', 10),
  last: berlin('2026-09-14', 10),
  reps: 3,
  lapses: 0,
  stage: 3,
};

const answer = (id: string, ex: ExerciseId, grade: Grade, t = T): AnswerEvent => ({ t, day: '2026-09-20', kind: 'chunk', id, ex, grade, given: 'x', ans: 'y', q: 'meet sb halfway', ms: 3000, lang: 'de', ctx: 'rev' });

describe('Wendungen als Karten: alte Planungsfelder gelesen, Kontext aus der aufgewerteten Fassung', () => {
  it('Altform: FSRS aus S/D/due abgeleitet, Stelle der Wendung mit Platzhalter gefunden', () => {
    const c = toChunkCard('c-meet-sb-halfway', LEGACY_CHUNK, T);
    expect(c).not.toBeNull();
    expect(c!.kind).toBe('chunk');
    expect(c!.key).toBe('chunk/c-meet-sb-halfway');
    expect(c!.fsrs.src).toBe('legacy');
    expect(c!.fsrs.stability).toBe(6.5);
    expect(c!.fsrs.due).toBe(LEGACY_CHUNK.due);
    expect(c!.stage).toBe(3);
    expect(c!.isNew).toBe(false);
    expect(c!.context?.gap).toBe('meet you halfway');
    expect(c!.chunk?.scene).toBe('sc-vida');
    // Wendungen der alten App ohne whyLang: Erklärung ist Deutsch, nur auf Deutsch angezeigt.
    expect(chunkWhy(c!, 'de')).toBe(LEGACY_CHUNK.why);
    expect(chunkWhy(c!, 'en')).toBeNull();
  });

  it('alle Wendungen des Testdatensatzes werden Karten; „…“ und Satzzeichen stören den Kontext nicht', () => {
    const cards = buildChunkCards(chunks, T);
    expect(cards).toHaveLength(chunks.size);
    for (const c of cards) expect(c.context, c.id).not.toBeNull();
    const point = cards.find((c) => c.id === 'c-i-take-your-point-but');
    expect(point?.context?.gap).toBe('I take your point, but');
    expect(point?.lemma).toBe('I take your point, but');
  });

  it('locateChunk: Beugung am Rand, kein Treffer ohne Wendung', () => {
    expect(locateChunk('The go-live was pushed back again.', 'push back the go-live')).toBeNull();
    const s = 'They pushed back the go-live by a week.';
    const hit = locateChunk(s, 'push back the go-live');
    expect(hit && s.slice(hit.start, hit.end)).toBe('pushed back the go-live');
    const d = 'We still meet deadlines.';
    const h2 = locateChunk(d, 'meet a deadline');
    expect(h2).toBeNull();
    expect(locateChunk('It all hinges on the budget.', 'hinge on')).toEqual({ start: 7, end: 16 });
  });

  it('ausgeblendete und ungültige Wendungen: Karte bleibt ausgeblendet bzw. fehlt', () => {
    const hidden = toChunkCard('x', { ...LEGACY_CHUNK, hidden: true }, T);
    expect(hidden?.hidden).toBe(true);
    expect(buildChunkCards(new Map([['c-x', { ...LEGACY_CHUNK }]]), T, new Set(['c-x']))).toHaveLength(0);
  });
});

describe('Schreiben einer Wendung: nur ergänzen, nie anlegen, keine Fähigkeitswerte', () => {
  it('jede Art × jede Note: strenges Schema, alte Felder unverändert, fsrs zusätzlich', () => {
    for (const d of CATALOG) {
      for (const g of [1, 2, 3, 4] as const) {
        const w = reviewWrite('chunk/c-meet-sb-halfway', LEGACY_CHUNK, answer('c-meet-sb-halfway', d.ex, g), null);
        expect(w.kind, `${d.ex} ${g}`).toBe('update');
        if (w.kind !== 'update') continue;
        expect(chunkPatchSchema.safeParse(w.patch).success).toBe(true);
        for (const k of ['pa', 'ac', 'co', 'colN']) expect(w.patch, k).not.toHaveProperty(k);
        const mode = chunkMode(d.ex);
        if (mode) expect(Object.keys(w.patch.modes as Doc)).toEqual([mode]);
        else expect(w.patch).not.toHaveProperty('modes');
        const merged = applyUpdate(LEGACY_CHUNK, w.patch);
        for (const k of ['en', 'de', 'kind', 'register', 'why', 'src', 'created', 'also', 'level', 'id']) expect(merged[k], k).toEqual(LEGACY_CHUNK[k]);
        expect((merged.fsrs as Doc).src).toBe('lx');
        expect(merged.last).toBe(T);
        expect(merged.S).toBe(Math.min((merged.fsrs as { stability: number }).stability, 365));
        expect((merged.hist as Doc[]).at(-1)).toMatchObject({ t: T, g, x: d.ex });
      }
    }
  });

  it('Modi der alten Wendungs-Wiederholung: getippt → cloze, eigener Satz → produce, Auswahl → keiner', () => {
    expect(chunkMode('cloze')).toBe('cloze');
    expect(chunkMode('tiles')).toBe('cloze');
    expect(chunkMode('dictation')).toBe('cloze');
    expect(chunkMode('situation')).toBe('cloze');
    expect(chunkMode('produce')).toBe('produce');
    expect(chunkMode('mc_de')).toBeNull();
    expect(chunkMode('match')).toBeNull();
  });

  it('fehlende Wendung wird nie angelegt; ausgeblendet, doppelt oder veraltet → nichts', () => {
    expect(reviewWrite('chunk/c-fehlt', undefined, answer('c-fehlt', 'cloze', 3), { en: 'x' })).toEqual({ kind: 'skip', reason: 'missing' });
    expect(reviewWrite('chunk/c-x', { ...LEGACY_CHUNK, hidden: true }, answer('c-x', 'cloze', 3), null)).toEqual({ kind: 'skip', reason: 'hidden' });
    expect(reviewWrite('chunk/c-x', { ...LEGACY_CHUNK, last: T }, answer('c-x', 'cloze', 3), null)).toEqual({ kind: 'skip', reason: 'already_applied' });
    expect(reviewWrite('chunk/c-x', { ...LEGACY_CHUNK, last: T + 9 }, answer('c-x', 'cloze', 3), null)).toEqual({ kind: 'skip', reason: 'stale_answer' });
    expect(reviewWrite('chunk/c-x', { ...LEGACY_CHUNK, en: '' }, answer('c-x', 'cloze', 3), null)).toEqual({ kind: 'skip', reason: 'invalid' });
  });

  it('neue Wendung: Einführungsdatum beim ersten Schreiben, Stufe steigt', () => {
    const fresh = seed['chunk/c-push-back-the-go-live'] as Doc;
    const w = reviewWrite('chunk/c-push-back-the-go-live', fresh, answer('c-push-back-the-go-live', 'mc_en', 3), null);
    expect(w.kind === 'update' && w.patch.intro).toBe('2026-09-20');
    expect(w.kind === 'update' && w.patch.stage).toBe(2);
  });
});

describe('Planung: Wendungen in derselben Runde wie Vokabeln, Wiederholungen vor neuen', () => {
  for (const now of MOMENTS) {
    it(`fällige Wendungen stehen in der Runde (${new Date(now).toISOString().slice(0, 10)})`, () => {
      const cards = [...buildTrainCards(vocab, now), ...buildChunkCards(chunks, now)];
      const dueChunks = dueCards(cards, now).filter((c) => c.kind === 'chunk');
      const plan = planRound({ cards, nowMs: now, newPerDay: 5, introducedToday: 0, lang: 'de' });
      const q = buildQueue({ cards, nowMs: now, target: plan.target, newQuotaLeft: plan.new, exclude: new Set(), lang: 'de' });
      // Wiederholungen zuerst: neue Karten erst an Stelle 2, 5, 8 …
      q.forEach((it, i) => {
        if (it.reason === 'new') expect([2, 5, 8, 11, 14].includes(i) || i >= q.filter((x) => x.reason !== 'new').length).toBe(true);
      });
      expect(q.filter((x) => x.reason === 'new').length).toBeLessThanOrEqual(plan.new);
      if (dueChunks.length && dueChunks.length <= plan.due) {
        const due = q.filter((x) => x.reason === 'due').map((x) => x.key);
        const inRound = dueCards(cards, now).slice(0, plan.due).filter((c) => c.kind === 'chunk');
        for (const c of inRound) expect(due).toContain(c.key);
      }
    });
  }

  it('nur Wendungen, Stapel „Wendungen“: fällige zuerst, neue über das Kontingent', () => {
    const at = berlin('2026-09-24', 9);
    const cards = buildChunkCards(chunks, at);
    const q = buildQueue({ cards, nowMs: at, target: 10, newQuotaLeft: 2, exclude: new Set(), lang: 'de' });
    expect(q.filter((x) => x.reason === 'due').map((x) => x.key)).toEqual(expect.arrayContaining(['chunk/c-i-take-your-point-but', 'chunk/c-meet-a-deadline', 'chunk/c-non-negotiable']));
    expect(q.filter((x) => x.reason === 'new')).toHaveLength(2);
    expect(q.find((x) => x.reason === 'new')?.phase).toBe('intro');
    for (const c of cards) expect(isPhraseCard(c)).toBe(true);
    expect(cards.filter((c) => matchesFilter(c, 'phrases', at))).toHaveLength(cards.filter((c) => !c.hidden).length);
  });
});

const vcard = (over: Doc): TrainCard => {
  const c = toTrainCard('reliable', { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', pos: 'adj', state: 'review', S: 5, D: 5, reps: 3, last: 1, due: 2, ex: 'Our supplier is very [reliable].', ...over }, true, T);
  if (!c) throw new Error('Karte');
  return c;
};
const ccard = (over: Doc = {}): TrainCard => {
  const c = toChunkCard('c-meet-sb-halfway', { ...LEGACY_CHUNK, def: 'to compromise with someone', ...over }, T);
  if (!c) throw new Error('Wendung');
  return c;
};

describe('Abfrageart je Stufe: mindestens zwei, Stufe 5 mit eigenem Satz, Rückfall ohne KI', () => {
  it('Katalog: jede Stufe 1–5 hat mindestens zwei eigene Arten', () => {
    for (const s of [1, 2, 3, 4, 5]) expect(CATALOG.filter((d) => d.stage === s).length, `Stufe ${s}`).toBeGreaterThanOrEqual(2);
  });

  it('jede Stufe 0–5 hat ohne Sprachausgabe und ohne KI mindestens zwei Arten (Vokabel und Wendung, DE und EN)', () => {
    for (const stage of [0, 1, 2, 3, 4, 5] as Stage[]) {
      for (const lang of ['de', 'en'] as const) {
        expect(availableExercises(vcard({ stage }), lang, 100, NO_ENV).length, `Vokabel ${stage} ${lang}`).toBeGreaterThanOrEqual(2);
        expect(availableExercises(ccard({ stage }), lang, 100, NO_ENV).length, `Wendung ${stage} ${lang}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('Stufe 5 „Sicher anwenden“: eigener Satz nur mit KI, Diktat nur mit Sprachausgabe', () => {
    const c = vcard({ stage: 5 });
    expect(availableExercises(c, 'de', 100, { tts: true, ai: true })).toEqual(['dictation', 'speed', 'produce']);
    expect(availableExercises(c, 'de', 100, { tts: false, ai: true })).toEqual(['speed', 'produce']);
    const noAi = availableExercises(c, 'de', 100, { tts: false, ai: false });
    expect(noAi).not.toContain('produce');
    expect(noAi.length).toBeGreaterThanOrEqual(2);
    // Schwächste Art gewinnt: produce nie geübt → gewählt, ohne KI nie.
    const weak = vcard({ stage: 5, xs: { speed: { c: 5, w: 0 }, dictation: { c: 5, w: 0 } } });
    expect(chooseExercise(weak, 'de', 100, [], { tts: true, ai: true })).toBe('produce');
    expect(chooseExercise(weak, 'de', 100, [], { tts: true, ai: false })).not.toBe('produce');
  });

  it('Stufe 1: Hören nur mit Sprachausgabe; ohne Satz kein „Im Satz finden“', () => {
    expect(availableExercises(vcard({ stage: 1 }), 'de', 100, { tts: true, ai: false })).toEqual(['mc_en', 'spot', 'listen_mc']);
    expect(availableExercises(vcard({ stage: 1, ex: '' }), 'de', 100, NO_ENV)).not.toContain('spot');
  });

  it('Wendungen: nie „Im Satz finden“ oder Wortpartner; „Aus der Situation“ nur mit Szene', () => {
    const all = new Set<ExerciseId>();
    for (const stage of [1, 2, 3, 4, 5] as Stage[]) for (const x of availableExercises(ccard({ stage }), 'de', 100, { tts: true, ai: true })) all.add(x);
    expect(all.has('spot')).toBe(false);
    expect(all.has('colloc')).toBe(false);
    expect(availableExercises(ccard({ stage: 4 }), 'de', 100, NO_ENV)).toContain('situation');
    const mail = ccard({ stage: 4, src: { kind: 'mail', ref: 'biz/x', title: 'Email Refiner', utterance: '', upgraded: 'We are happy to meet you halfway on the timeline.' } });
    expect(availableExercises(mail, 'de', 100, NO_ENV)).not.toContain('situation');
    expect(availableExercises(vcard({ stage: 4 }), 'de', 100, NO_ENV)).not.toContain('situation');
  });
});

describe('Übungen bauen: Bausteine, Einsetzen, Hören, Tempo, Situation', () => {
  const pool = [...buildTrainCards(vocab, T), ...buildChunkCards(chunks, T)].filter((c) => !c.hidden);

  it('Bausteine, ein Wort: Buchstaben der Lösung + 2 fremde, nie in Lösungsreihenfolge', () => {
    for (let i = 0; i < 20; i++) {
      const { tiles, mode } = buildTiles('reliable', [], mulberry32(i));
      expect(mode).toBe('letters');
      const own = tiles.filter((t) => !t.distractor).map((t) => t.text);
      expect([...own].sort().join('')).toBe([...'reliable'].sort().join(''));
      const foreign = tiles.filter((t) => t.distractor);
      expect(foreign).toHaveLength(2);
      for (const f of foreign) expect('reliable').not.toContain(f.text);
      expect(own.join('')).not.toBe('reliable');
      // In Lösungsreihenfolge gesetzt ergibt es die Lösung.
      const order = [...tiles].filter((t) => !t.distractor);
      const placed: number[] = [];
      for (const ch of 'reliable') {
        const hit = order.find((t) => t.text === ch && !placed.includes(t.id));
        placed.push(hit!.id);
      }
      expect(tilesAnswer(tiles, placed, 'letters')).toBe('reliable');
    }
  });

  it('Bausteine: lange Wörter in Zweiergruppen, Wendungen als Wörter + 2 Fremdwörter', () => {
    const long = buildTiles('responsibilities', [], mulberry32(1));
    expect(long.tiles.every((t) => !t.distractor)).toBe(true);
    expect(long.tiles.map((t) => t.text).every((x) => x.length <= 2)).toBe(true);
    const words = buildTiles('meet you halfway', ['budget', 'meet'], mulberry32(2));
    expect(words.mode).toBe('words');
    expect(words.tiles.filter((t) => !t.distractor).map((t) => t.text).sort()).toEqual(['halfway', 'meet', 'you']);
    expect(words.tiles.filter((t) => t.distractor)).toHaveLength(2);
  });

  it('Einsetzen: vier Wörter, die Lösung in der Form des Satzes, Ablenker ebenso gebeugt', () => {
    expect(inflectLike('relied', 'rely', 'trust')).toBe('trusted');
    expect(inflectLike('reliable', 'reliable', 'robust')).toBe('robust');
    const c = pool.find((x) => x.kind === 'vocab' && x.context && x.context.gap !== x.lemma);
    expect(c).toBeDefined();
    const e = buildExercise({ ...c!, stage: 2 }, 'match', 'de', pool, 's');
    expect(e.options).toHaveLength(4);
    expect(e.options.filter((o) => o.correct).map((o) => o.label)).toEqual([c!.context!.gap]);
    expect(new Set(e.options.map((o) => o.label.toLowerCase())).size).toBe(4);
  });

  it('Wendung „Wort wählen“: Ablenker sind andere Wendungen, ohne „…“', () => {
    const c = pool.find((x) => x.id === 'c-i-take-your-point-but')!;
    const e = buildExercise({ ...c, stage: 2 }, 'mc_de', 'de', pool, 's');
    expect(e.accepted[0]).toBe('I take your point, but');
    const wrong = e.options.filter((o) => !o.correct);
    expect(wrong).toHaveLength(3);
    const chunkWords = new Set(pool.filter((x) => x.kind === 'chunk').map((x) => x.word.replace(/\s*…$/, '')));
    for (const o of wrong) expect(chunkWords.has(o.label)).toBe(true);
  });

  it('Hören liest den Satz vor, Diktat ebenso; Tempo mit Zeitgrenze nach Länge', () => {
    const c = vcard({ stage: 1 });
    expect(buildExercise(c, 'listen_mc', 'de', pool, 's').speak).toBe('Our supplier is very reliable.');
    const d = buildExercise(vcard({ stage: 5 }), 'dictation', 'de', pool, 's');
    expect(d.speak).toBe('Our supplier is very reliable.');
    expect(d.accepted).toEqual(['reliable']);
    expect(speedLimitMs('reliable')).toBe(7200);
    expect(speedLimitMs('a')).toBe(6000);
    expect(speedLimitMs('x'.repeat(30))).toBe(14000);
    expect(buildExercise(vcard({ stage: 5 }), 'speed', 'de', pool, 's').limitMs).toBe(7200);
    expect(buildExercise(vcard({ stage: 5 }), 'produce', 'de', pool, 's').accepted).toEqual([]);
  });

  it('Aus der Situation: Szene und Absicht, getippt wird die Wendung ohne Platzhalter-Zeichen', () => {
    const c = ccard({ stage: 4 });
    const e = buildExercise(c, 'situation', 'de', pool, 's', { sceneOf: (id) => (id === 'sc-vida' ? { title: 'E-Rechnung', situation: 'Der CFO will verschieben.', counterpart: 'Dana, CFO' } : null) });
    expect(e.situation).toMatchObject({ sceneTitle: 'E-Rechnung', intent: 'jdm. entgegenkommen', then: 'We can make a compromise.' });
    expect(e.accepted[0]).toBe('meet sb halfway');
    const noScene = buildExercise(c, 'situation', 'de', pool, 's');
    expect(noScene.situation?.sceneTitle).toBe('Holding the Q2 e-invoicing deadline');
  });
});

describe('Einstufung der neuen Arten (ohne Selbstbewertung)', () => {
  it('Tempo: ≤ 0,6·G Leicht, ≤ G Gut, abgelaufen richtig → Schwer, falsch → Nochmal', () => {
    expect(autoGrade('speed', { verdict: 'correct' }, { submitMs: 4000, limitMs: 7200 })).toBe(4);
    expect(autoGrade('speed', { verdict: 'correct' }, { submitMs: 7200, limitMs: 7200 })).toBe(3);
    expect(autoGrade('speed', { verdict: 'correct' }, { submitMs: 7300, limitMs: 7200, timedOut: true })).toBe(2);
    expect(autoGrade('speed', { verdict: 'wrong' }, { submitMs: 7300, limitMs: 7200, timedOut: true })).toBe(1);
  });

  it('Bausteine: 600 ms je Baustein abgezogen, nie „Leicht“ (Rekonstruktion); Hören: 1,2 s je Wiederholung', () => {
    expect(autoGrade('tiles', { verdict: 'correct' }, { submitMs: 8300, tiles: 8 })).toBe(3);
    expect(autoGrade('tiles', { verdict: 'correct' }, { submitMs: 1500, tiles: 4 })).toBe(3);
    expect(autoGrade('tiles', { verdict: 'correct' }, { submitMs: 13000, tiles: 8 })).toBe(3);
    expect(autoGrade('tiles', { verdict: 'correct' }, { submitMs: 20000, tiles: 8 })).toBe(2);
    expect(autoGrade('listen_mc', { verdict: 'correct' }, { submitMs: 9000, replays: 1 })).toBe(3);
    expect(autoGrade('listen_mc', { verdict: 'correct' }, { submitMs: 9000 })).toBe(2);
  });

  it('eigener Satz: Note aus Claudes Prüfung, nie „Leicht“', () => {
    expect(produceGrade('correct', true)).toBe(3);
    expect(produceGrade('minor', true)).toBe(2);
    expect(produceGrade('wrong', true)).toBe(1);
    expect(produceGrade('correct', false)).toBe(1);
  });

  it('eigener Satz ohne Claude: Wort fehlt → Nochmal, zu kurz → Schwer, gut → Gut', () => {
    const c = vcard({ stage: 5 });
    expect(selfCheckProduce('We need a trustworthy partner for this.', c).grade).toBe(1);
    expect(selfCheckProduce('It is reliable.', c).grade).toBe(2);
    expect(selfCheckProduce('Our new logistics partner has been very reliable this year.', c).grade).toBe(3);
    expect(selfCheckProduce('Our supplier is very reliable indeed.', c).notCopied).toBe(false);
    expect(selfCheckProduce('We can meet them halfway on the price.', ccard()).containsTarget).toBe(true);
  });
});

describe('Protokoll: Wendungen in der Form der alten App, zählen zu „Wiederholen“', () => {
  it('Eintrag type:chunk ohne k, mit q; Schlüssel chunk/<id>', () => {
    const e = logEntry(answer('c-meet-sb-halfway', 'cloze', 3));
    expect(e).toMatchObject({ type: 'chunk', id: 'c-meet-sb-halfway', q: 'meet sb halfway', m: 'tr-cloze', g: 3, ok: true, ctx: 'rev' });
    expect(e).not.toHaveProperty('k');
    expect(entryCardKey(e)).toBe('chunk/c-meet-sb-halfway');
    expect(entryCardKey({ id: 'reliable', k: 'v' })).toBe('vocab/reliable');
    expect(entryCardKey({ id: 'x', type: 'dictate' })).toBeNull();
  });

  it('deriveToday: Vokabel und Wendung mit gleicher Kennung zählen getrennt, Extra nie', () => {
    const plan = { d: '2026-09-20', ids: [], why: [], v: 1 as const, duty: ['review' as const], goal: { review: 3 }, lesson: null, at: 1 };
    const entries: DayEntry[] = [
      { t: 1, id: 'deadline', k: 'v', ok: true, ctx: 'rev' },
      { t: 2, id: 'deadline', type: 'chunk', ok: true, ctx: 'rev' },
      { t: 3, id: 'c-x', type: 'chunk', ok: true, ctx: 'xtra' },
    ];
    const st = deriveToday({ day: '2026-09-20', plan, entries, minutes: 0 });
    expect(st.review).toEqual({ done: 2, total: 3 });
    expect(st.extra).toBe(1);
  });

  it('Kürzen des Protokolls schützt die erste Wiederholen-Antwort je Wendung', () => {
    const first = logEntry({ ...answer('c-keep', 'cloze', 3), t: 1 });
    const filler = Array.from({ length: 320 }, (_, i) => logEntry({ ...answer(`c-${i}`, 'mc_de', 3), t: 10 + i, ctx: 'xtra' }));
    const out = mergeLogEntries([first], filler) as Doc[];
    expect(out.some((x) => x.id === 'c-keep')).toBe(true);
    expect(out).toHaveLength(300);
  });
});

describe('produce-check: feste Testantworten bestehen das Schema, tolerant gelesen', () => {
  const vars = (sentence: string, uiLang: 'de' | 'en' = 'de') => ({ target: 'meet sb halfway', meaning: 'jdm. entgegenkommen', sentence, uiLang, kind: 'phrase' as const });
  it('richtig, klein, falsch – jeweils gültig nach dem Schema', () => {
    for (const [sentence, verdict] of [
      ['We are happy to meet you halfway on the price.', 'correct'],
      ['we can meet them halfway', 'minor'],
      ['The meeting starts at nine.', 'wrong'],
    ] as const) {
      for (const lang of ['de', 'en'] as const) {
        const v = vars(sentence, lang);
        const r = produceCheck.schema(v).safeParse(JSON.parse(produceCheckReply(produceCheck.build(v))));
        expect(r.success, `${sentence} ${lang}`).toBe(true);
        expect(r.data?.verdict).toBe(verdict);
      }
    }
  });

  it('tolerant: „Correct“, „minor error“, „yes“, fehlendes better', () => {
    const s = produceCheck.schema(vars('x'));
    const r = s.safeParse({ verdict: 'Correct', usesTarget: 'yes', fixed: 'We met halfway.', why: 'Die Wendung passt hier genau.' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ verdict: 'correct', usesTarget: true, better: '' });
    expect(produceVerdict('minor error')).toBe('minor');
    expect(produceVerdict('Incorrect')).toBe('wrong');
    expect(produceVerdict('maybe')).toBe('maybe');
  });
});

describe('Wendungen ab „Mit Stütze abrufen" (Lernberatung 27.09.)', () => {
  it('Stufen 1–2 werden als 3 abgefragt, 0 (neu) und ab 3 unverändert', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => chunkStage(s as 0 | 1 | 2 | 3 | 4 | 5))).toEqual([0, 3, 3, 3, 4, 5]);
  });
});
