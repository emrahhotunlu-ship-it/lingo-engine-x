import { describe, expect, it } from 'vitest';
import { parseJsonText } from '../../src/ai/gate';
import { WRITING_PROMPTS } from '../../src/content/writing/prompts';
import { bank, wordId } from '../../src/bank/words';
import { GRAMMAR_TASKS } from '../../src/coach/grammar';
import {
  answerRepair,
  boxDays,
  checkRepair,
  dueAfter,
  dueRepairs,
  grammarKey,
  planAdd,
  REPAIR_CAP,
  repairFromError,
  repairFromGrammar,
  taskOfRepair,
  writeKey,
  type RepairDoc,
  type RepairRec,
} from '../../src/coach/repair';
import { stumbleStats, weakCatsOf } from '../../src/coach/stumble';
import {
  buildEntry,
  lastWritten,
  levelHistory,
  pickPrompt,
  planWritingSave,
  taskFromInput,
  taskFromPrompt,
  usedWords,
  wordCount,
  WRITING_MONTH_SLOTS,
  type WriteReview,
  type WritingEntry,
  type WritingMonths,
} from '../../src/coach/writing';
import { buildSummary } from '../../src/coach/summary';
import { cannedWriteReview, CANNED_WRITE_TEXT } from '../../src/platform/dev/cannedWrite';
import { build, normalizeReview, readCat, readLevel, writeReview } from '../../src/prompts/write';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-04T10:00:00+02:00');

const rec = (over: Partial<RepairRec> = {}): RepairRec => ({
  k: 'w-x',
  orig: 'He work here',
  fix: 'He works here',
  why: 'Dritte Person: -s.',
  wl: 'de',
  cat: 'tenses',
  src: 'write',
  topic: '',
  box: 1,
  due: NOW - 1000,
  add: NOW - DAY,
  done: 0,
  ...over,
});

describe('Reparatur: Boxen 1 → 3 → 9 → erledigt', () => {
  it('richtig rückt eine Box vor, falsch geht zurück in Box 1, nach Box 9 und richtig ist es erledigt', () => {
    const a = answerRepair(rec(), true, NOW);
    expect(a.box).toBe(3);
    expect(a.due).toBe(dueAfter(NOW, 3));
    const b = answerRepair(a, true, NOW);
    expect(b.box).toBe(9);
    expect(b.done).toBe(0);
    const c = answerRepair(b, true, NOW);
    expect(c.done).toBe(1);
    expect(boxDays(c)).toBe(0);
    const back = answerRepair(b, false, NOW);
    expect(back.box).toBe(1);
    expect(back.done).toBe(0);
    expect(back.due).toBe(dueAfter(NOW, 1));
    // Ein erledigter Eintrag, der wieder falsch ist, wird wieder geöffnet.
    expect(answerRepair(c, false, NOW).done).toBe(0);
  });

  it('Fälligkeit zählt ab 04:00 Uhr des Lerntags, auch bei einer Einheit nach Mitternacht', () => {
    const evening = Date.parse('2026-10-04T21:00:00+02:00');
    expect(new Date(dueAfter(evening, 1)).toISOString()).toBe('2026-10-05T02:00:00.000Z');
    // 01:30 Uhr gehört noch zum Vortag (3.10.): „morgen“ ist dann der 4.10. um 04:00.
    const night = Date.parse('2026-10-04T01:30:00+02:00');
    expect(new Date(dueAfter(night, 1)).toISOString()).toBe('2026-10-04T02:00:00.000Z');
  });

  it('höchstens drei fällige Einträge, die am längsten wartenden zuerst; Erledigte und Künftige nie', () => {
    const doc: RepairDoc = {
      s0: rec({ k: 'a', due: NOW - 5 * DAY }),
      s1: rec({ k: 'b', due: NOW - 1 * DAY }),
      s2: rec({ k: 'c', due: NOW - 3 * DAY }),
      s3: rec({ k: 'd', due: NOW - 2 * DAY }),
      s4: rec({ k: 'e', due: NOW + DAY }),
      s5: rec({ k: 'f', due: NOW - 9 * DAY, done: 1 }),
    };
    const due = dueRepairs(doc, NOW);
    expect(due.map(([slot]) => slot)).toEqual(['s0', 's2', 's3']);
    expect(dueRepairs({ s4: doc.s4! }, NOW)).toEqual([]);
  });

  it('Plätze: derselbe Fehler setzt zurück, sonst erster freier Platz, voll = ältester erledigter vor ältestem', () => {
    const first = repairFromError({ orig: 'We have an meeting', fix: 'We have a meeting', why: 'a vor Konsonant', cat: 'articles' }, 'de', NOW);
    const patch1 = planAdd({}, [first]);
    expect(Object.keys(patch1)).toEqual(['s0']);
    // Noch einmal derselbe Fehler (andere Groß-/Kleinschreibung und Satzzeichen): gleicher Platz, wieder Box 1.
    const again = repairFromError({ orig: 'we have an meeting.', fix: 'We have a meeting', why: 'a vor Konsonant', cat: 'articles' }, 'de', NOW + 5 * DAY);
    expect(again.k).toBe(first.k);
    const moved: RepairDoc = { s0: { ...first, box: 9, done: 1 } };
    const patch2 = planAdd(moved, [again]);
    expect(Object.keys(patch2)).toEqual(['s0']);
    expect(patch2.s0?.box).toBe(1);
    expect(patch2.s0?.done).toBe(0);
    // Zwei neue Fehler in einem Rutsch bekommen verschiedene Plätze.
    const two = planAdd({ s0: first }, [rec({ k: 'n1' }), rec({ k: 'n2' })]);
    expect(Object.keys(two).sort()).toEqual(['s1', 's2']);
  });

  it('bleibt bei 300 Plätzen: erst erledigte, dann die ältesten werden überschrieben', () => {
    const doc: Record<string, RepairRec> = {};
    for (let i = 0; i < REPAIR_CAP; i++) doc[`s${i}`] = rec({ k: `k${i}`, add: NOW - (REPAIR_CAP - i) * 1000 });
    // Platz 7 ist erledigt, aber nicht der älteste: Er wird trotzdem zuerst überschrieben.
    doc.s7 = { ...doc.s7!, done: 1 };
    const patch = planAdd(doc, [rec({ k: 'neu', add: NOW })]);
    expect(Object.keys(patch)).toEqual(['s7']);
    const full = { ...doc, s7: patch.s7! };
    const next = planAdd(full, [rec({ k: 'neu2', add: NOW })]);
    expect(Object.keys(next)).toEqual(['s0']);
    expect(Object.keys(full).length).toBe(REPAIR_CAP);
  });
});

describe('Reparatur: Aufnahme falscher Grammatik', () => {
  const byType = (type: string) => GRAMMAR_TASKS.find((t) => t.type === type)!;

  it('getippte Aufgaben (gap, transform, correct) werden aufgenommen, Auswahlaufgaben nicht', () => {
    for (const type of ['gap', 'transform', 'correct']) {
      const t = byType(type);
      const r = repairFromGrammar(t, NOW)!;
      expect(r).not.toBeNull();
      expect(r.src).toBe('grammar');
      expect(r.topic).toBe(t.topic);
      expect(r.orig).toBe(t.prompt);
      expect(r.fix).toBe(t.answer);
      expect(r.box).toBe(1);
      expect(r.due).toBe(dueAfter(NOW, 1));
    }
    expect(repairFromGrammar(byType('mc'), NOW)).toBeNull();
  });

  it('zeigt die echte Aufgabe wieder (nichts erfunden) und erkennt dieselbe Aufgabe am Schlüssel', () => {
    const t = byType('correct');
    const r = repairFromGrammar(t, NOW)!;
    expect(r.k).toBe(grammarKey(t));
    expect(taskOfRepair(r)).toBe(t);
    expect(taskOfRepair(rec())).toBeUndefined();
    expect(planAdd({ s0: r }, [repairFromGrammar(t, NOW + DAY)!])).toHaveProperty('s0');
  });
});

describe('Reparatur: Prüfung der getippten Fassung', () => {
  const r = { orig: 'We are working on it since March', fix: 'We have been working on it since March' };
  it('richtig, britische Schreibweise zählt, unverändert nie', () => {
    expect(checkRepair('We have been working on it since March.', r)).toBe('correct');
    expect(checkRepair('we have been working on it since march', r)).toBe('correct');
    expect(checkRepair('We are working on it since March', r)).toBe('wrong');
    expect(checkRepair('', r)).toBe('wrong');
    expect(checkRepair('We organise it', { orig: 'We organizes it', fix: 'We organize it' })).toBe('correct');
  });

  it('ein Tippfehler zählt nur, wenn die Korrektur selbst stimmt', () => {
    // Tippfehler in einem anderen Wort: fast richtig.
    expect(checkRepair('We have been workng on it since March', r)).toBe('near');
    // Ein Buchstabe vom Ziel entfernt, aber das Korrektur-Wort fehlt: falsch.
    expect(checkRepair('He work here', { orig: 'He work here', fix: 'He works here' })).toBe('wrong');
    expect(checkRepair('He worked here', { orig: 'He work here', fix: 'He works here' })).toBe('wrong');
  });

  it('weitere gültige Fassungen der Aufgabe gelten', () => {
    expect(checkRepair("I'm used to getting up early.", { orig: 'I am used to get up early.', fix: 'I am used to getting up early.' }, ["I'm used to getting up early."])).toBe('correct');
  });
});

describe('Schreibtexte: Plätze, Größe, Aufgaben', () => {
  const review: WriteReview = {
    corrected: 'Corrected text.',
    errors: [{ orig: 'a', fix: 'b', why: 'w', cat: 'articles' }],
    upgrades: [],
    level: 'B2+',
    praise: 'Gut.',
  };
  const entry = (at: number, over: Partial<WritingEntry> = {}): WritingEntry => ({
    ...buildEntry({ now: at, day: '2026-10-04', task: taskFromPrompt(WRITING_PROMPTS[0]!, 'de'), text: 'Some text here for the entry.', review, lang: 'de' }),
    ...over,
  });

  it('Eintrag enthält Text, Korrektur, Fehler, Niveau, Datum', () => {
    const e = entry(NOW);
    expect(e).toMatchObject({ at: NOW, d: '2026-10-04', t: 'Some text here for the entry.', c: 'Corrected text.', lv: 'B2+', n: 6, wl: 'de' });
    expect(e.e).toHaveLength(1);
  });

  it('ein Monat hat feste Plätze: erster freier, danach überschreibt der neueste den ältesten', () => {
    let month: Record<string, WritingEntry> = {};
    for (let i = 0; i < WRITING_MONTH_SLOTS; i++) {
      const patch = planWritingSave(month, entry(NOW + i));
      expect(Object.keys(patch)).toEqual([`w${i}`]);
      month = { ...month, ...patch };
    }
    const patch = planWritingSave(month, entry(NOW + 1000));
    expect(Object.keys(patch)).toEqual(['w0']);
  });

  it('wird das Dokument zu groß, verlieren die ältesten Texte den Volltext, die Fehlerliste bleibt', () => {
    const big = (at: number) => entry(at, { t: 'x'.repeat(3000), c: 'y'.repeat(3000) });
    let month: Record<string, WritingEntry> = {};
    for (let i = 0; i < 5; i++) month = { ...month, ...planWritingSave(month, big(NOW + i), 1_000_000) };
    const limit = 3 * 6200;
    const patch = planWritingSave(month, big(NOW + 99), limit);
    const slim = Object.entries(patch).filter(([, e]) => !e.t && !e.c);
    expect(slim.length).toBeGreaterThan(0);
    // Die ältesten zuerst, der neue Text bleibt voll.
    expect(patch.w5?.t).toHaveLength(3000);
    for (const [, e] of slim) expect(e.e).toHaveLength(1);
    expect(slim[0]![1].at).toBe(NOW);
  });

  it('Niveau-Verlauf: die letzten fünf Schätzungen, älteste zuerst', () => {
    const months: WritingMonths = {
      '2026-09': { w0: entry(NOW - 40 * DAY, { lv: 'B1+' }), w1: entry(NOW - 30 * DAY, { lv: 'B2' }) },
      '2026-10': { w0: entry(NOW - 3 * DAY, { lv: 'B2' }), w1: entry(NOW - 2 * DAY, { lv: '' }), w2: entry(NOW - DAY, { lv: 'B2+' }), w3: entry(NOW, { lv: 'B2+' }) },
    };
    expect(levelHistory(months, 5)).toEqual(['B1+', 'B2', 'B2', 'B2+', 'B2+']);
    expect(levelHistory(months, 2)).toEqual(['B2+', 'B2+']);
  });

  it('40 eingebaute Aufgaben, zwei Drittel Beruf, jede mit vier Schlüsselwörtern', () => {
    expect(WRITING_PROMPTS).toHaveLength(40);
    expect(WRITING_PROMPTS.filter((p) => p.kind === 'work').length).toBe(27);
    expect(new Set(WRITING_PROMPTS.map((p) => p.id)).size).toBe(40);
    for (const p of WRITING_PROMPTS) {
      expect(p.words, p.id).toHaveLength(4);
      expect(p.task_en.length, p.id).toBeGreaterThan(30);
      expect(p.task_de.length, p.id).toBeGreaterThan(30);
      expect(p.min).toBeGreaterThanOrEqual(30);
      expect(p.max).toBeLessThanOrEqual(120);
    }
  });

  it('Schlüsselwörter stehen im eingebauten Wörterbuch (antippbar mit Bedeutung)', () => {
    const missing: string[] = [];
    for (const p of WRITING_PROMPTS) for (const w of p.words) if (!bank().byId.has(wordId(w.en)) && w.en.includes(' ') === false) missing.push(w.en);
    // Ein paar Fachwörter dürfen fehlen; die große Mehrheit muss antippbar sein.
    expect(missing.length).toBeLessThan(WRITING_PROMPTS.length * 4 * 0.25);
  });

  it('Aufgabe des Tages ist fest je Tag, neue Aufgaben zuerst, „andere Aufgabe“ wechselt', () => {
    const a = pickPrompt('2026-10-04', {}, 0);
    expect(pickPrompt('2026-10-04', {}, 0).id).toBe(a.id);
    expect(pickPrompt('2026-10-04', {}, 1).id).not.toBe(a.id);
    // Alle bis auf eine schon geschrieben: die eine kommt.
    const last = Object.fromEntries(WRITING_PROMPTS.filter((p) => p.id !== 'weekend').map((p, i) => [p.id, NOW + i]));
    expect(pickPrompt('2026-10-04', last, 0).id).toBe('weekend');
    expect(lastWritten({ '2026-10': { w0: entry(NOW, { tid: 'weekend' }) } })).toEqual({ weekend: NOW });
  });

  it('Aufgabe zum Input-Beitrag: Schlüsselwörter und Titel des Beitrags', () => {
    const task = taskFromInput({ id: 'ai-chips', kind: 'article', title: 'Why "AI" chips are hard', source: 'X', url: 'https://x.test/', mins: 8, words: [{ en: 'supply chain', de: 'Lieferkette' }] });
    expect(task.id).toBe('in:ai-chips');
    expect(task.task_en).toContain('Why');
    expect(task.task_en.split('"').length).toBe(3);
    expect(task.words).toEqual([{ en: 'supply chain', de: 'Lieferkette' }]);
    expect(task.input).toBeTruthy();
  });

  it('zählt Wörter und erkennt benutzte Schlüsselwörter (auch gebeugt)', () => {
    expect(wordCount("We're done — it's a 3-day plan, OK?")).toBe(7);
    expect(wordCount('')).toBe(0);
    const used = usedWords('We negotiated a discount and will follow up soon.', [
      { en: 'negotiate', de: '' },
      { en: 'discount', de: '' },
      { en: 'follow up', de: '' },
      { en: 'deadline', de: '' },
    ]);
    expect([...used].sort()).toEqual(['discount', 'follow up', 'negotiate']);
  });
});

describe('Stolpersteine', () => {
  const today = '2026-10-04';
  const werr = (cat: string) => ({ orig: 'a', fix: 'b', why: 'w', cat });
  const wentry = (d: string, cats: string[]): WritingEntry => ({
    at: Date.parse(`${d}T12:00:00+02:00`),
    d,
    tid: 't',
    title: 't',
    t: '',
    c: '',
    e: cats.map(werr),
    up: [],
    lv: 'B2',
    pr: '',
    n: 50,
    wl: 'de',
  });
  const grammarRec = (topic: string, d: string, k: string): RepairRec => rec({ k, src: 'grammar', topic, cat: 'grammar', add: Date.parse(`${d}T12:00:00+02:00`) });

  it('zählt Schreibfehler nach Art und Grammatikfehler nach Thema der letzten 30 Tage mit Trend', () => {
    const writing: WritingMonths = {
      '2026-10': { w0: wentry('2026-10-02', ['articles', 'articles', 'tenses']), w1: wentry('2026-10-03', ['articles', 'word-order']) },
      '2026-09': { w0: wentry('2026-09-10', ['articles']), w1: wentry('2026-08-20', ['tenses', 'tenses']), w2: wentry('2026-06-01', ['spelling']) },
      '2026-08': { w0: wentry('2026-08-25', ['articles']) },
    };
    const repair: RepairDoc = {
      s0: grammarRec('pres-perf-cont', '2026-10-01', 'g1'),
      s1: grammarRec('pres-perf-cont', '2026-09-20', 'g2'),
      s2: grammarRec('articles', '2026-10-03', 'g3'),
      // Reparatur aus dem Schreiben zählt nicht noch einmal.
      s3: rec({ k: 'w-1', src: 'write', cat: 'articles', add: Date.parse('2026-10-03T12:00:00+02:00') }),
    };
    const stats = stumbleStats(writing, repair, today);
    // Artikel im Fenster: Schreiben 2 + 1 + 1 (10.9. liegt noch drin) plus Grammatik-Thema „articles“ 1; davor 1.
    expect(stats[0]).toEqual({ key: 'articles', n: 5, prev: 1, trend: 'up' });
    expect(stats.find((s) => s.key === 'topic:pres-perf-cont')).toEqual({ key: 'topic:pres-perf-cont', n: 2, prev: 0, trend: 'up' });
    // Zeitformen: im aktuellen Fenster 1, davor 2 → seltener.
    expect(stats.find((s) => s.key === 'tenses')).toEqual({ key: 'tenses', n: 1, prev: 2, trend: 'down' });
    // Älter als 60 Tage zählt gar nicht.
    expect(stats.find((s) => s.key === 'spelling')).toBeUndefined();
  });

  it('höchstens fünf, häufigste zuerst, bei Gleichstand fest sortiert; leer = leer', () => {
    expect(stumbleStats({}, {}, today)).toEqual([]);
    const cats = ['articles', 'prepositions', 'tenses', 'word-order', 'collocation', 'spelling', 'register'];
    const writing: WritingMonths = { '2026-10': { w0: wentry('2026-10-01', cats) } };
    const stats = stumbleStats(writing, {}, today);
    expect(stats).toHaveLength(5);
    expect(stats.map((s) => s.key)).toEqual(['articles', 'collocation', 'prepositions', 'register', 'spelling']);
    expect(stats.every((s) => s.trend === 'up')).toBe(true);
  });

  it('weakCats für die Zusammenfassung: Top 3, englisch', () => {
    const writing: WritingMonths = { '2026-10': { w0: wentry('2026-10-01', ['articles', 'articles', 'articles', 'tenses', 'tenses']) } };
    const repair: RepairDoc = { s0: grammarRec('passive', '2026-10-02', 'g1'), s1: grammarRec('passive', '2026-10-02', 'g2'), s2: grammarRec('reported', '2026-10-02', 'g3'), s3: grammarRec('reported', '2026-10-02', 'g4') };
    const cats = weakCatsOf(stumbleStats(writing, repair, today), 3);
    expect(cats).toEqual(['articles', 'tenses', 'Passive voice']);
    const summary = buildSummary(null, new Map(), { it: {}, own: {} }, today, cats);
    expect(summary.weakCats).toEqual(cats);
    expect(buildSummary(null, new Map(), { it: {}, own: {} }, today).weakCats).toEqual([]);
  });
});

describe('KI-Vorlage write-review@1: tolerantes Lesen', () => {
  const text = 'We are working on it since March. We have an meeting next week. The colour of the logo is nice.';
  const schema = writeReview.schema({ task_en: 't', text, uiLang: 'de' });
  const read = (reply: string) => schema.parse(parseJsonText(reply));

  it('Prompt: Kopfzeile, Text zwischen Markierungen, Sprache der Erklärung, Grenze 3.000 Zeichen', () => {
    const p = build({ task_en: 'Write an email.', text: 'x'.repeat(5000), uiLang: 'de' });
    expect(p.startsWith('[write-review@1]\n')).toBe(true);
    expect(p).toContain('Explanation language: German');
    expect(p).toContain('<<<TEXT\n' + 'x'.repeat(3000) + '\nTEXT>>>');
    expect(p).not.toContain('x'.repeat(3001));
    expect(build({ task_en: 'a', text: 'b', uiLang: 'en' })).toContain('Explanation language: English');
    expect(writeReview.tier === 'default' || writeReview.tier === 'quick').toBe(true);
    expect(writeReview.cache).toBe(false);
  });

  it('liest eine Antwort mit kaputten Anführungszeichen („…“ mit geradem Schlusszeichen) trotzdem', () => {
    const reply = `{
  "corrected": "We have been working on it since March. We have a meeting next week. The colour of the logo is nice.",
  "errors": [
    {"orig": "We are working on it since March", "fix": "We have been working on it since March", "why": "Mit „since" braucht man das Present Perfect Continuous.", "cat": "tenses"},
    {"orig": "We have an meeting", "fix": "We have a meeting", "why": "Vor „meeting" steht „a" und nicht „an".", "cat": "articles"}
  ],
  "upgrades": [],
  "level": "B2+",
  "praise": "Klare Sätze."
}`;
    const out = read(reply);
    expect(out.errors).toHaveLength(2);
    expect(out.errors[0]!.why).toContain('since');
    expect(out.level).toBe('B2+');
  });

  it('glättet Feldnamen, Arten, Niveau; lässt unlesbare und nicht belegte Fehler weg; britisch ist kein Fehler', () => {
    const out = read(
      JSON.stringify({
        corrected_text: 'We have been working on it since March.',
        errors: [
          { original: 'We are working on it since March', correction: 'We have been working on it since March', explanation: 'Present Perfect.', category: 'Verb Tenses' },
          { orig: 'The colour of the logo', fix: 'The color of the logo', why: 'US-Schreibweise.', cat: 'spelling' },
          { orig: 'We had a meeting yesterday', fix: 'We had meeting yesterday', why: 'steht gar nicht im Text', cat: 'articles' },
          { orig: 'only orig, no fix' },
          'kein Objekt',
          { orig: 'We have an meeting', fix: 'We have an meeting', why: 'gleich', cat: 'articles' },
        ],
        upgrades: [{ weak: 'The logo is nice.', strong: 'The logo looks striking.', why: 'präziser' }, { weak: 'x' }, { weak: 'a', strong: 'b' }, { weak: 'c', strong: 'd' }],
        cefr: 'B2 (B2+ in places)',
        praise_de: 'Klar.',
      }),
    );
    expect(out.corrected).toBe('We have been working on it since March.');
    expect(out.errors).toEqual([{ orig: 'We are working on it since March', fix: 'We have been working on it since March', why: 'Present Perfect.', cat: 'tenses' }]);
    expect(out.upgrades).toHaveLength(2);
    expect(out.level).toBe('B2');
    expect(out.praise).toBe('Klar.');
  });

  it('baut den korrigierten Text selbst, wenn er fehlt, und kommt mit leeren Listen zurecht', () => {
    const out = read(JSON.stringify({ errors: [{ orig: 'We have an meeting', fix: 'We have a meeting', why: 'a', cat: 'articles' }], level: 'B2' }));
    expect(out.corrected).toContain('We have a meeting next week');
    expect(out.upgrades).toEqual([]);
    expect(out.praise).toBe('');
    const none = read(JSON.stringify({ corrected: text, errors: [], upgrades: [], level: 'C1', praise: 'Top.' }));
    expect(none.errors).toEqual([]);
  });

  it('lehnt nur ab, was gar nichts hergibt', () => {
    expect(schema.safeParse(parseJsonText('"nur ein Satz"')).success).toBe(false);
    expect(schema.safeParse(parseJsonText('[1,2]')).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it('Hilfsfunktionen: Fehlerarten und Niveau', () => {
    expect(readCat('Articles')).toBe('articles');
    expect(readCat('word order')).toBe('word-order');
    expect(readCat('idiom')).toBe('collocation');
    expect(readCat('false friends')).toBe('false-friend');
    expect(readCat('grammar')).toBe('other');
    expect(readCat(7)).toBe('other');
    expect(readLevel('B2-C1')).toBe('B2');
    expect(readLevel('c1+')).toBe('C1+');
    expect(readLevel('upper intermediate')).toBe('');
    expect(normalizeReview('x', text)).toBe('x');
  });

  it('die feste Testantwort des Entwicklungs-Adapters ist gültig und passt zum Beispieltext', () => {
    const prompt = build({ task_en: 'Task', text: CANNED_WRITE_TEXT, uiLang: 'de' });
    const s = writeReview.schema({ task_en: 'Task', text: CANNED_WRITE_TEXT, uiLang: 'de' });
    const out = s.parse(parseJsonText(cannedWriteReview(prompt)));
    expect(out.errors.map((e) => e.cat)).toEqual(['tenses', 'articles', 'prepositions']);
    expect(out.upgrades).toHaveLength(1);
    expect(out.corrected).toContain('We have been working on it since March');
    const en = s.parse(parseJsonText(cannedWriteReview(build({ task_en: 'Task', text: CANNED_WRITE_TEXT, uiLang: 'en' }))));
    expect(en.errors[0]!.why).toMatch(/Present Perfect/);
    expect(writeKey('We have an meeting', 'We have a meeting')).toBe(repairFromError(out.errors[1]!, 'de', NOW).k);
  });
});

describe('Speichern in der Datenbank (coach/writing-JJJJ-MM, coach/repair)', () => {
  it('schreibt feste Plätze, liest sie wieder ein und überschreibt beim Wiederholen nichts anderes', async () => {
    const { createMemoryDb } = await import('../../src/platform/dev/memoryDb');
    const { monthOf, resetCoach, saveRepair, saveWriting, startCoach, useCoach } = await import('../../src/coach/store');
    const h = createMemoryDb();
    resetCoach();
    const stop = startCoach(h.db);
    const review: WriteReview = { corrected: 'We have a meeting.', errors: [{ orig: 'We have an meeting', fix: 'We have a meeting', why: 'a', cat: 'articles' }], upgrades: [], level: 'B2', praise: 'Gut.' };
    const e = buildEntry({ now: NOW, day: '2026-10-04', task: taskFromPrompt(WRITING_PROMPTS[0]!, 'de'), text: 'We have an meeting.', review, lang: 'de' });
    await saveWriting('2026-10-04', planWritingSave(useCoach.getState().writing[monthOf('2026-10-04')], e));
    await saveRepair(planAdd(useCoach.getState().repair, review.errors.map((x) => repairFromError(x, 'de', NOW))));
    const dump = h.dump();
    expect(Object.keys((dump['coach/writing-2026-10'] as { e: object }).e)).toEqual(['w0']);
    expect(Object.keys((dump['coach/repair'] as { e: object }).e)).toEqual(['s0']);
    // Eine zweite Ansicht liest beides wieder ein (Prüfung mit zod).
    await new Promise((r) => setTimeout(r, 20));
    expect(useCoach.getState().writing['2026-10']?.w0?.c).toBe('We have a meeting.');
    expect(useCoach.getState().repair.s0?.k).toBe(writeKey('We have an meeting', 'We have a meeting'));
    // Antwort: Box 3, dasselbe Dokument, derselbe Platz.
    const cur = useCoach.getState().repair.s0!;
    await saveRepair({ s0: answerRepair(cur, true, NOW + DAY) });
    expect((h.dump()['coach/repair'] as { e: Record<string, RepairRec> }).e.s0?.box).toBe(3);
    expect(Object.keys((h.dump()['coach/repair'] as { e: object }).e)).toHaveLength(1);
    stop();
    resetCoach();
  });
});
