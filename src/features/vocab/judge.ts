import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { typedForm } from '../../domain/chunks/situation';
import type { Exercise, Lang } from '../../domain/srs/types';
import { logWarn } from '../../platform/diagnostics';
import { wordJudge, type WordJudgeOut, type WordJudgeVars } from '../../prompts/wordJudge';

// KI-Urteil über eine getippte Antwort (docs/ki-paket-plan.md §3). Nur nach „Prüfen", nur wenn die
// feste Prüfung „falsch" sagt. Ohne KI, bei Drosselung oder Fehler: `null` – dann gilt die feste
// Prüfung wie bisher. Nie automatisch wiederholt (A6.3); derselbe Satz mit derselben Antwort kommt
// aus dem Zwischenspeicher von `sample` (24 h).

/** Abfragen, deren getippte Antwort Claude nachprüft (Diktat und Bausteine nicht: dort ist die Form vorgegeben). */
export const JUDGE_EX: ReadonlySet<Exercise['ex']> = new Set(['cloze_hint', 'cloze', 'type', 'speed', 'situation']);

export function judgeVars(e: Exercise, given: string, lang: Lang): WordJudgeVars {
  const card = e.card;
  const s = e.sentence;
  const gapped = s && e.ex !== 'type' && e.ex !== 'situation' ? s.sentence.slice(0, s.start) + '___' + s.sentence.slice(s.end) : '';
  const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
  return {
    target,
    pos: card.pos ?? '',
    meaning: (lang === 'de' ? card.de : card.def) ?? card.def ?? card.de ?? '',
    sentence: e.ex === 'situation' ? (e.situation?.situation ?? '') : gapped,
    expected: e.accepted[0] ?? target,
    given,
    task: e.ex === 'situation' ? 'situation' : gapped ? 'gap' : 'translate',
    uiLang: lang,
  };
}

export async function judgeAnswer(e: Exercise, given: string, lang: Lang, signal: AbortSignal): Promise<WordJudgeOut | null> {
  if (!given.trim()) return null;
  try {
    const r = await askJson({ template: wordJudge, vars: judgeVars(e, given, lang), signal });
    return r.data;
  } catch (err) {
    if (!isAiFailure(err) || (err.kind !== 'cancelled' && err.kind !== 'unavailable' && err.kind !== 'busy')) logWarn('trainer:judge', err, e.card.key);
    return null;
  }
}
