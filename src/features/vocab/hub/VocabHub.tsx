import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { addDays, dayKey, dayKeyNoon, daysBetween } from '../../../domain/date';
import { meaningOf } from '../../../domain/srs/cards';
import { BUILTIN_DECKS, deckCards, deckCounts, estimateMinutes, inboxReach, visibleDecks, type BuiltinDeck, type DeckCounts } from '../../../domain/srs/decks';
import { forecast } from '../../../domain/srs/forecast';
import { normalizeNewPerDay } from '../../../domain/srs/queue';
import type { TrainCard } from '../../../domain/srs/types';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Segmented } from '../../../ui/Segmented';
import { toast } from '../../../ui/Toast';
import { prefsOp } from '../../../domain/srs/decks';
import { ScreenHeader } from '../../learn/ui';
import { useDecks, writeDecks } from '../decksStore';
import { startAllDue } from '../start';
import { useDeckCtx, useQuota, useVocabCards } from './data';
import { decksErrorKey } from './errors';

// Wurzel des Reiters „Wortschatz“ (plan.md §1.3, Optik wie Prototyp v1): Suche · „Alle fälligen“
// (Hauptkarte mit Neu · Lernen · Fällig, Modus, „Wiederholen →“, Minuten) · Prognose 7 Tage ·
// Stapel (eingebaut + eigene, je Zeile die drei Zähler) · Eingangskorb · Zuletzt hinzugefügt.

export const DECK_LABEL: Record<BuiltinDeck, MessageKey> = {
  inbox: 'nbWsDeckInbox',
  hard: 'nbWsDeckHard',
  leech: 'nbWsDeckLeech',
  job: 'nbWsDeckJob',
  phrases: 'nbWsDeckPhrases',
  theme: 'nbWsDeckTheme',
  mistakes: 'nbWsDeckMistakes',
  'src:translate': 'nbWsDeckSrcTranslate',
  'src:lookup': 'nbWsDeckSrcLookup',
  'src:preply': 'nbWsDeckSrcPreply',
  'src:lesson': 'nbWsDeckSrcLesson',
  'src:ai': 'nbWsDeckSrcAi',
};

type Mode = 'auto' | 'flip' | 'type';

export function Counts({ c, testId }: { c: DeckCounts; testId?: string }) {
  const { t } = useT();
  return (
    <span className="lx-tnum inline-flex items-center gap-2 text-sm" data-testid={testId} aria-label={t('nbWsCounts', { new: c.new, learning: c.learning, due: c.due })}>
      <span className="text-cyan-text" data-count="new" aria-hidden="true">
        {c.new}
      </span>
      <span className="text-gold-text" data-count="learning" aria-hidden="true">
        {c.learning}
      </span>
      <span className="text-accent-text" data-count="due" aria-hidden="true">
        {c.due}
      </span>
    </span>
  );
}

function RowButton({ onClick, testId, children, data }: { onClick: () => void; testId: string; children: React.ReactNode; data?: Record<string, string> }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} {...data} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-strong">
        {children}
      </button>
    </li>
  );
}

export function VocabHub() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const ctx = useDeckCtx();
  const decks = useDecks((s) => s.decks);
  const mode: Mode = decks.prefs.mode ?? 'auto';
  const [q, setQ] = useState('');

  const visible = useMemo(() => cards.filter((c) => !c.hidden), [cards]);
  const all = useMemo(() => deckCounts(visible, now), [visible, now]);
  const allShown: DeckCounts = { ...all, new: Math.min(all.new, quota.left) };
  const total = allShown.new + allShown.learning + allShown.due;
  const minutes = estimateMinutes(allShown);
  const fc = useMemo(() => forecast(visible, now), [visible, now]);
  const fcMax = Math.max(1, ...fc.map((d) => d.n));
  const perDay = normalizeNewPerDay(quota.perDay);
  const inbox = inboxReach(all.new, perDay);
  const rows = useMemo(() => {
    const builtin = BUILTIN_DECKS.map((id) => ({ id, name: t(DECK_LABEL[id]), cards: deckCards(cards, id, decks, ctx) })).filter((d) => d.cards.length > 0 && d.id !== 'inbox');
    const own = visibleDecks(decks).map((d) => ({ id: d.id, name: d.name, cards: deckCards(cards, d.id, decks, ctx) }));
    return [...builtin, ...own].map((d) => ({ ...d, counts: deckCounts(d.cards, now) }));
  }, [cards, decks, ctx, now, t]);
  const recent = useMemo(() => [...visible].sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : b.order - a.order)).slice(0, 5), [visible]);

  const setMode = (m: Mode) => {
    void writeDecks((cur) => prefsOp(cur, { mode: m })).then((r) => {
      if (!r.ok) toast(t(decksErrorKey(r.error)), 'error');
    });
  };
  const state = (c: TrainCard): string => {
    if (c.isNew) return t('nbWsStateNew');
    const d = daysBetween(today, dayKey(c.fsrs.due));
    if (c.fsrs.due <= now || d <= 0) return t('nbWsStateToday');
    if (d === 1) return t('nbWsStateTomorrow');
    return t('nbWsStateIn', { n: d });
  };
  const dayLabel = (day: string, i: number) => (i === 0 ? t('nbWsTomorrow') : new Date(dayKeyNoon(day)).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' }));

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10" data-testid="vocab">
      <ScreenHeader
        title={t('nbWsTitle')}
        right={
          <Button variant="secondary" icon="plus" onClick={() => openSheet('add')} data-testid="vocab-add">
            {t('nbWsAdd')}
          </Button>
        }
      />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go({ name: 'vocabList', ...(q.trim() ? { q: q.trim() } : {}) });
        }}
      >
        <label className="relative block">
          <span className="sr-only">{t('nbWsSearch')}</span>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
          <input type="search" className="lx-field pl-10" value={q} placeholder={t('nbWsSearch')} onChange={(e) => setQ(e.target.value)} data-testid="ws-search" autoComplete="off" spellCheck={false} enterKeyHint="search" />
        </label>
      </form>

      <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5 sm:p-6" data-testid="ws-due" data-total={total}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="lx-eyebrow">{t('nbWsDueEyebrow')}</p>
          {total > 0 && (
            <span className="lx-tnum text-sm text-muted" data-testid="ws-minutes">
              {t('nbWsMinutes', { n: minutes })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="lx-tnum text-2xl font-semibold tracking-tight">{total > 0 ? tn('nbWsDueHeadline', total) : t('nbWsNothingDue')}</h2>
          <dl className="lx-tnum flex gap-4 text-sm" data-testid="ws-counts">
            {(
              [
                ['new', 'nbWsCountNew', allShown.new, 'text-cyan-text'],
                ['learning', 'nbWsCountLearn', allShown.learning, 'text-gold-text'],
                ['due', 'nbWsCountDue', allShown.due, 'text-accent-text'],
              ] as const
            ).map(([k, key, n, tone]) => (
              <div key={k} className="flex flex-col items-center" data-count={k}>
                <dt className="text-xs text-muted">{t(key)}</dt>
                <dd className={`text-lg font-semibold ${tone}`}>{n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Segmented<Mode>
          label={t('nbWsModeLabel')}
          value={mode}
          options={[
            { value: 'auto', label: t('nbWsModeAuto') },
            { value: 'flip', label: t('nbWsModeFlip') },
            { value: 'type', label: t('nbWsModeType') },
          ]}
          onChange={setMode}
          testId="ws-mode"
        />
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => startAllDue(api)} disabled={total === 0} data-testid="ws-review">
          {t('nbWsReview')}
        </Button>
      </section>

      <section className="flex flex-col gap-2" data-testid="ws-forecast" aria-label={t('nbWsForecast')}>
        <p className="lx-eyebrow">{t('nbWsForecast')}</p>
        <ol className="grid grid-cols-7 items-end gap-1.5">
          {fc.map((d, i) => (
            <li key={d.day} className="flex flex-col items-center gap-1" aria-label={t('nbWsForecastBar', { day: dayLabel(d.day, i), n: d.n })} data-n={d.n}>
              <span className="lx-tnum text-xs text-muted" aria-hidden="true">
                {d.n}
              </span>
              <span className="block w-full rounded-md bg-accent/70" style={{ height: `${Math.max(3, Math.round((d.n / fcMax) * 44))}px` }} aria-hidden="true" />
              <span className="max-w-full truncate text-[0.7rem] text-subtle" aria-hidden="true">
                {dayLabel(d.day, i)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbWsDecks')}</p>
        <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" data-testid="ws-decks">
          <RowButton onClick={() => go({ name: 'deck', id: 'inbox' })} testId="ws-inbox" data={{ 'data-deck': 'inbox' }}>
            <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface-strong text-cyan-text">
              <Icon name="download" size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{t('nbWsDeckInbox')}</span>
              <span className="text-sm text-muted">{inbox.n === 0 ? t('nbWsInboxEmpty') : inbox.days === null ? t('nbWsInboxNoQuota', { n: inbox.n }) : t('nbWsInbox', { n: inbox.n, days: inbox.days })}</span>
              {inbox.review && (
                <span className="text-sm text-gold-text" data-testid="ws-inbox-review">
                  {t('nbWsInboxReview')}
                </span>
              )}
            </span>
            <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
          </RowButton>
          {rows.map((d) => (
            <RowButton key={d.id} onClick={() => go({ name: 'deck', id: d.id })} testId="ws-deck" data={{ 'data-deck': d.id }}>
              <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface-strong text-accent-text">
                <Icon name="cards" size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              <Counts c={d.counts} />
              <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
            </RowButton>
          ))}
          <RowButton onClick={() => openSheet('x:deck-new')} testId="ws-new-deck">
            <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface-strong text-muted">
              <Icon name="plus" size={18} />
            </span>
            <span className="flex-1 font-medium">{t('nbWsNewDeck')}</span>
          </RowButton>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbWsRecent')}</p>
        <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" data-testid="ws-recent">
          {recent.map((c) => (
            <RowButton key={c.key} onClick={() => openSheet('word', { key: c.key })} testId="vocab-row" data={{ 'data-word': c.id, 'data-kind': c.kind }}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium" lang="en">
                  {c.word}
                </span>
                <span className="truncate text-sm text-muted" lang={lang}>
                  {meaningOf(c, lang)}
                </span>
              </span>
              <span className="flex-none text-xs text-muted">{state(c)}</span>
            </RowButton>
          ))}
          <RowButton onClick={() => go({ name: 'vocabList' })} testId="ws-all">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{tn('nbWsAll', visible.length)}</span>
              <span className="text-sm text-muted">{t('nbWsAllSub')}</span>
            </span>
            <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
          </RowButton>
        </ul>
      </section>
      <p className="text-center">
        <button type="button" className="text-sm text-muted underline-offset-4 hover:underline" onClick={() => openSheet('x:extra')} data-testid="ws-more">
          {t('nbWsMore')} ›
        </button>
      </p>
    </div>
  );
}

export const tomorrowOf = (day: string): string => addDays(day, 1);
