import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import type { ScreenProps } from '../../../app/registry';
import { openSheet } from '../../../app/sheets';
import { meaningOf } from '../../../domain/srs/cards';
import { builtinPrefOp, deckCards, deckCounts, isBuiltinDeck, updateDeckOp, type DeckMode } from '../../../domain/srs/decks';
import type { FlipDir } from '../../../domain/srs/flip';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Segmented } from '../../../ui/Segmented';
import { useSpeech } from '../../../platform/speech';
import { toast } from '../../../ui/Toast';
import { ScreenHeader } from '../../learn/ui';
import { useDecks, writeDecks } from '../decksStore';
import { startExtra } from '../start';
import { useDeckCtx, useQuota, useVocabCards } from './data';
import { decksErrorKey } from './errors';
import { Counts, DECK_LABEL } from './VocabHub';

// Seite eines Stapels (plan.md N21/N22): Zähler, gemerkter Modus, Richtung und Größe, „Lernen“.
// Eigene Stapel: umbenennen und ausblenden (Löschen = `hidden: true`, data-guard 00:35).
// Eingebaute Stapel merken Modus/Richtung/Größe in `app/decks.builtin`.

const ROWS = 50;
const SIZES = ['10', '20', '30'] as const;

export function DeckScreen({ route }: ScreenProps<'deck'>) {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const now = useClock((s) => s.now);
  const decks = useDecks((s) => s.decks);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const ctx = useDeckCtx();
  const tts = useSpeech((s) => s.status === 'ready');
  const id = route.id;
  const builtin = isBuiltinDeck(id);
  const own = builtin ? null : (decks.decks[id] ?? null);
  const prefs = builtin ? (decks.builtin[id] ?? {}) : (own ?? {});
  const mode: DeckMode = prefs.mode ?? (decks.prefs.mode === 'type' ? 'type' : 'flip');
  const dir: FlipDir = prefs.dir ?? decks.prefs.dir ?? 'de-en';
  const size = String(prefs.size && SIZES.includes(String(prefs.size) as (typeof SIZES)[number]) ? prefs.size : 20) as (typeof SIZES)[number];
  const [name, setName] = useState(own?.name ?? '');
  const [renaming, setRenaming] = useState(false);
  const list = useMemo(() => deckCards(cards, id, decks, ctx), [cards, id, decks, ctx]);
  const counts = useMemo(() => deckCounts(list, now), [list, now]);
  const shown = { ...counts, new: Math.min(counts.new, quota.left) };
  const title = builtin ? t(DECK_LABEL[id]) : (own?.name ?? id);

  const save = (patch: { mode?: DeckMode; dir?: FlipDir; size?: number; name?: string; hidden?: boolean }, after?: () => void) => {
    void writeDecks((cur) => (builtin ? builtinPrefOp(cur, id, patch) : updateDeckOp(cur, id, patch))).then((r) => {
      if (!r.ok) toast(t(decksErrorKey(r.error)), 'error');
      else after?.();
    });
  };

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10" data-testid="deck-screen" data-deck={id}>
      <ScreenHeader title={title} back={back} lead={<span className="lx-tnum">{tn('nbWsDeckCards', list.length)}</span>} />
      <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Counts c={shown} testId="deck-counts" />
          {shown.new + shown.learning + shown.due === 0 && list.length > 0 && <span className="text-sm text-muted">{t('nbWsDeckNothingDue')}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('nbWsModeLabel')}</p>
          <Segmented<DeckMode>
            label={t('nbWsModeLabel')}
            value={mode}
            options={[
              { value: 'flip', label: t('nbWsModeFlip') },
              { value: 'type', label: t('nbWsModeType') },
              { value: 'listen', label: t('nbWsModeListen') },
            ]}
            onChange={(m) => save({ mode: m })}
            testId="deck-mode"
          />
          {mode === 'listen' && (
            <p className="text-sm text-muted" data-testid="deck-listen-hint">
              {t(tts ? 'nbWsListenHint' : 'nbWsListenNoTts')}
            </p>
          )}
        </div>
        {mode === 'flip' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('nbWsDirLabel')}</p>
            <Segmented<FlipDir>
              label={t('nbWsDirLabel')}
              value={dir}
              options={[
                { value: 'de-en', label: t('nbWsDirDeEn') },
                { value: 'en-de', label: t('nbWsDirEnDe') },
                { value: 'mix', label: t('nbWsDirMix') },
              ]}
              onChange={(d) => save({ dir: d })}
              testId="deck-dir"
            />
          </div>
        )}
        <div className="flex max-w-xs flex-col gap-2">
          <p className="text-sm font-medium">{t('nbWsSizeLabel')}</p>
          <Segmented<(typeof SIZES)[number]> label={t('nbWsSizeLabel')} value={size} options={SIZES.map((n) => ({ value: n, label: n }))} onChange={(v) => save({ size: Number(v) })} testId="deck-size" />
        </div>
        <Button
          variant="primary"
          size="lg"
          iconAfter="arrowRight"
          disabled={list.length === 0}
          onClick={() => startExtra(api, { deck: id, size: Number(size), mode, dir, label: title })}
          data-testid="deck-start"
        >
          {t('nbWsStart')}
        </Button>
      </section>

      {own && (
        <section className="flex flex-col gap-3" data-testid="deck-own">
          {renaming ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save({ name }, () => setRenaming(false));
              }}
            >
              <input className="lx-field min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} aria-label={t('nbWsDeckName')} data-testid="deck-name" maxLength={40} />
              <Button type="submit" variant="primary" data-testid="deck-rename-save">
                {t('nbWsSave')}
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setRenaming(true)} data-testid="deck-rename">
                {t('nbWsRename')}
              </Button>
              <Button
                variant="ghost"
                icon="eyeOff"
                onClick={() =>
                  save({ hidden: true }, () => {
                    toast(t('nbWsDeckHidden'), 'info');
                    back();
                  })
                }
                data-testid="deck-hide"
              >
                {t('nbWsHideDeck')}
              </Button>
            </div>
          )}
        </section>
      )}

      {id === 'inbox' && <p className="text-sm text-muted">{t('nbWsInboxReviewHint')}</p>}

      {list.length === 0 ? (
        <p className="text-base text-muted" data-testid="deck-empty">
          {t('nbWsDeckEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="deck-cards">
          {list.slice(0, ROWS).map((c) => (
            <li key={c.key} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 56px' }}>
              <button type="button" className="flex w-full min-w-0 flex-col rounded-xl px-3 py-2 text-left hover:bg-surface" onClick={() => openSheet('word', { key: c.key })} data-testid="vocab-row" data-word={c.id} data-kind={c.kind}>
                <span className="truncate font-medium" lang="en">
                  {c.word}
                </span>
                <span className="truncate text-sm text-muted" lang={lang}>
                  {meaningOf(c, lang)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
