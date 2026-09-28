import { useDeferredValue, useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { useLive } from '../../../data/live';
import { meaningOf } from '../../../domain/srs/cards';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf } from '../../../domain/srs/confidence';
import { addIdsOp, isLeechCard, visibleDecks } from '../../../domain/srs/decks';
import { filterCards, VOCAB_FILTERS, vocabStats, type VocabFilter, type VocabSort } from '../../../domain/srs/vocabList';
import { normalizeNewPerDay } from '../../../domain/srs/queue';
import type { TrainCard } from '../../../domain/srs/types';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { toast } from '../../../ui/Toast';
import { Dots } from '../../grammar/GrammarScreen';
import { ScreenHeader } from '../../learn/ui';
import { useDecks, writeDecks } from '../decksStore';
import { useVocabCards } from '../hub/data';
import { decksErrorKey } from '../hub/errors';
import { setHidden } from './actions';

// Wortliste als Browser (plan.md N24, D1/D2): Suche, Filter-Chips (Mehrfachauswahl unter
// „Auswählen“: Ausblenden, zu Stapel), Sortierung. 50 Zeilen je Seite, `content-visibility`, keine
// Layout-Animationen (leistung.md §3.2 Nr. 6). Ein Tippen öffnet das Wortblatt (`word`).

const PAGE = 50;
type Filter = VocabFilter | 'leech';
const FILTERS: readonly Filter[] = [...VOCAB_FILTERS.slice(0, VOCAB_FILTERS.length - 1), 'leech', 'hidden'];

const FILTER_KEY: Record<Filter, MessageKey> = {
  all: 'vcFilterAll',
  due: 'vcFilterDue',
  new: 'vcFilterNew',
  shaky: 'vcFilterShaky',
  helped: 'vcFilterHelped',
  solid: 'vcFilterSolid',
  job: 'vcFilterJob',
  phrases: 'vcFilterPhrases',
  leech: 'nbWsFilterLeech',
  hidden: 'vcFilterHidden',
};

const isFilter = (v: unknown): v is Filter => typeof v === 'string' && (FILTERS as readonly string[]).includes(v);

export function VocabScreen({ filter: initialFilter, q: initialQ }: { filter?: string | undefined; q?: string | undefined } = {}) {
  const { t, tn, lang } = useT();
  const back = useNav((s) => s.back);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const newPerDay = useLive((s) => s.docs['app/profile']?.newPerDay);
  const decks = useDecks((s) => s.decks);
  const cards = useVocabCards();
  const [filter, setFilter] = useState<Filter>(isFilter(initialFilter) ? initialFilter : 'all');
  const [sort, setSort] = useState<VocabSort>('stage');
  const [query, setQuery] = useState(initialQ ?? '');
  const q = useDeferredValue(query);
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => vocabStats(cards, now, today, normalizeNewPerDay(newPerDay)), [cards, now, today, newPerDay]);
  const chunkCount = useMemo(() => cards.filter((c) => c.kind === 'chunk' && !c.hidden).length, [cards]);
  const list = useMemo(() => {
    if (filter === 'leech') return filterCards(cards, { filter: 'all', query: q, sort, nowMs: now }).filter(isLeechCard);
    return filterCards(cards, { filter, query: q, sort, nowMs: now });
  }, [cards, filter, q, sort, now]);
  const sortLabel = t(sort === 'stage' ? 'vcSortStage' : 'vcSortAz');
  const newLine = stats.stockEmpty ? t('vcStockEmpty') : t('vcNewToday', { n: Math.min(stats.newToday, stats.quota), total: stats.quota });
  const own = visibleDecks(decks);

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const chosen = (): TrainCard[] => cards.filter((c) => selected.has(c.key));
  const hideSelected = async () => {
    setBusy(true);
    let ok = true;
    for (const c of chosen()) ok = (await setHidden(c, filter !== 'hidden')) && ok;
    setBusy(false);
    toast(ok ? t(filter === 'hidden' ? 'vcUnhiddenToast' : 'vcHiddenToast') : t('saveFailed'), ok ? 'info' : 'error');
    setSelected(new Set());
  };
  const addToDeck = async (id: string, name: string) => {
    const keys = [...selected];
    const r = await writeDecks((cur) => addIdsOp(cur, id, keys));
    if (!r.ok) toast(t(decksErrorKey(r.error)), 'error');
    else {
      toast(t('nbWsAddedToDeck', { name }), 'info');
      setSelected(new Set());
    }
  };

  return (
    <div className="flex flex-col gap-4 py-6 sm:gap-6 sm:py-10" data-testid="vocab-list">
      <ScreenHeader
        title={t('nbWsListTitle')}
        back={back}
        lead={
          <span className="lx-tnum block truncate text-sm" data-testid="vocab-status">
            {tn('vcTotal', stats.total - chunkCount)}
            {chunkCount > 0 && <> · {tn('vcChunks', chunkCount)}</>} · {tn('vocabDue', stats.due)}
          </span>
        }
        right={
          <Button variant="secondary" onClick={() => (setSelecting((v) => !v), setSelected(new Set()))} data-testid="vocab-select" aria-pressed={selecting}>
            {selecting ? t('nbWsSelDone') : t('nbWsSelect')}
          </Button>
        }
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
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
          <button type="button" className="lx-chip flex-none" onClick={() => setSort((v) => (v === 'stage' ? 'az' : 'stage'))} aria-label={t('vcSortToggle', { sort: sortLabel })} data-testid="vocab-sort" data-sort={sort}>
            <Icon name="sort" size={16} />
            <span aria-hidden="true">{sortLabel}</span>
          </button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('vcFilters')} data-hscroll="">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="lx-chip flex-none whitespace-nowrap"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setLimit(PAGE);
                setSelected(new Set());
              }}
              data-testid="vocab-filter"
              data-filter={f}
            >
              {t(FILTER_KEY[f])}
            </button>
          ))}
        </div>
      </div>
      {selecting && selected.size > 0 && (
        <div className="lx-glass sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl p-3" data-testid="vocab-bulk">
          <span className="lx-tnum text-sm font-medium">{tn('nbWsSelected', selected.size)}</span>
          <Button variant="secondary" icon="eyeOff" busy={busy} onClick={() => void hideSelected()} data-testid="vocab-bulk-hide">
            {filter === 'hidden' ? t('vcUnhide') : t('nbWsHideSel')}
          </Button>
          {own.map((d) => (
            <button key={d.id} type="button" className="lx-chip" onClick={() => void addToDeck(d.id, d.name)} data-testid="vocab-bulk-deck" data-deck={d.id}>
              + {d.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="lx-tnum text-sm text-muted" data-testid="vocab-count">
          {tn('vcShown', list.length)} · {newLine}
        </p>
        {list.length === 0 ? (
          <p className="text-base text-muted" data-testid="vocab-empty">
            {t('vcEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.slice(0, limit).map((c) => (
              <li key={c.key} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
                <WordRow card={c} nowMs={now} lang={lang} selecting={selecting} selected={selected.has(c.key)} onOpen={() => (selecting ? toggle(c.key) : openSheet('word', { key: c.key }))} />
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
      </div>
    </div>
  );
}

function WordRow({ card, nowMs, lang, onOpen, selecting, selected }: { card: TrainCard; nowMs: number; lang: 'de' | 'en'; onOpen: () => void; selecting: boolean; selected: boolean }) {
  const { t } = useT();
  const conf = confidenceOf(card, nowMs);
  const meaning = meaningOf(card, lang);
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface ${selected ? 'bg-accent-soft' : ''}`}
      onClick={onOpen}
      data-testid="vocab-row"
      data-word={card.id}
      data-kind={card.kind}
      data-stage={card.stage}
      data-hidden={card.hidden || undefined}
      aria-pressed={selecting ? selected : undefined}
    >
      {selecting && (
        <span className={`inline-flex size-5 flex-none items-center justify-center rounded-md border ${selected ? 'border-accent bg-accent text-accent-fg' : 'border-line'}`} aria-hidden="true">
          {selected && <Icon name="check" size={14} />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="max-w-full truncate font-medium" lang="en">
            {card.word}
          </span>
          {card.kind === 'chunk' && <span className="flex-none rounded-full border border-line px-2 py-0.5 text-[0.7rem] font-medium text-muted">{t('vcChunkBadge')}</span>}
        </span>
        {meaning && (
          <span className="truncate text-sm text-muted" lang={lang}>
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
