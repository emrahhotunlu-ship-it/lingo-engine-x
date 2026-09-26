import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useAiAvailable } from '../../ai/scope';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { CardStatus } from '../../engine/CardStatus';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { ExerciseFrame } from '../../engine/ExerciseFrame';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, type GapState } from '../../engine/KineticGap';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { checkTyped } from '../../domain/answer/check';
import { answerDiff } from '../../domain/answer/diff';
import { formKind } from '../../domain/answer/form';
import { maskOf } from '../../domain/answer/mask';
import { normalize } from '../../domain/answer/normalize';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf } from '../../domain/srs/confidence';
import { cardExamples, EXAMPLES_MIN, storedExamples } from '../../domain/srs/examples';
import { posKey } from '../../domain/srs/explain';
import { autoGrade } from '../../domain/srs/grade';
import { exerciseDef } from '../../domain/srs/modes';
import { reviewFsrs } from '../../domain/srs/scheduler';
import type { CheckResult, ContextSpan, Exercise, Grade, Option } from '../../domain/srs/types';
import { requestExamples, useExamples } from './examples';
import { commitAnswer, type FirstKind } from './session';
import { useCompanionSee } from '../companion/seeing';
import { companionOpenedSince, companionOpenMs } from '../companion/store';

// Eine Übung (CLAUDE.md A7 „Emrahs Rückmeldung zum Trainer"): Status oben, Aufgabe in einer
// Zeile, Antwort → Prüfen → Ergebnis mit Markierung, Bedeutung, Formhinweis, Beispielsätzen.
// Die Note bestimmt die App aus Richtigkeit, Zeit und genutzter Hilfe – nur „Weiter".

type Feedback = {
  result: CheckResult;
  given: string;
  chosen: Option | null;
  grade: Grade;
  /** Abstand bis zur nächsten Fälligkeit (ms) bei dieser Note. */
  dueInMs: number;
  ms: number;
};

const PURPOSE: Record<number, MessageKey> = { 1: 'purpose1', 2: 'purpose2', 3: 'purpose3', 4: 'purpose4', 5: 'purpose4' };
const FREE_TYPED = new Set(['cloze', 'type']);

export function ExerciseView({ exercise, knownWords, onDone }: { exercise: Exercise; knownWords: ReadonlySet<string>; onDone: (kind: FirstKind) => void }) {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const ai = useAiAvailable();
  const now = useClock((s) => s.now);
  const e = exercise;
  const card = e.card;
  const [fb, setFb] = useState<Feedback | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  const [confidence] = useState(() => confidenceOf(card, now));
  const extra = useExamples((s) => s.byCard[card.id]);
  const typed = useRef('');
  const firstKeyAt = useRef<number | null>(null);
  const firstKeyLookup = useRef(0);
  const deletions = useRef(0);
  const shownAt = useRef(0);
  const lookupAtStart = useRef(0);
  const companionAtStart = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
    lookupAtStart.current = lookupOpenMs();
    companionAtStart.current = companionOpenMs();
  }, []);

  const shownSentence = e.input === 'typed' || e.ex === 'colloc' || e.ex === 'mc_en' ? (e.sentence?.sentence ?? null) : null;
  const solution = e.accepted[0] ?? card.word;

  const check = (chosen: Option | null) => {
    if (fb) return;
    const nowPerf = performance.now();
    // Offene Zeit von Nachschlagen und Begleiter zählt nicht zur Antwortzeit (Phase 5, E5-05).
    const paused = lookupOpenMs() - lookupAtStart.current + (companionOpenMs() - companionAtStart.current);
    // Den Begleiter vor dem Prüfen zu öffnen zählt als Hilfe: höchstens „Schwer" (E5-05, A7).
    const companionHelp = companionOpenedSince(shownAt.current);
    const ms = Math.max(0, Math.round(nowPerf - shownAt.current - paused));
    let result: CheckResult;
    let given: string;
    if (e.input === 'choice') {
      if (!chosen) return;
      given = chosen.label;
      result = { verdict: chosen.correct ? 'correct' : 'wrong' };
    } else {
      given = typed.current;
      result = checkTyped(given, e.accepted, { lemma: card.lemma, knownWords });
    }
    const firstKey = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current - firstKeyLookup.current));
    const grade = autoGrade(e.ex, result, {
      submitMs: ms,
      firstKeyMs: firstKey,
      chars: solution.length,
      deletions: deletions.current,
      hintLevel: companionHelp ? 2 : FREE_TYPED.has(e.ex) ? tip : 0,
    });
    const t0 = Date.now();
    const dueInMs = Math.max(0, reviewFsrs(card.fsrs, grade, t0).due - t0);
    setFb({ result, given, chosen, grade, dueInMs, ms });
    // Fehlen Beispiele, ergänzt Claude sie einmal (ausgelöst durch „Prüfen").
    if (ai && storedExamples(card.doc).length === 0 && cardExamples(card, shownSentence).length < EXAMPLES_MIN) requestExamples(card);
    // Touch: Tastatur schließen, damit Ergebnis und Beispiele sichtbar sind.
    if (e.input === 'typed' && window.matchMedia('(pointer: coarse)').matches) api.blur();
  };

  const next = () => {
    if (!fb) return;
    const kind = commitAnswer({ grade: fb.grade, given: fb.given, ms: fb.ms, ok: fb.grade > 1 });
    // Tastatur am iPhone: im selben Handler fokussieren bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };

  const showTip = () => {
    setTip((v) => (v === 0 ? 1 : 2));
    api.focusNow();
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (e.input === 'typed') check(null);
      },
      digit: (n) => {
        if (fb || e.input !== 'choice' || useLookup.getState().req) return;
        const o = e.options[n - 1];
        if (o) check(o);
      },
    },
    api.isInput,
  );

  const when = (ms: number): string => {
    const min = Math.round(ms / 60_000);
    if (min < 60) return t('ivMin', { n: Math.max(1, min) });
    const h = Math.round(ms / 3_600_000);
    if (h < 24) return t('ivHour', { n: h });
    return tn('ivDay', Math.round(ms / 86_400_000));
  };

  const gapState: GapState = !fb ? 'input' : fb.result.verdict;
  const helped = e.ex === 'cloze_hint';
  const mask = helped ? maskOf(solution, { firstLetter: true }) : FREE_TYPED.has(e.ex) && tip > 0 ? maskOf(solution, { firstLetter: tip >= 2 }) : null;
  const src = { area: 'trainer' as const, source: card.path, title: card.word };

  // Was der Begleiter sieht (Phase 5 §8.4): vor dem Prüfen Aufgabe und Satz mit ___, nie die Lösung.
  const blanked = e.sentence ? `${e.sentence.sentence.slice(0, e.sentence.start)}___${e.sentence.sentence.slice(e.sentence.end)}` : '';
  const seeDetail =
    e.ex === 'mc_en'
      ? `${t(`task_${e.ex}` as MessageKey)}\n${e.sentence?.sentence ?? card.word}`
      : `${t(`task_${e.ex}` as MessageKey)}\n${blanked || e.meaning || ''}${e.meaning && blanked ? `\n(${e.meaning})` : ''}`;
  useCompanionSee({
    area: 'trainer',
    label: `${t('cmpSeeTrainer')} · ${t(`exName_${e.ex}` as MessageKey)}`,
    phase: fb ? 'feedback' : 'question',
    detail: seeDetail,
    ...(fb ? { reveal: `Solution: ${solution}. Learner: ${fb.given || '(empty)'}` } : { mask: [solution, card.word, card.lemma, ...e.accepted] }),
  });

  const sentence = (span: ContextSpan, slot: ReactNode | null, opts: { mark?: boolean } = {}) => (
    <EnglishText
      as="p"
      className="lx-sentence"
      testId="sentence"
      text={span.sentence}
      {...src}
      slot={slot ? { start: span.start, end: span.end, node: slot } : null}
      highlight={opts.mark ? [span.start, span.end] : null}
      exclude={opts.mark && !fb ? [span.start, span.end] : null}
    />
  );

  // ------------------------------------------------------------------ Aufgabe
  let body: ReactNode;
  if (e.input === 'typed') {
    const gap = (
      <KineticGap
        label={e.sentence ? t('trGapLabel', { sentence: `${e.sentence.sentence.slice(0, e.sentence.start)}…${e.sentence.sentence.slice(e.sentence.end)}` }) : t('trTypeLabel', { meaning: e.meaning ?? '' })}
        maxLength={Math.max(40, solution.length + 10)}
        state={gapState}
        marks={fb?.result.marks}
        mask={mask}
        onChange={(v, info) => {
          typed.current = v;
          if (info.firstKey && firstKeyAt.current === null) {
            firstKeyAt.current = performance.now();
            firstKeyLookup.current = lookupOpenMs() - lookupAtStart.current;
          }
          deletions.current += info.deleted;
        }}
        onEnter={() => (fb ? next() : check(null))}
      />
    );
    body = (
      <>
        {e.ex === 'type' && e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.sentence ? (
          sentence(e.sentence, gap)
        ) : (
          <p className="lx-sentence" lang="en">
            {gap}
          </p>
        )}
        {e.ex !== 'type' && e.meaning && !fb && (
          <p className="text-sm text-muted" data-testid="cue" lang={lang}>
            {t('trHint', { meaning: e.meaning })}
          </p>
        )}
      </>
    );
  } else {
    const filled = fb?.chosen ? (fb.result.verdict === 'correct' ? fb.chosen.label : solution) : '';
    body = (
      <>
        {e.ex === 'mc_de' && e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.ex === 'mc_en' &&
          (e.sentence ? (
            sentence(e.sentence, null, { mark: true })
          ) : (
            <p className="lx-sentence" lang="en">
              <mark className="lx-mark text-fg">{card.word}</mark>
            </p>
          ))}
        {e.ex === 'colloc' &&
          e.sentence &&
          sentence(
            e.sentence,
            <span className="lx-gap" data-testid="gap" data-state={gapState} style={{ width: 'auto' }}>
              {filled || ' '}
            </span>,
          )}
        <Choices items={e.options} chosen={fb?.chosen?.id ?? null} onChoose={(id) => check(e.options.find((o) => o.id === id) ?? null)} label={t('trChoicesLabel')} />
      </>
    );
  }

  // ------------------------------------------------------------------ Ergebnis
  let result: ReactNode = undefined;
  if (fb) {
    const v = fb.result;
    const verdictKey: MessageKey =
      v.verdict === 'correct' ? (v.variant === 'uk' ? 'trVerdictUk' : 'trVerdictCorrect') : v.verdict === 'near' ? (v.kind === 'form' ? 'trVerdictForm' : v.kind === 'typo' ? 'trVerdictTypo' : 'trVerdictNear') : 'trVerdictWrong';
    const tone = v.verdict === 'correct' ? 'text-accent-text' : v.verdict === 'near' ? 'text-gold-text' : 'text-danger-text';
    const answerLang = e.ex === 'mc_en' ? lang : 'en';
    const diff = e.input === 'typed' ? answerDiff(fb.given, solution) : [];
    const meaning = e.ex === 'mc_en' ? null : (lang === 'de' ? card.de : card.def);
    const pk = posKey(card.pos);
    const fk = e.input === 'typed' && v.verdict !== 'correct' ? formKind(solution, card.lemma, card.pos) : null;
    const examples = cardExamples(card, shownSentence, extra?.items ?? []);
    const loadingExamples = extra?.status === 'loading' && examples.length < EXAMPLES_MIN;
    result = (
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE_OUT }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className={`text-base font-semibold ${tone}`} data-testid="verdict" data-verdict={v.verdict}>
            {t(verdictKey)}
          </p>
          {v.verdict !== 'correct' && (
            <p className="text-sm leading-relaxed">
              <span className="text-muted">{t('trYour')}: </span>
              <span lang={answerLang} data-testid="given">
                {!normalize(fb.given) ? (
                  <span className="text-muted">{t('trEmpty')}</span>
                ) : diff.length ? (
                  <span data-testid="word-diff">
                    {diff.map((p, i) => (
                      <span key={i} className={p.ok ? undefined : 'lx-diff-off'} data-off={p.ok ? undefined : ''}>
                        {p.text}
                      </span>
                    ))}
                  </span>
                ) : (
                  fb.given
                )}
              </span>
              <span className="text-muted"> · {t('trSolution')}: </span>
              <span className="font-semibold" lang={answerLang} data-testid="solution">
                {solution}
              </span>
            </p>
          )}
          {v.variant === 'uk' && v.us && (
            <p className="text-sm text-muted" data-testid="us-hint">
              {t('trUsHint', { us: v.us })}
            </p>
          )}
        </div>
        {(meaning || pk) && (
          <p className="text-sm" data-testid="meaning">
            <span className="font-semibold" lang="en">
              {card.word}
            </span>
            <span className="text-muted"> – </span>
            {meaning && <span lang={lang}>{meaning}</span>}
            {meaning && pk && <span className="text-muted"> · </span>}
            {pk && <span className="text-muted">{t(pk as MessageKey)}</span>}
          </p>
        )}
        {fk && (
          <p className="text-sm" data-testid="form-hint">
            <span className="font-semibold">{t('trFormHint', { form: t(`form_${fk}` as MessageKey), word: solution })}</span>
            <span className="text-muted"> · {t('trBaseForm', { lemma: card.lemma })}</span>
          </p>
        )}
        {(examples.length > 0 || loadingExamples) && (
          <div className="flex flex-col gap-1.5" data-testid="examples">
            <p className="lx-eyebrow">{t('trExamples')}</p>
            <ul className="flex flex-col gap-1.5">
              {examples.map((x) => (
                <li key={x.en} className="text-[0.95rem] leading-relaxed" data-testid="example" data-src={x.src}>
                  <EnglishText as="span" text={x.en} {...src} />
                </li>
              ))}
            </ul>
            {loadingExamples && (
              <p className="text-sm text-subtle" data-testid="examples-loading">
                {t('trExamplesLoading')}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-subtle" data-testid="due-in" data-grade={fb.grade}>
            {t('trAgainIn', { when: when(fb.dueInMs) })}
          </span>
          <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="next">
            {t('trNext')}
          </Button>
        </div>
      </motion.div>
    );
  }

  const def = exerciseDef(e.ex);
  return (
    <ExerciseFrame
      status={
        <CardStatus
          dots={confidenceDots(confidence)}
          level={confidence}
          word={t(CONFIDENCE_KEYS[confidence])}
          label={t('confLabel', { level: t(CONFIDENCE_KEYS[confidence]) })}
          kind={t(`exName_${e.ex}` as MessageKey)}
          kindLabel={t('exKindLabel', { name: '' }).trim()}
        />
      }
      task={t(`task_${e.ex}` as MessageKey)}
      infoLabel={t('trInfo')}
      purpose={t(e.ex === 'colloc' ? 'purposeColloc' : (PURPOSE[def.stage] ?? 'purpose1'))}
      body={body}
      actions={
        e.input === 'typed' && !fb ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => check(null)} data-testid="check">
              {t('trCheck')}
            </Button>
            {FREE_TYPED.has(e.ex) && tip < 2 && (
              <Button variant="ghost" icon="lightbulb" onClick={showTip} data-testid="hint" data-level={tip}>
                {tip === 0 ? t('trTip') : t('trTipLetter')}
              </Button>
            )}
          </div>
        ) : undefined
      }
      resultLabel={t('trResultLabel')}
      result={result}
      meta={{ ex: e.ex, card: card.id, col: e.colloc?.index, stage: e.stage }}
    />
  );
}
