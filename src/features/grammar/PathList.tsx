import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { dueErrors } from '../../domain/grammar/errors';
import { lernweg, type TopicState } from '../../domain/grammar/path';
import { useT, type MessageKey } from '../../i18n';
import { useWide } from '../../platform/input';
import { Icon } from '../../ui/Icon';
import { chapterNodes } from './chapters';
import { Dots, topicName } from './topicUi';

// Grammatik-Lernweg in 7 Kapiteln (Lernplattform 2.0 §2.4): Am Handy ist nur das aktuelle Kapitel offen („Du bist hier“), am Laptop
// stehen alle offen. Jedes Thema zeigt Zustand und „Muster sicher x/y“; Fehlersätze stehen als EINE Zahl am Kapitelkopf. Nichts ist gesperrt.

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
  const today = useClock((s) => s.today);
  const wide = useWide();
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const dueByTopic = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dueErrors(docs, now)) m.set(d.topic, (m.get(d.topic) ?? 0) + 1);
    return m;
  }, [docs, now]);
  const path = useMemo(() => chapterNodes({ docs, nowMs: now, today, dueByTopic }), [docs, now, today, dueByTopic]);
  const lernwegOf = (id: string) => lernweg(id, docs.get(id), now).done.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-3" data-testid="grammar-path" data-chapters={path.chapters.length}>
      {path.chapters.map((c, ci) => {
        const here = ci === path.current;
        const open = toggled[c.id] ?? (wide || here);
        const first = path.chapters.slice(0, ci).reduce((sum, x) => sum + x.topics.length, 0) + 1;
        return (
          <section key={c.id} className="lx-glass overflow-hidden rounded-[var(--radius-card)]" data-testid="chapter" data-chapter={c.id} data-here={here ? 'true' : undefined} data-open={open ? 'true' : 'false'}>
            <button
              type="button"
              onClick={() => setToggled((cur) => ({ ...cur, [c.id]: !open }))}
              aria-expanded={open}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-strong"
              data-testid="chapter-head"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">{t('hxPathChapter', { n: ci + 1, name: lang === 'en' ? c.name.en : c.name.de })}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span className="lx-tnum whitespace-nowrap">{t('hxPathSafe', { a: c.safe, b: c.topics.length })}</span>
                  {here && <span className="whitespace-nowrap font-medium text-accent-text" data-testid="chapter-here">· {t('hxPathHere')}</span>}
                </span>
              </span>
              {c.due > 0 && (
                <span className="flex-none rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-fg" data-testid="chapter-due" data-n={c.due}>
                  {tn('grDueBadge', c.due)}
                </span>
              )}
              <Icon name="arrowRight" size={16} className={`flex-none text-subtle transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <ol className="flex flex-col divide-y divide-line border-t border-line" aria-label={t('grTopics')}>
                {c.topics.map((r, k) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(r.id)}
                      data-testid="topic"
                      data-topic={r.id}
                      data-state={r.state}
                      data-points={lernwegOf(r.id)}
                      aria-current={highlight === r.id ? 'step' : undefined}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-strong"
                    >
                      <span className="lx-tnum w-6 flex-none text-sm text-subtle" aria-hidden="true">
                        {first + k}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-medium">{topicName(r.id, lang)}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                          <Dots n={lernwegOf(r.id)} />
                          <span className="whitespace-nowrap">{t(STATE_KEYS[r.state])}</span>
                          {r.patTotal > 0 && (
                            <span className="lx-tnum whitespace-nowrap" data-testid="topic-pats" data-safe={r.patSafe} data-total={r.patTotal}>
                              · {t('hxPathPats', { a: r.patSafe, b: r.patTotal })}
                            </span>
                          )}
                          {highlight === r.id && <span className="whitespace-nowrap text-accent-text">· {t('nbLernenPathNext')}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
