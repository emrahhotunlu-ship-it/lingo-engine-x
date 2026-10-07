import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { bookAnswer, givenOf, type C1Run } from '../../domain/c1x/book';
import { c1Key, type C1Task } from '../../domain/c1x/runtime';
import { scoreC1 } from '../../domain/c1x/score';
import type { C1Response, C1Score } from '../../domain/c1x/types';
import { topicById } from '../../domain/content';
import type { ExplainDepth, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { topicP } from '../../domain/grammar/bkt';
import { grammarExplanation } from '../../domain/grammar/explain';
import { patternOf, whyFor } from '../../domain/grammar/patterns';
import { topicState } from '../../domain/grammar/path';
import { grammarRetryHint, type GrammarRetryHint } from '../../domain/grammar/retryHint';
import type { InputProfile } from '../../domain/grammar/tasks';
import type { HelpLevel } from '../../domain/grade';
import type { Ctx, GrammarAnswer } from '../../domain/learn/types';
import { patsOf, patternState } from '../../domain/metrics/pattern';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup, type WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { toast } from '../../ui/Toast';
import { explainDepth, type ShellFeedback, type ShellMenuId, type ShellSecondary, type ExerciseShellProps } from '../../ui/exercise';
import { TutorButton } from '../../ui/exercise/TutorButton';
import { useCompanionSee } from '../companion/seeing';
import { nextT } from '../progress/persist';
import { bookLex } from './lexWrite';
import { ResultAfter, ResultParts, useResultSub } from './ResultCard';
import type { C1Ctrl, C1KindEntry, ResponseMeta } from './types';

// Der Rahmen einer c1x-Aufgabe (Lernplattform 3.0 §3.1, §3.4, §3.5, P14): Zeit, Tipp-Leiter, Prüfen, Teilpunkte, Urteil, Erklär-Karte, Buchung.
// Die Art (`kinds/<Art>.tsx`) zeichnet nur Satz und Eingabe. Ablauf wie `GrammarItem`: erst ein Hinweis, dann der zweite Versuch (getippte Formen),
// keine Selbstbewertung (die Note folgt aus Richtigkeit, Zeit und Hilfe), Erklärung auch bei richtiger Antwort.

type Fb = {
  score: C1Score;
  response: C1Response;
  meta: ResponseMeta;
  given: string;
  dontKnow: boolean;
  override: boolean;
  ms: number;
  firstKeyMs: number;
  help: HelpLevel;
};

export type C1ItemProps = {
  task: C1Task;
  ctx: Ctx;
  day: string;
  onDone: (a: GrammarAnswer) => 'typed' | 'choice' | null | void;
  area?: WordTapArea;
  badge?: string | null;
  /** Wochen-Check, Check, Einstufung: ohne Tipp und ohne zweiten Versuch. */
  noHelp?: boolean;
  profile?: InputProfile;
  topicRound?: boolean;
  /** Kein automatisches Weiter nach einer richtigen Antwort (Tempo-Runde, P24). */
  noAuto?: boolean;
};

const nonEmpty = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

const tick = (): number => performance.now();

export function useC1Item(props: C1ItemProps, entry: C1KindEntry, root: RefObject<HTMLDivElement | null>): ExerciseShellProps {
  const { task, ctx, day, onDone, area = 'trainer', badge = null, noHelp = false, profile: profileProp, topicRound = false, noAuto = false } = props;
  const item = task.c1;
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const [profile] = useState<InputProfile>(() => profileProp ?? inputProfile());
  const inp = profile === 'touch' ? 'touch' : 'desk';
  const doc = useLive((s) => s.collections.grammar?.get(task.topic));
  const p = topicP(task.topic, doc, now);
  const pattern = useMemo(() => patternOf(task), [task]);
  const patId = task.pat ?? pattern?.id ?? null;
  const patEntry = patId ? patsOf(doc)[patId] : undefined;
  const learning = !!pattern && (topicRound || (patEntry?.n ?? 0) < 3);
  const tp = topicById(task.topic);
  const topicLabel = tp ? (lang === 'en' ? (tp.name_en ?? tp.name) : tp.name) : null;
  const state = patId && pattern ? patternState(patEntry, day) : tp ? topicState(task.topic, doc, now) : null;
  const seenBefore = useMemo(() => (Array.isArray(doc?.seen) ? (doc.seen as unknown[]).includes(c1Key(item.id)) : false), [doc, item.id]);

  const [fb, setFb] = useState<Fb | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2 | 3>(0);
  const [retry, setRetry] = useState<GrammarRetryHint | null>(null);
  const [has, setHas] = useState(false);
  const respRef = useRef<{ r: C1Response; meta: ResponseMeta } | null>(null);
  const firstWrong = useRef<string | null>(null);
  const shownAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const lookupAt = useRef(0);

  useEffect(() => {
    shownAt.current = tick();
    lookupAt.current = lookupOpenMs();
    const a = document.activeElement;
    if (!a || a === document.body) root.current?.focus({ preventScroll: true });
  }, [root]);

  const elapsed = (): number => Math.max(0, Math.round(tick() - shownAt.current - (lookupOpenMs() - lookupAt.current)));
  const help: HelpLevel = tip >= 2 || retry ? 2 : tip >= 1 ? 1 : 0;

  const setResponse = useCallback((r: C1Response | null, meta: ResponseMeta = { form: 'default' }) => {
    respRef.current = r ? { r, meta } : null;
    setHas(r !== null);
  }, []);
  const markFirstKey = useCallback(() => {
    if (firstKeyAt.current === null) firstKeyAt.current = tick();
  }, []);
  const restartClock = useCallback(() => {
    shownAt.current = tick();
    firstKeyAt.current = null;
    lookupAt.current = lookupOpenMs();
  }, []);

  const finish = (score: C1Score, response: C1Response, meta: ResponseMeta, extra: Partial<Fb> = {}): void => {
    const ms = elapsed();
    const firstKeyMs = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current));
    setFb({ score, response, meta, given: givenOf(item, response), dontKnow: false, override: false, ms, firstKeyMs, help, ...extra });
    if (profile === 'touch') api.blur();
  };

  const submit = (): void => {
    if (fb) return;
    const cur = respRef.current;
    if (!cur) return;
    const score = scoreC1(item, cur.r);
    // Erst ein Hinweis, dann der zweite Versuch: nur bei getippten Formen ganz ohne Punkte (Auswahl ist ratbar), nie im Check.
    if (score.verdict === 'wrong' && score.free && !retry && !noHelp) {
      firstWrong.current = givenOf(item, cur.r);
      setRetry(grammarRetryHint(task, topicLabel, false, { task, given: firstWrong.current, ...(cur.meta.picked !== undefined ? { picked: cur.meta.picked } : {}), ...(cur.meta.tapped !== undefined ? { tapped: cur.meta.tapped } : {}), lang }));
      api.focusNow();
      return;
    }
    finish(score, cur.r, cur.meta);
  };

  const dontKnow = (): void => {
    if (fb) return;
    const cur = respRef.current;
    const response: C1Response = cur?.r ?? ({ kind: item.kind, ...(item.kind === 'kwt' || item.kind === 'ocl' || item.kind === 'wf' ? { text: '' } : item.kind === 'err' ? { tap: 'none' } : {}) } as C1Response);
    const score = scoreC1(item, response);
    setFb({ score: { ...score, got: 0, verdict: 'wrong' }, response, meta: cur?.meta ?? { form: 'default' }, given: '', dontKnow: true, override: false, ms: elapsed(), firstKeyMs: elapsed(), help });
    api.blur();
  };

  const override = (): void => {
    if (!fb) return;
    setFb({ ...fb, override: true });
  };

  const next = (): void => {
    if (!fb) return;
    const run: C1Run = {
      form: fb.meta.form,
      inp,
      timeMs: fb.ms,
      firstKeyMs: fb.firstKeyMs,
      help: fb.dontKnow ? 3 : fb.help,
      ...(fb.meta.deletions !== undefined ? { deletions: fb.meta.deletions } : {}),
      ...(fb.meta.chars !== undefined ? { chars: fb.meta.chars } : {}),
      ...(fb.meta.units !== undefined ? { units: fb.meta.units } : {}),
      ...(seenBefore ? { again: true } : {}),
      ...(fb.dontKnow ? { dontKnow: true } : {}),
      ...(fb.override ? { override: true } : {}),
      day,
      t: nextT(),
      lang,
      ctx,
      given: fb.given,
    };
    const a = bookAnswer(task, fb.score, fb.response, run);
    // Wortkarten und Verlauf der Lexik-Aufgaben (P20): höchstens eine Wiederholung je Karte und Lerntag, nie eine neue Karte, nie im Messmodus.
    if (item.lex?.length || item.area === 'lex') {
      const score = fb.override ? { ...fb.score, verdict: 'correct' as const } : fb.score;
      void bookLex({ item, score, grade: a.grade, day, lang, ms: fb.ms, given: fb.given, dev: inp === 'touch' ? 't' : 'k', ...(seenBefore ? { again: true } : {}), ...(noHelp ? { measure: true } : {}) });
    }
    const booked: GrammarAnswer = retry && firstWrong.current !== null ? { ...a, firstWrong: firstWrong.current } : a;
    const kind = onDone(booked);
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (respRef.current) submit();
      },
    },
    api.isInput,
  );

  const ctrl: C1Ctrl = {
    task,
    item,
    inp,
    profile,
    lang,
    area,
    p,
    locked: fb !== null,
    score: fb?.score ?? null,
    tip,
    retry: retry !== null,
    noHelp,
    api,
    setResponse,
    submit,
    markFirstKey,
    restartClock,
  };
  // Der Hook der Art: immer genau einmal je Zeichnen (die Art ist je Aufgabe fest; `C1Item` hängt die Aufgabe mit `key` ein).
  const ui = entry.useUi(ctrl);

  // ------------------------------------------------------------------ Erklärung

  const rv: ResultVerdict | null = !fb ? null : fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.score.verdict === 'correct' ? 'ok' : fb.score.verdict === 'near' ? 'near' : 'wrong';
  const model: ExplanationModel | null = useMemo(() => {
    if (!fb || !rv) return null;
    return grammarExplanation({ task, verdict: rv, given: fb.given, ...(fb.meta.picked !== undefined ? { picked: fb.meta.picked } : {}), ...(fb.meta.tapped !== undefined ? { tapped: fb.meta.tapped } : {}), lang, learning });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, lang, learning, task]);
  const depth: ExplainDepth = explainDepth({ verdict: rv ?? 'ok', p, learning });
  const sub = useResultSub(fb?.score ?? { got: 0, max: 1, parts: [], verdict: 'wrong', free: false });
  const matched = fb && !fb.dontKnow ? whyFor(task, { given: fb.given, ...(fb.meta.picked !== undefined ? { picked: fb.meta.picked } : {}), ...(fb.meta.tapped !== undefined ? { tapped: fb.meta.tapped } : {}) }).rule : null;

  // ------------------------------------------------------------------ Hinweise

  const maxTip = noHelp ? 0 : (ui.maxTip ?? 2);
  const tipText = (n: 1 | 2 | 3): string => ui.tipText?.(n) ?? (n === 1 ? (pattern ? (lang === 'de' ? pattern.nudge.de : pattern.nudge.en) : '') : pattern ? `${t('gxHintFormula')}: ${lang === 'de' ? pattern.form.de : pattern.form.en}` : '');
  const retryText = (r: GrammarRetryHint): string => (r.kind === 'nudge' ? r.text : r.kind === 'hint' ? t('rhGrammarHint', { hint: r.text }) : r.kind === 'topic' ? t('rhGrammarTopic', { topic: r.name }) : t('rhGrammarVerb'));
  const hint = fb ? null : retry ? { text: retryText(retry), tone: 'near' as const } : tip > 0 && tipText(tip as 1 | 2 | 3) ? { text: tipText(tip as 1 | 2 | 3), tone: 'hint' as const } : null;
  const canTip = !noHelp && !retry && !fb && tip < maxTip;
  const secondary: ShellSecondary[] = [
    ...(canTip ? [{ id: 'hint' as const, label: t('exHint'), onClick: () => setTip((v) => Math.min(3, v + 1) as 1 | 2 | 3), testId: 'hint' }] : []),
    { id: 'dontKnow' as const, label: t('exDontKnow'), onClick: dontKnow, testId: 'dont-know' },
  ];

  // ------------------------------------------------------------------ Rückmeldung

  useCompanionSee({
    area: 'grammar',
    label: `${t('grTitle')} · ${topicLabel ?? t(`cxKindName_${item.kind}` as MessageKey)}`,
    phase: fb ? 'feedback' : 'question',
    detail: task.prompt,
    ...(fb ? { reveal: `Solution: ${task.answer}. Learner: ${fb.given || '(empty)'}` } : { mask: [task.answer, ...task.accepted] }),
  });

  let feedback: ShellFeedback | null = null;
  if (fb && model && rv) {
    const typedWrong = fb.score.free && fb.score.verdict !== 'correct' && !fb.dontKnow && !fb.override;
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (typedWrong) menu.override = override;
    menu.report = () => {
      logWarn('c1x:report', { message: 'Aufgabe gemeldet (lokal, nur im Protokoll)' }, item.id);
      toast(t('cxReported'));
    };
    const tutor =
      fb.dontKnow || fb.score.verdict === 'correct' || fb.override ? null : (
        createElement(TutorButton, {
          taskKey: `c1:${item.id}:${fb.given}`,
          vars: {
            topic: task.topic,
            prompt: task.prompt,
            answer: task.answer,
            given: fb.given,
            pattern: pattern ? { name: lang === 'de' ? pattern.name.de : pattern.name.en, form: lang === 'de' ? pattern.form.de : pattern.form.en } : null,
          },
        })
      );
    feedback = {
      verdict: rv,
      sub,
      explanation: model,
      depth,
      menu,
      tutor,
      parts: createElement(ResultParts, { score: fb.score }),
      right: ui.right ?? null,
      after: createElement(ResultAfter, { item, matched }),
      auto: !noAuto && fb.help === 0 && !fb.override && fb.score.free,
    };
  }

  const primary = fb ? { label: t('exNext'), onClick: next, testId: 'next' } : { label: t('exCheck'), onClick: submit, testId: 'check', disabled: !has };
  const aiMark: ReactNode = item.src === 'ai' ? createElement('p', { className: 'lx-t-meta text-muted', 'data-testid': 'ai-mark' }, t('cxAiMark')) : null;
  // Die Muster-Karte vor dem Prüfen entfällt am Handy: sie verdrängte die Bausteine unter den Bildschirmrand und verriet die Formel (UX-Prüfung R1).
  const aid: ReactNode = [ui.aid, aiMark].some(Boolean) ? createElement('div', { className: 'flex flex-col gap-2' }, ui.aid, aiMark) : null;

  const learnLine = learning && pattern ? { topic: topicLabel, pattern: lang === 'de' ? pattern.name.de : pattern.name.en } : { topic: null, pattern: null };
  void nonEmpty;

  const shell: ExerciseShellProps = {
    meta: { ex: `c1_${item.kind}`, id: `${task.topic}|${task.key}`, kind: item.kind },
    status: { area: 'grammar', state, kindLabel: t(`cxKindName_${item.kind}` as MessageKey), topic: learnLine.topic, pattern: learnLine.pattern, badge },
    task: { text: ui.task ?? t(`cxTask_${item.kind}` as MessageKey), purpose: t('cxPurpose') },
    aid,
    prompt: ui.prompt,
    answer: ui.answer,
    hint,
    secondary,
    primary,
    feedback,
    // UX-Prüfung W4: rechts vor dem Prüfen nur „Erst selbst entscheiden …“ (Platzhalter des Gerüsts), die Regel nur als Tipp.
    side: null,
  };
  return shell;
}
