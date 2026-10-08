import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../../ai/scope';
import { maskOf } from '../../../domain/answer/mask';
import { ipaOf } from '../../../domain/lexicon/pron';
import { meaningOf } from '../../../domain/srs/cards';
import { unitState } from '../../../domain/metrics';
import { cardExamples, wantsEnrichment } from '../../../domain/srs/examples';
import { explainWord, registerOf } from '../../../domain/srs/explainWord';
import { posKey } from '../../../domain/srs/explain';
import { flipSuggest, formatInterval, seenOn, wordCount } from '../../../domain/srs/flip';
import { previewIntervals } from '../../../domain/srs/scheduler';
import type { Exercise, Grade } from '../../../domain/srs/types';
import { isPhraseCard } from '../../../domain/srs/vocabList';
import { EnglishText } from '../../../engine/EnglishText';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { SpeakButton } from '../../../engine/SpeakButton';
import { useCardSwipe } from '../../../engine/cardSwipe';
import { useHotkeys } from '../../../engine/useHotkeys';
import { useT, type MessageKey } from '../../../i18n';
import { ExerciseShell, Explanation, Examples } from '../../../ui/exercise';
import { GradeButtons } from '../../../ui/GradeButtons';
import { StackBehind } from '../../../ui/CardStack';
import { nextT } from '../../progress/persist';
import { useDecks } from '../decksStore';
import { WordExtras } from '../WordExtras';
import { requestExamples, useExamples } from '../examples';
import { commitAnswer, prepareNext, useSession, type FirstKind } from '../session';

// Anki „Aufdecken“ (anki-regeln.md, architektur.md §4.1, Optik wie Prototyp v1):
// Vorderseite Deutsch → Englisch: Bedeutung + Ursprungssatz mit Lücke (Platzhalter je Buchstabe),
// kein ▶. Englisch → Deutsch: Wort + Satz. Tippen, Leertaste oder Enter deckt auf. Rückseite immer
// voll (Lösung im Satz, Wortart, Verbindungen, Beispiele, ▶ und Lautschrift; jedes Wort antippbar).
// Darunter 4 Knöpfe (bzw. 2) mit Intervall, der Vorschlag aus der Denkzeit ist hervorgehoben.
// Wischen links = Nochmal, rechts = Vorschlag; Tasten 1–4. Der Zeitstempel `t` wird beim Aufdecken
// reserviert – Vorschau und Speichern rechnen mit demselben `t` (§4.3).

const GRADE_KEY: Record<Grade, MessageKey> = { 1: 'nbWsGrade1', 2: 'nbWsGrade2', 3: 'nbWsGrade3', 4: 'nbWsGrade4' };

// Feste leere Referenz statt `?? []` im Selektor: ein neues Array bei jedem Aufruf lässt
// `useSyncExternalStore` (in zustand) denken, der Schnappschuss habe sich geändert, und rendert
// endlos neu (React-Fehler #185, Befund beim Bauen dieser Änderung).
const NO_EXAMPLES: readonly { en: string; t: number }[] = [];

/** Denkzeit bis jetzt (außerhalb des Renderns aufgerufen). */
function thinkMs(start: number, hidden: number): number {
  const now = performance.now();
  return Math.max(0, now - (start || now) - hidden);
}

function idle(fn: () => void): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 400 });
  else window.setTimeout(fn, 60);
}

/** `behind` = noch kommende Karten (P54: höchstens zwei Kanten hinter der Vorderseite). */
export function FlipCard({ exercise, again = false, onDone, behind = 0 }: { exercise: Exercise; again?: boolean; onDone: (kind: FirstKind) => void; behind?: number }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const ai = useAiAvailable();
  const day = useSession((s) => s.day);
  const strict = useSession((s) => s.strict);
  const twoButtons = useDecks((s) => s.decks.prefs.grades === 2);
  const e = exercise;
  const card = e.card;
  const dir = e.dir ?? 'de-en';
  const meaning = meaningOf(card, lang);
  const [shown, setShown] = useState<{ t: number; ms: number; suggest: 2 | 3 | 4; iv: Record<Grade, number> } | null>(null);
  const shownAt = useRef(0);
  const hiddenMs = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const wasHidden = useRef(false);
  const done = useRef(false);
  const [state0] = useState(() => unitState(card));

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
    const ms = thinkMs(shownAt.current, hiddenMs.current);
    const suggest = flipSuggest({ revealMs: ms, phrase: isPhraseCard(card), frontWords: wordCount(front), seenToday: again || seenOn(card.doc, day), hidden: wasHidden.current, strict });
    const tt = nextT();
    setShown({ t: tt, ms: Math.round(ms), suggest, iv: previewIntervals(card.fsrs, tt) });
    // Fehlt der Rückseite ein Beispielsatz (Befund 29.09.: Karte ohne Ursprungssatz, Kap. 15),
    // ergänzt Claude ihn einmal je Karte – genau wie beim Tippen (ExerciseView.tsx).
    if (ai && wantsEnrichment(card, card.context?.sentence ?? null, Date.now())) requestExamples(card);
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
  const suggestRef = useRef<Grade | null>(null);
  useEffect(() => {
    gradeRef.current = grade;
    suggestRef.current = shown?.suggest ?? null;
  });
  // P54: auf der Karte folgt sie dem Finger (Achse rastet nach 10 px ein); die Entscheidung bleibt `classifySwipe` (`engine/cardSwipe.ts`).
  const rootRef = useRef<HTMLDivElement>(null);
  useCardSwipe(rootRef, {
    enabled: shown !== null,
    onLeft: () => gradeRef.current(1),
    onRight: () => {
      if (suggestRef.current !== null) gradeRef.current(suggestRef.current);
    },
  });

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
  const freshEntry = useExamples((s) => s.byCard[card.id]);
  const extras = freshEntry?.items ?? NO_EXAMPLES;
  const model = useMemo(
    () =>
      shown
        ? explainWord({ card, ex: 'flip', verdict: 'ok', given: '', check: { verdict: 'correct' }, lang, meaningShown: true, examples: cardExamples(card, null, extras).map((x) => ({ en: x.en, de: null, ctx: null })) })
        : null,
    [shown, card, lang, extras],
  );
  const reg = registerOf(card);
  const prompt =
    dir === 'de-en' ? (
      <div className="dz-flip flex flex-col items-center gap-3 text-center">
        <p className="lx-t-title" lang={lang} data-testid="flip-front">
          {meaning}
        </p>
        {ctx && !shown && <EnglishText as="p" className="max-w-[34ch] text-muted" text={ctx.sentence} {...src} slot={{ start: ctx.start, end: ctx.end, node: gapNode }} testId="flip-sentence" />}
        {!shown && <StackBehind n={behind} />}
      </div>
    ) : (
      <div className="dz-flip flex flex-col items-center gap-3 text-center">
        <p className="lx-t-title" lang="en" data-testid="flip-front">
          {card.word}
        </p>
        {ctx && !shown && <EnglishText as="p" className="max-w-[34ch] text-muted" text={ctx.sentence} {...src} highlight={[ctx.start, ctx.end]} testId="flip-sentence" />}
        {!shown && <StackBehind n={behind} />}
      </div>
    );
  const back = shown ? (
    <section className="lx-card flex flex-col gap-3 overflow-hidden p-4 text-left" data-testid="flip-back" aria-live="polite">
      {/* Kopf (Design-Lead): Wort groß, Vorlesen und Lautschrift genau einmal; Wortart und Register stehen als Chips in der Erklärung darunter. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="lx-t-title" lang="en" data-testid="flip-answer">
          {card.word}
        </p>
        <SpeakButton text={card.word} testId="flip-listen" />
        {ipa && (
          <span className="lx-t-meta basis-full text-muted" lang="en" data-testid="flip-ipa">
            {ipa}
          </span>
        )}
      </div>
      {/* UX-Prüfung W5 (Kap. 15 „Karten ohne Ursprungssatz“): der Ursprungssatz mit gefüllter Lücke steht unter dem Wort. */}
      {ctx && (
        <EnglishText as="p" className="lx-t-support m-0 text-muted" text={ctx.sentence} {...src} highlight={[ctx.start, ctx.end]} testId="flip-origin" />
      )}
      {/* Die deutsche Bedeutung steht genau einmal: bei Deutsch → Englisch zeigt sie schon die Vorderseite. */}
      {dir === 'en-de' && meaning && (
        <p className="lx-t-body m-0" lang={lang}>
          {meaning}
        </p>
      )}
      {!model && (pk || reg) && (
        <p className="lx-t-meta m-0 text-muted">
          {pk && t(pk as MessageKey)}
          {pk && reg && ' · '}
          {reg && t(`wxReg_${reg}` as MessageKey)}
        </p>
      )}
      {model && <Explanation model={model} depth="min" learning={false} hideWord />}
      {model && model.examples.length > 0 && <Examples items={model.examples} open={0} />}
      <WordExtras card={card} open={false} lang={lang} extras={extras} part="more" />
    </section>
  ) : null;

  return (
    <div
      ref={rootRef}
      className="lx-swipe-card"
      // Beschriftung der Färbung beim Wischen (CSS `attr()`, kein zweiter Text im Baum).
      data-swipe-left={shown ? t('nbWsGrade1') : undefined}
      data-swipe-right={shown ? t(GRADE_KEY[shown.suggest]) : undefined}
      data-testid="flip"
      data-card={card.id}
      data-kind={card.kind}
      data-dir={dir}
      data-shown={shown ? '' : undefined}
      data-suggest={shown?.suggest}
      onClick={(ev) => {
        if (!shown && !(ev.target as HTMLElement).closest('button')) reveal();
      }}
    >
      <ExerciseShell
        meta={{ ex: 'flip', id: card.id, stage: card.stage, kind: card.kind }}
        // UX-Prüfung W5: keine Seitenkarte rechts bei Anki; Tastaturhinweis passend zur Seite (Rückseite: Enter = Vorschlag, 1–4 = selbst).
        // eslint-disable-next-line no-restricted-syntax -- Gerüst-Eigenschaft „gestapelt“ (keine Layout-Animation)
        layout="stack"
        keysHint={shown ? t('trEnterHint') : null}
        status={{ area: 'words', state: state0, kindLabel: t('nbWsFlipKind'), badge: again ? t('trAgainBadge') : null }}
        task={{ text: t(dir === 'de-en' ? 'nbWsFlipTaskDeEn' : 'nbWsFlipTaskEnDe'), purpose: `${t('nbWsFlipInfo')} ${t('nbWsGradeInfo')}` }}
        prompt={prompt}
        answer={back}
        primary={{ label: t('nbWsFlipShow'), onClick: reveal, testId: 'flip-show' }}
        barOverride={
          shown ? (
            <GradeButtons
              options={grades.map((g, i) => ({ grade: g, label: twoButtons ? t(i === 0 ? 'nbWsGradeNo' : 'nbWsGradeYes') : t(GRADE_KEY[g]), interval: formatInterval(shown.iv[g], lang) }))}
              suggest={shown.suggest}
              onGrade={grade}
              label={t('nbWsGradesLabel')}
              note={`${t('nbWsSuggest', { grade: t(GRADE_KEY[shown.suggest]) })} · ${t('nbWsSwipeHint', { again: t('nbWsGrade1'), grade: t(GRADE_KEY[shown.suggest]) })}`}
            />
          ) : undefined
        }
      />
    </div>
  );
}
