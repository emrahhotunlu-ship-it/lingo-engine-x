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
    <div className="flex flex-col" data-testid="grammar-path" data-chapters={path.chapters.length}>
      {path.chapters.map((c, ci) => {
        const here = ci === path.current;
        const open = toggled[c.id] ?? (wide || here);
        const first = path.chapters.slice(0, ci).reduce((sum, x) => sum + x.topics.length, 0) + 1;
        const complete = c.topics.length > 0 && c.safe >= c.topics.length;
        const last = ci === path.chapters.length - 1;
        return (
          <section key={c.id} className="relative pb-4 pl-[3.75rem]" data-testid="chapter" data-chapter={c.id} data-here={here ? 'true' : undefined} data-open={open ? 'true' : 'false'}>
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-[2.875rem] -bottom-0.5 left-[1.3125rem] w-0.5"
                style={complete ? { background: 'var(--lx-ok)' } : { background: 'repeating-linear-gradient(to bottom, var(--lx-line-strong) 0 4px, transparent 4px 8px)' }}
              />
            )}
            <StationNode n={ci + 1} complete={complete} here={here} safe={c.safe} total={c.topics.length} />
            <button
              type="button"
              onClick={() => setToggled((cur) => ({ ...cur, [c.id]: !open }))}
              aria-expanded={open}
              className="flex min-h-11 w-full items-start gap-3 py-0.5 text-left"
              data-testid="chapter-head"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="lx-t-answer tracking-tight">
                  {t('hxPathChapter', { n: ci + 1, name: lang === 'en' ? c.name.en : c.name.de })}
                  {here && (
                    <span className="dz-here ml-2 inline-flex h-[1.375rem] items-center rounded-full px-2.5 align-middle text-xs font-bold" style={{ background: 'var(--lx-btn-grammar)', color: '#fff' }} data-testid="chapter-here">
                      {t('hxPathHere')}
                    </span>
                  )}
                </span>
                <span className="lx-tnum text-sm text-muted">{t('hxPathSafe', { a: c.safe, b: c.topics.length })}</span>
              </span>
              {c.due > 0 && (
                <span className="flex-none rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-fg" data-testid="chapter-due" data-n={c.due}>
                  {tn('grDueBadge', c.due)}
                </span>
              )}
              <Icon name="arrowRight" size={16} className={`mt-1.5 flex-none text-subtle transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <ol className="mt-3 flex list-none flex-col gap-2 p-0" aria-label={t('grTopics')}>
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
                      className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-[0.875rem] border px-3.5 py-2 text-left transition-colors hover:bg-surface-strong ${highlight === r.id ? 'bg-surface-strong' : 'bg-surface-solid border-line'}`}
                      style={highlight === r.id ? { borderColor: 'var(--lx-ch-grammar)' } : undefined}
                    >
                      <span className="sr-only">{first + k}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-semibold">{topicName(r.id, lang)}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                          <Dots n={lernwegOf(r.id)} />
                          {r.patTotal > 0 && (
                            <span className="lx-tnum whitespace-nowrap" data-testid="topic-pats" data-safe={r.patSafe} data-total={r.patTotal}>
                              {t('hxPathPats', { a: r.patSafe, b: r.patTotal })}
                            </span>
                          )}
                          {highlight === r.id && <span className="whitespace-nowrap text-accent-text">· {t('nbLernenPathNext')}</span>}
                        </span>
                      </span>
                      <span className={`inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-bold ${STATE_TONE[r.state]}`}>{t(STATE_KEYS[r.state])}</span>
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

const STATE_TONE: Record<TopicState, string> = {
  new: 'bg-surface-strong text-fg',
  learning: 'bg-hint-soft text-hint-text',
  safe: 'bg-ok-soft text-ok-text',
  firm: 'bg-ok-soft text-ok-text',
};

/** Knoten der Station (Design LP2): geschafft = grüner Ring mit Haken, „Du bist hier“ = blauer Fortschrittsring, sonst gestrichelt mit Nummer. */
function StationNode({ n, complete, here, safe, total }: { n: number; complete: boolean; here: boolean; safe: number; total: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, safe / total) : 0;
  return (
    <svg className="absolute top-0 left-0 size-11" viewBox="0 0 44 44" aria-hidden="true" data-testid="station-node" data-state={complete ? 'done' : here ? 'here' : 'open'}>
      {complete ? (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-ok-soft)" stroke="var(--lx-ok)" strokeWidth="3" />
          <path d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="var(--lx-ok-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-bg)" stroke="var(--lx-line-strong)" strokeWidth="3" strokeDasharray={here ? undefined : '4 4'} />
          {here && <circle cx="22" cy="22" r={r} fill="none" stroke="var(--lx-ch-grammar)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * Math.max(frac, 0.12)} ${c}`} transform="rotate(-90 22 22)" />}
          <text x="22" y="27.5" textAnchor="middle" fill="var(--lx-fg)" fontSize="15" fontWeight="650">
            {n}
          </text>
        </>
      )}
    </svg>
  );
}
