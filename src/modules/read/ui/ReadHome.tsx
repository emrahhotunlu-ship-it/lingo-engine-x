import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Eyebrow, HeroCard, Icon, IconButton, Row, RowList, Skeleton, AiRunPanel, useNav, useT } from '../sharedUi';
import type { MessageKey } from '../sharedUi';
import { TOPIC_KEYS } from '../schemas';
import type { IndexItem } from '../schemas';
import { entryState } from '../domain/view';
import type { RunFailure } from '../run';
import { PER_DAY_MAX } from '../domain/docs';
import { useReadHome } from './useReadHome';
import type { ReadHome } from './useReadHome';

// Bildschirm „Lesen“ (Reiter-Wurzel `read`, docs/umbau/lesen-plan.md §2.1): ein großer Knopf, die Artikel von heute,
// Themen, eine Wochenzeile, frühere Artikel. Keine doppelten Aussagen; „gelesen“ ist ein Zustand.

const TOPIC_LABEL: Record<string, MessageKey> = {
  bizdev: 'rdTopicBizdev',
  saas: 'rdTopicSaas',
  ai: 'rdTopicAi',
  economy: 'rdTopicEconomy',
  architecture: 'rdTopicArchitecture',
  management: 'rdTopicManagement',
  claudecode: 'rdTopicClaudecode',
  custom: 'rdTopicCustom',
};
const CHIP_KEYS = TOPIC_KEYS.filter((k) => k !== 'custom');

const STATE_LABEL: Record<'open' | 'started' | 'done', MessageKey> = { open: 'rdStateOpen', started: 'rdStateStarted', done: 'rdStateDone' };

const ROW = 'flex min-h-14 w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-b-0';

function Title() {
  const { t } = useT();
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center">
        <h1 className="min-w-0 text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-3xl" data-testid="read-title">
          {t('rdTitle')}
        </h1>
      </div>
      <p className="m-0 text-sm text-muted" data-testid="read-byline">
        {t('rdByClaude')}
      </p>
    </header>
  );
}

function ArticleRow({ e, onOpen }: { e: IndexItem; onOpen: () => void }) {
  const { t } = useT();
  const state = entryState(e);
  const topic = TOPIC_LABEL[e.topic ?? 'custom'] ?? 'rdTopicCustom';
  return (
    <li className="m-0 list-none">
      <button type="button" className={ROW} onClick={onOpen} data-testid="read-row" data-id={e.id} data-state={state} aria-label={t('rdOpenArticle', { title: e.title ?? '' })}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{e.title}</span>
          <span className="text-xs leading-snug text-muted">
            {t(topic)} · {t('rdMinWords', { min: e.mins ?? 1, n: e.words ?? 0 })}
          </span>
        </span>
        <span className={`flex flex-none items-center gap-1 text-xs font-medium ${state === 'done' ? 'text-ok-text' : 'text-subtle'}`} data-testid="read-state">
          {state === 'done' && <Icon name="check" size={16} />}
          {t(STATE_LABEL[state])}
        </span>
      </button>
    </li>
  );
}

function failureText(f: RunFailure): MessageKey {
  switch (f.type) {
    case 'device_busy':
      return 'rdErrBusy';
    case 'full':
      return 'rdErrFull';
    case 'save':
      return 'rdErrSave';
    case 'rate':
      return 'rdErrRate';
    case 'invalid':
      return 'rdErrInvalid';
    case 'ai':
      return f.key ?? 'aiFailed';
  }
}

function Outcome({ h }: { h: ReadHome }) {
  const { t } = useT();
  const o = h.outcome;
  if (!o) return null;
  const { result, failure } = o;
  if (!failure && !result.stopped) return null;
  return (
    <div className="flex flex-col gap-2" role={failure ? 'alert' : 'status'} data-testid="read-outcome" data-kind={failure ? failure.type : 'stopped'}>
      {failure && (
        <p className="m-0 text-sm text-danger-text" data-testid="read-error">
          {t(failureText(failure))}
        </p>
      )}
      {(result.stopped || (failure && result.saved > 0)) && (
        <p className="m-0 text-sm text-muted" data-testid="read-partial">
          {t(result.stopped ? 'rdStopped' : 'rdPartial', { n: result.saved, total: result.total })}
        </p>
      )}
      {failure && failure.type !== 'rate' && failure.type !== 'full' && h.aiOn && (
        <div>
          <Button icon="refresh" onClick={() => h.getArticles(failure.type === 'invalid')} data-testid="read-retry" data-ai="">
            {t('rdErrRetry')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Running({ h }: { h: ReadHome }) {
  const { t } = useT();
  const r = h.running;
  if (!r) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="read-progress" data-n={r.n} data-total={r.total}>
      <p className="m-0 font-semibold" role="status">
        {t('rdFetching', { n: r.n, total: r.total })}
      </p>
      {r.phase === 'slow' && (
        <p className="m-0 text-sm text-muted" data-testid="read-slow">
          {t('rdSlow')}
        </p>
      )}
      <AiRunPanel phase={r.phase === 'slow' ? 'thinking' : r.phase} error={null} onStop={h.stop} skeleton={false} />
    </div>
  );
}

function TodayCard({ h }: { h: ReadHome }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const open = (id: string) => go({ name: 'readArticle', id });
  const busy = h.running !== null;
  const empty = h.entries.length === 0;
  const canFetch = h.aiOn && !busy && !h.rateLocked && h.toFetch > 0;

  let action: ReactNode;
  if (busy) action = <Running h={h} />;
  else if (h.next) {
    const started = entryState(h.next) === 'started';
    action = (
      <>
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => open(h.next!.id)} data-testid="read-primary" data-kind="read">
          {t(started ? 'rdContinue' : 'rdReadNext', { title: h.next.title ?? '' })}
        </Button>
        {canFetch && h.entries.length < h.perDay && (
          <Button variant="ghost" onClick={() => h.getArticles()} data-testid="read-fetch" data-ai="">
            {t('rdFetch')}
          </Button>
        )}
      </>
    );
  } else if (empty) {
    action = canFetch ? (
      <Button variant="primary" size="lg" icon="sparkle" onClick={() => h.getArticles()} data-testid="read-primary" data-kind="fetch" data-ai="">
        {t('rdFetch')}
      </Button>
    ) : null;
  } else {
    action = canFetch ? (
      <Button variant="secondary" onClick={() => h.getArticles()} data-testid="read-fetch" data-ai="">
        {t('rdMore')}
      </Button>
    ) : null;
  }

  return (
    <HeroCard testId="read-today" eyebrow={t('rdToday')} tone={!empty && !h.next ? 'done' : 'default'} title={empty ? t('rdEmptyTitle') : !h.next ? t('rdAllDone') : undefined} action={action}>
      {empty && !busy && <p className="m-0 text-sm text-muted">{h.aiOn ? t('rdEmptyBody') : t('rdAiOff')}</p>}
      {!empty && (
        <ul className="m-0 flex list-none flex-col p-0" data-testid="read-list" aria-label={t('rdToday')}>
          {h.entries.map((e) => (
            <ArticleRow key={e.id} e={e} onOpen={() => open(e.id)} />
          ))}
        </ul>
      )}
      {!empty && !h.aiOn && <p className="m-0 text-sm text-muted">{t('rdAiOff')}</p>}
      {!busy && <Outcome h={h} />}
    </HeroCard>
  );
}

function Topics({ h }: { h: ReadHome }) {
  const { t } = useT();
  const [panel, setPanel] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<MessageKey | null>(null);
  const prefs = h.home?.prefs;
  if (!prefs) return null;
  const add = (value: string) => {
    const r = h.addCustom(value);
    setMsg(r === 'invalid' ? 'rdTopicInvalid' : r === 'full' ? 'rdTopicFull' : null);
    if (r === 'ok') setText('');
  };
  const chip = (on: boolean) => `lx-hit inline-flex items-center rounded-full px-3 text-sm whitespace-nowrap transition-colors ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg hover:bg-surface'}`;
  return (
    <section className="flex flex-col gap-2.5" aria-label={t('rdTopics')} data-testid="read-topics">
      <Eyebrow>{t('rdTopics')}</Eyebrow>
      <div role="group" aria-label={t('rdTopics')} className="flex flex-wrap gap-2">
        {CHIP_KEYS.map((k) => {
          const on = (prefs.topics[k] ?? 0) > 0;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => h.toggleTopic(k)} className={chip(on)} data-testid="read-topic" data-topic={k}>
              {t(TOPIC_LABEL[k] ?? 'rdTopicCustom')}
            </button>
          );
        })}
        {prefs.custom.map((c) => (
          <span key={c} className={`${chip(true)} gap-1 pr-1`} data-testid="read-custom">
            <span>{c}</span>
            <IconButton icon="close" label={t('rdTopicRemove', { topic: c })} onClick={() => h.removeCustom(c)} className="size-8 text-accent-text" data-testid="read-custom-remove" />
          </span>
        ))}
        <button type="button" className={chip(false)} aria-expanded={panel} onClick={() => setPanel((v) => !v)} data-testid="read-newtopic">
          <Icon name="plus" size={16} />
          <span className="ml-1">{t('rdNewTopic')}</span>
        </button>
      </div>
      <p className="m-0 text-xs text-muted">{t('rdTopicsHint')}</p>
      {panel && (
        <form
          className="lx-card flex flex-col gap-3 p-3.5"
          data-testid="read-newtopic-panel"
          onSubmit={(e) => {
            e.preventDefault();
            add(text);
          }}
        >
          <p className="m-0 text-sm text-muted">{t('rdNewTopicHint')}</p>
          <div className="flex gap-2">
            <input className="lx-field min-w-0 flex-1" value={text} maxLength={60} placeholder={t('rdTopicPlaceholder')} aria-label={t('rdNewTopic')} onChange={(e) => setText(e.target.value)} data-testid="read-topic-input" autoComplete="off" enterKeyHint="done" />
            <Button type="submit" variant="secondary" data-testid="read-topic-add">
              {t('rdTopicAdd')}
            </Button>
          </div>
          {msg && (
            <p className="m-0 text-sm text-danger-text" role="alert" data-testid="read-topic-msg">
              {t(msg)}
            </p>
          )}
          {h.aiOn && (
            <div className="flex flex-col gap-2">
              <Button variant="ghost" icon="sparkle" onClick={h.suggest} busy={h.suggestions.state === 'busy'} busyLabel={t('rdSuggesting')} data-testid="read-suggest" data-ai="" type="button">
                {t('rdSuggest')}
              </Button>
              {h.suggestions.state === 'error' && h.suggestions.key && (
                <p className="m-0 text-sm text-danger-text" role="alert">
                  {t(h.suggestions.key)}
                </p>
              )}
              {h.suggestions.topics.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="read-suggestions">
                  {h.suggestions.topics.map((s) => (
                    <button key={s} type="button" className={chip(false)} onClick={() => add(s)} data-testid="read-suggestion">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function PerDay({ h }: { h: ReadHome }) {
  const { t, num } = useT();
  return (
    <div className="lx-card flex min-h-14 items-center justify-between gap-3 px-3.5 py-1" data-testid="read-perday">
      <span className="font-semibold">{t('rdPerDay')}</span>
      <span className="flex items-center gap-1">
        <IconButton icon="arrowDown" label={t('rdPerDayLess')} onClick={() => h.setPerDay(h.perDay - 1)} disabled={h.perDay <= 1} data-testid="read-perday-less" className="[&_svg]:rotate-90" />
        <span className="lx-tnum min-w-6 text-center font-semibold" data-testid="read-perday-n">
          {num(h.perDay)}
        </span>
        <IconButton icon="plus" label={t('rdPerDayMore')} onClick={() => h.setPerDay(h.perDay + 1)} disabled={h.perDay >= PER_DAY_MAX} data-testid="read-perday-more" />
      </span>
    </div>
  );
}

function Earlier({ h }: { h: ReadHome }) {
  const { t, date } = useT();
  const go = useNav((s) => s.go);
  if (h.earlier.length === 0) return null;
  return (
    <RowList title={t('rdEarlier')} testId="read-earlier">
      {h.earlier.map((e) => (
        <Row
          key={e.id}
          title={e.title}
          sub={`${e.day ? date(Date.parse(`${e.day}T12:00:00`)) : ''} · ${t(TOPIC_LABEL[e.topic ?? 'custom'] ?? 'rdTopicCustom')}`}
          value={entryState(e) === 'done' ? <Icon name="check" size={16} /> : undefined}
          chevron
          onClick={() => go({ name: 'readArticle', id: e.id })}
          testId="read-earlier-row"
          data={{ 'data-id': e.id }}
        />
      ))}
    </RowList>
  );
}

export function ReadHome() {
  const { t, tn } = useT();
  const h = useReadHome();
  return (
    <div className="mx-auto flex w-full max-w-[47.5rem] flex-col gap-6 py-6 sm:py-10" data-testid="read" data-load={h.load}>
      <Title />
      {h.load === 'loading' && (
        <div className="flex flex-col gap-3" data-testid="read-skeleton" aria-hidden="true">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}
      {h.load === 'error' && (
        <div className="lx-card flex flex-col gap-3 p-4" role="alert" data-testid="read-load-error">
          <p className="m-0 text-sm text-danger-text">{t('rdLoadFailed')}</p>
          <div>
            <Button icon="refresh" onClick={h.reload}>
              {t('rdErrRetry')}
            </Button>
          </div>
        </div>
      )}
      {h.load === 'ready' && (
        <>
          <TodayCard h={h} />
          <Topics h={h} />
          <PerDay h={h} />
          <p className="m-0 text-sm text-muted lx-tnum" data-testid="read-week">
            {h.week.articles > 0 || h.week.minutes > 0 ? tn('rdWeek', h.week.articles, { m: h.week.minutes }) : t('rdWeekNone')}
          </p>
          <Earlier h={h} />
        </>
      )}
    </div>
  );
}
