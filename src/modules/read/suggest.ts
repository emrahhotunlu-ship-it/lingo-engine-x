import { askJson, isAiFailure } from './shared';
import type { AiMessageKey, AiPhase } from './shared';
import { readTopics } from './prompt';
import { sanitizeCustomTopic } from './domain/topics';

// „Claude schlägt vor“ (Plan §3.3): ein kleiner `quick`-Aufruf, nur auf Tipp, nie automatisch wiederholt.

export type SuggestResult = { ok: true; topics: string[] } | { ok: false; cancelled: boolean; key: AiMessageKey | null };

/** Sechs Themenvorschläge; `active` = schon gewählte Themen (nicht wiederholen). */
export async function suggestTopics(active: readonly string[], signal: AbortSignal, onPhase?: (p: AiPhase) => void): Promise<SuggestResult> {
  try {
    const res = await askJson({ template: readTopics, vars: { active }, signal, priority: 'user', ...(onPhase ? { onPhase } : {}) });
    const topics = res.data.topics.map((t) => sanitizeCustomTopic(t)).filter((t): t is string => t !== null);
    return { ok: true, topics: [...new Set(topics)].slice(0, 6) };
  } catch (err) {
    if (isAiFailure(err)) return { ok: false, cancelled: err.kind === 'cancelled', key: err.messageKey };
    return { ok: false, cancelled: false, key: 'aiFailed' };
  }
}
