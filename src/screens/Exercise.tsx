import { useEffect, useMemo, useRef, useState } from 'react';
import { useT, type MessageKey } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { KineticGap, type GapState } from '../engine/KineticGap';
import { useHiddenInput } from '../engine/HiddenInput';
import { checkWithHint } from '../domain/answer/check';
import type { MaskCell } from '../domain/answer/mask';
import type { CheckResult } from '../domain/srs/types';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { speak } from '../platform/speech';
import { setAskContext } from '../app/route';
import { distractors, familyTask, gapIn, synonymTask, type CardView } from '../coach/cardView';
import type { AnswerFacts, Format } from '../coach/session';
import { Certainty, PosLabel, Speak, TapText, WordDetails } from './parts';

// Eine Abfrage (docs/neustart.md §5): Bedeutung wählen, Lücke im echten Satz, frei abrufen,
// hören und schreiben. Danach echte Hilfe statt Erklärtext: Bedeutung, Aussprache, Beispiele.

export type StepKind = Format | 'meet' | 'sort' | 'grammar' | 'colloc' | 'ff';

export const FORMAT_LABEL: Record<StepKind, MessageKey> = {
  choose: 'cFmtChoose',
  gap: 'cFmtGap',
  recall: 'cFmtRecall',
  listen: 'cFmtListen',
  family: 'cFmtFamily',
  synonym: 'cFmtSynonym',
  meet: 'cFmtMeet',
  sort: 'cFmtSort',
  grammar: 'cFmtGrammar',
  colloc: 'cFmtColloc',
  ff: 'cFmtFF',
};
const WHY: Record<StepKind, MessageKey> = {
  choose: 'cWhyChoose',
  gap: 'cWhyGap',
  recall: 'cWhyRecall',
  listen: 'cWhyListen',
  family: 'cWhyFamily',
  synonym: 'cWhySynonym',
  meet: 'cWhyMeet',
  sort: 'cWhySort',
  grammar: 'cWhyGrammar',
  colloc: 'cWhyColloc',
  ff: 'cWhyFF',
};

/** Kopfzeile jeder Abfrage: Sicherheit, Abfrageart, Zweck hinter dem Info-Symbol. */
export function StepHead({ kind, lv }: { kind: StepKind; lv: number | null }) {
  const { t } = useT();
  const [why, setWhy] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        {lv !== null && <Certainty lv={lv} />}
        <span className="text-2xs font-medium uppercase tracking-wide text-muted" data-testid="format">
          {t(FORMAT_LABEL[kind])}
        </span>
        <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} aria-label={t(WHY[kind])} className="ml-auto grid h-8 w-8 place-items-center rounded-full text-subtle hover:text-fg">
          <Icon name="info" size={16} />
        </button>
      </div>
      {why && <p className="mt-2 text-xs text-muted">{t(WHY[kind])}</p>}
    </div>
  );
}

const perfNow = (): number => performance.now();

type Verdict = { result: CheckResult; given: string; solution: string; help: boolean; ms: number };

function verdictFacts(v: Verdict): AnswerFacts {
  return { correct: v.result.verdict === 'correct', near: v.result.verdict === 'near', help: v.help, ms: v.ms };
}

function revealMask(solution: string, revealed: number): MaskCell[] {
  let k = 0;
  return Array.from(solution).map((ch): MaskCell => {
    if (!/[\p{L}\p{N}]/u.test(ch)) return { kind: 'fixed', ch };
    return k++ < revealed ? { kind: 'slot', hint: ch } : { kind: 'slot' };
  });
}

/** Feedback nach jeder Abfrage. */
export function Feedback({ view, v, dueText, onNext, form }: { view: CardView; v: Verdict; dueText: string; onNext: () => void; form?: string | null }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      }
    };
    const id = window.setTimeout(() => window.addEventListener('keydown', onKey), 250);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [onNext]);
  const tone = v.result.verdict === 'correct' ? 'text-accent-text' : v.result.verdict === 'near' ? 'text-gold-text' : 'text-danger-text';
  return (
    <div className="mt-6 border-t border-line/60 pt-5" data-testid="feedback" data-verdict={v.result.verdict}>
      <p className={`flex flex-wrap items-center gap-2 text-base font-semibold ${tone}`}>
        <Icon name={v.result.verdict === 'wrong' ? 'close' : 'check'} size={18} />
        {v.result.verdict === 'correct' ? t('cFbRight') : v.result.verdict === 'near' ? t('cFbNear') : t('cFbWrong')}
        {v.result.verdict !== 'correct' && (
          <span lang="en" className="text-fg" data-testid="solution">
            {v.solution}
          </span>
        )}
      </p>
      {v.result.variant === 'uk' && v.result.us && <p className="mt-1 text-xs text-muted">{t('cFbUk', { us: v.result.us })}</p>}
      {form && form.toLowerCase() !== view.word.toLowerCase() && <p className="mt-1 text-xs text-muted">{t('cFbForm', { form })}</p>}
      <div className="mt-4">
        <WordDetails view={view} compact />
      </div>
      <p className="mt-4 text-2xs text-subtle" data-testid="next-due">
        {dueText}
      </p>
      <div className="mt-4">
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext} data-testid="next">
          {t('cNext')}
        </Button>
      </div>
    </div>
  );
}

type ExerciseProps = {
  view: CardView;
  format: Format;
  lv: number;
  /** Wiederholungszahl: wählt den Beispielsatz, damit nicht immer derselbe kommt. */
  reps: number;
  onAnswer: (facts: AnswerFacts) => string;
  onNext: () => void;
};

/** Abfrage einer Karte samt Rückmeldung. `onAnswer` verbucht und liefert den Text „wieder dran". */
export function Exercise({ view, format, lv, reps, onAnswer, onNext }: ExerciseProps) {
  const [started] = useState(perfNow);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [dueText, setDueText] = useState('');
  const gap = useMemo(() => (format === 'gap' || format === 'listen' ? gapIn(view, reps) : null), [view, format, reps]);
  const family = useMemo(() => (format === 'family' ? familyTask(view) : null), [view, format]);
  const synonym = useMemo(() => (format === 'synonym' ? synonymTask(view) : null), [view, format]);
  const fmt: Format = (format === 'gap' && !gap) || (format === 'family' && !family) || (format === 'synonym' && !synonym) ? 'recall' : format;

  useEffect(() => {
    setAskContext(`${view.word} (${view.de})${gap ? ` – ${gap.before}${gap.answer}${gap.after}` : ''}`);
  }, [view, gap]);

  function finish(v: Omit<Verdict, 'ms'>) {
    const full = { ...v, ms: performance.now() - started };
    setVerdict(full);
    setDueText(onAnswer(verdictFacts(full)));
  }

  return (
    <div data-testid="exercise" data-format={fmt}>
      <StepHead kind={fmt} lv={lv} />
      {fmt === 'choose' && <Choose view={view} done={verdict} onDone={finish} />}
      {fmt === 'synonym' && synonym && <Choose view={view} done={verdict} onDone={finish} synonym={synonym} />}
      {(fmt === 'gap' || fmt === 'recall' || fmt === 'listen' || fmt === 'family') && (
        <Typed key={view.id + fmt} view={view} fmt={fmt} gap={gap} family={family} lv={lv} done={verdict} onDone={finish} />
      )}
      {verdict && <Feedback view={view} v={verdict} dueText={dueText} onNext={onNext} form={gap?.answer ?? null} />}
    </div>
  );
}

function Choose({
  view,
  done,
  onDone,
  synonym,
}: {
  view: CardView;
  done: Verdict | null;
  onDone: (v: Omit<Verdict, 'ms'>) => void;
  synonym?: { answer: string; options: string[] };
}) {
  const { t } = useT();
  const main = synonym ? synonym.answer : (view.de.split(', ')[0] ?? view.de);
  const options = useMemo(() => synonym?.options ?? shuffle([main, ...distractors(view)], mulberry32(hash32(view.id))), [view, main, synonym]);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div>
      <p className="text-sm text-muted">{synonym ? t('cTaskSynonym') : t('cTaskChoose')}</p>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="prompt-word">
          {view.word}
        </p>
        <Speak text={view.word} />
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2" data-testid="choices">
        {options.map((o) => {
          const isRight = o === main;
          const state = !done ? '' : isRight ? 'ring-2 ring-accent' : o === picked ? 'ring-2 ring-danger-text/60' : 'opacity-60';
          return (
            <Button
              key={o}
              variant="secondary"
              disabled={!!done}
              className={`justify-start text-left ${state}`}
              onClick={() => {
                setPicked(o);
                onDone({ result: { verdict: isRight ? 'correct' : 'wrong' }, given: o, solution: main, help: false });
              }}
            >
              {o}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function Typed({
  view,
  fmt,
  gap,
  family,
  lv,
  done,
  onDone,
}: {
  view: CardView;
  fmt: 'gap' | 'recall' | 'listen' | 'family';
  gap: ReturnType<typeof gapIn>;
  family: ReturnType<typeof familyTask>;
  lv: number;
  done: Verdict | null;
  onDone: (v: Omit<Verdict, 'ms'>) => void;
}) {
  const { t } = useT();
  const api = useHiddenInput();
  const solution = fmt === 'gap' ? gap!.answer : fmt === 'listen' && gap ? gap.answer : fmt === 'family' && family ? family.word : view.word;
  const accepted = fmt === 'listen' ? [solution, view.word] : [solution];
  // Lücke mit Hilfe (Stufe ≤ 1): Platzhalter und erster Buchstabe. Frei: erst „Tipp" zeigt sie.
  const helped = fmt === 'gap' && lv <= 1;
  const [revealed, setRevealed] = useState(helped ? 1 : 0);
  const [showMask, setShowMask] = useState(helped);
  const [showMeaning, setShowMeaning] = useState(fmt !== 'listen');
  const typed = useRef('');
  const usedHelp = useRef(false);
  const listenText = fmt === 'listen' ? (gap ? `${gap.before}${gap.answer}${gap.after}` : view.word) : '';

  useEffect(() => {
    if (fmt === 'listen') void speak(listenText);
  }, [fmt, listenText]);

  const mask = showMask ? revealMask(solution, revealed) : null;
  const state: GapState = !done ? 'input' : done.result.verdict === 'correct' ? 'correct' : done.result.verdict === 'near' ? 'near' : 'wrong';

  function check() {
    if (done) return;
    const given = typed.current.trim();
    if (!given) return;
    const prefix = revealed > 0 ? Array.from(solution).slice(0, revealed).join('') : null;
    const { result } = checkWithHint(given, accepted, { lemma: view.word }, prefix);
    api.blur();
    onDone({ result, given, solution, help: usedHelp.current });
  }

  function tip() {
    usedHelp.current = true;
    if (fmt === 'listen' && !showMeaning) {
      setShowMeaning(true);
      return;
    }
    if (!showMask) {
      setShowMask(true);
      setRevealed(1);
      return;
    }
    setRevealed((r) => Math.min(r + 1, Math.max(1, Array.from(solution).length - 1)));
  }

  const gapEl = (
    <KineticGap
      label={fmt === 'recall' ? t('cTaskRecall') : t('cTaskGap')}
      maxLength={Math.max(30, solution.length + 10)}
      state={state}
      mask={mask}
      shown={done ? done.given : null}
      onChange={(v) => {
        typed.current = v;
      }}
      onEnter={check}
    />
  );

  return (
    <div>
      <p className="text-sm text-muted">{fmt === 'gap' ? t('cTaskGap') : fmt === 'listen' ? t('cTaskListen') : fmt === 'family' ? t('cTaskFamily') : t('cTaskRecall')}</p>
      {fmt === 'family' && family && (
        <div className="mt-3">
          <p className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight" data-testid="prompt-family">
            <span lang="en">{view.word}</span>
            <span className="text-base text-muted">→</span>
            <PosLabel pos={family.pos} />
          </p>
          <p className="mt-1 text-sm text-muted">{family.de}</p>
          <div className="mt-6 text-2xl">{gapEl}</div>
        </div>
      )}
      {fmt === 'recall' && (
        <div className="mt-3">
          <p className="text-2xl font-semibold tracking-tight" data-testid="prompt-meaning">
            {view.de}
          </p>
          <PosLabel pos={view.pos} />
          {view.en && <p className="mt-1 text-sm text-muted" lang="en">{view.en}</p>}
          <div className="mt-6 text-2xl">{gapEl}</div>
        </div>
      )}
      {fmt === 'gap' && gap && (
        <div className="mt-3">
          <p className="text-base text-muted" data-testid="prompt-meaning">
            {view.de}
          </p>
          <p className="mt-4 text-xl leading-loose" lang="en" data-testid="gap-sentence">
            {gap.before}
            {gapEl}
            {gap.after}
          </p>
          {gap.de && <p className="mt-2 text-sm text-subtle">{gap.de}</p>}
        </div>
      )}
      {fmt === 'listen' && (
        <div className="mt-3">
          <Button variant="secondary" icon="speaker" onClick={() => void speak(listenText)} data-testid="play">
            {t('cPlay')}
          </Button>
          {showMeaning && <p className="mt-3 text-base text-muted">{view.de}</p>}
          <div className="mt-5 text-2xl">{gapEl}</div>
        </div>
      )}
      {!done && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={check} data-testid="check">
            {t('cCheck')}
          </Button>
          <Button variant="ghost" icon="lightbulb" onClick={tip} data-testid="tip">
            {t('cTip')}
          </Button>
        </div>
      )}
      {done && fmt !== 'recall' && gap && (
        <p className="mt-3 text-sm text-muted">
          <TapText text={`${gap.before}${gap.answer}${gap.after}`} />
        </p>
      )}
    </div>
  );
}
