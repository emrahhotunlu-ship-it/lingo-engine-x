import { describe, expect, it } from 'vitest';
import { comboBlocked, pickPairs, PPC_TOPIC } from '../../src/domain/apply/combo';
import { comboFrames } from '../../src/content/apply/frames';
import { comboCheck, comboContextProblem, COMBO_CHECK_EXAMPLE } from '../../src/prompts/comboCheck';
import { comboCheckReply } from '../../src/platform/dev/canned/comboCheck';
import { TOPICS } from '../../src/domain/content';

const WORDS = [
  { word: 'deadline', lapses: 0, stage: 3 },
  { word: 'invoice', lapses: 4, stage: 2 },
  { word: 'budget', lapses: 2, stage: 3 },
  { word: 'merger', lapses: 0, stage: 4 },
];

describe('Eigener Satz: Paare und Prüfvorlage', () => {
  it('schwächste Wörter zuerst, Themen mit Fehlern zuerst, nur Themen mit Kurzregel, fest je Tag', () => {
    const withRule = TOPICS.filter((t) => t.rule?.trim());
    const errTopic = withRule[3]!.id;
    const a = pickPairs(WORDS, TOPICS, [errTopic], '2026-10-04');
    expect(a.map((p) => p.word)).toEqual(['invoice', 'budget', 'deadline']);
    expect(a[0]!.topicId).toBe(errTopic);
    expect(new Set(a.map((p) => p.topicId)).size).toBe(3);
    expect(pickPairs(WORDS, TOPICS, [errTopic], '2026-10-04')).toEqual(a);
    expect(pickPairs([], TOPICS, [], 'x')).toEqual([]);
  });
  it('Vorlage: Kopfzeile, Beispiel und Test-Antwort bestehen das Schema; Korrektur Pflicht bei falschem Satz', () => {
    const v = { word: 'deadline', topic: 'Present perfect', rule: 'have + 3. Form', sentence: 'We have been working on the deadline.', uiLang: 'de' as const };
    expect(comboCheck.build(v).split('\n')[0]).toBe('[combo-check@4]');
    const s = comboCheck.schema(v);
    expect(s.safeParse({ ruleOk: false, correct: false, fixed: 'We have been working on it.', why: 'Hier braucht die Regel eine andere Form.' }).success).toBe(true);
    // Leere Korrektur bei falschem Satz: erlaubt, aber als „nicht sicher geprüft“ markiert (Auswertung 15.10.2026), nie als richtige Fassung.
    expect(s.parse({ ruleOk: false, correct: false, fixed: '', why: 'Hier braucht die Regel eine andere Form.' })).toMatchObject({ fixed: '', fixedUnsure: true });
    // Eine korrigierte Fassung mit eindeutigem Fehler besteht nicht (Selbstprüfung).
    expect(s.safeParse({ ruleOk: false, correct: false, fixed: 'We discussed about the deadline.', why: 'Hier braucht die Regel eine andere Form.' }).success).toBe(false);
    expect(s.safeParse({ ruleOk: 'yes', correct: 'true', why: 'Die Regel ist richtig angewendet, sehr gut.' }).success).toBe(true);
    expect(COMBO_CHECK_EXAMPLE).toContain('ruleOk');
    const out = s.parse(JSON.parse(comboCheckReply(comboCheck.build({ ...v, sentence: 'zzno sentence about the deadline' }))));
    expect(out.correct).toBe(false);
    expect(out.fixed).toContain('deadline');
  });

  it('Rahmen: jedes Thema mit Kurzregel hat 2–3 Rahmen mit Situation (de/en) und Satzanfang; jedes Paar bekommt einen, fest je Tag', () => {
    const frames = comboFrames();
    for (const t of TOPICS.filter((x) => x.rule?.trim())) {
      const list = frames[t.id] ?? [];
      expect(list.length, t.id).toBeGreaterThanOrEqual(2);
      expect(list.length, t.id).toBeLessThanOrEqual(3);
      for (const f of list) {
        expect(f.starter, t.id).toMatch(/…$/);
        expect(/[äöüß]/i.test(f.en) || /[äöüß]/i.test(f.starter), `${t.id}: ${f.en}`).toBe(false);
      }
    }
    const a = pickPairs(WORDS, TOPICS, [], '2026-11-05');
    for (const p of a) {
      expect(p.starter).toBeTruthy();
      expect(frames[p.topicId]?.some((f) => f.starter === p.starter && f.de === p.situation?.de)).toBe(true);
    }
    expect(pickPairs(WORDS, TOPICS, [], '2026-11-05')).toEqual(a);
    // Ohne Rahmen: Paar ohne Situation und Satzanfang (ältere Aufrufer, fehlende Datei).
    expect(pickPairs(WORDS, TOPICS, [], '2026-11-05', 3, [], {})[0]).not.toHaveProperty('starter');
  });
  it('Sperrliste: Zustandsverben nie mit Present Perfect Continuous, dann das nächste Thema', () => {
    expect(comboBlocked('know', PPC_TOPIC)).toBe(true);
    expect(comboBlocked('to belong', PPC_TOPIC)).toBe(true);
    expect(comboBlocked('know', 'past-perfect')).toBe(false);
    expect(comboBlocked('deadline', PPC_TOPIC)).toBe(false);
    const words = [{ word: 'know', lapses: 9, stage: 1 }, ...WORDS];
    const pairs = pickPairs(words, TOPICS, [], '2026-11-05', 3, [PPC_TOPIC, 'past-perfect']);
    expect(pairs[0]).toMatchObject({ word: 'know', topicId: 'past-perfect' });
    // Das übersprungene Thema geht an das nächste Wort.
    expect(pairs[1]).toMatchObject({ word: 'invoice', topicId: PPC_TOPIC });
  });
  it('combo-check@4: Situation und Satzanfang im Prompt; Korrektur ohne Bezugspunkt ist ein Schemafehler, beim Neuversuch „nicht sicher geprüft“', () => {
    const v = { word: 'lack', topic: 'Past Perfect', rule: 'had + past participle for the earlier of two past events.', sentence: 'They have lacked on quality after migration.', uiLang: 'de' as const, topicId: 'past-perfect', situation: 'You explain what things looked like before the move.', starter: 'By the time we migrated their data, …' };
    const p = comboCheck.build(v);
    expect(p).toContain('Situation: You explain');
    expect(p).toContain('Required sentence start: By the time we migrated their data, …');
    expect(p).toContain('State verbs (know, own, belong, consist, seem) normally do not take a continuous form; polite "will be needing" and "I\'m hoping" are fine.');
    expect(p).toContain('or a present result it explains');
    const why = 'Hier fehlt der Bezugspunkt in der Vergangenheit.';
    expect(comboCheck.schema(v).safeParse({ ruleOk: false, correct: false, fixed: 'They had lacked quality.', why }).success).toBe(false);
    expect(comboCheck.schema(v).safeParse({ ruleOk: false, correct: false, fixed: 'By the time we migrated their data, they had lacked quality for years.', why }).success).toBe(true);
    expect(comboCheck.lenient!(v).parse({ ruleOk: false, correct: false, fixed: 'They had lacked quality.', why })).toMatchObject({ fixed: '', fixedUnsure: true });
    expect(comboContextProblem('pres-perf-cont', 'We have been working on the rollout.')).toMatch(/for, since/);
    expect(comboContextProblem('pres-perf-cont', 'We have been working on the rollout since March.')).toBeNull();
    // @4: ein Ergebnis jetzt, das die Dauer erklärt, reicht als Bezug.
    expect(comboContextProblem('pres-perf-cont', "I've been calling him, but he doesn't answer.")).toBeNull();
    expect(comboContextProblem('pres-perf-cont', 'We have been testing it all morning.')).toBeNull();
    expect(comboContextProblem('passive', 'They had lacked quality.')).toBeNull();
    // Ohne Rahmen keine Zeilen für Situation und Satzanfang.
    expect(comboCheck.build({ ...v, situation: undefined, starter: undefined })).not.toContain('Required sentence start');
  });
});
