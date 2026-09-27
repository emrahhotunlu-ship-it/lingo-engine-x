import { motion } from 'framer-motion';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { SHARED_TRANSITION, sharedId, SOURCE_DEPENDENCY, useSharedEpoch } from '../../../engine/shared';
import { invalidIdsOf, useLive } from '../../../data/live';
import { buildTrainCards, meaningOf } from '../../../domain/srs/cards';
import { buildChunkCards } from '../../../domain/srs/chunkCards';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf } from '../../../domain/srs/confidence';
import { filterCards, VOCAB_FILTERS, vocabStats, type VocabFilter, type VocabSort } from '../../../domain/srs/vocabList';
import { normalizeNewPerDay } from '../../../domain/srs/queue';
import type { TrainCard } from '../../../domain/srs/types';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Segmented } from '../../../ui/Segmented';
import { DURATION, EASE_OUT } from '../../../ui/motion';
import { Dots } from '../../grammar/GrammarScreen';
import { ScreenHeader } from '../../learn/ui';
import { AddWordSheet } from './AddWordSheet';
import { WordSheet } from './WordSheet';

// Wortschatz (Funktionsabgleich M1): alle Karten mit Suche, Filtern und Sortierung, oben der
// Status als eine Zeile. Ein Tippen öffnet das Wortblatt mit Status, Beispielen und Aktionen.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const PAGE = 120;

const FILTER_KEY: Record<VocabFilter, MessageKey> = {
  all: 'vcFilterAll',
  due: 'vcFilterDue',
  new: 'vcFilterNew',
  shaky: 'vcFilterShaky',
  helped: 'vcFilterHelped',
  solid: 'vcFilterSolid',
  job: 'vcFilterJob',
  phrases: 'vcFilterPhrases',
  hidden: 'vcFilterHidden',
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export function VocabScreen() {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunks = useLive((s) => s.collections.chunk) ?? EMPTY;
  const invalid = useLive((s) => s.invalid);
  const newPerDay = useLive((s) => s.docs['app/profile']?.newPerDay);
  const [filter, setFilter] = useState<VocabFilter>('all');
  const [sort, setSort] = useState<VocabSort>('stage');
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const closeWord = useCallback(() => setOpen(null), []);
  const closeAdd = useCallback(() => setAdding(false), []);

  // Wendungen (`chunk/*`) stehen mit in der Liste (Filter „Wendungen“, M1).
  const cards = useMemo(
    () => [...buildTrainCards(vocab, now, invalidIdsOf(invalid, 'vocab')), ...buildChunkCards(chunks, now, invalidIdsOf(invalid, 'chunk'))],
    [vocab, chunks, now, invalid],
  );
  const stats = useMemo(() => vocabStats(cards, now, today, normalizeNewPerDay(newPerDay)), [cards, now, today, newPerDay]);
  const chunkCount = useMemo(() => cards.filter((c) => c.kind === 'chunk' && !c.hidden).length, [cards]);
  const list = useMemo(() => filterCards(cards, { filter, query: q, sort, nowMs: now }), [cards, filter, q, sort, now]);
  const current = open ? (cards.find((c) => c.key === open) ?? null) : null;
  // Kap. 4.4: Das Wort der Zeile gleitet in den Titel des Wortblatts (gemeinsames Element).
  const ep = useSharedEpoch();

  const newLine = stats.stockEmpty ? t('vcStockEmpty') : t('vcNewToday', { n: Math.min(stats.newToday, stats.quota), total: stats.quota });
  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} data-testid="vocab">
      <motion.div variants={item}>
        <ScreenHeader
          eyebrow={t('lhVocab')}
          title={t('vcTitle')}
          back={() => go({ name: 'learn' })}
          lead={
            <span className="lx-tnum" data-testid="vocab-status">
              {tn('vcTotal', stats.total - chunkCount)}
              {chunkCount > 0 && <> · {tn('vcChunks', chunkCount)}</>} · {tn('vocabDue', stats.due)} · {newLine}
            </span>
          }
          right={
            <Button variant="secondary" icon="plus" onClick={() => setAdding(true)} data-testid="vocab-add">
              {t('vcAdd')}
            </Button>
          }
        />
      </motion.div>
      <motion.div variants={item} className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">{t('vcSearch')}</span>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            className="lx-field pl-10"
            value={query}
            placeholder={t('vcSearch')}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            data-testid="vocab-search"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('vcFilters')}>
          {VOCAB_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="lx-chip"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setLimit(PAGE);
              }}
              data-testid="vocab-filter"
              data-filter={f}
            >
              {t(FILTER_KEY[f])}
            </button>
          ))}
        </div>
        <div className="max-w-xs">
          <Segmented
            label={t('vcSort')}
            value={sort}
            options={[
              { value: 'stage', label: t('vcSortStage') },
              { value: 'az', label: t('vcSortAz') },
            ]}
            onChange={setSort}
          />
        </div>
      </motion.div>
      <motion.div variants={item} className="flex flex-col gap-2">
        <p className="lx-tnum text-sm text-muted" data-testid="vocab-count">
          {tn('vcShown', list.length)}
        </p>
        {list.length === 0 ? (
          <p className="text-base text-muted" data-testid="vocab-empty">
            {t('vcEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.slice(0, limit).map((c) => (
              <li key={c.key}>
                <WordRow card={c} nowMs={now} lang={lang} onOpen={() => setOpen(c.key)} layoutId={sharedId(`word-${c.key}`, ep)} />
              </li>
            ))}
          </ul>
        )}
        {list.length > limit && (
          <div>
            <Button variant="ghost" onClick={() => setLimit((n) => n + PAGE)} data-testid="vocab-more">
              {t('vcMore')}
            </Button>
          </div>
        )}
      </motion.div>
      <WordSheet card={current} onClose={closeWord} layoutId={current ? sharedId(`word-${current.key}`, ep) : undefined} />
      <AddWordSheet open={adding} onClose={closeAdd} />
    </motion.div>
  );
}

function WordRow({ card, nowMs, lang, onOpen, layoutId }: { card: TrainCard; nowMs: number; lang: 'de' | 'en'; onOpen: () => void; layoutId: string }) {
  const { t } = useT();
  const conf = confidenceOf(card, nowMs);
  const meaning = meaningOf(card, lang);
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface"
      onClick={onOpen}
      data-testid="vocab-row"
      data-word={card.id}
      data-kind={card.kind}
      data-stage={card.stage}
      data-hidden={card.hidden || undefined}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <motion.span layoutId={layoutId} layoutDependency={SOURCE_DEPENDENCY} transition={SHARED_TRANSITION} className="max-w-full self-start truncate font-medium" lang="en">
            {card.word}
          </motion.span>
          {card.kind === 'chunk' && <span className="flex-none rounded-full border border-line px-2 py-0.5 text-[0.7rem] font-medium text-muted">{t('vcChunkBadge')}</span>}
        </span>
        {meaning && (
          <span className="text-sm text-muted" lang={lang}>
            {meaning}
          </span>
        )}
      </span>
      <span className="flex flex-none items-center gap-2 text-xs text-muted" title={t(CONFIDENCE_KEYS[conf])}>
        <Dots n={confidenceDots(conf)} />
        <span className="sr-only">{t(CONFIDENCE_KEYS[conf])}</span>
      </span>
    </button>
  );
}
