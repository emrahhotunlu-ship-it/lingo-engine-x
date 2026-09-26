import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import type { Grade } from '../../src/domain/srs/types';

// Erfundene Bausteine für die Phase-2-Tests.

export function task(over: Partial<GrammarTask> = {}): GrammarTask {
  const prompt = over.prompt ?? 'By next June, I ___ (finish) my course.';
  return {
    key: legacyTaskKey(prompt),
    topic: 'future-perf-cont',
    type: 'gap',
    prompt,
    answer: 'will have finished',
    accepted: [],
    options: null,
    hint: '(finish)',
    expl: { de: 'By + Zeitpunkt → Future Perfect.', en: 'By + point in time → future perfect.' },
    src: 'seed',
    ref: null,
    errorT: null,
    ...over,
  };
}

export function answer(over: Partial<GrammarAnswer> & { t: number }, t0: Partial<GrammarTask> = {}): GrammarAnswer {
  const verdict = over.verdict ?? 'correct';
  const grade: Grade = over.grade ?? (verdict === 'wrong' ? 1 : verdict === 'near' ? 2 : 3);
  return {
    kind: 'g',
    day: '2026-09-27',
    lang: 'de',
    ctx: 'xtra',
    task: task(t0),
    given: 'will have finished',
    dontKnow: false,
    verdict,
    grade,
    ms: 4000,
    help: { level: 0 },
    judged: 'local',
    ...over,
  };
}
