import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../../app/clock';
import { maskOf } from '../../../domain/answer/mask';
import { ipaOf } from '../../../domain/lexicon/pron';
import { meaningOf } from '../../../domain/srs/cards';
import { chunkWhy } from '../../../domain/srs/chunkCards';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf } from '../../../domain/srs/confidence';
import { cardExamples } from '../../../domain/srs/examples';
import { posKey } from '../../../domain/srs/explain';
import { flipSuggest, formatInterval, seenOn, wordCount } from '../../../domain/srs/flip';
import { previewIntervals } from '../../../domain/srs/scheduler';
import type { Exercise, Grade } from '../../../domain/srs/types';
import { isPhraseCard } from '../../../domain/srs/vocabList';
import { CardStatus } from '../../../engine/CardStatus';
import { EnglishText } from '../../../engine/EnglishText';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { SpeakButton } from '../../../engine/SpeakButton';
import { classifySwipe, swipeExcluded } from '../../../engine/swipe';
import { useHotkeys } from '../../../engine/useHotkeys';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { nextT } from '../../progress/persist';
import { useDecks } from '../decksStore';
import { MnemonicBlock } from '../mnemonic';
import { commitAnswer, prepareNext, useSession, type FirstKind } from '../session';

// Anki „Aufdecken“ (anki-regeln.md, architektur.md §4.1, Optik wie Prototyp v1):
// Vorderseite Deutsch → Englisch: Bedeutung + Ursprungssatz mit Lücke (Platzhalter je Buchstabe),
// kein ▶. Englisch → Deutsch: Wort + Satz. Tippen, Leertaste oder Enter deckt auf. Rückseite immer
// voll (Lösung im Satz, Wortart, Verbindungen, Beispiele, ▶ und Lautschrift; jedes Wort antippbar).
// Darunter 4 Knöpfe (bzw. 2) mit Intervall, der Vorschlag aus der Denkzeit ist hervorgehoben.
// Wischen links = Nochmal, rechts = Vorschlag; Tasten 1–4. Der Zeitstempel `t` wird beim Aufdecken
// reserviert – Vorschau und Speichern rechnen mit demselben `t` (§4.3).

const GRADE_KEY: Record<Grade, MessageKey> = { 1: 'nbWsGrade1', 2: 'nbWsGrade2', 3: 'nbWsGrade3', 4: 'nbWsGrade4' };

function idle(fn: () => void): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 400 });
  else window.setTimeout(fn, 60);
}

export function FlipCard({ exercise, again = false, onDone }: { exercise: Exercise; again?: boolean; onDone: (kind: FirstKind) => void }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const day = useSession((s) => s.day);
  const strict = useSession((s) => s.strict);
  const twoButtons = useDecks((s) => s.decks.prefs.grades === 2);
  const e = exercise;
  const card = e.card;
  const dir = e.dir ?? 'de-en';
  const meaning = meaningOf(card, lang);
  const [shown, setShown] = useState<{ t: number; ms: number; suggest: 2 | 3 | 4; iv: Record<Grade, number> } | null>(null);
  const [info, setInfo] = useState(false);
  const shownAt = useRef(0);
  const hiddenMs = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const wasHidden = useRef(false);
  const done = useRef(false);
  const [conf] = useState(() => confidenceOf(card, now));

  // Denkzeit ab dem ersten Bild der Vorderseite; Zeit im Hintergrund zählt nicht (§2).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      shownAt.current = performance.now();
    });
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden.current = true;
        hiddenAt.current = performance.now();
      } else if (hiddenAt.current !== null) {
        hiddenMs.current += performance.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const front = dir === 'de-en' ? (card.context?.sentence ?? null) : (card.context?.sentence ?? null);
  const reveal = () => {
    if (shown) return;
    const ms = Math.max(0, performance.now() - (shownAt.current || performance.now()) - hiddenMs.current);
    const suggest = flipSuggest({ revealMs: ms, phrase: isPhraseCard(card), frontWords: wordCount(front), seenToday: again || seenOn(card.doc, day), hidden: wasHidden.current, strict });
    const tt = nextT();
    setShown({ t: tt, ms: Math.round(ms), suggest, iv: previewIntervals(card.fsrs, tt) });
    idle(prepareNext);
  };

  const grade = (g: Grade) => {
    if (!shown || done.current) return;
    done.current = true;
    const kind = commitAnswer({ grade: g, given: '', ms: shown.ms, ok: g > 1, t: shown.t });
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };

  const grades: Grade[] = twoButtons ? [1, shown?.suggest ?? 3] : [1, 2, 3, 4];
  useHotkeys(
    {
      enter: () => (shown ? grade(shown.suggest) : reveal()),
      digit: (n) => {
        if (!shown) return;
        if (twoButtons) {
          if (n === 1) grade(1);
          else if (n === 2) grade(shown.suggest);
        } else if (n >= 1 && n <= 4) grade(n as Grade);
      },
    },
    api.isInput,
  );
  // Leertaste deckt auf (Anki); nicht in Eingabefeldern und nicht, wenn ein Knopf den Fokus hat.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== ' ' || ev.defaultPrevented || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.isContentEditable)) return;
      ev.preventDefault();
      if (!shown) reveal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Wischen (nur Finger, nach dem Aufdecken): links = Nochmal, rechts = Vorschlag.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const suggestRef = useRef<Grade | null>(null);
  suggestRef.current = shown?.suggest ?? null;
  useEffect(() => {
    let start: { x: number; y: number; t: number; id: number } | null = null;
    const down = (ev: TouchEvent) => {
      const p = ev.touches.length === 1 ? ev.touches[0] : undefined;
      if (!p || suggestRef.current === null || document.querySelector('[role="dialog"][aria-modal="true"]') || swipeExcluded(ev.target, p.clientX, window.innerWidth)) {
        start = null;
        return;
      }
      start = { x: p.clientX, y: p.clientY, t: ev.timeStamp, id: p.identifier };
    };
    const up = (ev: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || suggestRef.current === null) return;
      const p = Array.from(ev.changedTouches).find((x) => x.identifier === s.id);
      const dirn = p ? classifySwipe(s, { x: p.clientX, y: p.clientY, t: ev.timeStamp }) : null;
      if (dirn === 'left') gradeRef.current(1);
      else if (dirn === 'right') gradeRef.current(suggestRef.current);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
    };
  }, []);

  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const mask = useMemo(() => maskOf(card.context?.gap ?? card.word), [card]);
  const gapNode: ReactNode = (
    <span className="lx-gap" data-masked="" data-testid="flip-gap" role="img" aria-label={t('nbWsGapLabel', { n: mask.filter((m) => m.kind === 'slot').length })}>
      <span className="lx-gap-inner">
        {mask.map((m, i) => (
          <span key={i} className={`lx-slot${m.kind === 'fixed' ? ' lx-slot-fixed' : ''}`}>
            {m.kind === 'fixed' ? m.ch : ' '}
          </span>
        ))}
      </span>
    </span>
  );
  const ctx = card.context;
  const pk = posKey(card.pos);
  const ipa = shown ? ipaOf(card.word) : null;
  const why = chunkWhy(card, lang);
  const examples = shown ? cardExamples(card, ctx?.sentence ?? null) : [];
  const col = card.col.filter((c) => c.p).slice(0, 3);

  return (
    <div className="flex flex-col gap-4" data-testid="flip" data-card={card.id} data-kind={card.kind} data-dir={dir} data-shown={shown ? '' : undefined} data-suggest={shown?.suggest}>
      <article
        className="lx-glass flex min-h-[18rem] flex-col gap-4 rounded-[var(--radius-card)] p-5 sm:p-7"
        data-testid="exercise"
        data-ex="flip"
        data-card={card.id}
        data-kind={card.kind}
        data-stage={card.stage}
        onClick={(ev) => {
          if (!shown && !(ev.target as HTMLElement).closest('button')) reveal();
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <CardStatus
            dots={confidenceDots(conf)}
            level={conf}
            word={t(CONFIDENCE_KEYS[conf])}
            label={t('confLabel', { level: t(CONFIDENCE_KEYS[conf]) })}
            again={again ? t('trAgainBadge') : null}
            kind={t('nbWsFlipKind')}
            kindLabel={t('exKindLabel', { name: '' }).trim()}
            kindId="flip"
          />
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('nbWsFlipInfoLabel')}
            aria-expanded={info}
            onClick={() => setInfo((v) => !v)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        </header>
        {info && (
          <p className="text-sm text-muted" data-testid="purpose">
            {t('nbWsFlipInfo')} {t('nbWsGradeInfo')}
          </p>
        )}
        <h2 className="text-base font-medium text-muted" data-testid="task">
          {t(dir === 'de-en' ? 'nbWsFlipTaskDeEn' : 'nbWsFlipTaskEnDe')}
        </h2>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {dir === 'de-en' ? (
            <>
              <p className="text-2xl font-semibold tracking-tight" lang={lang} data-testid="flip-front">
                {meaning}
              </p>
              {ctx && !shown && (
                <EnglishText as="p" className="lx-sentence max-w-[34ch] text-muted" text={ctx.sentence} {...src} slot={{ start: ctx.start, end: ctx.end, node: gapNode }} testId="flip-sentence" />
              )}
            </>
          ) : (
            <>
              <p className="text-3xl font-bold tracking-tight" lang="en" data-testid="flip-front">
                {card.word}
              </p>
              {ctx && !shown && <EnglishText as="p" className="lx-sentence max-w-[34ch] text-muted" text={ctx.sentence} {...src} highlight={[ctx.start, ctx.end]} testId="flip-sentence" />}
            </>
          )}
        </div>
        {shown && (
          <section className="flex flex-col gap-3 border-t border-line pt-4 text-left" data-testid="flip-back" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-semibold tracking-tight" lang="en" data-testid="flip-answer">
                {card.word}
              </p>
              <SpeakButton text={card.word} testId="flip-listen" />
              {ipa && (
                <span className="text-sm text-muted" lang="en" data-testid="flip-ipa">
                  {ipa}
                </span>
              )}
            </div>
            <p className="text-base">
              {meaning && <span lang={lang}>{meaning}</span>}
              {pk && <span className="text-muted"> · {t(pk as MessageKey)}</span>}
            </p>
            {why && (
              <p className="text-sm text-muted" lang={lang} data-testid="chunk-why">
                {why}
              </p>
            )}
            {ctx && (
              <div className="flex items-start gap-1">
                <EnglishText as="p" className="lx-sentence min-w-0 flex-1" text={ctx.sentence} {...src} highlight={[ctx.start, ctx.end]} testId="origin-sentence" />
                <SpeakButton text={ctx.sentence} />
              </div>
            )}
            {col.length > 0 && (
              <div className="flex flex-col gap-1" data-testid="flip-col">
                <p className="lx-eyebrow">{t('nbWsCollocations')}</p>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {col.map((c) => (
                    <li key={c.p}>
                      <span lang="en" className="font-medium">
                        {c.p}
                      </span>
                      {lang === 'de' && c.de ? <span className="text-muted"> – {c.de}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {examples.length > 0 && (
              <div className="flex flex-col gap-1.5" data-testid="examples">
                <p className="lx-eyebrow">{t('trExamples')}</p>
                <ul className="flex flex-col gap-1.5">
                  {examples.slice(0, 3).map((x) => (
                    <li key={x.en} className="text-[0.95rem] leading-relaxed" data-testid="example">
                      <EnglishText as="span" text={x.en} {...src} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <MnemonicBlock card={card} />
          </section>
        )}
      </article>
      {!shown ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={reveal} data-testid="flip-show">
          {t('nbWsFlipShow')}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`grid gap-2 ${twoButtons ? 'grid-cols-2' : 'grid-cols-4'}`} role="group" aria-label={t('nbWsGradesLabel')} data-testid="grades">
            {grades.map((g, i) => {
              const suggested = g === shown.suggest;
              const label = twoButtons ? t(i === 0 ? 'nbWsGradeNo' : 'nbWsGradeYes') : t(GRADE_KEY[g]);
              return (
                <button
                  key={`${i}-${g}`}
                  type="button"
                  onClick={() => grade(g)}
                  className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-surface-strong px-1 py-2 text-[0.9rem] font-semibold transition-colors ${suggested ? 'border-accent' : 'border-transparent'} ${g === 1 ? 'text-danger-text' : ''}`}
                  data-testid="grade"
                  data-grade={g}
                  data-suggested={suggested ? '' : undefined}
                  aria-keyshortcuts={twoButtons ? String(i + 1) : String(g)}
                >
                  <span className="max-w-full truncate">{label}</span>
                  <small className="lx-tnum text-xs font-medium text-muted" data-testid="grade-iv">
                    {formatInterval(shown.iv[g], lang)}
                  </small>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-subtle" data-testid="suggest-note">
            {t('nbWsSuggest', { grade: t(GRADE_KEY[shown.suggest]) })} · {t('nbWsSwipeHint', { again: t('nbWsGrade1'), grade: t(GRADE_KEY[shown.suggest]) })}
          </p>
        </div>
      )}
    </div>
  );
}
