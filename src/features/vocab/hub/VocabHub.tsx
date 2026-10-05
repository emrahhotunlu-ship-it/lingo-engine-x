import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { addDays, dayKey, dayKeyNoon, daysBetween } from '../../../domain/date';
import { meaningOf } from '../../../domain/srs/cards';
import { estimateRoundMinutes } from '../../../domain/srs/cost';
import { BUILTIN_DECKS, deckCards, deckCounts, inboxReach, visibleDecks, type BuiltinDeck, type DeckCounts } from '../../../domain/srs/decks';
import { forecast } from '../../../domain/srs/forecast';
import { backlogBraked, catchUpOn, overdueCount } from '../../../domain/unit/backlog';
import { useToday } from '../../today/state';
import { normalizeNewPerDay } from '../../../domain/srs/queue';
import type { TrainCard } from '../../../domain/srs/types';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { HeroCard } from '../../../ui/HeroCard';
import { Row, RowList } from '../../../ui/RowList';
import { Eyebrow } from '../../../ui/Eyebrow';
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
  'src:pack': 'nbWsDeckSrcPack',
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
  // Zeit wie im Tagesplan gerechnet (`domain/srs/cost.ts`), im Modus „Aufdecken“ kürzer – nicht mehr zwei verschiedene Annahmen.
  const minutes = estimateRoundMinutes(visible, now, quota.left, mode === 'flip');
  const behind = useMemo(() => overdueCount(visible, now), [visible, now]);
  const braked = backlogBraked(behind);
  // Was der Knopf „Wiederholen“ jetzt tut (Emrah 02.10.2026: „Alle fälligen 60 Karten“, aber die Runde hat weniger):
  // Pflicht offen → die Pflichtrunde des Tagesplans, sonst eine freiwillige Runde mit bis zu 20 Karten.
  const dutyOpen = useToday((s) => s.duties.items.some((d) => d.id === 'review' && d.state === 'open'));
  const dutyTotal = useToday((s) => s.review.total);
  const dutyDone = useToday((s) => s.review.done);
  const fc = useMemo(() => forecast(visible, now), [visible, now]);
  const fcMax = Math.max(1, ...fc.map((d) => d.n));
  const perDay = normalizeNewPerDay(quota.perDay);
  const inbox = inboxReach(all.new, perDay, braked);
  const rows = useMemo(() => {
    const builtin = BUILTIN_DECKS.map((id) => ({ id, name: t(DECK_LABEL[id]), cards: deckCards(cards, id, decks, ctx) })).filter((d) => d.cards.length > 0 && d.id !== 'inbox');
    const own = visibleDecks(decks).map((d) => ({ id: d.id, name: d.name, cards: deckCards(cards, d.id, decks, ctx) }));
    return [...builtin, ...own].map((d) => ({ ...d, counts: deckCounts(d.cards, now) }));
  }, [cards, decks, ctx, now, t]);
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 2) return null;
    const low = (x: string | null) => (x ?? '').toLowerCase();
    return visible.filter((c) => low(c.word).includes(k) || low(c.de).includes(k) || low(c.def).includes(k)).slice(0, 8);
  }, [q, visible]);
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
          <input type="search" className="lx-field pl-10" value={q} placeholder={t('nbWsSearch')} onChange={(e) => setQ(e.target.value)} data-testid="vocab-search" autoComplete="off" spellCheck={false} enterKeyHint="search" />
        </label>
      </form>
      {hits && (
        <RowList testId="ws-hits" label={t('nbWsSearch')}>
          {hits.map((c) => (
            <Row key={c.key} title={<span lang="en">{c.word}</span>} sub={<span lang={lang}>{meaningOf(c, lang)}</span>} onClick={() => openSheet('word', { key: c.key })} testId="vocab-row" data={{ 'data-word': c.id, 'data-kind': c.kind }} />
          ))}
          <Row title={t('nbWsAllSub')} onClick={() => go({ name: 'vocabList', q: q.trim() })} testId="ws-hits-all" />
        </RowList>
      )}

      <HeroCard
        testId="ws-due"
        eyebrow={t('nbWsDueEyebrow')}
        meta={total > 0 ? <span data-testid="ws-minutes">{t('nbWsMinutes', { n: minutes })}</span> : undefined}
        title={<span className="lx-tnum">{total > 0 ? tn('nbWsDueHeadline', total) : t('nbWsNothingDue')}</span>}
        action={
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => startAllDue(api)} disabled={total === 0} data-testid="ws-review">
            {t('nbWsReview')}
          </Button>
        }
      >
        <dl className="lx-tnum m-0 flex gap-5 text-sm" data-testid="ws-counts" data-total={total}>
          {(
            [
              ['new', 'nbWsCountNew', allShown.new, 'text-cyan-text'],
              ['learning', 'nbWsCountLearn', allShown.learning, 'text-gold-text'],
              ['due', 'nbWsCountDue', allShown.due, 'text-accent-text'],
            ] as const
          ).map(([k, key, n, tone]) => (
            <div key={k} className="flex flex-col" data-count={k}>
              <dt className="text-xs text-muted">{t(key)}</dt>
              <dd className={`m-0 text-lg font-semibold ${tone}`}>{n}</dd>
            </div>
          ))}
        </dl>
        {behind > 0 && (
          <p className="m-0 text-sm text-muted" data-testid="ws-behind" data-n={behind}>
            {tn('nbWsBehind', behind)}
            {braked && (
              <span className="block text-muted" data-testid="ws-braked">
                {t('nbWsBraked')}
              </span>
            )}
            {catchUpOn(behind) && (
              <span className="block text-muted" data-testid="ws-catchup">
                {t('nbWsCatchUp')}
              </span>
            )}
          </p>
        )}
        {total > 0 && (
          <p className="m-0 text-sm text-muted" data-testid="ws-round-hint" data-duty={dutyOpen && dutyTotal > 0 ? '' : undefined}>
            {dutyOpen && dutyTotal > 0 ? t('nbWsDutyLeft', { left: Math.max(1, dutyTotal - dutyDone), total: dutyTotal }) : t('nbWsExtraRound', { n: Math.min(20, total) })}
          </p>
        )}
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
      </HeroCard>

      <section className="flex flex-col gap-2.5" data-testid="ws-forecast" aria-label={t('nbWsForecast')}>
        <Eyebrow>{t('nbWsForecast')}</Eyebrow>
        <ol className="m-0 grid list-none grid-cols-7 items-end gap-1.5 p-0">
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

      <RowList title={t('nbWsDecks')} testId="ws-decks">
        <Row
          icon="download"
          channel="cards"
          title={t('nbWsDeckInbox')}
          sub={
            <>
              {inbox.n === 0 ? t('nbWsInboxEmpty') : inbox.days === null ? t('nbWsInboxNoQuota', { n: inbox.n }) : t('nbWsInbox', { n: inbox.n, days: inbox.days })}
              {inbox.review && (
                <span className="block text-gold-text" data-testid="ws-inbox-review">
                  {t('nbWsInboxReview')}
                </span>
              )}
            </>
          }
          onClick={() => go({ name: 'deck', id: 'inbox' })}
          testId="ws-inbox"
          data={{ 'data-deck': 'inbox' }}
        />
        {rows.map((d) => (
          <Row key={d.id} icon="cards" channel="cards" title={d.name} value={<Counts c={d.counts} />} chevron onClick={() => go({ name: 'deck', id: d.id })} testId="ws-deck" data={{ 'data-deck': d.id }} />
        ))}
        <Row icon="plus" title={t('nbWsNewDeck')} onClick={() => openSheet('x:deck-new')} testId="ws-new-deck" />
      </RowList>

      <RowList title={t('nbWsRecent')} testId="ws-recent">
        {recent.map((c) => (
          <Row
            key={c.key}
            title={<span lang="en">{c.word}</span>}
            sub={<span lang={lang}>{meaningOf(c, lang)}</span>}
            value={state(c)}
            onClick={() => openSheet('word', { key: c.key })}
            testId="vocab-row"
            data={{ 'data-word': c.id, 'data-kind': c.kind }}
          />
        ))}
        <Row title={t('atTitle')} sub={t('atSub')} onClick={() => go({ name: 'atlas' })} testId="ws-atlas" />
        <Row title={tn('nbWsAll', visible.length)} sub={t('nbWsAllSub')} onClick={() => go({ name: 'vocabList' })} testId="ws-all" />
      </RowList>
      <p className="m-0 text-center">
        <button type="button" className="min-h-11 text-sm text-muted underline-offset-4 hover:underline" onClick={() => openSheet('x:extra')} data-testid="ws-more">
          {t('nbWsMore')} ›
        </button>
      </p>
    </div>
  );
}

export const tomorrowOf = (day: string): string => addDays(day, 1);
