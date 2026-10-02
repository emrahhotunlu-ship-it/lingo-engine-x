import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { maskOf } from '../../domain/answer/mask';
import { useSharedTarget } from '../../engine/shared';
import { checkCloze, type ClozeCheck, type ClozeItem } from '../../domain/drills/cloze';
import { missedWords, scoreDictation, type DictationScore } from '../../domain/drills/dictation';
import { checkOrder, type OrderCheck, type OrderItem } from '../../domain/drills/order';
import { radarEvent } from '../../domain/grammar/radar';
import { examplesFor } from '../../domain/grammar/rules';
import { learnGrade } from '../../domain/learn/grade';
import type { Ctx, DrillAnswer, Help, RadarEvent, Verdict } from '../../domain/learn/types';
import { cardExamples } from '../../domain/srs/examples';
import type { Grade } from '../../domain/srs/types';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset } from '../../engine/KineticGap';
import { SentenceDiff } from '../../engine/SentenceDiff';
import { Tiles } from '../../engine/Tiles';
import { hasFinePointer, TilesKeyboard } from '../../engine/TilesKeyboard';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { speak, useSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { nextT } from '../progress/persist';
import { AlsoRight, CopyOnce, ExampleList, LearnStatus, NextButton, OverrideButton, ResultArea, TaskLine, VerdictLine } from '../learn/ui';
import { orderTopic, useDrill } from './session';

// Die drei Übungen mit Einzelaufgaben (phase2-plan §5.4–5.6) im gemeinsamen Rahmen (A7):
// Status oben, Aufgabe in einer Zeile, Eingabe, „Prüfen", danach Vergleich, Hinweis und
// Beispiele an fester Stelle – auch bei richtiger Antwort. Die Note bestimmt die App.

type Next = 'typed' | 'choice' | null;
type ItemProps<T> = { item: T; ctx: Ctx; day: string; onDone: (a: DrillAnswer, label: string) => Next };

const VERDICT_KEY: Record<Verdict, MessageKey> = { correct: 'trVerdictCorrect', near: 'trVerdictNear', wrong: 'trVerdictWrong' };

function useTiming() {
  const shownAt = useRef(0);
  const lookupAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = performance.now();
    lookupAt.current = lookupOpenMs();
  }, []);
  return {
    elapsed: () => Math.max(0, Math.round(performance.now() - shownAt.current - (lookupOpenMs() - lookupAt.current))),
    firstKey: (from?: number) => (firstKeyAt.current === null ? undefined : Math.max(0, Math.round(firstKeyAt.current - (from ?? shownAt.current)))),
    markKey: () => {
      if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
    },
  };
}

function Frame({ status, task, purpose, kind, children, actions, result }: { status: ReactNode; task: string; purpose: string; kind: string; children: ReactNode; actions?: ReactNode; result?: ReactNode }) {
  // Kap. 4.4: Die Heldenkarte von Heute gleitet in die erste Aufgabe (nur direkt nach dem Start).
  const { ref: sharedRef, shared } = useSharedTarget<HTMLElement>('lx-hero');
  return (
    <article ref={sharedRef} data-shared={shared ? '' : undefined} className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="drill-item" data-kind={kind}>
      <header className="flex flex-col gap-2">
        {status}
        <TaskLine task={task} purpose={purpose} />
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      {actions}
      {result}
    </article>
  );
}

// ------------------------------------------------------------------ Diktat

export function DictationItem({ item, ctx, day, onDone }: ItemProps<{ s: string; src: string; ref: string | null }>) {
  const { t, lang } = useT();
  const tts = useSpeech((s) => s.status === 'ready');
  const timing = useTiming();
  const [text, setText] = useState('');
  const plays = useRef(0);
  const [slow, setSlow] = useState(false);
  const [fb, setFb] = useState<{ score: DictationScore; grade: Grade; ms: number; given: string; override: boolean; replays: number } | null>(null);
  const audioEnd = useRef<number | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const play = (rate?: number) => {
    plays.current += 1;
    void speak(item.s, rate ? { rate } : {}).then((o) => {
      if (o === 'done' && audioEnd.current === null) audioEnd.current = performance.now();
    });
  };

  useEffect(() => {
    // Der Satz spielt einmal automatisch (§5.4).
    play();
    field.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten Zeigen
  }, []);

  const check = () => {
    if (fb || !text.trim()) return;
    const replays = Math.max(0, plays.current - 1);
    const help: Help = { level: slow ? 1 : 0, replays };
    const score = scoreDictation(text, item.s, { helpLevel: help.level });
    const ms = timing.elapsed();
    const grade = learnGrade('dictate', score.verdict, { submitMs: ms, firstKeyMs: timing.firstKey(audioEnd.current ?? undefined), replays }, help);
    setFb({ score, grade, ms, given: text, override: false, replays });
  };

  const next = () => {
    if (!fb) return;
    const verdict: Verdict = fb.override ? 'correct' : fb.score.verdict;
    const tNow = nextT();
    const radar: RadarEvent | undefined = fb.score.typo > 0 && item.src === 'card' ? radarEvent('spelling', 'v', tNow, { q: item.s, g: fb.given, a: item.s }) : undefined;
    const a: DrillAnswer = { kind: 'x', t: tNow, day, lang, ctx, type: 'dictate', q: item.s, given: fb.given, ans: item.s, verdict, grade: fb.override ? 3 : fb.grade, ms: fb.ms, ...(radar ? { radar } : {}), ...(fb.override ? { override: true } : {}) };
    onDone(a, item.s);
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : undefined) }, () => false);

  const missed = fb ? missedWords(fb.score.ops) : [];
  return (
    <Frame
      kind="dictate"
      status={<LearnStatus p={null} kind={t('drDictate')} kindId="dictate" />}
      task={t('drTaskDictate')}
      purpose={t('purposeDictate')}
      actions={
        !fb && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={check} data-testid="check">
              {t('trCheck')}
            </Button>
            {tts && (
              <Button variant="secondary" icon="speaker" onClick={() => play()} data-testid="drill-replay">
                {t('drReplay')}
              </Button>
            )}
            {tts && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSlow(true);
                  play(0.8);
                }}
                data-testid="drill-slow"
              >
                {t('drSlow')}
              </Button>
            )}
          </div>
        )
      }
      result={
        fb && (
          <ResultArea label={t('trResultLabel')}>
            <VerdictLine verdict={fb.override ? 'correct' : fb.score.verdict} text={fb.override ? t('lrOverridden') : t(VERDICT_KEY[fb.score.verdict])} />
            <SentenceDiff ops={fb.score.ops} given={fb.given} correct={item.s} onlyCorrect={fb.score.verdict === 'correct'} labels={{ yours: t('grYourAnswer'), correct: t('grCorrect'), empty: t('trEmpty'), missing: t('lrMissing') }} source={item.ref} />
            {missed.length > 0 && (
              <p className="text-sm text-muted" data-testid="missed" lang={lang}>
                {t('drMissed', { words: missed.join(', ') })}
              </p>
            )}
            {tts && (
              <div>
                <Button variant="ghost" icon="speaker" onClick={() => void speak(item.s)} data-testid="drill-listen-again">
                  {t('drListenAgain')}
                </Button>
              </div>
            )}
            {fb.score.verdict === 'wrong' && !fb.override && <OverrideButton onOverride={() => setFb({ ...fb, override: true })} />}
            <div className="flex justify-end pt-1">
              <NextButton onNext={next} auto={fb.score.verdict === 'correct' && !slow && fb.replays <= 2} />
            </div>
          </ResultArea>
        )
      }
    >
      <textarea
        ref={field}
        className="lx-field"
        data-sentence=""
        data-testid="dictate-input"
        data-state={fb ? (fb.override ? 'correct' : fb.score.verdict) : undefined}
        lang="en"
        rows={2}
        value={text}
        readOnly={!!fb}
        autoCapitalize="sentences"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={t('drDictateLabel')}
        placeholder={t('drDictatePlaceholder')}
        onChange={(e) => {
          timing.markKey();
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (fb) next();
            else check();
          }
        }}
      />
    </Frame>
  );
}

// ------------------------------------------------------------------ Lückenjagd

export function ClozeItemView({ item, ctx, day, onDone }: ItemProps<ClozeItem>) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const timing = useTiming();
  const card = useDrill((s) => s.cards.get(item.cardId));
  const allCols = useDrill((s) => s.allCols);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  const [fb, setFb] = useState<{ res: ClozeCheck; grade: Grade; ms: number; given: string; override: boolean; help: Help } | null>(null);
  const typed = useRef('');
  const mask = tip > 0 ? maskOf(item.gap, { firstLetter: tip >= 2 }) : null;
  const help: Help = { level: tip };

  const check = () => {
    if (fb) return;
    let given = typed.current;
    if (tip >= 2 && mask) {
      const first = mask[0];
      if (first?.kind === 'slot' && first.hint && hintOffset(mask, given) === 1) given = first.hint + given;
    }
    if (!given.trim()) return;
    const res = checkCloze(item, given, { allCols });
    const ms = timing.elapsed();
    const grade = learnGrade('cloze', res.verdict, { submitMs: ms, firstKeyMs: timing.firstKey() }, help);
    setFb({ res, grade, ms, given, override: false, help });
    if (window.matchMedia('(pointer: coarse)').matches) api.blur();
  };

  const next = () => {
    if (!fb) return;
    const tNow = nextT();
    const verdict: Verdict = fb.override ? 'correct' : fb.res.verdict;
    const radar = fb.res.kind === 'confusable' && !fb.override ? radarEvent('wordchoice', 'v', tNow, { q: item.sentence.sentence, g: fb.given, a: item.gap }) : undefined;
    const a: DrillAnswer = { kind: 'x', t: tNow, day, lang, ctx, type: 'cloze', q: item.sentence.sentence, given: fb.given, ans: item.gap, verdict, grade: fb.override ? 3 : fb.grade, ms: fb.ms, ...(radar ? { radar } : {}), ...(fb.override ? { override: true } : {}) };
    const kind = onDone(a, item.phrase);
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : check()) }, api.isInput);

  const s = item.sentence;
  const verdictKey: MessageKey = fb?.override ? 'lrOverridden' : fb?.res.kind === 'uk' ? 'trVerdictUk' : fb?.res.kind === 'form' ? 'trVerdictForm' : fb?.res.kind === 'typo' ? 'trVerdictTypo' : VERDICT_KEY[fb?.res.verdict ?? 'wrong'];
  const examples = card ? cardExamples(card, s.sentence).map((x) => x.en).slice(0, 2) : [];
  return (
    <Frame
      kind="cloze"
      status={<LearnStatus p={null} kind={t('drCloze')} kindId="cloze" />}
      task={t('drTaskCloze')}
      purpose={t('purposeColloc')}
      actions={
        !fb && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={check} data-testid="check">
              {t('trCheck')}
            </Button>
            {tip < 2 && (
              <Button
                variant="ghost"
                icon="lightbulb"
                onClick={() => {
                  setTip((v) => (v === 0 ? 1 : 2));
                  api.focusNow();
                }}
                data-testid="hint"
                data-level={tip}
              >
                {tip === 0 ? t('trTip') : t('trTipLetter')}
              </Button>
            )}
          </div>
        )
      }
      result={
        fb && (
          <ResultArea label={t('trResultLabel')}>
            <VerdictLine verdict={fb.override ? 'correct' : fb.res.verdict} text={t(verdictKey)} />
            {fb.res.us && (
              <p className="text-sm text-muted" data-testid="us-hint">
                {t('trUsHint', { us: fb.res.us })}
              </p>
            )}
            {fb.res.verdict !== 'correct' && (
              <SentenceDiff ops={[]} given={fb.given} correct={item.gap} labels={{ yours: t('grYourAnswer'), correct: t('grCorrect'), empty: t('trEmpty'), missing: t('lrMissing') }} />
            )}
            <p className="text-sm" data-testid="meaning">
              <span className="font-semibold" lang="en">
                {item.phrase}
              </span>
              {lang === 'de' && item.de && (
                <>
                  <span className="text-muted"> – </span>
                  <span lang="de">{item.de}</span>
                </>
              )}
            </p>
            {fb.res.belongsTo.length > 0 && (
              <p className="text-sm" data-testid="belongs-to">
                {t('clBelongs', { given: fb.given.trim(), list: fb.res.belongsTo.join(', ') })}
              </p>
            )}
            <ExampleList items={examples} source={`vocab/${item.cardId}`} />
            {fb.res.verdict === 'wrong' && !fb.override && <OverrideButton onOverride={() => setFb({ ...fb, override: true })} />}
            {fb.res.verdict === 'wrong' && <CopyOnce solution={item.gap} />}
            <div className="flex justify-end pt-1">
              <NextButton onNext={next} auto={fb.res.verdict === 'correct' && fb.help.level === 0 && !fb.override} />
            </div>
          </ResultArea>
        )
      }
    >
      <EnglishText
        as="p"
        className="lx-sentence"
        testId="sentence"
        text={s.sentence}
        area="trainer"
        source={`vocab/${item.cardId}`}
        slot={{
          start: s.start,
          end: s.end,
          node: (
            <KineticGap
              label={t('trGapLabel', { sentence: `${s.sentence.slice(0, s.start)}…${s.sentence.slice(s.end)}` })}
              maxLength={Math.max(30, item.gap.length + 10)}
              state={!fb ? 'input' : fb.override ? 'correct' : fb.res.verdict}
              mask={mask}
              shown={fb ? fb.given : null}
              onChange={(v, info) => {
                typed.current = v;
                if (info.firstKey) timing.markKey();
              }}
              onEnter={() => (fb ? next() : check())}
            />
          ),
        }}
      />
      {!fb && item.de && lang === 'de' && (
        <p className="text-sm text-muted" data-testid="cue" lang="de">
          {t('clCue', { de: item.de })}
        </p>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ Satzbau

export function OrderItemView({ item, ctx, day, onDone }: ItemProps<OrderItem>) {
  const { t, lang } = useT();
  const timing = useTiming();
  const [placed, setPlaced] = useState<number[]>([]);
  const [fb, setFb] = useState<{ res: OrderCheck; grade: Grade; ms: number } | null>(null);
  const topic = orderTopic(item);
  const byId = useMemo(() => new Map(item.tiles.map((x) => [x.id, x])), [item]);
  // Hilfen (Emrah 02.10.2026, nach Beratung Englischlehrer + Lernwissenschaft): Tipp 1 nennt einen guten Anfang
  // (Hilfe 1), Tipp 2 legt die ersten zwei Bausteine nach vorn (Hilfe 2, zweite Information). Die deutsche
  // Bedeutung steht immer da und ist keine Hilfe.
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  const first = item.solution[0] ?? '';
  const second = item.solution[1] ?? '';
  const leadIds = [first, second].map((x) => item.tiles.find((tile) => tile.text === x)?.id).filter((id): id is number => id !== undefined);
  const showTip = () => {
    if (tip === 0) setTip(1);
    else {
      setTip(2);
      setPlaced([...leadIds, ...placed.filter((id) => !leadIds.includes(id))]);
    }
  };

  const check = () => {
    if (fb || !placed.length) return;
    const res = checkOrder(item, placed);
    const ms = timing.elapsed();
    const grade = learnGrade('order', res.verdict, { submitMs: ms, units: item.tiles.length }, { level: tip });
    setFb({ res, grade, ms });
  };

  const next = () => {
    if (!fb) return;
    const given = placed.map((id) => byId.get(id)?.text ?? '').join(' ');
    const a: DrillAnswer = { kind: 'x', t: nextT(), day, lang, ctx, type: 'order', q: item.sentence, given, ans: item.sentence, verdict: fb.res.verdict, grade: fb.grade, ms: fb.ms };
    onDone(a, item.sentence);
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : check()) }, () => false);

  const marks: Record<number, 'ok' | 'off' | 'near'> = {};
  if (fb) {
    placed.forEach((id, i) => {
      const tile = byId.get(id);
      marks[id] = tile?.distractor || (fb.res.misplaced.includes(i) && fb.res.verdict === 'wrong') ? 'off' : fb.res.misplaced.includes(i) ? 'near' : 'ok';
    });
  }
  const verdictKey: MessageKey = !fb ? 'trVerdictWrong' : fb.res.verdict === 'correct' ? (tip > 0 ? 'drVerdictHelp' : 'trVerdictCorrect') : fb.res.verdict === 'near' ? 'drVerdictNear' : 'trVerdictWrong';
  return (
    <Frame
      kind="order"
      status={<LearnStatus p={null} kind={t('drOrder')} kindId="order" />}
      task={t('drTaskOrder')}
      purpose={t('purposeOrder')}
      actions={
        !fb && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={check} disabled={!placed.length} data-testid="check">
              {t('trCheck')}
            </Button>
            {placed.length > 0 && (
              <Button variant="ghost" icon="undo" onClick={() => setPlaced([])} data-testid="tiles-reset">
                {t('drReset')}
              </Button>
            )}
            {tip < 2 && (
              <Button variant="ghost" icon="lightbulb" onClick={showTip} data-testid="hint" data-level={tip}>
                {tip === 0 ? t('trTip') : t('drTipFirst')}
              </Button>
            )}
          </div>
        )
      }
      result={
        fb && (
          <ResultArea label={t('trResultLabel')}>
            <VerdictLine verdict={fb.res.verdict} text={t(verdictKey)} />
            <p className="text-[0.95rem] leading-relaxed">
              <span className="text-muted">{t('grCorrect')}: </span>
              <EnglishText as="span" className="font-semibold" text={item.sentence} area="trainer" source={topic ? `grammar/${topic}` : null} testId="diff-correct" />
            </p>
            <AlsoRight answers={item.alts} notes={[]} />
            <div className="flex flex-col gap-1" data-testid="order-why">
              <p className="lx-eyebrow">{t('drWhy')}</p>
              <p className="text-sm" lang={lang}>
                {item.why[lang]}
              </p>
              {item.bad && (
                <p className="text-sm text-muted" lang={lang} data-testid="order-bad">
                  {t('drTrapBad', { bad: item.bad })}
                </p>
              )}
            </div>
            {topic && <ExampleList items={examplesFor(topic, { exclude: item.sentence, max: 2 })} source={`grammar/${topic}`} />}
            <div className="flex justify-end pt-1">
              <NextButton onNext={next} auto={false} />
            </div>
          </ResultArea>
        )
      }
    >
      <div className="flex flex-col gap-1" data-testid="order-meaning">
        <p className="lx-eyebrow">{t('drOrderMeaning')}</p>
        <p className="text-xl font-semibold leading-snug tracking-tight" lang="de" data-testid="order-de">
          {item.de}
        </p>
      </div>
      {!fb && tip >= 1 && (
        <p className="text-sm text-muted" role="status" data-testid="tip-info">
          {tip >= 2 ? t('drTipPlaced', { first, second }) : t('drTipStart', { first })}
        </p>
      )}
      <Tiles tiles={item.tiles} placed={placed} onChange={(p) => {
        timing.markKey();
        setPlaced(p);
      }} locked={!!fb} marks={fb ? marks : undefined} labels={{ line: t('drTileLine'), pool: t('drTilePool') }} />
      {!fb && hasFinePointer() && (
        <TilesKeyboard
          tiles={item.tiles}
          placed={placed}
          onChange={(p) => {
            timing.markKey();
            setPlaced(p);
          }}
          onSubmit={check}
          locked={!!fb}
          mode="words"
          label={t('trTilesTypeLabel')}
          hint={t('trTilesTypeHint')}
          unknown={(tok) => t('trTilesTypeMiss', { word: tok })}
        />
      )}
      {item.end && (
        <p className="text-sm text-subtle" aria-hidden="true">
          {t('drEnd', { end: item.end })}
        </p>
      )}
    </Frame>
  );
}
