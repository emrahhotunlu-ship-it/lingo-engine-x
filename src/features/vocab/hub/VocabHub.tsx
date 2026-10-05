import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { useLive } from '../../../data/live';
import { addDays } from '../../../domain/date';
import { meaningOf } from '../../../domain/srs/cards';
import { estimateRoundMinutes } from '../../../domain/srs/cost';
import { deckCards, deckCounts, visibleDecks, type BuiltinDeck, type DeckCounts } from '../../../domain/srs/decks';
import { backlogBraked, catchUpOn, overdueCount } from '../../../domain/unit/backlog';
import { C1_MARK, vocabGoal } from '../../../domain/vocab/goal';
import { useToday } from '../../today/state';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { Button, IconButton } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { HeroCard } from '../../../ui/HeroCard';
import { Row, RowList } from '../../../ui/RowList';
import { ScreenHeader } from '../../learn/ui';
import { useDecks } from '../decksStore';
import { startAllDue } from '../start';
import { useDeckCtx, useQuota, useVocabCards } from './data';

// Wurzel des Reiters „Wörter“ (Gesamtkonzept 3.3): Suche · EINE Zielkarte (X von 8.000, Balken mit C1-Marke, Tempo) ·
// Wiederholen-Karte (ein Hauptknopf, Modus als Textknopf) · „Neue Wörter heute“ · drei Stapel + „Alle Stapel ›“ (Blatt `x:decks`
// mit Eingangskorb, Prognose, allen Stapeln, Zuletzt hinzugefügt) · Atlas · „Mehr üben“ (Blatt `x:extra`).

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
  const { t, tn, lang, num } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const ctx = useDeckCtx();
  const decks = useDecks((s) => s.decks);
  const profile = useLive((s) => s.docs['app/profile']);
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
  // Was der Knopf „Wiederholen“ jetzt tut (Emrah 02.10.2026): Pflicht offen → die Pflichtrunde des Tagesplans, sonst eine freiwillige Runde mit bis zu 20 Karten.
  const dutyOpen = useToday((s) => s.duties.items.some((d) => d.id === 'review' && d.state === 'open'));
  const dutyTotal = useToday((s) => s.review.total);
  const dutyDone = useToday((s) => s.review.done);
  const goal = useMemo(() => vocabGoal({ profile, cards, today }), [profile, cards, today]);
  const goalNow = goal.now ?? 0;
  const modeLabel = t(mode === 'auto' ? 'nbWsModeAuto' : mode === 'flip' ? 'nbWsModeFlip' : 'nbWsModeType');
  // Drei Stapel: Alle · Schwierig · bei Bedarf der erste eigene Stapel (früher „Thema der Woche“). Alles Weitere unter „Alle Stapel“.
  const hardCards = useMemo(() => deckCards(cards, 'hard', decks, ctx), [cards, decks, ctx]);
  const ownDeck = useMemo(() => {
    // Der zuletzt angelegte eigene Stapel (bei gleichem Tag der mit der größeren Kennung).
    const d = [...visibleDecks(decks)].sort((a, b) => b.created.localeCompare(a.created) || (a.id < b.id ? 1 : -1))[0];
    return d ? { id: d.id, name: d.name, counts: deckCounts(deckCards(cards, d.id, decks, ctx), now) } : null;
  }, [cards, decks, ctx, now]);
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 2) return null;
    const low = (x: string | null) => (x ?? '').toLowerCase();
    return visible.filter((c) => low(c.word).includes(k) || low(c.de).includes(k) || low(c.def).includes(k)).slice(0, 8);
  }, [q, visible]);

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10" data-testid="vocab">
      <ScreenHeader title={t('nbWsTitle')} titleAction={<IconButton icon="plus" label={t('nbWsHAddLabel')} onClick={() => openSheet('add')} data-testid="vocab-add" />} />
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
        testId="ws-goal"
        eyebrow={t('nbWsHGoalEyebrow')}
        title={
          <span className="lx-tnum" data-testid="ws-goal-now" data-now={goal.now ?? ''}>
            {t('nbWsHGoalOf', { now: num(goalNow), target: num(goal.target) })}
          </span>
        }
      >
        <div data-testid="ws-goal-bar">
          <div className="relative h-2 rounded-full bg-surface" role="img" aria-label={t('vgBarLabel', { now: goalNow, mark: C1_MARK })}>
            <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((goalNow / goal.target) * 100))}%` }} />
            <span className="absolute top-[-3px] h-3.5 w-0.5 bg-fg" style={{ left: `${(C1_MARK / goal.target) * 100}%` }} aria-hidden="true" />
          </div>
          <p className="lx-tnum m-0 mt-1 text-xs text-muted">{t('nbWsHGoalMark', { mark: num(C1_MARK) })}</p>
        </div>
        <p className="m-0 text-sm text-muted" data-testid="ws-goal-pace">
          {!goal.measured
            ? t('nbWsHGoalUnmeasured')
            : goal.reached
              ? t('nbWsHGoalReached')
              : goal.weeks !== null
                ? t('nbWsHGoalPace', { n: goal.perWeek, weeks: goal.weeks })
                : goal.perWeek >= 1
                  ? t('nbWsHGoalPaceOpen', { n: goal.perWeek })
                  : t('nbWsHGoalNoPace')}
        </p>
      </HeroCard>

      <HeroCard
        testId="ws-due"
        eyebrow={t('nbWsHReviewEyebrow')}
        meta={total > 0 ? <span data-testid="ws-minutes">{t('nbWsMinutes', { n: minutes })}</span> : undefined}
        action={
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => startAllDue(api)} disabled={total === 0} data-testid="ws-review">
            {total > 0 ? tn('nbWsHReviewBtn', total) : t('nbWsHReviewBtnNone')}
          </Button>
        }
      >
        <span data-testid="ws-counts" data-total={total} data-new={allShown.new} data-learning={allShown.learning} data-due={allShown.due} hidden />
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
        <button type="button" className="min-h-11 self-start text-sm text-muted underline-offset-4 hover:underline" onClick={() => openSheet('x:mode')} data-testid="ws-mode-open" data-mode={mode}>
          {t('nbWsHModeLine', { mode: modeLabel })} ›
        </button>
      </HeroCard>

      <RowList testId="ws-newtoday">
        <Row
          icon="plus"
          channel="cards"
          title={t('nbWsHNewToday')}
          value={
            <span data-testid="ws-new-left" data-n={quota.left}>
              {num(quota.left)}
            </span>
          }
          testId="ws-new-today"
        />
      </RowList>

      <RowList title={t('nbWsDecks')} testId="ws-decks-main">
        <Row icon="cards" channel="cards" title={tn('nbWsAll', visible.length)} sub={t('nbWsAllSub')} value={<Counts c={all} />} chevron onClick={() => go({ name: 'vocabList' })} testId="ws-all" />
        {hardCards.length > 0 && (
          <Row icon="cards" channel="cards" title={t('nbWsDeckHard')} value={<Counts c={deckCounts(hardCards, now)} />} chevron onClick={() => go({ name: 'deck', id: 'hard' })} testId="ws-deck" data={{ 'data-deck': 'hard' }} />
        )}
        {ownDeck && <Row icon="cards" channel="cards" title={ownDeck.name} value={<Counts c={ownDeck.counts} />} chevron onClick={() => go({ name: 'deck', id: ownDeck.id })} testId="ws-deck" data={{ 'data-deck': ownDeck.id }} />}
        <Row title={`${t('nbWsHAllDecks')} ›`} onClick={() => openSheet('x:decks')} testId="ws-decks-all" />
      </RowList>

      <RowList testId="ws-atlas-list">
        <Row icon="grid" channel="cards" title={t('nbWsHAtlasRow')} sub={t('nbWsHAtlasSub')} chevron onClick={() => go({ name: 'atlas' })} testId="ws-atlas" />
      </RowList>
      <p className="m-0 text-center">
        <button type="button" className="min-h-11 text-sm text-muted underline-offset-4 hover:underline" onClick={() => openSheet('x:extra')} data-testid="ws-more">
          {t('nbWsHMoreLabel')} ›
        </button>
      </p>
    </div>
  );
}

export const tomorrowOf = (day: string): string => addDays(day, 1);
