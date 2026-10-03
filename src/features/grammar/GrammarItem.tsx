import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useSharedTarget } from '../../engine/shared';
import { useLive } from '../../data/live';
import { solvedSentence } from '../../domain/course/baseLesson';
import { topicP } from '../../domain/grammar/bkt';
import { altFamily, checkGrammar, closeVariant } from '../../domain/grammar/check';
import { alsoRight, altNote, examplesFor, formHint, ruleOf } from '../../domain/grammar/rules';
import { grammarRetryHint, type GrammarRetryHint } from '../../domain/grammar/retryHint';
import { scaffolded, splitTransform, wholeSentence } from '../../domain/grammar/tasks';
import { learnGrade } from '../../domain/learn/grade';
import type { Ctx, GrammarAnswer, GrammarCheck, GrammarTask, Help, Verdict } from '../../domain/learn/types';
import { maskOf } from '../../domain/answer/mask';
import { hash32 } from '../../domain/random';
import type { Grade } from '../../domain/srs/types';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset, type GapState } from '../../engine/KineticGap';
import { SentenceDiff } from '../../engine/SentenceDiff';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup, type WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { topicById } from '../../domain/content';
import { useCompanionSee } from '../companion/seeing';
import { nextT } from '../progress/persist';
import { RetryHintLine } from '../learn/RetryHint';
import { AlsoRight, CopyOnce, ExampleList, FormHint, LearnStatus, NextButton, OverrideButton, ResultArea, TaskLine, VerdictLine } from '../learn/ui';

// Eine Grammatikaufgabe (phase2-plan §5.0/§5.2, CLAUDE.md A7): Status oben, Aufgabe in einer
// Zeile, Eingabe IN der Lücke bzw. im Satz selbst, „Prüfen", danach an fester Stelle:
// Vergleich, Form-Hinweis, Beispiele, „Auch richtig" – auch bei richtiger Antwort. Keine
// Bewertungsknöpfe: die Note folgt aus Richtigkeit, Zeit und Hilfe. Freie Antworten, die lokal
// abgelehnt werden, beurteilt auf denselben Druck auf „Prüfen" einmal Claude (D13).

type Next = 'typed' | 'choice' | null | void;

export type GrammarItemProps = {
  task: GrammarTask;
  ctx: Ctx;
  day: string;
  onDone: (a: GrammarAnswer) => Next;
  area?: WordTapArea;
  /** Zusatz in der Statuszeile (z. B. „Deine Fehler"). */
  badge?: string | null;
  /** Wochen-Check (M10): ohne Platzhalter und ohne Tipp – der Check misst, statt zu helfen. */
  noHelp?: boolean;
};

type Fb = {
  verdict: Verdict;
  check: GrammarCheck | null;
  given: string;
  dontKnow: boolean;
  grade: Grade;
  ms: number;
  help: Help;
  judged: GrammarAnswer['judged'];
  why: string | null;
  unsure: boolean;
  override: boolean;
};

const GAP = /_{3,}/;

export function GrammarItem({ task, ctx, day, onDone, area = 'trainer', badge = null, noHelp = false }: GrammarItemProps) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const doc = useLive((s) => s.collections.grammar?.get(task.topic));
  const [pStart] = useState(() => topicP(task.topic, doc, now));
  const p = topicP(task.topic, doc, now);
  // Ganzsatz-Eingabe: `correct` und Umformungen ohne Lücke `___` (Lektionen der alten App).
  const whole = wholeSentence(task);
  const scaff = task.type === 'gap' && !whole && scaffolded(pStart) && !noHelp;
  const [fb, setFb] = useState<Fb | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  /** „Erst ein Hinweis, dann die Lösung": Hinweis nach falschem erstem Versuch (zweiter Versuch). */
  const [retry, setRetry] = useState<GrammarRetryHint | null>(null);
  const firstWrong = useRef<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Seit 27.09. ohne Claude-Nachprüfung: nie im Wartezustand.
  const judging = false;
  const [chosen, setChosen] = useState<string | null>(null);
  const [text, setText] = useState(task.type === 'correct' ? task.prompt : '');
  const typed = useRef('');
  const shownAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const lookupAt = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  // Kap. 4.4: Die Heldenkarte von Heute gleitet in die erste Aufgabe (nur direkt nach dem Start).
  const { ref: sharedRef, shared } = useSharedTarget<HTMLElement>('lx-hero');

  useEffect(() => {
    shownAt.current = performance.now();
    lookupAt.current = lookupOpenMs();
    const a = document.activeElement;
    if (!a || a === document.body) root.current?.focus({ preventScroll: true });
  }, []);

  const solution = task.answer;
  const briefRule = useMemo(() => ruleOf(task.topic, lang)?.core ?? '', [task.topic, lang]);
  const typedKind = !whole && (task.type === 'gap' || task.type === 'transform');
  const maskShown = typedKind && (scaff || tip > 0);
  const mask = maskShown ? maskOf(solution, { firstLetter: tip >= 2 }) : null;
  // Zweiter Versuch nach dem Hinweis zählt wie „Tipp" Stufe 2: richtig höchstens „Schwer".
  const help: Help = { level: tip >= 2 || retry ? 2 : tip >= 1 ? 1 : 0 };

  // Was der Begleiter sieht (Phase 5 D4): vor dem Prüfen nur Thema und Aufgabe, nie die Lösung.
  const tp = topicById(task.topic);
  const topicLabel = tp ? (lang === 'en' ? (tp.name_en ?? tp.name) : tp.name) : task.topic;
  useCompanionSee({
    area: area === 'lesson' ? 'course' : 'grammar',
    label: `${area === 'lesson' ? t('lhCourse') : t('grTitle')} · ${topicLabel}`,
    phase: fb ? 'feedback' : 'question',
    detail: task.options?.length ? `${task.prompt}\n${task.options.join(' / ')}` : task.prompt,
    ...(fb ? { reveal: `Solution: ${solution}. Learner: ${fb.given || '(empty)'}` } : { mask: [solution, ...task.accepted] }),
  });

  const elapsed = () => Math.max(0, Math.round(performance.now() - shownAt.current - (lookupOpenMs() - lookupAt.current)));

  // Steht der Hinweis der Aufgabe schon vor dem Prüfen da (Stütze unter der Lücke, im Satz oder
  // über dem Feld der Umformung)? Dann nennt der Hinweis für den zweiten Versuch das Thema.
  const hintVisible = !!task.hint && (task.prompt.includes(task.hint) || task.type === 'gap' || (whole && task.type === 'transform'));

  const finishCheck = (verdict: Verdict, check: GrammarCheck | null, given: string, extra: Partial<Fb> = {}) => {
    // Erster Versuch falsch → Hinweis statt Lösung; die Eingabe bleibt stehen, der Fokus bleibt im
    // Feld. Nicht bei Auswahl, nicht im Wochen-Check, nicht bei „nicht sicher prüfbar".
    if (verdict === 'wrong' && !retry && !noHelp && task.type !== 'mc' && !extra.unsure) {
      firstWrong.current = given;
      setRetry(grammarRetryHint(task, tp ? topicLabel : null, hintVisible));
      if (whole) fieldRef.current?.focus({ preventScroll: true });
      else api.focusNow();
      return;
    }
    // Zeit: Gesamtzeit ab dem Einblenden über beide Versuche (durch die Deckelung auf „Schwer"
    // entscheidet sie beim zweiten Versuch nicht mehr über die Note).
    const ms = elapsed();
    const firstKeyMs = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current));
    const grade = learnGrade(task.type, verdict, { submitMs: ms, firstKeyMs }, help);
    setFb({ verdict, check, given, dontKnow: false, grade, ms, help, judged: 'local', why: null, unsure: false, override: false, ...extra });
    if (typedKind && window.matchMedia('(pointer: coarse)').matches) api.blur();
  };

  const check = (choice?: string) => {
    if (fb || judging) return;
    let given: string;
    if (task.type === 'mc') {
      if (!choice) return;
      given = choice;
      setChosen(choice);
    } else if (whole) given = text;
    else {
      given = typed.current;
      if (tip >= 2 && mask) {
        const first = mask[0];
        if (first?.kind === 'slot' && first.hint && hintOffset(mask, given) === 1) given = first.hint + given;
      }
    }
    if (!given.trim()) return;
    const res = checkGrammar(task, given);
    if (res.verdict !== 'wrong' || !res.needsJudge) {
      finishCheck(res.verdict, res, given);
      return;
    }
    // Emrahs Wunsch 27.09.: Bewertung sofort, kein Warten auf Claude. Sehr ähnlich zur Lösung →
    // mögliche gültige Variante („nicht sicher prüfbar“, mit „Ich lag richtig“); sonst falsch.
    if (closeVariant(task, given)) finishCheck('near', res, given, { judged: 'noai', unsure: true });
    else finishCheck('wrong', res, given);
  };

  const dontKnow = () => {
    if (fb || judging) return;
    setFb({ verdict: 'wrong', check: null, given: '', dontKnow: true, grade: 1, ms: elapsed(), help, judged: 'local', why: null, unsure: false, override: false });
    api.blur();
  };

  const override = () => {
    if (!fb) return;
    setFb({ ...fb, verdict: 'correct', grade: Math.min(3, Math.max(2, fb.grade)) as Grade, override: true });
  };

  const next = () => {
    if (!fb) return;
    const a: GrammarAnswer = {
      kind: 'g',
      t: nextT(),
      day,
      lang,
      ctx,
      task,
      given: fb.given,
      dontKnow: fb.dontKnow,
      verdict: fb.verdict,
      grade: fb.override ? 3 : fb.grade,
      ms: fb.ms,
      help: fb.help,
      judged: fb.judged,
      ...(fb.override ? { override: true } : {}),
      ...(retry && firstWrong.current !== null ? { firstWrong: firstWrong.current } : {}),
    };
    const kind = onDone(a);
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (task.type !== 'mc') void check();
      },
      digit: (n) => {
        if (fb || task.type !== 'mc' || useLookup.getState().req) return;
        const o = task.options?.[n - 1];
        if (o) void check(o);
      },
    },
    api.isInput,
  );

  const gapState: GapState = !fb ? 'input' : fb.verdict;
  const solved = useMemo(() => solvedSentence(task) ?? (task.type === 'correct' ? task.answer : null), [task]);
  const src = { area, source: `grammar/${task.topic}` };

  const gapNode = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={Math.max(40, solution.length + 16)}
      state={gapState}
      mask={mask}
      shown={fb ? fb.given : null}
      onChange={(v, info) => {
        typed.current = v;
        if (info.firstKey && firstKeyAt.current === null) firstKeyAt.current = performance.now();
      }}
      onEnter={() => (fb ? next() : void check())}
    />
  );

  const sentenceWithSlot = (sentence: string, slot: ReactNode) => {
    const m = GAP.exec(sentence);
    if (!m) return <EnglishText as="p" className="lx-sentence" text={sentence} {...src} />;
    return <EnglishText as="p" className="lx-sentence" testId="sentence" text={sentence} {...src} slot={{ start: m.index, end: m.index + m[0].length, node: slot }} />;
  };

  // ------------------------------------------------------------------ Aufgabe
  let body: ReactNode;
  if (task.type === 'mc') {
    const filled = fb ? (fb.verdict === 'correct' ? (chosen ?? '') : solution) : '';
    body = (
      <>
        {sentenceWithSlot(
          task.prompt,
          <span className="lx-gap" data-testid="gap" data-state={!fb ? 'input' : fb.verdict === 'correct' ? 'correct' : 'reveal'} style={{ width: 'auto' }}>
            {filled || '   '}
          </span>,
        )}
        <Choices
          items={(task.options ?? []).map((o, i) => ({ id: String(i), label: o, lang: 'en', correct: o === task.answer }))}
          chosen={chosen === null ? null : String((task.options ?? []).indexOf(chosen))}
          onChoose={(id) => void check((task.options ?? [])[Number(id)])}
          label={t('trChoicesLabel')}
        />
      </>
    );
  } else if (task.type === 'gap') {
    body = (
      <>
        {sentenceWithSlot(task.prompt, gapNode)}
        {task.hint && !task.prompt.includes(task.hint) && (
          <p className="text-sm text-muted" lang="en" data-testid="cue">
            {task.hint}
          </p>
        )}
      </>
    );
  } else if (task.type === 'transform' && !whole) {
    const { from, target } = splitTransform(task.prompt);
    body = (
      <>
        {from && <EnglishText as="p" className="text-base text-muted" text={from} {...src} testId="transform-from" />}
        {sentenceWithSlot(target, gapNode)}
      </>
    );
  } else {
    // Ganzsatz: `correct` (Satz steht im Feld) oder Umformung ohne Lücke (Auftrag oben, Feld leer).
    const field = (
      <textarea
        ref={fieldRef}
        className="lx-field"
        data-sentence=""
        data-testid="correct-input"
        data-whole={task.type === 'correct' ? undefined : ''}
        data-state={fb ? fb.verdict : undefined}
        lang="en"
        rows={2}
        value={text}
        readOnly={!!fb}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={t(task.type === 'correct' ? 'grCorrectLabel' : 'grRewriteLabel')}
        onChange={(e) => {
          if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (fb) next();
            else void check();
          }
        }}
      />
    );
    body =
      task.type === 'correct' ? (
        field
      ) : (
        <>
          <EnglishText as="p" className="lx-sentence" text={task.prompt} {...src} testId="transform-from" />
          {task.hint && !task.prompt.includes(task.hint) && (
            <p className="text-sm text-muted" data-testid="cue">
              {task.hint}
            </p>
          )}
          {field}
        </>
      );
  }

  // ------------------------------------------------------------------ Ergebnis
  let result: ReactNode = null;
  if (fb) {
    const c = fb.check;
    const key: MessageKey = fb.dontKnow
      ? 'grVerdictDontKnow'
      : fb.override
        ? 'lrOverridden'
        : fb.unsure
          ? 'grUnsure'
          : fb.verdict === 'correct'
            ? c?.kind === 'uk'
              ? 'trVerdictUk'
              : c?.kind === 'contraction'
                ? 'grVerdictContraction'
                : c?.kind === 'alt'
                  ? 'grVerdictAlt'
                  : 'trVerdictCorrect'
            : fb.verdict === 'near'
              ? c?.kind === 'typo'
                ? 'trVerdictTypo'
                : 'trVerdictNear'
              : c?.kind === 'form'
                ? 'grVerdictForm'
                : 'trVerdictWrong';
    const family = c?.kind === 'alt' ? altFamily(task, fb.given) : null;
    const also = alsoRight(task, lang);
    const notes = family ? [altNote(family, lang), ...also.notes] : also.notes;
    const exclude = solved ?? undefined;
    const examples = examplesFor(task.topic, { exclude, max: 3, offset: hash32(task.key) % 5 });
    const typedAnswer = task.type !== 'mc';
    result = (
      <ResultArea label={t('trResultLabel')}>
        <VerdictLine verdict={fb.verdict} text={t(key)} />
        {fb.why && (
          <p className="text-sm" data-testid="judge-why" lang={lang}>
            {fb.why}
          </p>
        )}
        {c?.us && (
          <p className="text-sm text-muted" data-testid="us-hint">
            {t('trUsHint', { us: c.us })}
          </p>
        )}
        <SentenceDiff
          ops={c?.ops ?? []}
          given={fb.given}
          correct={task.type === 'correct' ? task.answer : solution}
          onlyCorrect={task.type === 'mc' || fb.verdict === 'correct'}
          labels={{ yours: t('grYourAnswer'), correct: t('grCorrect'), empty: t('trEmpty'), missing: t('lrMissing') }}
          {...src}
        />
        {solved && task.type !== 'correct' && <EnglishText as="p" className="text-[0.95rem] leading-relaxed text-muted" text={solved} {...src} testId="solved" />}
        <FormHint text={formHint(task, lang)} />
        <ExampleList items={examples} {...src} />
        <AlsoRight answers={also.answers} notes={notes} />
        {fb.verdict === 'wrong' && typedAnswer && !fb.dontKnow && !fb.override && <OverrideButton onOverride={override} />}
        {fb.verdict === 'wrong' && typedAnswer && <CopyOnce solution={task.type === 'correct' ? task.answer : solution} />}
        <div className="flex justify-end pt-1">
          <NextButton onNext={next} auto={fb.verdict === 'correct' && fb.help.level === 0 && !fb.override && !fb.why} />
        </div>
      </ResultArea>
    );
  }

  return (
    <div ref={root} tabIndex={-1} className="outline-none">
      <article
        ref={sharedRef}
        data-shared={shared ? '' : undefined}
        className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7"
        data-testid="gr-item"
        data-type={task.type}
        data-topic={task.topic}
        data-src={task.src}
        data-review={task.errorT !== null ? '' : undefined}
      >
        <header className="flex flex-col gap-2">
          <LearnStatus p={p} n={typeof doc?.n === 'number' ? doc.n : 0} recent={Array.isArray(doc?.recent) ? (doc.recent as number[]) : null} kind={t(`grKind_${task.type}` as MessageKey)} kindId={task.type} extra={badge} />
          <TaskLine task={t(`grTask_${task.type}` as MessageKey)} purpose={t('purposeGrammar')} />
        </header>
        {/* N46 „Kurz erklärt“ (Soll): die Regel in einem Satz, zugeklappt, ohne KI; nicht im Wochen-Check
            und nicht in der Lektion (dort steht die Regel schon über der Aufgabe). */}
        {!fb && !noHelp && area !== 'lesson' && briefRule && (
          <Disclosure label={t('nbLernenBrief')} testId="gr-brief">
            <p className="text-sm text-muted" lang={lang} data-testid="gr-brief-text">
              {briefRule}
            </p>
          </Disclosure>
        )}
        <div className="flex flex-col gap-4">
          {body}
          {retry && !fb && (
            <RetryHintLine
              text={retry.kind === 'hint' ? t('rhGrammarHint', { hint: retry.text }) : retry.kind === 'topic' ? t('rhGrammarTopic', { topic: retry.name }) : t('rhGrammarVerb')}
            />
          )}
        </div>
        {!fb && (
          <div className="flex flex-wrap items-center gap-2">
            {task.type !== 'mc' && (
              <Button variant="primary" onClick={() => void check()} busy={judging} busyLabel={t('aiThinking')} data-testid="check">
                {t('trCheck')}
              </Button>
            )}
            {typedKind && !scaff && tip < 2 && !noHelp && !retry && (
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
                {tip === 0 ? t('grTip') : t('trTipLetter')}
              </Button>
            )}
            {scaff && tip < 2 && !retry && (
              <Button
                variant="ghost"
                icon="lightbulb"
                onClick={() => {
                  setTip(2);
                  api.focusNow();
                }}
                data-testid="hint"
                data-level={tip}
              >
                {t('trTipLetter')}
              </Button>
            )}
            <Button variant="ghost" onClick={dontKnow} data-testid="dont-know">
              {t('grDontKnow')}
            </Button>
            {judging && (
              <p className="text-sm text-muted" data-testid="gr-judge-phase" role="status">
                {t('grJudging')}
              </p>
            )}
          </div>
        )}
        {result}
      </article>
    </div>
  );
}
