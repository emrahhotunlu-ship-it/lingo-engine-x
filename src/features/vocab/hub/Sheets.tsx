import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import type { SheetProps } from '../../../app/registry';
import { dayKey, learningDayEnd } from '../../../domain/date';
import { createDeckOp, isLeechCard, newDeckId, visibleDecks, wrongSince, type DeckFilter } from '../../../domain/srs/decks';
import { histOf, weekStartMs } from '../../../domain/srs/flip';
import type { TrainCard } from '../../../domain/srs/types';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { useDecks, writeDecks } from '../decksStore';
import { WordSheet } from '../list/WordSheet';
import { AddWordSheet } from '../list/AddWordSheet';
import { startExtra } from '../start';
import { useQuota, useVocabCards } from './data';
import { decksErrorKey } from './errors';

// Blätter des Wortschatz-Bereichs (plan.md §1.2): Wortblatt (von überall), Hinzufügen, Neuer Stapel,
// Extra-Runde. Die Extra-Runde startet zeitweilige Sitzungen ohne neues Dokument (N26).

/** Wortblatt `word` ({ key } = `vocab/<id>` bzw. `chunk/<id>`). */
export function WordSheetHost({ params, onClose }: SheetProps) {
  const key = params && typeof params === 'object' && typeof (params as { key?: unknown }).key === 'string' ? (params as { key: string }).key : null;
  const cards = useVocabCards();
  const card = key ? (cards.find((c) => c.key === key) ?? null) : null;
  return <WordSheet card={card} onClose={onClose} />;
}

export function AddSheetHost({ onClose }: SheetProps) {
  return <AddWordSheet open onClose={onClose} />;
}

const SRC_CHOICES = ['lookup', 'read', 'translate', 'preply', 'lesson', 'job', 'ai', 'user', 'scene'] as const;

/** Blatt „Neuer Stapel“ (`x:deck-new`): Name und Filter; danach die Seite des Stapels. */
export function NewDeckSheet({ onClose }: SheetProps) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const [name, setName] = useState('');
  const [src, setSrc] = useState<string[]>([]);
  const [kinds, setKinds] = useState<Array<'vocab' | 'chunk'>>([]);
  const [hard, setHard] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const create = async () => {
    const id = newDeckId(Date.now());
    const filter: DeckFilter = { ...(src.length ? { src } : {}), ...(kinds.length ? { kinds } : {}), ...(hard ? { hard: true } : {}), ...(query.trim() ? { query: query.trim() } : {}) };
    setBusy(true);
    const r = await writeDecks((cur) => createDeckOp(cur, { id, name, filter }, today));
    setBusy(false);
    if (!r.ok) {
      toast(t(decksErrorKey(r.error)), 'error');
      return;
    }
    onClose();
    go({ name: 'deck', id });
  };
  const chip = (on: boolean, label: string, onClick: () => void, testId: string, data?: string) => (
    <button key={testId + (data ?? '')} type="button" className="lx-chip" aria-pressed={on} onClick={onClick} data-testid={testId} data-value={data}>
      {label}
    </button>
  );
  return (
    <Sheet open onClose={onClose} title={t('nbWsNewDeck')} closeLabel={t('close')}>
      <form
        className="flex flex-col gap-5"
        data-testid="deck-new"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('nbWsDeckName')}</span>
          <input className="lx-field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-testid="deck-new-name" />
        </label>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('nbWsDeckFilter')}</p>
          <p className="text-xs text-muted">{t('nbWsFilterSrc')}</p>
          <div className="flex flex-wrap gap-2">{SRC_CHOICES.map((s) => chip(src.includes(s), t(`nbWsSrc_${s}` as MessageKey), () => setSrc((l) => toggle(l, s)), 'deck-new-src', s))}</div>
          <p className="text-xs text-muted">{t('nbWsFilterKind')}</p>
          <div className="flex flex-wrap gap-2">
            {chip(kinds.includes('vocab'), t('nbWsKindVocab'), () => setKinds((l) => toggle(l, 'vocab')), 'deck-new-kind', 'vocab')}
            {chip(kinds.includes('chunk'), t('nbWsKindChunk'), () => setKinds((l) => toggle(l, 'chunk')), 'deck-new-kind', 'chunk')}
            {chip(hard, t('nbWsFilterHard'), () => setHard((v) => !v), 'deck-new-hard')}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('nbWsFilterQuery')}</span>
            <input className="lx-field" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="deck-new-query" />
          </label>
        </div>
        <div>
          <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()} data-testid="deck-new-create">
            {t('nbWsCreate')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

type ExtraOpt = { id: string; label: string; sub?: string; cards: TrainCard[]; allowNew?: boolean; size?: number };

/** Blatt „Extra-Runde“ (`x:extra`, N26): zeitweilige Sitzungen, neue Karten nur im Rahmen des Kontingents. */
export function ExtraSheet({ onClose }: SheetProps) {
  const { t, tn } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const decks = useDecks((s) => s.decks);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const opts = useMemo((): ExtraOpt[] => {
    const vis = cards.filter((c) => !c.hidden);
    const forgot = vis.filter((c) => histOf(c.doc).some((h) => h.g === 1 && dayKey(h.t) === today));
    const tomorrowEnd = learningDayEnd(learningDayEnd(now) + 1000);
    const tomorrow = vis.filter((c) => !c.isNew && c.fsrs.due >= learningDayEnd(now) && c.fsrs.due < tomorrowEnd);
    const leech = vis.filter(isLeechCard);
    const mistakes = vis.filter((c) => wrongSince(c, weekStartMs(now)));
    const fresh = vis.filter((c) => c.isNew);
    return [
      { id: 'forgot', label: t('nbWsExtraForgot'), cards: forgot },
      { id: 'tomorrow', label: t('nbWsExtraTomorrow'), cards: tomorrow },
      { id: 'leech', label: t('nbWsExtraLeech'), cards: leech },
      { id: 'mistakes', label: t('nbWsExtraMistakes'), cards: mistakes },
      { id: 'new', label: t('nbWsExtraNew'), sub: t('nbWsExtraNewSub', { n: quota.left }), cards: quota.left > 0 ? fresh : [], allowNew: true, size: quota.left },
    ];
  }, [cards, now, today, quota.left, t]);
  const start = (o: ExtraOpt) => {
    const keys = new Set(o.cards.map((c) => c.key));
    startExtra(api, { deck: 'all', pick: (c) => keys.has(c.key), allowNew: o.allowNew === true, size: Math.min(o.size ?? 20, Math.max(1, keys.size)), label: o.label });
  };
  const own = visibleDecks(decks);
  return (
    <Sheet open onClose={onClose} title={t('nbWsExtraTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-4" data-testid="extra-sheet">
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {opts.map((o) => (
            <li key={o.id}>
              <button type="button" disabled={o.cards.length === 0} onClick={() => start(o)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-50" data-testid="extra-opt" data-opt={o.id} data-n={o.cards.length}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{o.label}</span>
                  <span className="text-sm text-muted">{o.sub ?? (o.cards.length ? tn('nbWsExtraCards', o.cards.length) : t('nbWsExtraNone'))}</span>
                </span>
                <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('nbWsExtraDeck')}</p>
          <div className="flex flex-wrap gap-2">
            {(['hard', 'job', 'phrases'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className="lx-chip"
                onClick={() => {
                  onClose();
                  go({ name: 'deck', id: d });
                }}
                data-testid="extra-deck"
                data-deck={d}
              >
                {t(d === 'hard' ? 'nbWsDeckHard' : d === 'job' ? 'nbWsDeckJob' : 'nbWsDeckPhrases')}
              </button>
            ))}
            {own.map((d) => (
              <button
                key={d.id}
                type="button"
                className="lx-chip"
                onClick={() => {
                  onClose();
                  go({ name: 'deck', id: d.id });
                }}
                data-testid="extra-deck"
                data-deck={d.id}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted">{t('nbWsExtraNote')}</p>
      </div>
    </Sheet>
  );
}
