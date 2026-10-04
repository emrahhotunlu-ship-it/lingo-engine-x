import { describe, expect, it } from 'vitest';
import { pickPairs } from '../../src/domain/apply/combo';
import { comboCheck, COMBO_CHECK_EXAMPLE } from '../../src/prompts/comboCheck';
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
    expect(comboCheck.build(v).split('\n')[0]).toBe('[combo-check@1]');
    const s = comboCheck.schema(v);
    expect(s.safeParse({ ruleOk: false, correct: false, fixed: 'We have been working on it.', why: 'Hier braucht die Regel eine andere Form.' }).success).toBe(true);
    expect(s.safeParse({ ruleOk: false, correct: false, fixed: '', why: 'Hier braucht die Regel eine andere Form.' }).success).toBe(false);
    expect(s.safeParse({ ruleOk: 'yes', correct: 'true', why: 'Die Regel ist richtig angewendet, sehr gut.' }).success).toBe(true);
    expect(COMBO_CHECK_EXAMPLE).toContain('ruleOk');
    const out = s.parse(JSON.parse(comboCheckReply(comboCheck.build({ ...v, sentence: 'zzno sentence about the deadline' }))));
    expect(out.correct).toBe(false);
    expect(out.fixed).toContain('deadline');
  });
});
