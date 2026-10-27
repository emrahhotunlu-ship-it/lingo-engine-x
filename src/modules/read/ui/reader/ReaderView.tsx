import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ArticleItem, ReadState, ReadView } from '../../schemas';
import { VIEWS } from '../../schemas';
import { summarizeChecks } from '../../domain/readerCheck';
import { buildModel, highlightMap, initialRevealed, pickChecks, pickKeyWords, toggleAll, toggleSentence, topVisibleSentence, userRevealCount, viewOf } from '../../domain/readerModel';
import { formatAsOf, formatPubDay, rdrText, topicKey, type RdrKey } from '../../domain/readerText';
import { buildStatePatch, canFinish, clockSeconds, newClock, pauseClock, resumeClock, type ReadClock } from '../../domain/readerTiming';
import { countWords, minutesFor } from '../../domain/text';
import { Button, Icon, Segmented, lookupOpenMs, speak, unlockSpeech, useT } from '../../sharedUi';
import { CheckCard } from './CheckCard';
import { KeyWordsCard } from './KeyWordsCard';
import { SentenceRow } from './SentenceRow';

// Der Leser (docs/umbau/lesen-plan.md §2.2): Absätze Satz für Satz, drei Ansichten, Wort antippen, Schlüsselwörter, Check,
// Lesezustand. Der Artikel kommt als Eigenschaft (testbarer Kern); `ReaderScreen` lädt ihn nur.
// Lesezustand wird gebündelt geschrieben (beim Ausblenden und Verlassen der Seite), nie beim Bildlauf; die Lesezeit berührt weder
// Pflicht noch Serie noch `app/profile`.

export type ReaderViewProps = {
  article: ArticleItem;
  /** Bisheriger Lesezustand aus dem Monatsindex. */
  state?: ReadState | null;
  /** Startansicht (aus `read/p`); unbekannt = B. */
  view?: string | null;
  /** Beim Aufdecken eines Satzes automatisch vorlesen (`read/p.autoSpeak`, Standard aus). */
  autoSpeak?: boolean;
  /** Der Leser hat die Ansicht gewechselt (zum Merken in `read/p`). */
  onViewChange?: (view: ReadView) => void;
  /** Gebündelter Lesezustand beim Ausblenden/Verlassen; nur wenn sich etwas getan hat. */
  onProgress?: (patch: ReadState) => void;
  /** Öffnung über „Weiterlesen“: direkt zu diesem Satz springen (ab 1), ohne Zwischenkarte. */
  startAt?: number | null;
  /** Nächster ungelesener Artikel; ohne ihn führt der Abschlussknopf zurück zur Liste. */
  onNext?: () => void;
  /** Zurück zur Liste (Abschlussknopf, wenn es keinen nächsten Artikel gibt). */
  onBack?: () => void;
  /** Kurslektion (Paket L8): eigene Kopfzeile, Einschübe vor und nach dem Text, Abschluss steht in `afterCheck`. Ohne Angabe: ein Tagesartikel. */
  lesson?: LessonSlots;
};

/** Einschübe einer Kurslektion im Leser. Der Rest (Ansichten, Satzzeilen, Wort antippen, Prüffragen, Lesezeit) ist derselbe wie beim Artikel. */
export type LessonSlots = {
  /** Kopfzeile statt des Themas, z. B. „K1 · Lektion 3 von 10“. */
  kicker: string;
  /** Zeile unter dem Titel statt „Von Claude geschrieben …“. */
  byline: string;
  /** Zwischen Kopf und Ansichtsleiste: Ziel, Aufwärmen, Wendungen. */
  top?: ReactNode;
  /** Direkt unter dem Text (Sprachtipp). */
  afterText?: ReactNode;
  /** Nach den Prüffragen: Anwenden, Wendungen mitnehmen, Abschluss. */
  afterCheck?: ReactNode;
  /** Der Leser meldet hier seine „Zwischenstand jetzt schreiben“-Funktion an (und beim Verlassen `null` ab); der Abschluss ruft sie, bevor er „Text gelesen“ auswertet. */
  registerFlush?: (flush: (() => void) | null) => void;
  /** Neue Antwort auf eine Prüffrage (Frage ab 0 → Antwort). */
  onAnswers?: (answers: Record<number, number>) => void;
};

const VIEW_KEYS: Record<ReadView, { label: RdrKey; hint: RdrKey }> = {
  a: { label: 'rdrViewA', hint: 'rdrViewHintA' },
  b: { label: 'rdrViewB', hint: 'rdrViewHintB' },
  c: { label: 'rdrViewC', hint: 'rdrViewHintC' },
};

export function ReaderView({ article, state = null, view: viewProp = null, autoSpeak = false, onViewChange, onProgress, startAt = null, onNext, onBack, lesson }: ReaderViewProps) {
  const { lang } = useT();
  const model = useMemo(() => buildModel(article), [article]);
  const picks = useMemo(() => pickKeyWords(model, article.keyWords), [model, article.keyWords]);
  const marks = useMemo(() => highlightMap(picks), [picks]);
  const checks = useMemo(() => pickChecks(article.check), [article.check]);
  const words = useMemo(() => model.sentences.reduce((a, s) => a + countWords(s.e), 0), [model]);

  const [view, setViewState] = useState<ReadView>(() => viewOf(viewProp));
  const [revealed, setRevealed] = useState<Set<number>>(() => initialRevealed(viewOf(viewProp), model.total));
  const [done, setDone] = useState(state?.done === true);
  const [resumeAt, setResumeAt] = useState<number | null>(() => (!startAt && state?.pos && state.pos > 1 && !state.done && state.pos <= model.total ? state.pos : null));

  // ---- Zustand außerhalb des Zeichnens: Zähler, Zwischenstand, aktuelle Rückruf-Funktionen
  const revealedRef = useRef(revealed);
  const viewRef = useRef(view);
  const clock = useRef<ReadClock>(newClock());
  const prior = useRef<ReadState | null>(state);
  const session = useRef({ opened: new Set<number>(), saved: 0, answers: {} satisfies Record<number, number>, endSeen: false });
  const lessonAnswers = lesson?.onAnswers;
  const cb = useRef({ onProgress, autoSpeak, onViewChange, sentences: model.sentences, lessonAnswers });
  useEffect(() => {
    cb.current = { onProgress, autoSpeak, onViewChange, sentences: model.sentences, lessonAnswers };
  });
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const flush = useCallback(() => {
    const now = Date.now();
    const c = clockSeconds(clock.current, now, lookupOpenMs());
    const s = session.current;
    const list = listRef.current;
    const header = barRef.current?.getBoundingClientRect().bottom ?? 0;
    const rows = list ? Array.from(list.querySelectorAll<HTMLElement>('[data-n]')).map((el) => ({ n: Number(el.dataset.n), bottom: el.getBoundingClientRect().bottom })) : [];
    const pos = rows.length ? topVisibleSentence(rows, header) : (prior.current?.pos ?? 0);
    const secTotal = (prior.current?.sec ?? 0) + c;
    const patch = buildStatePatch({
      prior: prior.current,
      sec: c,
      pos,
      opened: s.opened.size,
      saved: s.saved,
      answered: summarizeChecks(checks, s.answers),
      reachedEnd: (s.endSeen || (endRef.current?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight) && canFinish(model.total, secTotal),
      total: model.total,
      now,
    });
    if (!patch) return;
    // Zwischenstand fortschreiben und Zähler zurücksetzen: ein späterer Aufruf zählt nichts doppelt.
    prior.current = { ...(prior.current ?? {}), ...patch };
    clock.current = newClock();
    if (document.visibilityState === 'visible') clock.current = resumeClock(clock.current, now, lookupOpenMs());
    s.opened = new Set();
    s.saved = 0;
    if (patch.done) setDone(true);
    cb.current.onProgress?.(patch);
  }, [checks, model.total]);

  // Kurslektion: der Abschluss ruft den Zwischenstand von außen ab, bevor er „Text gelesen“ auswertet.
  const registerFlush = lesson?.registerFlush;
  useEffect(() => {
    if (!registerFlush) return;
    registerFlush(flush);
    return () => registerFlush(null);
  }, [flush, registerFlush]);

  // Lesezeit: nur bei sichtbarer Seite; Ausblenden und Verlassen schreiben einmal.
  useEffect(() => {
    const on = () => {
      clock.current = resumeClock(clock.current, Date.now(), lookupOpenMs());
    };
    const off = () => {
      clock.current = pauseClock(clock.current, Date.now(), lookupOpenMs());
    };
    if (document.visibilityState === 'visible') on();
    const vis = () => {
      if (document.visibilityState === 'hidden') {
        off();
        flush();
      } else on();
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', vis);
      off();
      flush();
    };
  }, [flush]);

  // Ende des Artikels gesehen (ein Beobachter, kein Bildlauf-Ereignis).
  useEffect(() => {
    const el = endRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) session.current.endSeen = true;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Geöffnet über „Weiterlesen“: einmal zum Satz springen und ihn kurz markieren (nichts davon bei reduzierter Bewegung).
  useEffect(() => {
    if (!startAt || startAt > model.total) return;
    const el = document.getElementById(`rdr-s-${startAt}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'auto' });
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm && typeof el.animate === 'function') el.animate([{ backgroundColor: 'var(--lx-cyan-soft)' }, { backgroundColor: 'transparent' }], { duration: 300, easing: 'ease-out' });
  }, [startAt, model.total]);

  // ---- Bedienung
  const reveal = useCallback((next: Set<number>, was: ReadonlySet<number>) => {
    const added = [...next].filter((n) => !was.has(n));
    for (const n of added) session.current.opened.add(n);
    revealedRef.current = next;
    setRevealed(next);
    return added;
  }, []);

  const onToggle = useCallback(
    (n: number) => {
      unlockSpeech();
      const was = revealedRef.current;
      const added = reveal(toggleSentence(was, n), was);
      const text = cb.current.sentences[n - 1]?.e;
      if (added.length && cb.current.autoSpeak && text) void speak(text);
    },
    [reveal],
  );

  const changeView = useCallback(
    (next: ReadView) => {
      if (next === viewRef.current) return;
      viewRef.current = next;
      setViewState(next);
      const fresh = initialRevealed(next, model.total);
      revealedRef.current = fresh;
      setRevealed(fresh);
      cb.current.onViewChange?.(next);
    },
    [model.total],
  );

  const allOpen = revealed.size >= model.total && model.total > 0;
  const onAll = () => {
    const was = revealedRef.current;
    reveal(toggleAll(was, model.total), was);
  };

  const jump = () => {
    if (resumeAt) document.getElementById(`rdr-s-${resumeAt}`)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    setResumeAt(null);
  };

  const onSaved = useCallback(() => {
    session.current.saved += 1;
  }, []);
  const onAnswers = useCallback((a: Record<number, number>) => {
    session.current.answers = a;
    cb.current.lessonAnswers?.(a);
  }, []);

  const meta = rdrText(lang, 'rdrMeta', { min: minutesFor(words), words });
  const userOpened = userRevealCount(view, revealed, model.total);
  const viewOptions = VIEWS.map((v) => ({ value: v, label: rdrText(lang, VIEW_KEYS[v].label), testId: `rdr-view-${v}` }));

  return (
    <article className="mx-auto flex w-full max-w-[66ch] flex-col gap-5" data-testid="rdr" data-view={view} data-article={article.id} data-opened={userOpened} data-done={done || undefined}>
      <header className="flex flex-col gap-1.5 pt-2">
        <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-accent-text" data-testid="rdr-topic">
          {lesson ? lesson.kicker : article.topic === 'custom' && article.custom ? article.custom : rdrText(lang, topicKey(article.topic))}
        </p>
        <h1 className={lesson ? 'm-0 text-2xl leading-tight font-bold tracking-[-0.02em] text-fg sm:text-3xl' : 'm-0 text-xl font-semibold tracking-tight text-fg'} lang="en" data-testid="rdr-title">
          {article.title}
        </h1>
        <p className="m-0 text-xs text-muted" data-testid="rdr-meta">
          {meta}
          {done ? (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-accent-text" data-testid="rdr-done">
              <Icon name="check" size={14} />
              {rdrText(lang, 'rdrRead')}
            </span>
          ) : null}
        </p>
        {lesson ? (
          <p className="m-0 text-xs text-subtle" data-testid="rdr-byclaude">
            {lesson.byline}
          </p>
        ) : article.by === 'routine' && article.source ? (
          <p className="m-0 text-xs text-subtle" data-testid="rdr-routine">
            {rdrText(lang, 'rdrRoutineLine', { source: article.source })}
            {formatPubDay(lang, article.pub) ? ` · ${formatPubDay(lang, article.pub)}` : ''} · {rdrText(lang, 'rdrRoutineHint')}
            {article.url ? (
              <>
                {' · '}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-accent-text underline" data-testid="rdr-source-link" aria-label={rdrText(lang, 'rdrOpenSource', { source: article.source })}>
                  {article.source}
                </a>
              </>
            ) : null}
          </p>
        ) : (
          <p className="m-0 text-xs text-subtle" data-testid="rdr-byclaude">
            {rdrText(lang, 'rdrByClaude')}
            {formatAsOf(lang, article.asOf) ? ` · ${rdrText(lang, 'rdrAsOf', { asOf: formatAsOf(lang, article.asOf) })}` : ''} · {rdrText(lang, 'rdrByClaudeHint')}
          </p>
        )}
      </header>

      {lesson?.top}

      {/* Die Ansichtsleiste klebt nur im Textabschnitt (nicht durch die ganze Lektion) und ist deckend, damit nichts durchschimmert (UX-Prüfung 14.10.). */}
      <div className="flex flex-col gap-5" data-testid="rdr-textsection">
      <div ref={barRef} className="sticky top-[env(safe-area-inset-top)] z-20 rounded-2xl border border-line bg-bg p-1.5 md:top-[4.5rem]" data-testid="rdr-bar">
        <Segmented label={rdrText(lang, 'rdrViewLabel')} value={view} options={viewOptions} onChange={changeView} testId="rdr-views" />
      </div>

      <div className="-mt-3 flex items-center justify-between gap-2">
        <p className="m-0 min-h-12 min-w-0 flex-1 text-xs text-muted" data-testid="rdr-view-hint">
          {rdrText(lang, VIEW_KEYS[view].hint)}
        </p>
        {model.total > 0 ? (
          <Button variant="ghost" onClick={onAll} aria-pressed={allOpen} data-testid="rdr-all" className="shrink-0">
            {rdrText(lang, allOpen ? 'rdrCoverAll' : 'rdrRevealAll')}
          </Button>
        ) : null}
      </div>

      {resumeAt ? (
        <div className="lx-card flex items-center justify-between gap-3 p-3" data-testid="rdr-resume">
          <p className="m-0 text-sm text-fg">{rdrText(lang, 'rdrResume', { n: resumeAt })}</p>
          <Button variant="secondary" onClick={jump} data-testid="rdr-resume-go">
            {rdrText(lang, 'rdrResumeGo')}
          </Button>
        </div>
      ) : null}

      {model.total === 0 ? (
        <p className="m-0 text-sm text-muted" data-testid="rdr-removed">
          {rdrText(lang, 'rdrTextRemoved')}
        </p>
      ) : (
        <div ref={listRef} className="flex flex-col gap-4" data-testid="rdr-text" aria-label={rdrText(lang, 'rdrSentences')} role="group">
          {model.paragraphs.map((para) => (
            <ol key={para[0]?.n} start={para[0]?.n} className="m-0 flex list-none flex-col p-0">
              {para.map((s) => (
                <SentenceRow key={s.n} sentence={s} view={view} revealed={revealed.has(s.n)} hl={marks.get(s.n) ?? null} articleId={article.id} title={article.title} lang={lang} onToggle={onToggle} />
              ))}
            </ol>
          ))}
        </div>
      )}

      </div>

      <div ref={endRef} aria-hidden="true" className="h-px" />
      {lesson?.afterText}
      {lesson ? null : <KeyWordsCard picks={picks} article={article} lang={lang} onSaved={onSaved} />}
      <CheckCard checks={checks} articleId={article.id} title={article.title} lang={lang} onAnswers={onAnswers} />
      {lesson?.afterCheck}
      {onNext || onBack ? (
        <footer className="flex flex-col items-stretch gap-3 pt-1 pb-4" data-testid="rdr-end">
          {done ? (
            <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-ok-text" role="status" data-testid="rdr-end-done">
              <Icon name="check" size={16} />
              {rdrText(lang, 'rdrDoneState')}
            </p>
          ) : null}
          <Button variant="primary" size="lg" iconAfter={onNext ? 'arrowRight' : undefined} onClick={() => (onNext ?? onBack)?.()} data-testid="rdr-end-next" data-kind={onNext ? 'next' : 'back'}>
            {rdrText(lang, onNext ? 'rdrNextArticle' : 'rdrBackToList')}
          </Button>
        </footer>
      ) : null}
    </article>
  );
}
