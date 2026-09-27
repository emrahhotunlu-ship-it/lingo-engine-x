import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { coreWord } from '../../domain/course/baseLesson';
import { lessonWordCard, questionOptions } from '../../domain/course/lessonDoc';
import { localProductionCheck, usesWord, type ProductionCheck } from '../../domain/course/production';
import { normCat, radarEvent } from '../../domain/grammar/radar';
import { ruleOf } from '../../domain/grammar/rules';
import { wholeSentence } from '../../domain/grammar/tasks';
import { learnGrade } from '../../domain/learn/grade';
import type { DrillAnswer, GrammarAnswer, GrammarTask, LessonContent, LessonMeta, RadarEvent } from '../../domain/learn/types';
import { mergedVocab } from '../../domain/overview';
import { applyUpdate, cardPatch } from '../../domain/srs/applyReview';
import { buildTrainCards, meaningOf, toTrainCard } from '../../domain/srs/cards';
import { buildExercise } from '../../domain/srs/exercise';
import { posKey } from '../../domain/srs/explain';
import { supports } from '../../domain/srs/modes';
import type { AnswerEvent, Exercise, ExerciseId, TrainCard } from '../../domain/srs/types';
import { topicById } from '../../domain/content';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { logError } from '../../platform/diagnostics';
import { speak, stopSpeech, useSpeech } from '../../platform/speech';
import { KEY_PREFIX, local } from '../../platform/storage';
import { lessonProduction, toWritingDoc, type LessonProductionOut } from '../../prompts/lessonProduction';
import { Button } from '../../ui/Button';
import { normalize } from '../../domain/answer/normalize';
import { learnRecorder, nextT, recordAnswer } from '../progress/persist';
import { saveCard } from '../vocab/persist';
import { ExerciseView } from '../vocab/ExerciseView';
import type { Answer, FirstKind } from '../vocab/session';
import { GrammarItem } from '../grammar/GrammarItem';
import { VerdictLine } from '../learn/ui';
import { perfNow } from '../learn/time';
import { countAnswer, markLessonAi, touchLesson, useLessonRun } from './lessonRun';

// Die vier Schritte einer Lektion (phase2-plan §5.1): Wörter (Einführung + Bedeutung wählen,
// dann Lücke mit Hilfe; falsche am Ende noch einmal), Dialog (hören, lesen, Fragen), Grammatik
// (Regel in einer Zeile + Gegensatzpaar, 4 Aufgaben) und Anwenden (2–3 eigene Sätze).

type Doc = Record<string, unknown>;
type StepProps = { meta: LessonMeta; content: LessonContent; onComplete: () => void };

export function StepDone({ text, onNext, label }: { text: string; onNext: () => void; label: string }) {
  return (
    <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
      <p className="text-sm text-accent-text" role="status">
        {text}
      </p>
      <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext} data-testid="lesson-next">
        {label}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ Wörter

type WItem = { key: string; phase: 'intro' | 'quiz'; ex?: ExerciseId; again?: boolean };

function inputOf(ex: ExerciseId | undefined): FirstKind {
  return ex === 'cloze_hint' || ex === 'cloze' || ex === 'type' ? 'typed' : 'choice';
}

export function WordsStep({ meta, content, onComplete }: StepProps) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const day = useLessonRun((s) => s.day);
  const ctx = useLessonRun((s) => s.ctx);
  const now = useClock((s) => s.now);
  const data = useMemo(() => {
    const live = useLive.getState();
    const vocab = live.collections.vocab ?? new Map<string, Doc>();
    const merged = mergedVocab(vocab, invalidIdsOf(live.invalid, 'vocab'));
    const pool = buildTrainCards(vocab, now, invalidIdsOf(live.invalid, 'vocab')).filter((c) => !c.hidden);
    const cards = new Map<string, TrainCard>();
    const words = content.words.map((w) => {
      const made = lessonWordCard(w, { lid: meta.id, lines: content.dialogue.lines, today: day, nowMs: now, title: meta.en });
      if (!made) return { w, key: w.en, card: null as TrainCard | null };
      const existing = merged.get(made.id);
      const card = existing?.hidden === true ? null : toTrainCard(made.id, existing ?? made.doc, vocab.has(made.id), now);
      if (card) cards.set(card.key, card);
      return { w, key: card?.key ?? w.en, card };
    });
    const queue: WItem[] = [];
    for (const x of words) {
      queue.push({ key: x.key, phase: 'intro' });
      if (x.card && supports(x.card, 'mc_en', lang, pool.length - 1)) queue.push({ key: x.key, phase: 'quiz', ex: 'mc_en' });
    }
    for (const x of words) if (x.card && supports(x.card, 'cloze_hint', lang, pool.length - 1)) queue.push({ key: x.key, phase: 'quiz', ex: 'cloze_hint' });
    return { words, cards, pool, queue, known: new Set(pool.map((c) => normalize(c.lemma))) };
    // Einmal je Lektionslauf eingefroren (Kap. 15: nichts neu würfeln).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, content]);
  type WState = { queue: WItem[]; pos: number; cards: Map<string, TrainCard>; wrong: string[]; again: boolean };
  const [ws, setWs] = useState<WState>(() => ({ queue: [...data.queue], pos: 0, cards: new Map(data.cards), wrong: [], again: false }));
  const done = ws.pos >= ws.queue.length;
  const item = ws.queue[ws.pos];

  /** Nächster Stand (rein) und die Eingabeart der nächsten Aufgabe – synchron für den Fokus am iPhone. */
  const advance = (s: WState): FirstKind => {
    const queue = [...s.queue];
    let again = s.again;
    const pos = s.pos + 1;
    if (pos >= queue.length && !again && s.wrong.length) {
      // Falsche Wörter kommen am Ende noch einmal (§5.1).
      again = true;
      for (const k of s.wrong) queue.push({ key: k, phase: 'quiz', ex: 'cloze_hint', again: true });
    }
    setWs({ ...s, queue, pos, again });
    const next = queue[pos];
    if (!next) return null;
    return next.phase === 'intro' ? 'intro' : inputOf(next.ex);
  };

  const commit = (ans: Answer): FirstKind => {
    touchLesson();
    const it = ws.queue[ws.pos];
    const card = it ? ws.cards.get(it.key) : undefined;
    if (!it || !card || !it.ex) return advance(ws);
    const a: AnswerEvent = {
      t: nextT(),
      day,
      kind: 'v',
      id: card.id,
      ex: it.ex,
      grade: ans.grade,
      given: ans.given,
      ans: exerciseFor(card, it)?.accepted[0] ?? card.word,
      ms: ans.ms,
      lang,
      ctx: ctx === 'duty' ? 'duty' : 'xtra',
      lesson: meta.id,
      ...(ans.override ? { override: true } : {}),
    };
    void saveCard(a, card.inDb ? null : { ...card.doc });
    recordAnswer(a, false);
    countAnswer(ans.ok);
    const nextDoc = applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
    const updated = toTrainCard(card.id, nextDoc, true, a.t) ?? card;
    const cards = new Map(ws.cards);
    cards.set(card.key, updated);
    const wrong = !ans.ok && !ws.wrong.includes(card.key) ? [...ws.wrong, card.key] : ws.wrong;
    return advance({ ...ws, cards, wrong });
  };

  const exerciseFor = (card: TrainCard, it: WItem): Exercise | null => {
    if (!it.ex) return null;
    return buildExercise(card, it.ex, lang, data.pool.length ? data.pool : [card], `${meta.id}|${it.key}|${it.ex}|${it.again ? 1 : 0}`);
  };

  if (done)
    return (
      <article className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="lesson-step" data-step="words">
        <h2 className="text-lg font-semibold tracking-tight">{t('lsStepWords')}</h2>
        <ul className="flex flex-wrap gap-2" lang="en">
          {content.words.map((w) => (
            <li key={w.en} className="rounded-full border border-line px-3 py-1 text-sm">
              {w.en}
            </li>
          ))}
        </ul>
        <StepDone text={t('lsWordsDone')} onNext={onComplete} label={t('lsToDialog')} />
      </article>
    );
  if (!item) return null;
  const card = ws.cards.get(item.key);
  const w = data.words.find((x) => x.key === item.key)?.w;
  if (item.phase === 'intro' || !card) {
    const go = () => {
      const kind = advance(ws);
      if (kind === 'typed') api.focusNow();
      else api.blur();
    };
    return <WordIntro key={`${ws.pos}`} w={w} card={card ?? null} onNext={go} lessonTitle={meta.en} />;
  }
  const ex = exerciseFor(card, item);
  if (!ex) return null;
  return (
    <div data-testid="lesson-step" data-step="words">
      <ExerciseView key={`${ws.pos}`} exercise={ex} knownWords={data.known} again={!!item.again} onDone={() => undefined} onCommit={commit} />
    </div>
  );
}

function WordIntro({ w, card, onNext, lessonTitle }: { w: LessonContent['words'][number] | undefined; card: TrainCard | null; onNext: () => void; lessonTitle: string }) {
  const { t, lang } = useT();
  if (!w) return null;
  const meaning = card ? meaningOf(card, lang) : lang === 'de' ? w.de : w.def || null;
  const pk = posKey(card?.pos ?? w.pos);
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="intro">
      <header className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('lsNewWord')}</p>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task-line">
          {t('introTask')}
        </h2>
      </header>
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="intro-word">
          {w.en}
        </p>
        {(meaning || pk) && (
          <p className="text-base text-muted">
            {meaning && <span lang={lang}>{meaning}</span>}
            {meaning && pk && ' · '}
            {pk && t(pk as MessageKey)}
          </p>
        )}
        {card?.context && (
          <EnglishText as="p" className="lx-sentence mt-2" testId="origin-sentence" text={card.context.sentence} area="lesson" source={card.path} title={lessonTitle} highlight={[card.context.start, card.context.end]} />
        )}
      </div>
      <div>
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext} data-testid="intro-continue">
          {t('introContinue')}
        </Button>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ Dialog

export function DialogStep({ meta, content, onComplete }: StepProps) {
  const { t, lang } = useT();
  const day = useLessonRun((s) => s.day);
  const ctx = useLessonRun((s) => s.ctx);
  const tts = useSpeech((s) => s.status === 'ready');
  const base = content.source === 'base';
  const [mode, setMode] = useState<'listen' | 'read'>(tts && !base ? 'listen' : 'read');
  const [trans, setTrans] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  const lines = content.dialogue.lines;
  const qs = content.questions;
  const visibleQs = mode === 'listen' ? qs.slice(0, 1) : qs;
  // Optionen fest gemischt (Lektion + Frage als Startwert): die Lösung steht nicht immer vorn,
  // bleibt aber nach dem Neuzeichnen an derselben Stelle.
  const optionsOf = useMemo(() => qs.map((q) => questionOptions(meta.id, q)), [qs, meta.id]);
  const allAnswered = qs.every((_, i) => answers[i] !== undefined);
  const hasDe = lang === 'de' && lines.some((l) => l.de);

  const answer = (i: number, chosen: string) => {
    if (answers[i] !== undefined) return;
    const q = qs[i];
    if (!q) return;
    const ok = chosen === q.answer;
    const ms = Math.round(perfNow() - shownAt.current);
    const a: DrillAnswer = { kind: 'x', t: nextT(), day, lang, ctx, type: 'lesson-q', q: q.q, given: chosen, ans: q.answer, verdict: ok ? 'correct' : 'wrong', grade: learnGrade('mc', ok ? 'correct' : 'wrong', { submitMs: ms }, { level: 0 }), ms, lesson: meta.id };
    learnRecorder.drill(a);
    countAnswer(ok);
    setAnswers((x) => ({ ...x, [i]: chosen }));
    shownAt.current = perfNow();
  };

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="lesson-step" data-step="dialog">
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{base ? t('lsExamples') : t('lsStepDialog')}</p>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task-line">
          {base ? t('lsTaskExamples') : mode === 'listen' ? t('lsTaskListen') : t('lsTaskRead')}
        </h2>
        {!base && (
          <p className="text-sm text-muted" lang="en">
            {content.dialogue.title}
          </p>
        )}
      </header>
      {mode === 'listen' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="speaker" onClick={() => void speak(lines.map((l) => l.en).join(' '))} data-testid="lesson-listen">
            {t('lsListen')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              stopSpeech();
              setMode('read');
            }}
            data-testid="lesson-show-text"
          >
            {t('lsShowText')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {lines.map((l, i) => (
              <li key={i} className="flex flex-col gap-0.5" data-testid="dialog-line">
                {l.sp && <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{l.sp}</span>}
                <EnglishText as="p" className="text-base leading-relaxed" text={l.en} area="lesson" source={`lesson/${meta.id}`} title={meta.en} />
                {trans && l.de && (
                  <p className="text-sm text-muted" lang="de">
                    {l.de}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {tts && (
              <Button variant="ghost" icon="speaker" onClick={() => void speak(lines.map((l) => l.en).join(' '))} data-testid="lesson-listen">
                {t('lsListen')}
              </Button>
            )}
            {hasDe && (
              <Button variant="ghost" onClick={() => setTrans((v) => !v)} aria-pressed={trans} data-testid="lesson-translate">
                {trans ? t('lsHideTranslation') : t('lsTranslation')}
              </Button>
            )}
          </div>
        </>
      )}
      {visibleQs.map((q, i) => {
        const chosen = answers[i];
        const options = optionsOf[i] ?? q.options;
        return (
          <section key={i} className="flex flex-col gap-2 border-t border-line pt-4" data-testid="lesson-question" aria-label={t('lsQuestion')}>
            <p className="text-base font-medium" lang={lang}>
              {q.q}
            </p>
            <Choices items={options.map((o, k) => ({ id: String(k), label: o, lang, correct: o === q.answer }))} chosen={chosen === undefined ? null : String(options.indexOf(chosen))} onChoose={(id) => answer(i, options[Number(id)] ?? '')} label={t('trChoicesLabel')} />
            {chosen !== undefined && <VerdictLine verdict={chosen === q.answer ? 'correct' : 'wrong'} text={chosen === q.answer ? t('trVerdictCorrect') : t('lsQuestionWrong', { answer: q.answer })} />}
          </section>
        );
      })}
      {mode === 'read' && allAnswered && <StepDone text={t('lsDialogDone')} onNext={onComplete} label={t('lsToGrammar')} />}
    </article>
  );
}

// ------------------------------------------------------------------ Grammatik

export function GrammarStep({ meta, content, onComplete }: StepProps) {
  const { t, lang } = useT();
  const day = useLessonRun((s) => s.day);
  const ctx = useLessonRun((s) => s.ctx);
  const tasks: GrammarTask[] = useMemo(() => content.tasks.slice(0, 4).map((x) => ({ ...x, src: 'lesson' as const, ref: `lesson/${meta.id}` })), [content, meta.id]);
  const [idx, setIdx] = useState(0);
  const rule = ruleOf(meta.grammar, lang);
  const trap = rule?.traps[0];
  const tp = topicById(meta.grammar);
  const onDone = (a: GrammarAnswer): 'typed' | 'choice' | null => {
    void learnRecorder.grammar(a);
    countAnswer(!a.dontKnow && a.verdict !== 'wrong');
    const next = idx + 1;
    setIdx(next);
    const nt = tasks[next];
    return !nt ? null : nt.type === 'mc' ? 'choice' : wholeSentence(nt) ? null : 'typed';
  };
  const task = tasks[idx];
  return (
    <div className="flex flex-col gap-4" data-testid="lesson-step" data-step="grammar">
      <section className="lx-glass flex flex-col gap-2 rounded-[var(--radius-card)] p-5 sm:p-6" data-testid="lesson-rule">
        <p className="lx-eyebrow">
          {t('grRule')} · {lang === 'en' ? (tp?.name_en ?? tp?.name) : tp?.name}
        </p>
        {rule && (
          <p className="text-base font-medium" lang={lang}>
            {rule.core}
          </p>
        )}
        {trap && (
          <p className="flex flex-col text-sm">
            <span className="lx-diff-off" lang="en">
              {trap.bad}
            </span>
            <EnglishText as="span" className="font-medium" text={trap.good} area="lesson" source={`grammar/${meta.grammar}`} />
          </p>
        )}
      </section>
      {task ? (
        <GrammarItem key={idx} task={task} ctx={ctx} day={day} onDone={onDone} area="lesson" />
      ) : (
        <article className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5 sm:p-7">
          <StepDone text={t('lsGrammarDone')} onNext={onComplete} label={t('lsToOutput')} />
        </article>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Anwenden

type AiRes = LessonProductionOut;

export function OutputStep({ meta, content, onComplete }: StepProps) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(lessonProduction);
  const draftKey = `${KEY_PREFIX}lesson:${meta.id}:draft`;
  const [text, setText] = useState(() => local.get(draftKey) ?? '');
  const [localRes, setLocalRes] = useState<ProductionCheck | null>(null);
  const [aiRes, setAiRes] = useState<AiRes | null>(null);
  const output = content.output ?? { de: meta.cando_de, en: meta.cando_en, mustUse: meta.words.slice(0, 3).map(([en]) => coreWord(en)) };
  const mustUse = output.mustUse.length ? output.mustUse : meta.words.slice(0, 3).map(([en]) => coreWord(en));
  const model = useMemo(() => {
    const hits = content.dialogue.lines.map((l) => l.en).filter((l) => mustUse.some((w) => usesWord(l, w)));
    return (hits.length ? hits : content.dialogue.lines.map((l) => l.en)).slice(0, 3).join(' ');
  }, [content, mustUse]);
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  const ok = !!aiRes || !!localRes?.ok;

  const selfCheck = () => {
    touchLesson();
    setLocalRes(localProductionCheck(text, mustUse, model));
  };

  const aiCheck = async () => {
    touchLesson();
    const tp = topicById(meta.grammar);
    const out = await ask.run({ taskEn: output.en, mustUse, structure: tp?.name_en ?? tp?.name ?? meta.grammar, text, candoEn: meta.cando_en, uiLang: lang });
    if (!out) return;
    setAiRes(out);
    markLessonAi();
    const tNow = Date.now();
    const writer = getWriter();
    if (writer) {
      const w = toWritingDoc({ lid: meta.id, text, t: tNow, out });
      try {
        await writer.createIfMissing(w.path, w.doc);
      } catch (err) {
        logError('course:writing', err, w.path);
      }
    }
    const radar: RadarEvent[] = out.errors.map((e, i) => radarEvent(normCat(e.cat), 'w', tNow + i, { q: e.wrong, g: e.wrong, a: e.right }));
    if (radar.length) learnRecorder.radar(radar);
  };

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="lesson-step" data-step="output">
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('lsStepOutput')}</p>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task-line">
          {t('lsTaskOutput')}
        </h2>
        <p className="text-base" lang={lang} data-testid="output-situation">
          {lang === 'de' ? output.de : output.en}
        </p>
      </header>
      <ul className="flex flex-wrap gap-2" aria-label={t('lsMustUse', { list: mustUse.join(', ') })}>
        {mustUse.map((w) => {
          const used = usesWord(text, w);
          return (
            <li key={w} className="lx-chip" lang="en" data-testid="must-use" data-used={used ? '' : undefined}>
              {used ? '✓ ' : ''}
              {w}
            </li>
          );
        })}
      </ul>
      <textarea
        className="lx-field"
        data-testid="output-input"
        lang="en"
        rows={4}
        value={text}
        readOnly={ok}
        autoCapitalize="sentences"
        autoComplete="off"
        spellCheck={false}
        aria-label={t('lsOutputLabel')}
        placeholder={t('lsOutputPlaceholder')}
        onChange={(e) => {
          setText(e.target.value);
          local.set(draftKey, e.target.value);
          if (localRes) setLocalRes(null);
        }}
      />
      {!ok && (
        <div className="flex flex-wrap gap-2">
          {ai && (
            <Button variant="primary" icon="sparkle" onClick={() => (busy ? ask.stop() : void aiCheck())} disabled={!text.trim()} data-testid="output-check" data-ai="">
              {busy ? t('aiStop') : t('lsCheckAi')}
            </Button>
          )}
          <Button variant={ai ? 'secondary' : 'primary'} onClick={selfCheck} disabled={!text.trim() || busy} data-testid="output-self">
            {t('lsCheckSelf')}
          </Button>
        </div>
      )}
      {busy && (
        <p className="text-sm text-muted" role="status" data-testid="output-busy">
          {ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}
        </p>
      )}
      {ask.error && (
        <p className="text-sm text-danger-text" role="alert">
          {t(ask.error)}
        </p>
      )}
      {localRes && (
        <div className="flex flex-col gap-2 border-t border-line pt-4" data-testid="output-local">
          <VerdictLine verdict={localRes.ok ? 'correct' : 'near'} text={localRes.ok ? t('lsLocalOk') : t('lsLocalMore')} />
          {localRes.tooShort && <p className="text-sm">{t('lsTooShort', { n: localRes.words })}</p>}
          {localRes.tooFewMustUse && <p className="text-sm">{t('lsUseMore', { list: localRes.missing.join(', ') })}</p>}
          {localRes.tooSimilar && <p className="text-sm">{t('lsTooSimilar')}</p>}
          {localRes.ok && (
            <div className="flex flex-col gap-1" data-testid="model-text">
              <p className="lx-eyebrow">{t('lsModel')}</p>
              <EnglishText as="p" className="text-[0.95rem] leading-relaxed" text={model} area="lesson" source={`lesson/${meta.id}`} />
              <p className="text-sm text-muted">{t('lsCandoSelf')}</p>
            </div>
          )}
        </div>
      )}
      {aiRes && (
        <div className="flex flex-col gap-3 border-t border-line pt-4" data-testid="output-ai">
          <VerdictLine verdict={aiRes.cando === 'met' ? 'correct' : aiRes.cando === 'partly' ? 'near' : 'wrong'} text={t(`lsCando_${aiRes.cando}` as MessageKey)} />
          <p className="text-sm" lang={lang}>
            {aiRes.candoWhy}
          </p>
          {aiRes.errors.length > 0 && (
            <ul className="flex flex-col gap-2" data-testid="output-errors">
              {aiRes.errors.map((e, i) => (
                <li key={i} className="flex flex-col text-sm">
                  <span>
                    <span className="lx-diff-off" lang="en">
                      {e.wrong}
                    </span>
                    <span className="text-muted"> → </span>
                    <span className="font-semibold" lang="en">
                      {e.right}
                    </span>
                  </span>
                  <span className="text-muted" lang={lang}>
                    {e.why}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1" data-testid="model-text">
            <p className="lx-eyebrow">{t('lsModel')}</p>
            <EnglishText as="p" className="text-[0.95rem] leading-relaxed" text={aiRes.model} area="lesson" source={`lesson/${meta.id}`} />
          </div>
        </div>
      )}
      {ok && (
        <StepDone
          text={t('lsOutputDone')}
          onNext={() => {
            local.remove(draftKey);
            onComplete();
          }}
          label={t('lsFinish')}
        />
      )}
      {!ok && <p className="text-xs text-subtle">{t('lsNoAiNeeded')}</p>}
    </article>
  );
}
