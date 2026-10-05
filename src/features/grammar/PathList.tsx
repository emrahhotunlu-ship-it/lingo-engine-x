import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { dueErrors } from '../../domain/grammar/errors';
import { lernweg, pathTopics, topicState, type TopicState } from '../../domain/grammar/path';
import { useT, type MessageKey } from '../../i18n';
import { Dots, topicName } from './topicUi';

// Grammatik-Pfad als Liste (Gesamtkonzept 3.4): alle Themen in Lehrreihenfolge B2 → C1, je Thema
// fünf Punkte (Lernweg ①–⑤) und der Zustand Neu · Lernt · Sicher · Fest. Nichts ist gesperrt.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

export const STATE_KEYS: Record<TopicState, MessageKey> = {
  new: 'nbLernenStateNew',
  learning: 'nbLernenStateLearning',
  safe: 'nbLernenStateSafe',
  firm: 'nbLernenStateFirm',
};

export function PathList({ onOpen, highlight = null }: { onOpen: (topic: string) => void; highlight?: string | null }) {
  const { t, tn, lang } = useT();
  const now = useClock((s) => s.now);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const due = useMemo(() => dueErrors(docs, now), [docs, now]);
  const rows = useMemo(
    () =>
      pathTopics().map((id, i) => {
        const doc = docs.get(id);
        return { id, n: i + 1, state: topicState(id, doc, now), points: lernweg(id, doc, now).done.filter(Boolean).length };
      }),
    [docs, now],
  );
  return (
    <ol className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" aria-label={t('grTopics')} data-testid="grammar-path">
      {rows.map((r) => {
        const nDue = due.filter((d) => d.topic === r.id).length;
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              data-testid="topic"
              data-topic={r.id}
              data-state={r.state}
              data-points={r.points}
              aria-current={highlight === r.id ? 'step' : undefined}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-strong"
            >
              <span className="lx-tnum w-6 flex-none text-sm text-subtle" aria-hidden="true">
                {r.n}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{topicName(r.id, lang)}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <Dots n={r.points} />
                  <span className="whitespace-nowrap">{t(STATE_KEYS[r.state])}</span>
                  {highlight === r.id && <span className="whitespace-nowrap text-accent-text">· {t('nbLernenPathNext')}</span>}
                </span>
              </span>
              {nDue > 0 && <span className="flex-none rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-text">{tn('grDueBadge', nDue)}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
