import { describe, expect, it } from 'vitest';
import { acceptLesson, needsSources } from '../../../src/modules/read/domain/lesson';
import type { Lesson } from '../../../src/modules/read/domain/lesson';
import { seedLesson } from './fixtures';

// Prüftore einer Kurslektion der Routine (Paket L8, docs/umbau/lesen-routine-kurse.md): eine gute und je eine kaputte Fassung.

const ok = (raw: unknown, course: 'k1' | 'k5' = 'k1', n = 1): Lesson => {
  const r = acceptLesson(raw, { course, n });
  if (!r.ok) throw new Error(r.reason);
  return r.lesson;
};
const bad = (raw: unknown, course: 'k1' | 'k5' = 'k1', n = 1): string => {
  const r = acceptLesson(raw, { course, n });
  if (r.ok) throw new Error('should be rejected');
  return r.reason;
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('acceptLesson: die Beispiel-Lektionen bestehen', () => {
  it('Lektion 1 und 2 von K1 (Seed) bestehen alle Tore', () => {
    for (const n of [1, 2] as const) {
      const l = ok(seedLesson(n), 'k1', n);
      expect(l.id).toBe(`c-k1-0${n}`);
      expect(l.phrases.length).toBeGreaterThanOrEqual(4);
      expect(l.check).toHaveLength(3);
      expect(l.words).toBeGreaterThanOrEqual(300);
      expect(l.sources[0]?.url).toMatch(/^https:\/\//);
    }
  });
});

describe('acceptLesson: Kopf und Zuordnung', () => {
  it('kein Objekt, fremder Kurs, falsche Nummer, falsches by', () => {
    expect(bad(null)).toMatch(/not an object/);
    expect(bad(seedLesson(1), 'k5', 1)).toMatch(/course does not match/);
    expect(bad(seedLesson(1), 'k1', 2)).toMatch(/n does not match/);
    expect(bad({ ...seedLesson(1), by: 'user' })).toMatch(/by must be/);
    expect(bad(seedLesson(1), 'k1', 11)).toMatch(/outside the course/);
  });
});

describe('acceptLesson: Text (dieselben Tore wie Tagesartikel)', () => {
  it('zu kurz, vertauschte Sprache, verklebt und britisch fallen durch', () => {
    const short = clone(seedLesson(1)) as { paras: unknown[][] };
    short.paras = short.paras.slice(0, 2);
    expect(bad(short)).toMatch(/form|length/);
    const swapped = clone(seedLesson(1)) as { paras: Array<Array<{ e: string; d: string }>> };
    for (const p of swapped.paras) for (const s of p) [s.e, s.d] = [s.d, s.e];
    expect(bad(swapped)).toMatch(/language/);
    const glued = clone(seedLesson(1)) as { paras: Array<Array<{ e: string; d: string }>> };
    glued.paras[0]![1]!.e = 'Claude Code works differently.It is new.';
    expect(bad(glued)).toMatch(/glued|alignment/);
    const british = clone(seedLesson(1)) as { paras: Array<Array<{ e: string; d: string }>> };
    british.paras[1]![3]!.e = 'Think of it as a capable colleague who works on your colour scheme, not as a search engine for code.';
    expect(bad(british)).toMatch(/American spelling/);
  });
});

describe('acceptLesson: Wendungen, Fragen, Ziel', () => {
  it('weniger als vier gültige Wendungen oder zu wenige mehrteilige fallen durch', () => {
    const few = clone(seedLesson(1)) as { phrases: unknown[] };
    few.phrases = few.phrases.slice(0, 3);
    expect(bad(few)).toMatch(/key phrases/);
    const single = clone(seedLesson(1)) as { phrases: Array<{ w: string; de: string; i: number[] }> };
    single.phrases = [
      { w: 'colleague', de: 'Kollege', i: [1, 3] },
      { w: 'safeguard', de: 'Absicherung', i: [3, 2] },
      { w: 'repository', de: 'Repository', i: [2, 1] },
      { w: 'chores', de: 'Routinearbeiten', i: [2, 3] },
      { w: 'symptoms', de: 'Symptome', i: [2, 2] },
    ];
    expect(bad(single)).toMatch(/multi-word/);
  });

  it('eine Wendung, die nicht im Text steht, wird verworfen und unterschreitet das Minimum', () => {
    const missing = clone(seedLesson(1)) as { phrases: Array<{ w: string }> };
    missing.phrases[0]!.w = 'drive the roadmap';
    missing.phrases[1]!.w = 'seize the day';
    expect(bad(missing)).toMatch(/key phrases/);
  });

  it('genau drei Prüffragen', () => {
    const two = clone(seedLesson(1)) as { check: unknown[] };
    two.check = two.check.slice(0, 2);
    expect(bad(two)).toMatch(/exactly 3/);
    const broken = clone(seedLesson(1)) as { check: Array<{ o: string[] }> };
    broken.check[1]!.o = ['same', 'same', 'other'];
    expect(bad(broken)).toMatch(/exactly 3/);
  });

  it('Ziel-Zeile: fehlt, englisch oder mit Markup', () => {
    expect(bad({ ...seedLesson(1), lessonGoal: '' })).toMatch(/lessonGoal/);
    expect(bad({ ...seedLesson(1), lessonGoal: 'You can explain what Claude Code is and where its limits are.' })).toMatch(/lessonGoal must be German/);
    expect(bad({ ...seedLesson(1), lessonGoal: 'Du kannst **erklären**, was Claude Code ist und kann.' })).toMatch(/lessonGoal/);
  });
});

describe('acceptLesson: Sprachtipp', () => {
  it('falsch und richtig müssen verschieden sein, Grund deutsch', () => {
    const same = clone(seedLesson(1)) as { tip: { wrong: string; right: string; why: string } };
    same.tip.wrong = same.tip.right;
    expect(bad(same)).toMatch(/must differ/);
    const en = clone(seedLesson(1)) as { tip: { wrong: string; right: string; why: string } };
    en.tip.why = 'In German you use the present tense here, but English needs the present perfect for this idea.';
    expect(bad(en)).toMatch(/tip.why must be German/);
    const none = clone(seedLesson(1)) as { tip?: unknown };
    delete none.tip;
    expect(bad(none)).toMatch(/tip/);
  });
});

describe('acceptLesson: Anwenden', () => {
  it('Zielwendungen müssen Schlüsselwendungen sein und in der Musterlösung vorkommen', () => {
    const foreign = clone(seedLesson(1)) as { apply: { targets: string[] } };
    foreign.apply.targets = ['stay in control', 'seize the day'];
    expect(bad(foreign)).toMatch(/not one of the key phrases/);
    const absent = clone(seedLesson(1)) as { apply: { model: string[] } };
    absent.apply.model = ['Claude Code works inside my project and I decide what it changes.', 'After each change it can run the tests, so I see quickly whether something broke.'];
    expect(bad(absent)).toMatch(/does not use the target phrase "stay in control"/);
  });

  it('Musterlösung: zwei bis sechs englische Sätze; Lage deutsch', () => {
    const one = clone(seedLesson(1)) as { apply: { model: string[] } };
    one.apply.model = one.apply.model.slice(0, 1);
    expect(bad(one)).toMatch(/2 to 6/);
    expect(bad({ ...seedLesson(1), apply: { ...(seedLesson(1).apply as object), situation: 'Your colleague asks what Claude Code is. Explain it in two sentences.' } })).toMatch(/apply.situation must be German/);
  });

  it('Zielwendungen: 2 bis 4, verschieden', () => {
    const one = clone(seedLesson(1)) as { apply: { targets: string[] } };
    one.apply.targets = ['stay in control'];
    expect(bad(one)).toMatch(/2 to 4/);
    const dup = clone(seedLesson(1)) as { apply: { targets: string[] } };
    dup.apply.targets = ['stay in control', 'Stay in Control'];
    expect(bad(dup)).toMatch(/at least 2 different/);
  });
});

describe('acceptLesson: Quellen und Stand', () => {
  it('Claude-Code-Lektionen brauchen Quellen, Stand und eine offizielle Quelle', () => {
    const none = clone(seedLesson(1)) as { sources?: unknown };
    delete none.sources;
    expect(bad(none)).toMatch(/sources are required/);
    const noAsOf = clone(seedLesson(1)) as { asOf?: unknown };
    delete noAsOf.asOf;
    expect(bad(noAsOf)).toMatch(/asOf/);
    const other = clone(seedLesson(1)) as { sources: Array<{ title: string; url: string }> };
    other.sources = [{ title: 'A blog', url: 'https://example.com/post' }];
    expect(bad(other)).toMatch(/official Anthropic documentation/);
    const insecure = clone(seedLesson(1)) as { sources: Array<{ title: string; url: string }> };
    insecure.sources = [{ title: 'Docs', url: 'http://docs.claude.com/x' }];
    expect(bad(insecure)).toMatch(/https/);
  });

  it('needsSources: Claude Code immer; andere Kurse bei Recht und Zahlen', () => {
    expect(needsSources('k1', 'A plain sentence.')).toBe(true);
    expect(needsSources('k5', 'Models help teams write drafts.')).toBe(false);
    expect(needsSources('k5', 'The EU AI Act sorts systems by risk.')).toBe(true);
    expect(needsSources('k5', 'Costs fell by 30 % in the pilot.')).toBe(true);
    expect(needsSources('k5', 'Roughly two million documents were scanned.')).toBe(true);
    expect(needsSources('k5', 'The GDPR applies to personal data.')).toBe(true);
  });

  it('K5 ohne Zahlen und Recht braucht keine Quelle; mit EU AI Act ohne Quelle fällt durch', () => {
    const k5 = clone(seedLesson(1)) as { course: string; n: number; title: string; sources?: unknown; asOf?: unknown; paras: Array<Array<{ e: string; d: string }>> };
    k5.course = 'k5';
    delete k5.sources;
    delete k5.asOf;
    ok(k5, 'k5', 1);
    k5.paras[0]![1]!.e = 'The EU AI Act classifies systems by risk.';
    k5.paras[0]![1]!.d = 'Der EU AI Act ordnet Systeme nach Risiko ein.';
    expect(bad(k5, 'k5', 1)).toMatch(/sources are required/);
  });
});
