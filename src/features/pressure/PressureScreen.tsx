import { usePlayerSkip } from '../../app/shell/Player';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import type { Objection } from '../../content/nb/schemas';
import {
  ANSWER_MS,
  choiceOptions,
  firstSentence,
  modelText,
  MOVES,
  movesScore,
  noMoves,
  orderPool,
  PRESSURE_ANSWER_MS,
  PRESSURE_TEXT_MAX,
  starterOf,
  starterPrefill,
  THINK_MS,
  type PressureAnswer,
} from '../../domain/nbdrill/pressure';
import { objections } from '../../content/nb/load';
import type { Level } from '../../domain/levels/levels';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { ExerciseShell, type ExerciseShellProps, type ShellSecondary } from '../../ui/exercise';
import type { Feedback } from '../../ui/feedback/types';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { saveLookupCard } from '../lookup/store';
import { drillFeedback } from '../nbdrill/shell';
import { finishUnit, Note, StepBoundary, TimeBar, TrainingBar, useCountdown } from '../nbdrill/shared';
import {
  beginAnswer,
  bestOf,
  submitStarters,
  easierNow,
  levelAt,
  showHint,
  submitStructured,
  endPressure,
  ensurePressure,
  markSaved,
  nextObjection,
  itemOf,
  pressureItems,
  setOf,
  TIMES,
  type PressureItem,
  pressureMs,
  pressureResult,
  pressureRight,
  retryCheck,
  setDraft,
  skipObjection,
  submitAnswer,
  toggleMove,
  usePressure,
  type PressureSession,
} from './session';

// Einwand-Training (Plan N103, Lehrer I3): 5 Einwände, je 10 s Bedenkzeit und 30 s Antwort, das
// Muster anerkennen · nachfragen · antworten · absichern steht immer sichtbar da. Mit KI prüft
// Claude die vier Schritte nach; ohne KI Selbstcheck + Musterantwort. „Weiter“ wartet nie.

const MOVE_KEY: Record<(typeof MOVES)[number], MessageKey> = {
  acknowledge: 'nbTrainingMove_acknowledge',
  ask: 'nbTrainingMove_ask',
  answer: 'nbTrainingMove_answer',
  secure: 'nbTrainingMove_secure',
};

export function PressureScreen({ route }: ScreenProps<'pressure'>) {
  const { t } = useT();
  useState(() => ensurePressure(route, useSettings.getState().lang));
  const s = usePressure((x) => x.s);
  usePlayerSkip(skipObjection);
  if (!s) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="pressure" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  if (s.done) return <PressureEnd s={s} route={route} />;
  const p = itemOf(s);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pressure" data-pos={s.pos} data-phase={s.phase} data-state="open">
      <TrainingBar route={route} unit={s.unit} progress={{ n: s.pos + 1, total: s.ids.length }} />
      <StepBoundary resetKey={s.pos} scope="pressure" onSkip={skipObjection}>
        {p && (p.obj ? <ObjectionStep key={p.id} s={s} o={p.obj} /> : <QuestionStep key={p.id} s={s} p={p} />)}
      </StepBoundary>
    </div>
  );
}

function Pattern({ answer }: { answer?: PressureAnswer | null }) {
  const { t } = useT();
  const m = answer?.moves ?? null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="pressure-pattern">
      <p className="lx-eyebrow">{t('nbTrainingPattern')}</p>
      <ol className="flex flex-wrap gap-2">
        {MOVES.map((k, i) => (
          <li key={k} className="lx-chip inline-flex items-center gap-1" data-move={k} data-on={m ? String(m[k]) : 'open'}>
            {m?.[k] ? <Icon name="check" size={14} /> : <span className="lx-tnum text-subtle">{i + 1}</span>}
            {t(MOVE_KEY[k])}
          </li>
        ))}
      </ol>
    </div>
  );
}

const LEVEL_KEY = ['', 'nbTrainingLevel_1', 'nbTrainingLevel_2', 'nbTrainingLevel_3', 'nbTrainingLevel_4', 'nbTrainingLevel_5'] as const satisfies readonly (MessageKey | '')[];
const levelName = (t: (k: MessageKey) => string, lv: Level): string => t(LEVEL_KEY[lv]);
const LEVEL_TASK: Record<Level, MessageKey> = {
  1: 'nbTrainingLevelTask_1',
  2: 'nbTrainingLevelTask_2',
  3: 'nbTrainingLevelTask_3',
  4: 'nbTrainingLevelTask_4',
  5: 'nbTrainingLevelTask_5',
};

type Common = Omit<ExerciseShellProps, 'answer' | 'primary' | 'feedback' | 'hint' | 'secondary'>;

/** Der Einwand mit Vorlesen und „Auf Deutsch“ (Platz `prompt`). */
function LineBlock({ id, line, de, area, source, speakId, lineId, level }: { id: string; line: string; de: string; area: 'business'; source: string; speakId: string; lineId: string; level?: ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2" data-id={id}>
      {level}
      <div className="flex items-start gap-2">
        <EnglishText text={line} area={area} source={source} className="flex-1" testId={lineId} />
        <SpeakButton text={line} testId={speakId} />
      </div>
      <button type="button" className="lx-t-support self-start text-muted underline-offset-2 hover:underline" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid={lineId === 'objection-line' ? 'objection-de-toggle' : undefined}>
        {t('nbTrainingInGerman')}
      </button>
      {open && <p className="lx-t-support text-muted">{de}</p>}
    </div>
  );
}

function ObjectionStep({ s, o }: { s: PressureSession; o: Objection }) {
  const { t, lang } = useT();
  const field = useRef<HTMLTextAreaElement>(null);
  const staged = s.lv !== undefined;
  const lv = levelAt(s);
  // Stufe 5 (und alte Runden ohne Stufe): Bedenkzeit, dann Zeitziel. Die Uhr gibt nie selbst ab (Lernpfad 03.10.2026).
  const total = staged ? PRESSURE_ANSWER_MS : ANSWER_MS;
  const thinkLeft = useCountdown(THINK_MS, s.phase === 'think', beginAnswer, `t${s.pos}`);
  const answerLeft = useCountdown(total, s.phase === 'answer' && lv === 5, noop, `a${s.pos}`);
  const answer = s.answers.find((a) => a.id === o.id) ?? null;
  const start = () => {
    beginAnswer();
    field.current?.focus();
  };
  const levelLine = staged ? (
    <p className="lx-t-meta text-muted" data-testid="pressure-level" data-level={lv}>
      {t('nbTrainingLevel', { n: lv, name: levelName(t, lv) })}
    </p>
  ) : null;
  const common: Common = {
    meta: { ex: 'objection', id: o.id, kind: lv <= 2 ? 'choose' : lv === 3 ? 'complete' : 'speak' },
    status: { area: 'words', state: null, kindLabel: t('nbTrainingObjection'), badge: t('nbTrainingObjectionOf', { n: s.pos + 1, total: s.ids.length }) },
    task: { text: staged ? t(LEVEL_TASK[lv]) : t('nbTrainingPressureTask'), purpose: staged ? t('nbTrainingLevelPurpose') : t('nbTrainingPressurePurpose') },
    aid: lv > 2 ? <Pattern answer={s.phase === 'review' ? answer : null} /> : null,
    prompt: <LineBlock id={o.id} line={o.line} de={o.de} area="business" source={`objection/${o.id}`} speakId="objection-speak" lineId="objection-line" level={levelLine} />,
  };
  const easier: ShellSecondary = { id: 'reset', label: t('nbTrainingEasier'), onClick: easierNow, testId: 'pressure-easier' };
  const easierList = staged && lv > 1 ? [easier] : [];
  const wrap = (node: ReactNode) => (
    <div data-testid="objection-item" data-id={o.id} data-level={lv}>
      {node}
    </div>
  );

  if (s.phase === 'review') {
    const review = answer?.part !== undefined ? <StructuredReview o={o} answer={answer} common={common} /> : <Review s={s} o={o} answer={answer} lang={lang} common={common} />;
    return wrap(review);
  }
  if (lv === 1) return wrap(<OrderLevel o={o} common={common} secondary={easierList} />);
  if (lv === 2) return wrap(<ChoiceLevel o={o} common={common} secondary={easierList} />);
  if (lv === 3) return wrap(<StarterLevel key={`${o.id}-${lv}`} o={o} common={common} secondary={easierList} />);
  const secondary: ShellSecondary[] = [];
  if (lv === 4 && staged && !s.hint) secondary.push({ id: 'hint', label: t('nbTrainingShowStarters'), onClick: showHint, testId: 'pressure-hint' });
  secondary.push(...easierList);
  return wrap(
    <ExerciseShell
      {...common}
      answer={
        <div className="flex flex-col gap-3">
          {lv === 5 &&
            (s.phase === 'think' ? (
              <TimeBar left={thinkLeft} total={THINK_MS} label={t('nbTrainingThink')} testId="pressure-think" />
            ) : (
              <TimeBar left={answerLeft} total={total} label={staged ? t('nbTrainingTimeGoal') : t('nbTrainingAnswerTime')} testId="pressure-answer" />
            ))}
          {lv === 4 && staged && s.hint ? <StarterHint o={o} /> : null}
          <textarea
            ref={field}
            className="lx-field min-h-28 text-base"
            lang="en"
            rows={4}
            maxLength={PRESSURE_TEXT_MAX}
            value={s.draft}
            readOnly={s.phase !== 'answer'}
            onFocus={() => s.phase === 'think' && beginAnswer()}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t('nbTrainingAnswerLabel')}
            placeholder={t('nbTrainingAnswerLabel')}
            autoCapitalize="sentences"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="pressure-input"
          />
        </div>
      }
      hint={{ text: t('nbTrainingSpeakHint'), tone: 'hint' }}
      secondary={secondary}
      primary={s.phase === 'think' ? { label: t('nbTrainingStartAnswer'), onClick: start, testId: 'pressure-start' } : { label: t('nbTrainingCheck'), onClick: submitAnswer, testId: 'pressure-check' }}
    />,
  );
}

const noop = () => undefined;

/** Stufe 1: die vier Mustersätze antippen, sie füllen die Schritte der Reihe nach. */
function OrderLevel({ o, common, secondary }: { o: Objection; common: Common; secondary: ShellSecondary[] }) {
  const { t } = useT();
  const pool = useMemo(() => orderPool(o), [o]);
  const [slots, setSlots] = useState<(number | null)[]>([null, null, null, null]);
  const used = new Set(slots.filter((x): x is number => x !== null));
  const place = (i: number) => {
    const free = slots.indexOf(null);
    if (free < 0) return;
    setSlots(slots.map((x, k) => (k === free ? i : x)));
  };
  const full = slots.every((x) => x !== null);
  const input = (
    <div className="flex flex-col gap-4" data-testid="pressure-order">
      <ol className="flex flex-col gap-2">
        {MOVES.map((k, i) => {
          const at = slots[i];
          const item = at !== null && at !== undefined ? pool[at] : null;
          return (
            <li key={k} className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-line p-3" data-testid={`order-slot-${i}`}>
              <span className="text-xs font-medium tracking-wide text-subtle uppercase">{t('nbTrainingSlot', { n: i + 1, move: t(MOVE_KEY[k]) })}</span>
              {item ? (
                <button
                  type="button"
                  className="min-h-11 text-left text-base"
                  lang="en"
                  aria-label={`${t('nbTrainingSlotRemove')}: ${item.text}`}
                  onClick={() => setSlots(slots.map((x, n) => (n === i ? null : x)))}
                >
                  {item.text}
                </button>
              ) : (
                <span className="text-sm text-muted">{t('nbTrainingSlotEmpty')}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbTrainingPool')}</p>
        {pool.map((x, i) =>
          used.has(i) ? null : (
            <button
              key={x.move}
              type="button"
              className="lx-chip min-h-11 justify-start text-left text-base leading-snug whitespace-normal"
              lang="en"
              onClick={() => place(i)}
              data-testid="order-pool-item"
              data-move={x.move}
            >
              {x.text}
            </button>
          ),
        )}
      </div>
    </div>
  );
  const submit = () =>
    submitStructured(
      slots.map((x) => (x === null ? null : (pool[x]?.move ?? null))),
      slots.map((x) => (x === null ? '' : (pool[x]?.text ?? ''))),
    );
  return <ExerciseShell {...common} answer={input} secondary={secondary} primary={{ label: t('nbTrainingCheck'), onClick: submit, testId: 'pressure-check', disabled: !full }} />;
}

/** Stufe 2: je Schritt den passenden Satz aus drei wählen. */
function ChoiceLevel({ o, common, secondary }: { o: Objection; common: Common; secondary: ShellSecondary[] }) {
  const { t } = useT();
  const opts = useMemo(() => MOVES.map((k) => choiceOptions(o, objections(), k)), [o]);
  // Anerkennen ist fast immer allgemein formuliert (passt zu jedem Einwand): dieser Schritt steht als Vorbild da,
  // gewählt wird bei nachfragen, antworten, absichern (Lernwissenschaft S3, 03.10.2026).
  const [picked, setPicked] = useState<(number | null)[]>(() => [(opts[0] ?? []).findIndex((x) => x.ok), null, null, null]);
  const full = picked.every((x) => x !== null);
  const input = (
    <div className="flex flex-col gap-4" data-testid="pressure-choice">
      {MOVES.map((k, i) =>
        i === 0 ? (
          <div key={k} className="flex flex-col gap-1" data-testid="choice-given">
            <span className="text-xs font-medium tracking-wide text-subtle uppercase">{t('nbTrainingSlot', { n: 1, move: t(MOVE_KEY[k]) })}</span>
            <p className="rounded-[var(--radius-control)] border border-line p-3 text-base" lang="en">
              {o.model[k]}
            </p>
          </div>
        ) : (
          <fieldset key={k} className="flex flex-col gap-2" data-testid={`choice-step-${i}`}>
            <legend className="mb-1 text-xs font-medium tracking-wide text-subtle uppercase">{t('nbTrainingSlot', { n: i + 1, move: t(MOVE_KEY[k]) })}</legend>
            {(opts[i] ?? []).map((x, n) => (
              <label key={x.text} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 text-base has-[:checked]:border-accent">
                <input
                  type="radio"
                  className="mt-1 size-5 flex-none accent-[var(--color-accent)]"
                  name={`choice-${o.id}-${k}`}
                  checked={picked[i] === n}
                  onChange={() => setPicked(picked.map((p, m) => (m === i ? n : p)))}
                  data-testid="choice-option"
                  data-ok={x.ok ? '1' : '0'}
                />
                <span lang="en">{x.text}</span>
              </label>
            ))}
          </fieldset>
        ),
      )}
    </div>
  );
  const submit = () =>
    submitStructured(
      picked.map((p, i) => (p !== null && opts[i]?.[p]?.ok ? (MOVES[i] ?? null) : null)),
      picked.map((p, i) => (p !== null ? (opts[i]?.[p]?.text ?? '') : '')),
    );
  return <ExerciseShell {...common} answer={input} secondary={secondary} primary={{ label: t('nbTrainingCheck'), onClick: submit, testId: 'pressure-check', disabled: !full }} />;
}

/** Stufe 3: vier Felder mit Satzanfängen, Emrah schreibt jeden Satz zu Ende. */
function StarterLevel({ o, common, secondary }: { o: Objection; common: Common; secondary: ShellSecondary[] }) {
  const { t } = useT();
  const [parts, setParts] = useState<string[]>(() => MOVES.map((k) => starterPrefill(o.model[k])));
  const change = (i: number, v: string) => {
    const next = parts.map((p, n) => (n === i ? v : p));
    setParts(next);
    setDraft(
      next
        .map((x) => x.trim())
        .filter(Boolean)
        .join(' '),
    );
  };
  // Eigener Anteil je Feld: Wörter über den vorgegebenen Satzanfang hinaus. Voll gewertet nur mit ≥ 3 eigenen Wörtern je Satz.
  const ownWords = parts.map((p, i) => {
    const pre = starterPrefill(o.model[MOVES[i] ?? 'acknowledge']).trim();
    const v = p.trim();
    return (v.startsWith(pre) ? v.slice(pre.length) : v).split(/\s+/).filter(Boolean).length;
  });
  const written = ownWords.some((n) => n > 0);
  const own = ownWords.every((n) => n >= 3);
  const input = (
    <div className="flex flex-col gap-3" data-testid="pressure-starters-level">
      {MOVES.map((k, i) => (
        <label key={k} className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-subtle uppercase">{t('nbTrainingSlot', { n: i + 1, move: t(MOVE_KEY[k]) })}</span>
          <textarea
            className="lx-field min-h-16 text-base"
            lang="en"
            rows={2}
            maxLength={Math.floor(PRESSURE_TEXT_MAX / 4)}
            value={parts[i] ?? ''}
            onChange={(e) => change(i, e.target.value)}
            autoCapitalize="sentences"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid={`starter-input-${i}`}
          />
        </label>
      ))}
    </div>
  );
  return <ExerciseShell {...common} answer={input} secondary={secondary} primary={{ label: t('nbTrainingCheck'), onClick: () => submitStarters(own), testId: 'pressure-check', disabled: !written }} />;
}

/** Stufe 4: Satzanfänge auf Abruf (zählt als Hilfe). */
function StarterHint({ o }: { o: Objection }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-1" data-testid="pressure-hint-list">
      <p className="lx-eyebrow">{t('nbTrainingStartersHelp')}</p>
      <ol className="lx-t-support flex flex-col gap-1">
        {MOVES.map((k, i) => (
          <li key={k}>
            <span className="text-muted">
              {i + 1}. {t(MOVE_KEY[k])}:{' '}
            </span>
            <span lang="en">{starterOf(o.model[k])}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Rückblick Stufe 1–2: je Schritt richtig/falsch, dazu der richtige Satz und warum das Muster trägt. */
function StructuredReview({ o, answer, common }: { o: Objection; answer: PressureAnswer; common: Common }) {
  const { t, lang } = useT();
  const n = Math.round((answer.part ?? 0) * 4);
  const pick = answer.pick ?? [];
  const texts = answer.pickText ?? [];
  const fb: Feedback = {
    verdict: n === 4 ? 'ok' : n >= 2 ? 'close' : 'wrong',
    effect: t('nbTrainingStructResult', { n }),
    solution: modelText(o),
    fixes: [
      {
        kind: 'goal',
        mine: '',
        right: MOVES.map((k) => t(MOVE_KEY[k])).join(' · '),
        why: `${o.tip[lang]} ${t('nbTrainingStructWhy')}`,
      },
    ],
  };
  const rows = (
    <div className="flex flex-col gap-4" data-testid="pressure-review" data-mode="structured" data-part={n}>
      <ol className="flex flex-col gap-2">
        {MOVES.map((k, i) => {
          const ok = pick[i] === k;
          return (
            <li key={k} className="flex items-start gap-2 text-sm" data-testid={`struct-row-${i}`} data-ok={ok ? '1' : '0'}>
              <Icon name={ok ? 'check' : 'close'} size={16} className={`mt-0.5 flex-none ${ok ? 'text-ok' : 'text-danger-text'}`} />
              <span className="sr-only">{ok ? t('nbTrainingStepOk') : t('nbTrainingStepWrong')}</span>
              <span className="flex flex-col">
                <span className="font-medium">{t('nbTrainingSlot', { n: i + 1, move: t(MOVE_KEY[k]) })}</span>
                {!ok && texts[i] && (
                  <span className="text-muted" data-testid={`struct-mine-${i}`}>
                    {t('nbTrainingStructYours')} <s lang="en">{texts[i]}</s>
                    <span className="lx-t-meta block">{answer.lv === 1 ? t('nbTrainingStructOtherStep') : t('nbTrainingStructOther')}</span>
                  </span>
                )}
                <span className="text-muted">
                  {!ok && <span>{t('nbTrainingStructRightLbl')} </span>}
                  <span lang="en">{o.model[k]}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2">
        <SpeakButton text={modelText(o)} testId="pressure-model-speak" />
        <span className="text-sm text-muted">{t('nbTrainingModel')}</span>
      </div>
    </div>
  );
  return <ExerciseShell {...common} answer={rows} primary={{ label: t('exNext'), onClick: nextObjection, testId: 'next' }} feedback={drillFeedback(fb)} />;
}

function Review({ s, o, answer, lang, common }: { s: PressureSession; o: Objection; answer: PressureAnswer | null; lang: 'de' | 'en'; common: Common }) {
  const { t } = useT();
  const slot = s.ai[o.id];
  const busy = !!slot && ['queued', 'thinking', 'streaming', 'slow'].includes(slot.phase);
  const aiDone = slot?.phase === 'done' && answer?.by === 'ai';
  const self = !aiDone && !busy;
  const score = movesScore(answer?.moves);
  const text = answer?.text ?? '';
  const timeUp = !!answer && (answer.lv === 5 ? answer.ms > PRESSURE_ANSWER_MS : answer.lv === undefined && answer.ms >= ANSWER_MS - 200);
  const fb: Feedback = aiDone
    ? {
        verdict: score >= 4 ? 'ok' : score >= 2 ? 'close' : 'wrong',
        effect: `${t('nbTrainingMovesOf', { n: score })} · ${slot.effect}`,
        ...(text ? { mine: text } : {}),
        ...(answer?.better ? { solution: answer.better } : {}),
        fixes: slot.fixes.map((f) => ({
          kind: 'form' as const,
          mine: f.mine,
          right: f.right,
          why: f.why,
        })),
        why: { question: `${o.line} → ${text}` },
      }
    : {
        verdict: 'unchecked',
        ...(text ? { mine: text } : { mine: t('nbTrainingNoAnswer') }),
        solution: modelText(o),
        fixes: [
          {
            kind: 'goal',
            mine: '',
            right: MOVES.map((k) => t(MOVE_KEY[k])).join(' · '),
            why: o.tip[lang],
          },
        ],
      };
  const extras = (
    <div className="flex flex-col gap-4" data-testid="pressure-review" data-mode={aiDone ? 'ai' : busy ? 'busy' : 'self'}>
      {timeUp && <Note tone="info">{answer?.lv === 5 ? t('nbTrainingTimeOver') : t('nbTrainingTimeUp')}</Note>}
      {busy && <AiRunPanel phase={slot.phase === 'idle' ? 'queued' : slot.phase} error={null} skeleton={false} />}
      {slot?.phase === 'error' && slot.error && <AiRunPanel phase="error" error={slot.error} onRetry={() => retryCheck(o.id)} skeleton={false} />}
      {self && (
        <fieldset className="flex flex-col gap-2" data-testid="pressure-selfcheck">
          <legend className="mb-1 text-sm font-medium">{t('nbTrainingSelfCheck')}</legend>
          {MOVES.map((k) => {
            const on = (answer?.moves ?? noMoves())[k];
            return (
              <label key={k} className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={on} onChange={() => toggleMove(o.id, k)} data-testid={`selfcheck-${k}`} />
                <span className="flex flex-col">
                  <span className="font-medium">{t(MOVE_KEY[k])}</span>
                  <span className="text-muted" lang="en">
                    {o.model[k]}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
  return <ExerciseShell {...common} answer={extras} primary={{ label: t('exNext'), onClick: nextObjection, testId: 'next' }} feedback={drillFeedback(fb)} />;
}

const SET_TEXT = {
  hotseat: {
    task: 'nbTrainingHotseatTask',
    purpose: 'nbTrainingHotseatPurpose',
  },
  buytime: {
    task: 'nbTrainingBuytimeTask',
    purpose: 'nbTrainingBuytimePurpose',
  },
} as const satisfies Record<'hotseat' | 'buytime', { task: MessageKey; purpose: MessageKey }>;

/** Heißer Stuhl und Zeit gewinnen (Soll N108): Frage, Zeitbalken, Antwort, dann Muster zum Vergleich. */
function QuestionStep({ s, p }: { s: PressureSession; p: PressureItem }) {
  const { t, lang } = useT();
  const field = useRef<HTMLTextAreaElement>(null);
  const times = TIMES[p.set];
  const thinkLeft = useCountdown(times.think, s.phase === 'think' && times.think > 0, beginAnswer, `t${s.pos}`);
  const answerLeft = useCountdown(times.answer, s.phase === 'answer', noop, `a${s.pos}`);
  const answer = s.answers.find((a) => a.id === p.id) ?? null;
  const txt = SET_TEXT[p.set === 'buytime' ? 'buytime' : 'hotseat'];
  const text = answer?.text ?? '';
  const fb: Feedback = {
    verdict: 'unchecked',
    mine: text || t('nbTrainingNoAnswer'),
    solution: p.model,
    fixes: p.tip ? [{ kind: 'goal', mine: '', right: p.model, why: p.tip[lang] }] : [],
    ...(p.starters && p.starters.length > 1 ? { upgrades: p.starters.slice(1).map((x) => ({ to: x })) } : {}),
  };
  const review = s.phase === 'review';
  const start = () => {
    beginAnswer();
    field.current?.focus();
  };
  return (
    <div data-testid={`${p.set}-item`} data-id={p.id}>
      <ExerciseShell
        meta={{ ex: p.set, id: p.id, kind: 'speak' }}
        status={{ area: 'words', state: null, kindLabel: t(p.set === 'buytime' ? 'fxLKindBuytime' : 'fxLKindHotseat'), badge: t('nbTrainingQuestionOf', { n: s.pos + 1, total: s.ids.length }) }}
        task={{ text: t(txt.task), purpose: t(txt.purpose) }}
        prompt={<LineBlock id={p.id} line={p.line} de={p.de} area="business" source={`${p.set}/${p.id}`} speakId="question-speak" lineId="question-line" />}
        answer={
          !review ? (
            <div className="flex flex-col gap-3">
              {s.phase === 'think' ? (
                <TimeBar left={thinkLeft} total={times.think} label={t('nbTrainingThink')} testId="pressure-think" />
              ) : (
                <TimeBar left={answerLeft} total={times.answer} label={t('nbTrainingTimeGoal')} testId="pressure-answer" />
              )}
              <textarea
                ref={field}
                className="lx-field min-h-24 text-base"
                lang="en"
                rows={3}
                maxLength={PRESSURE_TEXT_MAX}
                value={s.draft}
                readOnly={s.phase !== 'answer'}
                onFocus={() => s.phase === 'think' && beginAnswer()}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={t('nbTrainingAnswerLabel')}
                placeholder={t('nbTrainingAnswerLabel')}
                autoCapitalize="sentences"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-testid="pressure-input"
              />
            </div>
          ) : p.starters ? (
            <div className="flex flex-col gap-1" data-testid="pressure-review">
              <div className="flex flex-col gap-1" data-testid="pressure-starters">
                <p className="lx-eyebrow">{t('nbTrainingStarters')}</p>
                <ul className="flex flex-col gap-1">
                  {p.starters.map((x) => (
                    <li key={x}>
                      <EnglishText text={x} area="business" source={`${p.set}/${p.id}`} className="lx-t-support" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <span data-testid="pressure-review" data-mode="self" />
          )
        }
        hint={!review ? { text: t('nbTrainingSpeakHint'), tone: 'hint' } : null}
        primary={
          review
            ? { label: t('exNext'), onClick: nextObjection, testId: 'next' }
            : s.phase === 'think'
              ? { label: t('nbTrainingStartAnswer'), onClick: start, testId: 'pressure-start' }
              : { label: t('nbTrainingCheck'), onClick: submitAnswer, testId: 'pressure-check' }
        }
        feedback={review ? drillFeedback(fb) : null}
      />
    </div>
  );
}

function PressureEnd({ s, route }: { s: PressureSession; route: ScreenProps<'pressure'>['route'] }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>(s.saved ? 'saved' : 'idle');
  const best = bestOf(s);
  const o = best ? (pressureItems(setOf(s)).find((x) => x.id === best.id) ?? null) : null;
  // Karten nur aus geprüftem Text (Prüfbefund M4c): KI-Fassung, sonst die Musterantwort.
  const keep = best?.better ?? o?.model ?? '';
  const finish = () => {
    const unit = s.unit;
    const result = pressureResult(s);
    endPressure();
    finishUnit(unit, unit ? result : undefined);
  };
  const save = async () => {
    if (!o || !keep || state === 'busy' || state === 'saved') return;
    setState('busy');
    const phrase = firstSentence(keep);
    const r = await saveLookupCard({
      word: phrase,
      de: t('nbTrainingSaveDe', { line: o.de }),
      pos: 'phrase',
      ex: keep,
      surface: phrase,
      src: 'coach',
      origin: {
        v: 1,
        kind: 'business',
        ref: `${o.set}/${o.id}`,
        title: o.line,
        t: Date.now(),
      },
      today: s.day,
    });
    if (r === 'saved' || r === 'added' || r === 'exists') {
      markSaved();
      setState('saved');
    } else setState('failed');
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pressure" data-state="done">
      <TrainingBar route={route} unit={s.unit} progress={null} onClose={finish} />
      <SessionEnd
        right={pressureRight(s)}
        total={s.answers.length}
        ms={pressureMs(s)}
        takeaways={
          keep || s.lvAfter ? (
            <div className="flex flex-col gap-3">
              {s.lvAfter && s.lv && <LevelNote from={s.lv} to={s.lvAfter} />}
              {keep && (
                <div className="flex flex-col gap-2" data-testid="pressure-best">
                  <p className="text-sm text-muted">{t('nbTrainingBest')}</p>
                  <EnglishText text={keep} area="business" source={o ? `${o.set}/${o.id}` : null} className="text-base leading-relaxed" />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      icon={state === 'saved' ? 'check' : 'bookmarkPlus'}
                      disabled={state === 'saved' || state === 'busy'}
                      onClick={() => void save()}
                      data-testid="pressure-save"
                      data-state={state}
                    >
                      {state === 'saved' ? t('nbTrainingSaved') : t('nbTrainingSave')}
                    </Button>
                    {state === 'failed' && <span className="text-sm text-danger-text">{t('nbTrainingSaveFailed')}</span>}
                  </div>
                </div>
              )}
            </div>
          ) : undefined
        }
        next={{
          label: s.unit ? t('nbTrainingNext') : t('nbTrainingDone'),
          run: finish,
        }}
      />
    </div>
  );
}

function LevelNote({ from, to }: { from: Level; to: Level }) {
  const { t } = useT();
  const key: MessageKey = to > from ? 'nbTrainingLevelUp' : to < from ? 'nbTrainingLevelDown' : 'nbTrainingLevelStay';
  return (
    <Note tone={to > from ? 'ok' : 'info'} testId="pressure-level-next" kind={to > from ? 'up' : to < from ? 'down' : 'stay'}>
      {t(key, { n: to, name: levelName(t, to) })}
    </Note>
  );
}
