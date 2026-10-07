import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { closeSheet, openSheet } from '../../../app/sheets';
import { entriesFor, type SheetProps } from '../../../app/registry';
import { useLive } from '../../../data/live';
import { dueFehlersaetze } from '../../../domain/repair/fehlersaetze';
import { startDrill } from '../../drills/session';
import { startGrammar } from '../../grammar/session';
import { dayKey, dayKeyNoon, daysBetween, learningDayEnd } from '../../../domain/date';
import { meaningOf } from '../../../domain/srs/cards';
import { forecast } from '../../../domain/srs/forecast';
import { normalizeNewPerDay } from '../../../domain/srs/queue';
import { backlogBraked, overdueCount } from '../../../domain/unit/backlog';
import { BUILTIN_DECKS, createDeckOp, deckCards, deckCounts, inboxReach, isLeechCard, newDeckId, prefsOp, visibleDecks, wrongSince, type DeckFilter } from '../../../domain/srs/decks';
import { histOf, weekStartMs } from '../../../domain/srs/flip';
import type { TrainCard } from '../../../domain/srs/types';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Eyebrow } from '../../../ui/Eyebrow';
import { Row, RowList } from '../../../ui/RowList';
import { Segmented } from '../../../ui/Segmented';
import { Sheet } from '../../../ui/Sheet';
import { unlockSpeech, useSpeech } from '../../../platform/speech';
import { toast } from '../../../ui/Toast';
import { useDecks, writeDecks } from '../decksStore';
import { WordSheet } from '../list/WordSheet';
import { AddWordSheet } from '../list/AddWordSheet';
import { startExtra } from '../start';
import { useDeckCtx, useQuota, useVocabCards } from './data';
import { decksErrorKey } from './errors';
import { Counts, DECK_LABEL } from './VocabHub';

const NO_DOCS = new Map<string, Record<string, unknown>>();

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
    // „Alle Stapel“ lag darunter und würde sonst über der neuen Stapel-Seite stehen bleiben.
    closeSheet('x:decks');
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

type ExtraOpt = { id: string; label: string; why: string; cards: TrainCard[]; allowNew?: boolean; size?: number };
type ExtraLine = { id: string; label: string; why: string; n: number | null; disabled: boolean; run: () => void };

/**
 * Blatt „Extra“ (`x:extra`, Gesamtkonzept 3.7): jede Zeile nennt Zahl und Grund. Wörter-Runden sind zeitweilige Sitzungen ohne neues
 * Dokument (N26), neue Karten nur im Rahmen des Tageskontingents; Grammatik, Anwenden und Sprechen starten ihre bestehenden Übungen.
 * Alles hier ist freiwillig und zählt nie zur Pflicht, zur Serie oder zum Fortschritt.
 */
export function ExtraSheet({ onClose, params }: SheetProps) {
  // Lernplattform 2.0 §2.5: im Reiter Wörter nur Wörter-Zeilen; der Grammatik-Reiter öffnet dasselbe Blatt mit `scope: 'grammar'`.
  const scope: 'words' | 'grammar' | 'all' = params && typeof params === 'object' && (params as { scope?: unknown }).scope === 'grammar' ? 'grammar' : params && typeof params === 'object' && (params as { scope?: unknown }).scope === 'words' ? 'words' : 'all';
  const { t, tn } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const decks = useDecks((s) => s.decks);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const ctx = useDeckCtx();
  const gdocs = useLive((s) => s.collections.grammar) ?? NO_DOCS;
  const repairDoc = useLive((st) => st.docs['app/repair']);
  const errors = useMemo(() => dueFehlersaetze({ grammarDocs: gdocs, repairDoc, nowMs: now, today }).length, [gdocs, repairDoc, now, today]);
  const tts = useSpeech((s) => s.status === 'ready');
  const opts = useMemo((): ExtraOpt[] => {
    const vis = cards.filter((c) => !c.hidden);
    const forgot = vis.filter((c) => histOf(c.doc).some((h) => h.g === 1 && dayKey(h.t) === today));
    const tomorrowEnd = learningDayEnd(learningDayEnd(now) + 1000);
    const tomorrow = vis.filter((c) => !c.isNew && c.fsrs.due >= learningDayEnd(now) && c.fsrs.due < tomorrowEnd);
    const hard = deckCards(vis, 'hard', decks, ctx).filter((c) => !c.isNew);
    const leech = vis.filter(isLeechCard);
    const mistakes = vis.filter((c) => wrongSince(c, weekStartMs(now)));
    const fresh = vis.filter((c) => c.isNew);
    return [
      { id: 'new', label: t('nbWsExtraNew'), why: quota.left > 0 ? t('nbWsXNewWhy', { n: quota.left }) : t('nbWsXNewFull'), cards: quota.left > 0 ? fresh : [], allowNew: true, size: quota.left },
      { id: 'hard', label: t('nbWsXHardTitle'), why: t('nbWsXHardWhy'), cards: hard },
      { id: 'leech', label: t('nbWsXLeechTitle'), why: t('nbWsXLeechWhy'), cards: leech },
      { id: 'mistakes', label: t('nbWsExtraMistakes'), why: t('nbWsXMistakesWhy'), cards: mistakes },
      { id: 'forgot', label: t('nbWsExtraForgot'), why: t('nbWsXForgotWhy'), cards: forgot },
      { id: 'tomorrow', label: t('nbWsExtraTomorrow'), why: t('nbWsXTomorrowWhy'), cards: tomorrow },
    ];
  }, [cards, now, today, quota.left, decks, ctx, t]);
  const startCards = (o: ExtraOpt) => {
    const keys = new Set(o.cards.map((c) => c.key));
    startExtra(api, { deck: 'all', pick: (c) => keys.has(c.key), allowNew: o.allowNew === true, size: Math.min(o.size ?? 20, Math.max(1, keys.size)), label: o.label });
  };
  const wordLines: ExtraLine[] = opts.map((o) => ({ id: o.id, label: o.label, why: o.why, n: o.id === 'new' ? Math.min(quota.left, o.cards.length) : o.cards.length, disabled: o.cards.length === 0, run: () => startCards(o) }));

  const grammarStart = () => {
    const first = startGrammar({ mode: 'xtra' });
    if (first === 'typed') api.focusNow();
    onClose();
    go({ name: 'grammarSession', mode: 'xtra' });
  };
  const goTo = (route: Parameters<typeof go>[0]) => () => {
    onClose();
    go(route);
  };
  const apply = entriesFor('apply');
  const entryLine = (id: string, label: MessageKey, why: MessageKey): ExtraLine | null => {
    const e = apply.find((x) => x.id === id);
    if (!e) return null;
    return {
      id,
      label: t(label),
      why: t(why),
      n: null,
      disabled: false,
      run: () => {
        onClose();
        if (e.start) e.start(api);
        else if (e.route) go(e.route);
      },
    };
  };
  const grammarLines: ExtraLine[] = [
    { id: 'gr-free', label: t('nbWsXFreeGrammar'), why: t('nbWsXFreeGrammarWhy'), n: null, disabled: false, run: grammarStart },
    { id: 'gr-errors', label: t('nbWsXErrors'), why: errors > 0 ? t('nbWsXErrorsWhy', { n: errors }) : t('nbWsXErrorsNone'), n: errors, disabled: errors === 0, run: goTo({ name: 'repairRound' }) },
    { id: 'gr-lookup', label: t('nbLernenLookupRow'), why: t('nbLernenLookupSub'), n: null, disabled: false, run: goTo({ name: 'grammar' }) },
    { id: 'gr-traps', label: t('nbLernenTrapsRow'), why: t('nbLernenTrapsSub'), n: null, disabled: false, run: goTo({ name: 'patterns' }) },
    { id: 'gr-wissen', label: t('nbLernenWissenRow'), why: t('nbLernenWissenSub'), n: null, disabled: false, run: goTo({ name: 'wissen' }) },
  ];
  const applyLines: ExtraLine[] = [
    {
      id: 'ap-order',
      label: t('nbWsXOrder'),
      why: t('nbWsXOrderWhy'),
      n: null,
      disabled: false,
      run: () => {
        unlockSpeech();
        const first = startDrill('order');
        if (first === 'typed') api.focusNow();
        else api.blur();
        onClose();
        go({ name: 'drill', kind: 'order', ctx: 'xtra' });
      },
    },
    entryLine('training-wordform', 'nbWsXWordform', 'nbWsXWordformWhy'),
    entryLine('training-colloc', 'nbWsXColloc', 'nbWsXCollocWhy'),
    entryLine('training-phrasal', 'nbWsXPhrasal', 'nbWsXPhrasalWhy'),
  ].filter((l): l is ExtraLine => l !== null);
  const speakLines: ExtraLine[] = [
    {
      id: 'speak',
      label: t('nbWsXSpeak'),
      why: t('nbWsXSpeakWhy'),
      n: null,
      disabled: false,
      run: () => {
        onClose();
        go({ name: 'speak' });
      },
    },
  ];
  const group = (id: string, title: string, lines: ExtraLine[]) => (
    <section key={id} className="flex flex-col gap-2" data-testid={`extra-group-${id}`} aria-label={title}>
      <p className="lx-eyebrow m-0">{title}</p>
      <ul className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface p-0">
        {lines.map((l) => (
          <li key={l.id}>
            <button type="button" disabled={l.disabled} onClick={l.run} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-50" data-testid="extra-opt" data-opt={l.id} data-n={l.n ?? ''}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{l.label}</span>
                <span className="text-sm text-muted">{l.why}</span>
              </span>
              {l.n !== null && (
                <span className="lx-tnum flex-none text-sm font-semibold text-muted" aria-label={tn('nbWsExtraCards', l.n)}>
                  {l.n}
                </span>
              )}
              <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <Sheet open onClose={onClose} title={t('nbWsExtraTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-5" data-testid="extra-sheet">
        {scope !== 'grammar' && group('words', t('nbWsXWords'), wordLines)}
        {scope !== 'words' && group('grammar', t('nbWsXGrammar'), grammarLines)}
        {scope !== 'words' && group('apply', t('nbWsXApply'), applyLines)}
        {scope !== 'words' && group('speak', t('nbWsXSpeak'), speakLines)}
        {scope !== 'grammar' && tts && (
          <button
            type="button"
            onClick={() => {
              // iPhone: Sprachausgabe im selben Klick freischalten; die Schleife spricht danach von selbst.
              unlockSpeech();
              onClose();
              go({ name: 'listenLoop' });
            }}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-2.5 text-left"
            data-testid="extra-loop"
          >
            <Icon name="headphones" size={18} className="flex-none text-subtle" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{t('nbWsLoopTitle')}</span>
              <span className="text-sm text-muted">{t('nbWsLoopSub')}</span>
            </span>
            <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
          </button>
        )}
        <p className="text-sm text-muted">{t('nbWsXNote')}</p>
      </div>
    </Sheet>
  );
}

type Mode = 'auto' | 'flip' | 'type';

/** Blatt „Modus“ (`x:mode`): wie die Wiederholen-Runde abfragt (Automatisch · Aufdecken · Tippen). */
export function ModeSheet({ onClose }: SheetProps) {
  const { t } = useT();
  const decks = useDecks((s) => s.decks);
  const mode: Mode = decks.prefs.mode ?? 'auto';
  const setMode = (m: Mode) => {
    void writeDecks((cur) => prefsOp(cur, { mode: m })).then((r) => {
      if (!r.ok) toast(t(decksErrorKey(r.error)), 'error');
      else onClose();
    });
  };
  return (
    <Sheet open onClose={onClose} title={t('nbWsHModeTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-4" data-testid="mode-sheet">
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
      </div>
    </Sheet>
  );
}

/**
 * Blatt „Alle Stapel“ (`x:decks`): was im Hub nicht mehr oben steht – Eingangskorb, alle Stapel (eingebaut und eigene), neuer Stapel,
 * Prognose der nächsten 7 Tage und zuletzt Hinzugefügtes. Test-IDs wie im früheren Hub.
 */
export function AllDecksSheet({ onClose }: SheetProps) {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const cards = useVocabCards();
  const quota = useQuota(cards);
  const ctx = useDeckCtx();
  const decks = useDecks((s) => s.decks);
  const visible = useMemo(() => cards.filter((c) => !c.hidden), [cards]);
  const all = useMemo(() => deckCounts(visible, now), [visible, now]);
  const behind = useMemo(() => overdueCount(visible, now), [visible, now]);
  const braked = backlogBraked(behind);
  const fc = useMemo(() => forecast(visible, now), [visible, now]);
  const fcMax = Math.max(1, ...fc.map((d) => d.n));
  const inbox = inboxReach(all.new, normalizeNewPerDay(quota.perDay), braked);
  const rows = useMemo(() => {
    const builtin = BUILTIN_DECKS.map((id) => ({ id, name: t(DECK_LABEL[id]), cards: deckCards(cards, id, decks, ctx) })).filter((d) => d.cards.length > 0 && d.id !== 'inbox');
    const own = visibleDecks(decks).map((d) => ({ id: d.id, name: d.name, cards: deckCards(cards, d.id, decks, ctx) }));
    return [...builtin, ...own].map((d) => ({ ...d, counts: deckCounts(d.cards, now) }));
  }, [cards, decks, ctx, now, t]);
  const recent = useMemo(() => [...visible].sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : b.order - a.order)).slice(0, 5), [visible]);
  const dayLabel = (day: string, i: number) => (i === 0 ? t('nbWsTomorrow') : new Date(dayKeyNoon(day)).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' }));
  const state = (c: TrainCard): string => {
    if (c.isNew) return t('nbWsStateNew');
    const d = daysBetween(today, dayKey(c.fsrs.due));
    if (c.fsrs.due <= now || d <= 0) return t('nbWsStateToday');
    if (d === 1) return t('nbWsStateTomorrow');
    return t('nbWsStateIn', { n: d });
  };
  const open = (route: Parameters<typeof go>[0]) => {
    onClose();
    go(route);
  };
  return (
    <Sheet open onClose={onClose} title={t('nbWsHAllDecksTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-5" data-testid="decks-sheet">
        <section className="flex flex-col gap-2.5" data-testid="ws-forecast" aria-label={t('nbWsForecast')}>
          <Eyebrow>{t('nbWsForecast')}</Eyebrow>
          <ol className="m-0 grid list-none grid-cols-7 items-end gap-1.5 p-0">
            {fc.map((d, i) => (
              <li key={d.day} className="flex flex-col items-center gap-1" aria-label={t('nbWsForecastBar', { day: dayLabel(d.day, i), n: d.n })} data-n={d.n}>
                <span className="lx-tnum text-xs text-muted" aria-hidden="true">
                  {d.n}
                </span>
                <span className="block w-full rounded-md bg-accent/70" style={{ height: `${Math.max(3, Math.round((d.n / fcMax) * 44))}px` }} aria-hidden="true" />
                <span className="max-w-full truncate text-2xs text-subtle" aria-hidden="true">
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
            onClick={() => open({ name: 'deck', id: 'inbox' })}
            testId="ws-inbox"
            data={{ 'data-deck': 'inbox' }}
          />
          {rows.map((d) => (
            <Row key={d.id} icon="cards" channel="cards" title={d.name} value={<Counts c={d.counts} />} chevron onClick={() => open({ name: 'deck', id: d.id })} testId="ws-deck" data={{ 'data-deck': d.id }} />
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
          <Row title={tn('nbWsAll', visible.length)} sub={t('nbWsAllSub')} onClick={() => open({ name: 'vocabList' })} testId="ws-all-list" />
        </RowList>
      </div>
    </Sheet>
  );
}
