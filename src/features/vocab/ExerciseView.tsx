import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { Choices } from '../../engine/Choices';
import { ExerciseFrame } from '../../engine/ExerciseFrame';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, type GapState } from '../../engine/KineticGap';
import { Ladder } from '../../engine/Ladder';
import { RatingBar } from '../../engine/RatingBar';
import { useHotkeys } from '../../engine/useHotkeys';
import { checkTyped } from '../../domain/answer/check';
import { normalize } from '../../domain/answer/normalize';
import { explain } from '../../domain/srs/explain';
import { allowedGrades, suggestGrade } from '../../domain/srs/grade';
import { exerciseDef } from '../../domain/srs/modes';
import { previewIntervals } from '../../domain/srs/scheduler';
import type { CheckResult, ContextSpan, Exercise, Grade, Option, WhyPart } from '../../domain/srs/types';
import { commitAnswer, type FirstKind } from './session';

// Eine Übung im Rahmen der vier Pflichtfragen. Antwort → Prüfung → Rückmeldung mit Lösung,
// Begründung (immer) und Bewertungsvorschlag → eine Note übernimmt und geht weiter.

type Feedback = {
  result: CheckResult;
  given: string;
  chosen: Option | null;
  suggested: Grade;
  allowed: Grade[];
  intervals: Record<Grade, number>;
  why: WhyPart[];
  ms: number;
};

const STAGE_KEYS: MessageKey[] = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5'];
const GRADE_KEYS: Record<Grade, MessageKey> = { 1: 'grade1', 2: 'grade2', 3: 'grade3', 4: 'grade4' };
const PURPOSE: Record<number, MessageKey> = { 1: 'purpose1', 2: 'purpose2', 3: 'purpose3', 4: 'purpose4', 5: 'purpose4' };
const SRC_KEYS = new Set(['seed', 'lesson', 'lookup', 'read', 'coach', 'preply', 'job', 'ai', 'claude', 'translate', 'user', 'listen', 'write']);

function Sentence({ span, children, lang = 'en' }: { span: ContextSpan; children: ReactNode; lang?: string }) {
  return (
    <p className="lx-sentence" lang={lang} data-testid="sentence">
      {span.sentence.slice(0, span.start)}
      {children}
      {span.sentence.slice(span.end)}
    </p>
  );
}

export function ExerciseView({ exercise, knownWords, onDone }: { exercise: Exercise; knownWords: ReadonlySet<string>; onDone: (kind: FirstKind) => void }) {
  const { t, tn, num, lang } = useT();
  const api = useHiddenInput();
  const e = exercise;
  const def = exerciseDef(e.ex);
  const [fb, setFb] = useState<Feedback | null>(null);
  const typed = useRef('');
  const firstKeyAt = useRef<number | null>(null);
  const deletions = useRef(0);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const check = (chosen: Option | null) => {
    if (fb) return;
    const now = performance.now();
    const ms = Math.max(0, Math.round(now - shownAt.current));
    let result: CheckResult;
    let given: string;
    if (e.input === 'choice') {
      if (!chosen) return;
      given = chosen.label;
      result = { verdict: chosen.correct ? 'correct' : 'wrong' };
    } else {
      given = typed.current;
      result = checkTyped(given, e.accepted, { lemma: e.card.lemma, knownWords });
    }
    const firstKey = firstKeyAt.current === null ? ms : Math.round(firstKeyAt.current - shownAt.current);
    const suggested = suggestGrade(e.ex, result.verdict, { submitMs: ms, firstKeyMs: firstKey, chars: (e.accepted[0] ?? '').length, deletions: deletions.current });
    setFb({
      result,
      given,
      chosen,
      suggested,
      allowed: allowedGrades(result.verdict),
      intervals: previewIntervals(e.card.fsrs, Date.now()),
      why: explain(e, lang, result, chosen),
      ms,
    });
  };

  const rate = (g: Grade) => {
    if (!fb || !fb.allowed.includes(g)) return;
    const kind = commitAnswer({ grade: g, given: fb.given, ms: fb.ms, ok: g > 1 });
    // Tastatur am iPhone: im selben Handler fokussieren bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };

  useHotkeys(
    {
      enter: () => (fb ? rate(fb.suggested) : e.input === 'typed' ? check(null) : undefined),
      digit: (n) => {
        if (fb) {
          if (n >= 1 && n <= 4) rate(n as Grade);
        } else if (e.input === 'choice') {
          const o = e.options[n - 1];
          if (o) check(o);
        }
      },
    },
    api.isInput,
  );

  const iv = (ms: number): string => {
    const min = Math.round(ms / 60_000);
    if (min < 60) return t('ivMin', { n: Math.max(1, min) });
    const h = Math.round(ms / 3_600_000);
    if (h < 24) return t('ivHour', { n: h });
    return tn('ivDay', Math.round(ms / 86_400_000));
  };

  const gapState: GapState = !fb ? 'input' : fb.result.verdict;
  const meaningLang = lang;

  // ------------------------------------------------------------------ Aufgabe
  let body: ReactNode;
  if (e.input === 'typed') {
    const gap = (
      <KineticGap
        label={e.sentence ? t('trGapLabel', { sentence: `${e.sentence.sentence.slice(0, e.sentence.start)}…${e.sentence.sentence.slice(e.sentence.end)}` }) : t('trTypeLabel', { meaning: e.meaning ?? '' })}
        maxLength={Math.max(40, (e.accepted[0] ?? '').length + 10)}
        state={gapState}
        marks={fb?.result.marks}
        onChange={(v, info) => {
          typed.current = v;
          if (info.firstKey && firstKeyAt.current === null) firstKeyAt.current = performance.now();
          deletions.current += info.deleted;
        }}
        onEnter={() => (fb ? rate(fb.suggested) : check(null))}
        onKey={(k) => {
          if (!fb || !/^[1-4]$/.test(k)) return false;
          rate(Number(k) as Grade);
          return true;
        }}
      />
    );
    body = (
      <>
        {e.ex === 'type' && e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={meaningLang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.sentence ? (
          <Sentence span={e.sentence}>{gap}</Sentence>
        ) : (
          <p className="lx-sentence" lang="en">
            {gap}
          </p>
        )}
        {e.ex !== 'type' && (e.meaning || e.firstLetter) && (
          <p className="text-sm text-muted" data-testid="cue">
            {e.meaning && <span lang={meaningLang}>{t('trHint', { meaning: e.meaning })}</span>}
            {e.meaning && e.firstLetter && ' · '}
            {e.firstLetter && <span>{t('trHintLetter', { letter: e.firstLetter })}</span>}
          </p>
        )}
      </>
    );
  } else {
    const filled = fb?.chosen ? (fb.result.verdict === 'correct' ? fb.chosen.label : (e.accepted[0] ?? '')) : '';
    body = (
      <>
        {e.ex === 'mc_de' && e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={meaningLang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.ex === 'mc_en' &&
          (e.sentence ? (
            <Sentence span={e.sentence}>
              <mark className="lx-mark text-fg">{e.sentence.gap}</mark>
            </Sentence>
          ) : (
            <p className="lx-sentence" lang="en">
              <mark className="lx-mark text-fg">{e.card.word}</mark>
            </p>
          ))}
        {e.ex === 'colloc' && e.sentence && (
          <Sentence span={e.sentence}>
            <span className="lx-gap" data-testid="gap" data-state={gapState} style={{ width: 'auto' }}>
              {filled || ' '}
            </span>
          </Sentence>
        )}
        <Choices items={e.options} chosen={fb?.chosen?.id ?? null} onChoose={(id) => check(e.options.find((o) => o.id === id) ?? null)} label={t('trChoicesLabel')} />
      </>
    );
  }

  const srcKey = e.card.src && SRC_KEYS.has(e.card.src) ? e.card.src : 'misc';
  const verdictKey: MessageKey = !fb ? 'trVerdictCorrect' : fb.result.verdict === 'correct' ? 'trVerdictCorrect' : fb.result.verdict === 'near' ? 'trVerdictNear' : 'trVerdictWrong';
  const verdictTone = !fb ? '' : fb.result.verdict === 'correct' ? 'text-accent-text' : fb.result.verdict === 'near' ? 'text-gold-text' : 'text-danger-text';

  return (
    <ExerciseFrame
      ladder={<Ladder stage={e.stage} label={t('ladderLabel', { n: e.stage, name: t(STAGE_KEYS[e.stage] ?? 'stage1') })} />}
      task={t(`task_${e.ex}` as MessageKey)}
      purposeLabel={t('trPurposeLabel')}
      purpose={t(e.ex === 'colloc' ? 'purposeColloc' : (PURPOSE[def.stage] ?? 'purpose1'))}
      body={body}
      actions={
        e.input === 'typed' && !fb ? (
          <div>
            <Button variant="primary" onClick={() => check(null)} data-testid="check">
              {t('trCheck')}
            </Button>
          </div>
        ) : undefined
      }
      resultLabel={t('trResultLabel')}
      result={
        fb ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base }} className="flex flex-col gap-2">
            <p className={`text-base font-semibold ${verdictTone}`} data-testid="verdict" data-verdict={fb.result.verdict}>
              {t(verdictKey)}
            </p>
            {fb.result.verdict !== 'correct' && (
              <p className="text-sm">
                <span className="text-muted">{t('trYour')}: </span>
                <span lang={e.ex === 'mc_en' ? meaningLang : 'en'} data-testid="given">
                  {normalize(fb.given) ? fb.given : t('trEmpty')}
                </span>
              </p>
            )}
            <AnimatePresence>
              <motion.p
                className="text-sm"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
                data-testid="solution"
              >
                <span className="text-muted">{t('trSolution')}: </span>
                <span className="font-semibold" lang={e.ex === 'mc_en' ? meaningLang : 'en'}>
                  {e.accepted[0]}
                </span>
              </motion.p>
            </AnimatePresence>
            {e.ex === 'type' && e.card.context && (
              <p className="text-sm text-muted" lang="en" data-testid="origin-sentence">
                {e.card.context.sentence.slice(0, e.card.context.start)}
                <mark className="lx-mark text-fg">{e.card.context.gap}</mark>
                {e.card.context.sentence.slice(e.card.context.end)}
              </p>
            )}
          </motion.div>
        ) : undefined
      }
      whyLabel={t('trWhyLabel')}
      why={
        fb ? (
          <ul className="flex flex-col gap-1 text-sm text-fg">
            {fb.why.map((w, i) => (
              <li key={i}>{t(w.key as MessageKey, w.vars && 'pos' in w.vars ? { ...w.vars, pos: t(String(w.vars.pos) as MessageKey) } : w.vars)}</li>
            ))}
          </ul>
        ) : undefined
      }
      rating={
        fb ? (
          <div className="flex flex-col gap-2">
            <RatingBar
              labels={{ 1: t('grade1'), 2: t('grade2'), 3: t('grade3'), 4: t('grade4') }}
              intervals={{ 1: iv(fb.intervals[1]), 2: iv(fb.intervals[2]), 3: iv(fb.intervals[3]), 4: iv(fb.intervals[4]) }}
              suggested={fb.suggested}
              allowed={fb.allowed}
              onRate={rate}
              groupLabel={t('trRateLabel')}
            />
            <p className="text-xs text-subtle">
              {t('trSuggest', { grade: t(GRADE_KEYS[fb.suggested]) })} · {t('trEnterHint')} · {num(Math.round(fb.ms / 100) / 10)} s
            </p>
          </div>
        ) : undefined
      }
      footer={t('srcLabel', { src: t(`src_${srcKey}` as MessageKey) })}
      meta={{ ex: e.ex, card: e.card.id, col: e.colloc?.index }}
    />
  );
}
