import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useT, type MessageKey } from '../i18n';
import { Button } from '../ui/Button';
import { lookupWord } from '../bank/words';
import { useClock } from '../app/clock';
import { openWord, setAskContext } from '../app/route';
import { useCoach } from '../coach/store';
import {
  defaultFilter,
  filterRows,
  nextLabel,
  sortRows,
  vocabRows,
  vocabStats,
  type NextLabel,
  type VocabFilter,
  type VocabOrigin,
  type VocabRow,
  type VocabSort,
} from '../coach/vocab';
import { Certainty, PosLabel } from './parts';
import { OwnWordSheet } from './OwnWordSheet';

// Mein Wortschatz: alle Karten sehen und lenken. Die Liste zeigt immer nur ein Stück (50 Zeilen,
// „Mehr anzeigen"), damit auch tausende Karten ohne Ruckeln laufen. Antippen öffnet das Wort-Blatt.

const PAGE = 50;
const LEVELS = [0, 1, 2, 3, 4] as const;
const LV_KEYS: readonly MessageKey[] = ['cLv0', 'cLv1', 'cLv2', 'cLv3', 'cLv4'];
const ORIGINS: ReadonlyArray<[VocabOrigin, MessageKey]> = [
  ['all', 'mwOriginAll'],
  ['bank', 'mwOriginBank'],
  ['legacy', 'mwOriginLegacy'],
  ['user', 'mwOriginUser'],
];
const SORTS: ReadonlyArray<[VocabSort, MessageKey]> = [
  ['recent', 'mwSortRecent'],
  ['alpha', 'mwSortAlpha'],
  ['weak', 'mwSortWeak'],
];

const selectClass = 'mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-accent';

function Chip({ active, onClick, role, children, testId }: { active: boolean; onClick: () => void; role: 'radio' | 'button'; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      role={role === 'radio' ? 'radio' : undefined}
      aria-checked={role === 'radio' ? active : undefined}
      aria-pressed={role === 'button' ? active : undefined}
      onClick={onClick}
      data-testid={testId}
      className={`min-h-10 rounded-full border px-3.5 text-sm capitalize transition-colors ${active ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}

function Stat({ value, label, testId }: { value: string; label: string; testId: string }) {
  return (
    <div className="lx-glass rounded-[var(--radius-card)] p-3 text-center" data-testid={testId}>
      <p className="lx-tnum text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-2xs text-muted">{label}</p>
    </div>
  );
}

function Row({ r, next }: { r: VocabRow; next: string }) {
  const { t } = useT();
  return (
    <li>
      <button
        type="button"
        onClick={() => openWord(r.id)}
        className="flex min-h-14 w-full items-center gap-3 border-b border-line/50 px-1 py-2.5 text-left transition-colors hover:bg-surface"
        data-testid="vocab-row"
        data-id={r.id}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-medium" lang="en">
              {r.word}
            </span>
            {r.hide && <span className="rounded-full bg-surface px-2 text-2xs text-muted">{t('mwHiddenBadge')}</span>}
          </span>
          <span className="block truncate text-sm text-muted">{r.de}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Certainty lv={r.lv} />
          <span className="text-2xs text-subtle">{next}</span>
        </span>
      </button>
    </li>
  );
}

export function VocabScreen() {
  const { t, num } = useT();
  const now = useClock((s) => s.now);
  const cards = useCoach((s) => s.cards);
  const [f, setF] = useState<VocabFilter>(defaultFilter);
  const [own, setOwn] = useState(false);
  const [limit, setLimit] = useState({ sig: '', n: PAGE });
  useEffect(() => setAskContext(''), []);

  const rows = useMemo(() => vocabRows(cards), [cards]);
  const stats = useMemo(() => vocabStats(rows, now), [rows, now]);
  // Die Eingabe bleibt flüssig, die Liste folgt mit kleiner Verzögerung.
  const query = useDeferredValue(f.query);
  const eff = useMemo<VocabFilter>(() => ({ ...f, query }), [f, query]);
  const list = useMemo(() => sortRows(filterRows(rows, eff, now), eff.sort), [rows, eff, now]);
  const sig = `${eff.query}|${eff.level}|${eff.due}|${eff.hidden}|${eff.origin}|${eff.sort}`;
  const shown = limit.sig === sig ? limit.n : PAGE;

  // Wörter der Wortbank, die noch keine Karte sind: nur bei offener Suche ohne einengende Filter.
  const bankSearch = eff.query.trim().length >= 2 && eff.level === 'all' && !eff.due && !eff.hidden && (eff.origin === 'all' || eff.origin === 'bank');
  const bankHits = useMemo(() => (bankSearch ? lookupWord(eff.query, 6).filter((w) => !cards.has(w.i)) : []), [bankSearch, eff.query, cards]);

  const set = (patch: Partial<VocabFilter>) => setF((cur) => ({ ...cur, ...patch }));
  const nextText = (l: NextLabel): string => {
    switch (l.kind) {
      case 'none':
        return t('mwNextNone');
      case 'due':
        return t('mwNextDue');
      case 'today':
        return t('mwNextToday');
      case 'tomorrow':
        return t('mwNextTomorrow');
      default:
        return t('mwNextDays', { n: l.n });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6" data-testid="vocab" data-count={rows.length}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('mwTitle')}</h1>
        <Button variant="secondary" icon="plus" onClick={() => setOwn(true)} data-testid="vocab-add">
          {t('mwAddOwn')}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3" data-testid="vocab-stats">
        <Stat value={num(stats.total)} label={t('mwStatTotal')} testId="stat-total" />
        <Stat value={num(stats.solid)} label={t('mwStatSolid')} testId="stat-solid" />
        <Stat value={num(stats.due)} label={t('mwStatDue')} testId="stat-due" />
      </div>
      {stats.hidden > 0 && <p className="mt-2 text-xs text-muted">{t('mwStatHidden', { n: stats.hidden })}</p>}

      <div className="mt-5">
        <label className="block text-xs text-muted" htmlFor="vocab-search">
          {t('mwSearchLabel')}
        </label>
        <input
          id="vocab-search"
          type="search"
          value={f.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder={t('mwSearchPh')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={selectClass}
          data-testid="vocab-search"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t('mwLevelLabel')} data-testid="vocab-levels">
        <Chip role="radio" active={f.level === 'all'} onClick={() => set({ level: 'all' })} testId="lv-all">
          {t('mwLvAll')}
        </Chip>
        {LEVELS.map((lv) => (
          <Chip key={lv} role="radio" active={f.level === lv} onClick={() => set({ level: lv })} testId={`lv-${lv}`}>
            {t(LV_KEYS[lv]!)}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip role="button" active={f.due} onClick={() => set({ due: !f.due })} testId="filter-due">
          {t('mwDueChip')}
        </Chip>
        <Chip role="button" active={f.hidden} onClick={() => set({ hidden: !f.hidden })} testId="filter-hidden">
          {t('mwHiddenChip')}
        </Chip>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          {t('mwOriginLabel')}
          <select value={f.origin} onChange={(e) => set({ origin: e.target.value as VocabOrigin })} className={selectClass} data-testid="vocab-origin">
            {ORIGINS.map(([v, key]) => (
              <option key={v} value={v}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          {t('mwSortLabel')}
          <select value={f.sort} onChange={(e) => set({ sort: e.target.value as VocabSort })} className={selectClass} data-testid="vocab-sort">
            {SORTS.map(([v, key]) => (
              <option key={v} value={v}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-5 text-xs text-muted" aria-live="polite" data-testid="vocab-count">
        {rows.length === 0 ? '' : t('mwCount', { n: list.length })}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted" data-testid="vocab-empty">
          {t('mwEmpty')}
        </p>
      ) : list.length === 0 && bankHits.length === 0 ? (
        <p className="mt-3 text-sm text-muted" data-testid="vocab-nomatch">
          {t('mwNoMatch')}
        </p>
      ) : (
        <ul className="mt-1" aria-label={t('mwListLabel')} data-testid="vocab-list">
          {list.slice(0, shown).map((r) => (
            <Row key={r.id} r={r} next={nextText(nextLabel(r, now))} />
          ))}
        </ul>
      )}
      {list.length > shown && (
        <div className="mt-4">
          <Button variant="secondary" className="w-full" onClick={() => setLimit({ sig, n: shown + PAGE })} data-testid="vocab-more">
            {t('mwMore', { n: list.length - shown })}
          </Button>
        </div>
      )}

      {bankHits.length > 0 && (
        <section className="mt-6" data-testid="vocab-bank">
          <h2 className="lx-eyebrow text-muted">{t('mwBankTitle')}</h2>
          <ul className="mt-1">
            {bankHits.map((w) => (
              <li key={w.i}>
                <button
                  type="button"
                  onClick={() => openWord(w.i)}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-line/50 px-1 py-2.5 text-left transition-colors hover:bg-surface"
                  data-testid="vocab-bank-row"
                  data-id={w.i}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2 font-medium" lang="en">
                      <span className="truncate">{w.w}</span>
                    </span>
                    <span className="block truncate text-sm text-muted">{w.de}</span>
                  </span>
                  <PosLabel pos={w.p} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <OwnWordSheet open={own} onClose={() => setOwn(false)} />
    </div>
  );
}
