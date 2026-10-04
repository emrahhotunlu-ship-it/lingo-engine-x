import { describe, expect, it } from 'vitest';
import feedSeed from '../../src/content/legacy/feed-seed.json';
import passages from '../../src/content/legacy/passages.json';
import { chunkParts, sentenceWith, usedChunks, usesChunk } from '../../src/domain/text/chunkMatch';
import { locateAll, locateError } from '../../src/domain/input/errorSpans';
import { evidenceSentence } from '../../src/domain/input/evidence';
import { articleQuestions, LEGACY_ARTICLES, LEGACY_LISTENING, LEGACY_PROMPTS } from '../../src/domain/input/items';
import { keypointQuestions, KEYPOINT_QUESTION } from '../../src/domain/input/keypointQuiz';
import { docDomain, domainTarget, feedDomain, LEGACY_DOMAIN } from '../../src/domain/input/mix';
import { gradeChoice, normalizeFeedQuestion, normalizeLegacyQuestion, normalizeQuestions, shuffleOptions } from '../../src/domain/input/questions';
import { pickItem, pickPrompt } from '../../src/domain/input/select';
import { paragraphs, readingMinutes, sentenceSplit, wordCount } from '../../src/domain/text/textStats';
import { isUkToUs, splitUkHints } from '../../src/domain/input/usHints';
import { normalizeWriting } from '../../src/domain/input/writingRecord';
import { processReview } from '../../src/domain/input/review';
import type { Cefr, Domain, Question } from '../../src/domain/input/types';
import { loadSeed } from './helpers';

describe('Beruf/Alltag (Plan F4)', () => {
  it('2/3-Regel aus profile.mix', () => {
    expect(domainTarget(undefined)).toBe('work');
    expect(domainTarget({ work: 0, life: 0 })).toBe('work');
    expect(domainTarget({ work: 6, life: 4 })).toBe('work');
    expect(domainTarget({ work: 2, life: 1 })).toBe('life');
    expect(domainTarget({ work: 41, life: 19 })).toBe('life');
    expect(domainTarget({ work: 'x', life: -3 })).toBe('work');
  });

  it('alle 32 Kennungen des Startbestands sind eingeordnet', () => {
    const ids = [...passages.listen, ...passages.write, ...passages.articles].map((p) => p.id);
    expect(ids).toHaveLength(32);
    for (const id of ids) expect(['work', 'life'], id).toContain(LEGACY_DOMAIN[id]);
    expect(Object.keys(LEGACY_DOMAIN).sort()).toEqual([...ids].sort());
  });

  it('Beiträge nach Kategorie, Dokumente nach Feld oder Thema', () => {
    expect(feedDomain('econ')).toBe('work');
    expect(feedDomain('tech')).toBe('work');
    expect(feedDomain('politics')).toBe('life');
    expect(feedDomain(undefined)).toBe('life');
    expect(docDomain({ domain: 'life', topic: 'business' })).toBe('life');
    expect(docDomain({ topic: 'travel' })).toBe('life');
    expect(docDomain({})).toBe('work');
  });
});

type P = { id: string; level: Cefr; domain: Domain };
const mk = (id: string, level: Cefr, domain: Domain): P => ({ id, level, domain });

describe('Tageswahl (Plan F1/F2): deterministisch, gespeichert vor Startbestand', () => {
  const db = [mk('ai1', 'B2+', 'work'), mk('ai2', 'C1', 'life'), mk('ai3', 'B1', 'work')];
  const legacy = [mk('a1', 'B2', 'work'), mk('a2', 'B2+', 'life')];
  const base = { kind: 'read', db, legacy, done: new Set<string>(), target: 'B2+' as Cefr, domain: 'work' as Domain };

  it('gleicher Tag = gleiche Wahl (100 Wiederholungen), auch bei anderer Reihenfolge', () => {
    const first = pickItem({ ...base, day: '2026-09-27' });
    for (let i = 0; i < 100; i++) expect(pickItem({ ...base, day: '2026-09-27', db: [...db].reverse() })?.id).toBe(first?.id);
  });

  it('gespeicherte Inhalte im Band zuerst, passende Domäne bevorzugt, Erledigtes nie', () => {
    expect(pickItem({ ...base, day: '2026-09-27' })?.id).toBe('ai1');
    expect(pickItem({ ...base, day: '2026-09-27', domain: 'life' })?.id).toBe('ai2');
    const next = pickItem({ ...base, day: '2026-09-27', done: new Set(['ai1', 'ai2']) });
    expect(['a1', 'a2']).toContain(next?.id);
  });

  it('Band-Rückfall: kleinster Abstand, dann null bei Erschöpfung', () => {
    const only = pickItem({ ...base, day: '2026-09-27', db: [mk('ai3', 'B1', 'work')], legacy: [] });
    expect(only?.id).toBe('ai3');
    expect(pickItem({ ...base, day: '2026-09-27', done: new Set(['ai1', 'ai2', 'ai3', 'a1', 'a2']) })).toBeNull();
  });

  it('verschiedene Tage verteilen die Wahl (nicht immer dasselbe)', () => {
    const many = Array.from({ length: 8 }, (_, i) => mk(`x${i}`, 'B2+', 'work'));
    const seen = new Set(Array.from({ length: 30 }, (_, d) => pickItem({ ...base, db: many, day: `2026-10-${String(d + 1).padStart(2, '0')}` })?.id));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('Schreibaufgabe: ungenutzte zuerst, sonst die am längsten nicht genutzte', () => {
    const usedAt = new Map(LEGACY_PROMPTS.map((p, i) => [p.id, 1000 + i] as const));
    usedAt.delete('w5');
    expect(pickPrompt({ day: '2026-09-27', prompts: LEGACY_PROMPTS, usedAt, target: 'B2+', domain: 'work' })?.id).toBe('w5');
    const all = new Map(LEGACY_PROMPTS.map((p, i) => [p.id, 1000 + i] as const));
    expect(pickPrompt({ day: '2026-09-27', prompts: LEGACY_PROMPTS, usedAt: all, target: 'B2+', domain: 'work' })?.id).toBe(LEGACY_PROMPTS[0]?.id);
  });
});

describe('Fragen (Plan §4.1, §4.4)', () => {
  it('Startbestand: alle Fragen lesbar, Lösung als Index', () => {
    for (const l of LEGACY_LISTENING) {
      expect(l.questions, l.id).toHaveLength(4);
      for (const q of l.questions) expect(q.options[q.answer]).toBeTruthy();
    }
    const raw = passages.listen[0]?.questions[0];
    const q = normalizeLegacyQuestion(raw, 'k');
    expect(q?.options[q.answer]).toBe(raw?.answer);
    expect(normalizeLegacyQuestion({ q: 'x?', options: ['a', 'b'], answer: 'c' }, 'k')).toBeNull();
    expect(normalizeLegacyQuestion({ q: 'x?', options: ['a', 'a'], answer: 'a' }, 'k')).toBeNull();
    expect(normalizeQuestions('kaputt', 'p')).toEqual([]);
  });

  it('Beiträge: Oberflächensprache mit Rückfall, a als Index', () => {
    const raw = feedSeed[0]?.items[0]?.questions?.[0];
    const de = normalizeFeedQuestion(raw, 'k', 'de');
    const en = normalizeFeedQuestion(raw, 'k', 'en');
    expect(de?.qLang).toBe('de');
    expect(en?.qLang).toBe('en');
    expect(en?.options[en.answer]).toBe(raw?.opts_en[0]);
    expect(normalizeFeedQuestion({ q_en: 'Why?', opts_en: ['a', 'b'], a: 5 }, 'k', 'de')).toBeNull();
    expect(normalizeFeedQuestion({ q_en: 'Why?', opts_en: ['a', 'b'], a: 1 }, 'k', 'de')?.qLang).toBe('en');
  });

  it('Mischen: Lösung wandert mit, keine Häufung an Position 0', () => {
    const q: Question = { key: 'q', q: 'Q?', qLang: 'en', options: ['right', 'w1', 'w2', 'w3'], answer: 0, type: 'detail', explain: {} };
    const pos = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const s = shuffleOptions({ ...q, key: `q${i}` }, 'seed');
      expect(s.options[s.answer]).toBe('right');
      expect(gradeChoice(s, s.answer)).toBe(true);
      pos[s.answer] = (pos[s.answer] ?? 0) + 1;
    }
    for (const n of pos) expect(n).toBeGreaterThan(60);
    expect(shuffleOptions(q, 'a')).toEqual(shuffleOptions(q, 'a'));
  });
});

describe('Beleg im Text (Plan F15)', () => {
  it('für jede Frage des Startbestands und von feed-seed.json wird ein Belegsatz gefunden', () => {
    const missing: string[] = [];
    for (const l of LEGACY_LISTENING) for (const q of l.questions) if (!evidenceSentence(l.text, q.options[q.answer] ?? '', q.q)) missing.push(`${l.id}: ${q.q}`);
    for (const f of feedSeed)
      for (const it of f.items)
        for (const [i, raw] of (it.questions ?? []).entries()) {
          const q = normalizeFeedQuestion(raw, `${it.id}#${i}`, 'en');
          if (q && !evidenceSentence(it.gist, q.options[q.answer] ?? '', q.q)) missing.push(`${it.id}: ${q.q}`);
        }
    for (const a of LEGACY_ARTICLES) for (const q of articleQuestions(a, LEGACY_ARTICLES)) if (!evidenceSentence(a.text, q.options[q.answer] ?? '', q.q)) missing.push(`${a.id}: ${q.options[q.answer]}`);
    // Einzige Ausnahme in den Daten: eine Wortschatzfrage zu „ill-advised", das in der Zusammenfassung
    // gar nicht vorkommt. Dann erscheint nur die Erklärung (kein erfundener Beleg).
    expect(missing).toEqual(['ai-safety-2609: What does “ill-advised” mean?']);
  });

  it('der Beleg ist ein Satz des Texts mit passenden Offsets', () => {
    const l = LEGACY_LISTENING[0];
    const q = l?.questions[1];
    const e = l && q ? evidenceSentence(l.text, q.options[q.answer] ?? '', q.q) : null;
    expect(e?.text).toContain('training course');
    expect(l?.text.slice(e?.start, e?.end)).toBe(e?.text);
  });
});

describe('Kernaussage-Fragen ohne KI (Plan F16)', () => {
  it('vier verschiedene Optionen, Ablenker nie aus demselben Artikel', () => {
    for (const a of LEGACY_ARTICLES) {
      const qs = keypointQuestions(a, LEGACY_ARTICLES);
      expect(qs.length, a.id).toBe(3);
      for (const q of qs) {
        expect(q.q).toBe(KEYPOINT_QUESTION);
        expect(new Set(q.options).size).toBe(4);
        expect(a.keypoints).toContain(q.options[q.answer]);
        for (const [i, o] of q.options.entries()) if (i !== q.answer) expect(a.keypoints).not.toContain(o);
      }
    }
  });

  it('ohne eigene Kernaussagen gibt es keine Fragen', () => {
    expect(keypointQuestions({ id: 'x', keypoints: [] }, LEGACY_ARTICLES)).toEqual([]);
  });
});

describe('Wendungen im eigenen Text (Plan §4.3/§4.4)', () => {
  it('Grundform, „…"-Platzhalter, „to", Groß/klein', () => {
    expect(chunkParts("I'm writing to let you know that…")).toEqual(["I'm writing to let you know that"]);
    expect(chunkParts('to raise interest rates')).toEqual(['raise interest rates']);
    expect(chunkParts('Due to …, we …')).toEqual(['Due to', 'we']);
    expect(usesChunk('The Fed RAISED interest rates again.', 'to raise interest rates')).toBe(true);
    expect(usesChunk('They raise the rates.', 'to raise interest rates')).toBe(false);
    expect(usesChunk('Due to the delay, we will start later.', 'Due to …, we …')).toBe(true);
    expect(usedChunks('Keep me posted on the plan.', ["I'll keep you posted on…", 'posted on'])).toEqual([false, true]);
  });

  it('Satzsuche für den Ursprungssatz', () => {
    const text = 'The Fed raised rates. It wants price stability first. Markets reacted nervously.';
    expect(sentenceWith(text, 'price stability')).toBe('It wants price stability first.');
    expect(sentenceWith(text, 'forward guidance')).toBeNull();
  });
});

describe('Fehlerstellen und US-Hinweise (Plan §5, F11, R7)', () => {
  it('Treffer trotz typografischer Anführungszeichen und Leerraum; fehlende Stellen → null', () => {
    const text = 'We don’t  have the “final” numbers yet.';
    const hit = locateError("don't have the \"final\"", text);
    expect(hit && text.slice(hit[0], hit[1])).toBe('don’t  have the “final”');
    expect(locateError('completely missing', text)).toBeNull();
    expect(locateError('WE DON’T', text)).toEqual([0, 8]);
  });

  it('keine doppelten Markierungen an derselben Stelle', () => {
    const spans = locateAll(['the', 'the', 'the'], 'the cat and the dog');
    expect(spans[0]).toEqual([0, 3]);
    expect(spans[1]).toEqual([12, 15]);
    expect(spans[2]).toBeNull();
  });

  it('summarise → summarize wird Hinweis, zählt nicht und landet nicht in den Fehlern', () => {
    expect(isUkToUs('summarise', 'summarize')).toBe(true);
    expect(isUkToUs('colour', 'color')).toBe(true);
    expect(isUkToUs('lorry', 'truck')).toBe(true);
    expect(isUkToUs('depend of', 'depend on')).toBe(false);
    const { errors, usHints } = splitUkHints([
      { orig: 'summarise', fix: 'summarize' },
      { orig: 'depend of', fix: 'depend on' },
      { orig: 'Summarise', fix: 'summarize' },
    ]);
    expect(errors).toEqual([{ orig: 'depend of', fix: 'depend on' }]);
    expect(usHints).toEqual([{ orig: 'summarise', us: 'summarize' }]);
  });

  it('Nachbearbeitung einer Korrektur: Stellen, Hinweise, Doppelte raus, unbekannte Kategorie → other', () => {
    const text = 'I will summarise it. It depends of you. It depends of you.';
    const r = processReview(
      {
        cefr: 'B2',
        scores: { task: 4, grammar: 3, vocabulary: 4, coherence: 4, register: 3 },
        summary: 's',
        strengths: [],
        improved: 'x',
        upgrades: [],
        phrases: [],
        next: 'n',
        errors: [
          { orig: 'summarise', fix: 'summarize', cat: 'spelling', topic: null, sev: 'minor', why: 'w' },
          { orig: 'depends of', fix: 'depends on', cat: 'collocation', topic: null, sev: 'minor', why: 'w' },
          { orig: 'depends of', fix: 'depends on', cat: 'collocation', topic: null, sev: 'minor', why: 'w' },
          { orig: 'nowhere', fix: 'here', cat: 'weird', topic: null, sev: 'major', why: 'w' },
        ],
      },
      text,
    );
    expect(r.usHints).toEqual([{ orig: 'summarise', us: 'summarize' }]);
    expect(r.errors.map((e) => [e.orig, e.cat, e.span !== null])).toEqual([
      ['depends of', 'collocation', true],
      ['nowhere', 'other', false],
    ]);
  });
});

describe('Beide Formen von writing/* (Plan §3.7)', () => {
  it('Aufgabe und Lektion ergeben dieselbe Anzeige', () => {
    const seed = loadSeed();
    const task = Object.entries(seed).find(([p]) => p.startsWith('writing/w'));
    const lesson = Object.entries(seed).find(([p]) => p.startsWith('writing/lesson-'));
    const a = normalizeWriting(task?.[0].slice(8) ?? '', task?.[1] ?? {});
    const b = normalizeWriting(lesson?.[0].slice(8) ?? '', lesson?.[1] ?? {});
    expect(a.kind).toBe('task');
    expect(b.kind).toBe('lesson');
    expect(b.lesson).toBe('l05');
    expect(a.res?.errors[0]).toMatchObject({ orig: 'has problems with the chips', fix: 'is facing chip shortages', cat: 'vocabulary' });
    expect(b.res?.errors[0]).toMatchObject({ orig: 'save costs for servers', fix: 'save on server costs', cat: 'collocation' });
    expect(b.t).toBeGreaterThan(0);
    expect(a.res?.lang).toBeNull();
    expect(normalizeWriting('w1', { text: 'Two words', res: 'kaputt' }).res).toBeNull();
  });
});

describe('Texte zählen', () => {
  it('Wörter, Sätze mit Offsets, Absätze, Lesezeit', () => {
    expect(wordCount("It's a well-known e-invoicing rule, isn't it?")).toBe(7);
    const text = 'The rate is 3.5 percent. The U.S. market reacted!\n\nNew paragraph here: yes.';
    const s = sentenceSplit(text);
    expect(s.map((x) => x.text)).toEqual(['The rate is 3.5 percent.', 'The U.S. market reacted!', 'New paragraph here:', 'yes.']);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
    expect(paragraphs(text)).toHaveLength(2);
    expect(readingMinutes('word '.repeat(600))).toBe(4);
    expect(readingMinutes('')).toBe(1);
  });
});
