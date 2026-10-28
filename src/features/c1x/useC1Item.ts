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
import type { AttemptTiming } from '../../domain/progress/logPatch';
import type { AttemptInput, AttemptMeta } from '../../domain/srs/types';
import { patsOf, patternState } from '../../domain/metrics/pattern';
import { useHiddenInput } from '../../engine/HiddenInput';
import { bindInputKind, createAttemptTracker, pickAttempt, promptChars } from '../../engine/inputKind';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup, type WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { logError, logWarn } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { toast } from '../../ui/Toast';
import { explainDepth, findHead, type ShellFeedback, type ShellMenuId, type ShellSecondary, type ExerciseShellProps } from '../../ui/exercise';
import { TutorButton } from '../../ui/exercise/TutorButton';
import { useCompanionSee } from '../companion/seeing';
import { nextT } from '../progress/persist';
import { bookLex } from './lexWrite';
import { registerLeaveBook } from '../../ui/exercise/leaveBook';
import { errFixed, errRange } from '../../domain/c1x/kinds/err';
import { shortWhy } from '../../domain/grammar/alsoRight';
import { abandonFit, fitAiState, runFit, useFitJudge, type FitResult } from '../grammar/fit';
import { FitSlow } from '../grammar/FitSlow';
import { JudgeFoot, type AiMsg, type TargetState } from '../grammar/JudgeFoot';
import { judge, readFitAlt } from '../../domain/tutor/judge';
import { composeFeedback, type FeedbackAction } from '../../domain/tutor/feedback';
import type { Diagnosis } from '../../domain/tutor/diagnose';
import type { Verdict as TutorVerdict } from '../../domain/tutor/tutorTypes';
import type { GrammarTask } from '../../domain/learn/types';
import { GRAMMAR_FIT_PV, type GrammarFitOut } from '../../prompts/grammarFit';
import { learnerNow, lintOnce, scheduleLearner } from '../tutor/learnerLive';
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
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt und Eingabeart; fehlen ohne Kontakt. Nur gespeichert, nie für Note oder Tempo (`tm` bleibt). */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4-Nacharbeit): gemischt, Senden vor Claude, Prompt-Länge, zweiter Versuch, verborgene Seite (siehe `AttemptMeta`). */
  mx?: AttemptMeta['mx'];
  sm?: number;
  pl?: number;
  n?: AttemptMeta['n'];
  bg?: AttemptMeta['bg'];
  help: HelpLevel;
  /** „Auch richtig“ (Claude, `grammar-fit@1`): zählt nie als Fehler und nicht als Beleg fürs Muster. */
  alt?: boolean;
  /** Begründung von Claude zu „Auch richtig“. */
  aiWhy?: string;
  /** Tutor-Engine v3 (nur Fehler finden mit getippter Korrektur): Urteil, Diagnose, Knopf „Claude fragen“, Meldung, gemerkte Antwort, Zielform. */
  tv?: TutorVerdict;
  by?: 'local' | 'ai' | 'me';
  fitsGoal?: boolean | null;
  dx?: Diagnosis | null;
  ask?: boolean;
  aiMsg?: AiMsg | null;
  aiNoWhy?: string | null;
  fit?: { by: 'ai' | 'me'; pv: string; a: string };
  target?: TargetState;
};

const TJ_V: Record<TutorVerdict, 'c' | 'a' | 'n' | 'w' | 'u'> = { correct: 'c', alt_ok: 'a', near: 'n', wrong: 'w', unsure: 'u' };

export type C1ItemProps = {
  task: C1Task;
  ctx: Ctx;
  day: string;
  onDone: (a: GrammarAnswer) => 'typed' | 'choice' | null | void;
  area?: WordTapArea;
  badge?: string | null;
  badgeTone?: 'near' | 'hint';
  /** Wochen-Check, Check, Einstufung: ohne Tipp und ohne zweiten Versuch. */
  noHelp?: boolean;
  profile?: InputProfile;
  topicRound?: boolean;
  /** Kein automatisches Weiter nach einer richtigen Antwort (Tempo-Runde, P24). */
  noAuto?: boolean;
  /** Nachtrag LS3: geprüft, aber nicht bestätigt → beim Verlassen buchen (`stay`: verborgen, Aufgabe bleibt; `go`: weiterrechnen). Wie `GrammarItem`. */
  onLeave?: ((a: GrammarAnswer, mode: 'stay' | 'go') => void) | null;
};

const nonEmpty = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

const tick = (): number => performance.now();

export function useC1Item(props: C1ItemProps, entry: C1KindEntry, root: RefObject<HTMLDivElement | null>): ExerciseShellProps {
  const { task, ctx, day, onDone, area = 'trainer', badge = null, badgeTone, noHelp = false, profile: profileProp, topicRound = false, noAuto = false, onLeave = null } = props;
  const item = task.c1;
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const [profile] = useState<InputProfile>(() => profileProp ?? inputProfile());
  const inp = profile === 'touch' ? 'touch' : 'desk';
  const doc = useLive((s) => s.collections.grammar?.get(task.topic));
  const p = topicP(task.topic, doc, now);
  // Fehler finden: Muster, Beispiele und „Nicht verwechseln“ nur, wenn die Aufgabe ihr Muster ausdrücklich nennt (Signalwörter im Fehlersatz treffen oft ein fremdes).
  const pattern = useMemo(() => (item.kind === 'err' && !task.pat && !item.pat ? null : patternOf(task)), [task, item]);
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
  const fit = useFitJudge();
  const shownAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const lookupAt = useRef(0);
  // S1-ZEIT (P4): erster Kontakt und Eingabeart, getrennt von `firstKeyAt` (das bleibt allein für Note und Tempo). Pause wie `elapsed()`.
  const [attempt] = useState(createAttemptTracker);

  // Tutor-Engine v3: Aufgaben-Prüfung als Warnzähler (nie Sperre); Lernermodell bei Rundenstart und bei jeder Rückmeldung, verzögert.
  useEffect(() => {
    lintOnce(task);
    if (!learnerNow()) scheduleLearner();
  }, [task]);
  useEffect(() => {
    if (fb) scheduleLearner();
  }, [fb]);

  useEffect(() => {
    shownAt.current = tick();
    lookupAt.current = lookupOpenMs();
    const a = document.activeElement;
    if (!a || a === document.body) root.current?.focus({ preventScroll: true });
  }, [root]);
  // S1-ZEIT (P4): Tasten und Einfügungen in der versteckten Eingabe (außerhalb der Aufgabe) oder in einem Feld der Aufgabe.
  useEffect(() => bindInputKind(document, { accept: (el) => api.isInput(el) || (el instanceof Node && !!root.current?.contains(el)), tracker: attempt, now: tick, paused: () => lookupOpenMs() - lookupAt.current }), [api, attempt, root]);

  const elapsed = (): number => Math.max(0, Math.round(tick() - shownAt.current - (lookupOpenMs() - lookupAt.current)));
  const help: HelpLevel = tip >= 2 || retry ? 2 : tip >= 1 ? 1 : 0;

  const setResponse = useCallback(
    (r: C1Response | null, meta: ResponseMeta = { form: 'default' }) => {
      // S1-ZEIT (P4): die erste Antwort (Wahl, Antippen, Baustein) ist ein Kontakt; Tasten erfasst `bindInputKind`.
      if (r) attempt.contact(tick(), lookupOpenMs() - lookupAt.current);
      respRef.current = r ? { r, meta } : null;
      setHas(r !== null);
    },
    [attempt],
  );
  const markFirstKey = useCallback(() => {
    if (firstKeyAt.current === null) firstKeyAt.current = tick();
    attempt.contact(tick(), lookupOpenMs() - lookupAt.current);
  }, [attempt]);
  const restartClock = useCallback(() => {
    shownAt.current = tick();
    firstKeyAt.current = null;
    lookupAt.current = lookupOpenMs();
    attempt.reset();
  }, [attempt]);
  /** S1-ZEIT (P4): Messwerte zum Zeitpunkt der Wertung (wie `ms`); getippte Formen `t`, Auswahl, Bausteine, Antippen `c`. Ohne Kontakt fehlen `fk`/`in`/`mx`. */
  const timing = (score: C1Score | null, meta: ResponseMeta | undefined, given: string): AttemptTiming => {
    const typed = !!score?.free || meta?.form === 'typed' || meta?.form === 'tapfix' || meta?.form === 'part';
    return attempt.meta({ start: shownAt.current, answer: given, base: typed ? 't' : 'c', second: !!retry, pl: promptChars(root.current) });
  };

  const finish = (score: C1Score, response: C1Response, meta: ResponseMeta, extra: Partial<Fb> = {}): void => {
    const ms = elapsed();
    const firstKeyMs = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current));
    const given = givenOf(item, response);
    setFb({ score, response, meta, given, dontKnow: false, override: false, ms, firstKeyMs, help, ...timing(score, meta, given), ...extra });
    if (profile === 'touch') api.blur();
  };

  const submit = (): void => {
    if (fb || fit.ctl.current) return;
    // S1-ZEIT: ein früheres Senden (erster Versuch vor dem Hinweis) gilt nicht für diesen Versuch.
    attempt.unsend();
    const cur = respRef.current;
    if (!cur) return;
    const score = scoreC1(item, cur.r);
    // Tutor-Engine v3 (§4.1): Stelle gefunden, getippter Ersatz nicht in der Liste → `judge` über die Korrektur: gemerkte Antworten (`fitAlt`)
    // zuerst, dann die Diagnose; unsicher → Claude automatisch nur mit `sampleConfirmed` und Tagesbremse, sonst Knopf „Claude fragen“.
    const r = cur.r;
    if (item.kind === 'err' && item.bad && score.verdict === 'near' && r.kind === 'err' && typeof r.tap === 'number' && r.typed && r.fix?.trim() && (patId ?? item.pat)) {
      const given = r.fix.trim();
      const j = judge(fixTask(), given, { fitAlt: readFitAlt(doc), aiState: fitAiState(), model: learnerNow() });
      const jx: Partial<Fb> = { tv: j.v, by: j.by, fitsGoal: j.fitsGoal, dx: j.dx, ask: j.askAi === 'button' };
      const full: C1Score = { ...score, got: score.max, verdict: 'correct', parts: score.parts.map((x) => ({ ...x, ok: true })) };
      if (j.v === 'correct' || (j.v === 'alt_ok' && j.kind === 'alt')) {
        finish(full, cur.r, cur.meta, { ...jx, tv: 'correct', ...(j.by === 'me' ? { aiMsg: 'byMe' as const } : {}) });
        return;
      }
      if (j.v === 'alt_ok') {
        finish(full, cur.r, cur.meta, { ...jx, alt: true });
        return;
      }
      if (j.askAi === 'auto') {
        // S1-ZEIT (P4-Nacharbeit): Antwortzeit beim Tippen auf „Prüfen“, ohne das Warten auf Claude.
        attempt.send(elapsed(), promptChars(root.current));
        runFit(fit.ctl, fit.judge(`${task.topic}|${task.key}`, fitVarsFor(given)), (out) => finish(full, cur.r, cur.meta, aiYes(out, given)), (res) => settle(score, cur, { ...jx, ...aiNotYes(res, true) }));
        return;
      }
      settle(score, cur, jx);
      return;
    }
    settle(score, cur);
  };

  /** Die Korrektur der Fehlerstelle als Lückenaufgabe (für `judge`): Lösung und weitere Fassungen aus `bad.fix`. */
  const errIt = item.kind === 'err' ? item : null;
  const fixes: readonly string[] = errIt?.bad?.fix ?? [];
  const fixTask = (): GrammarTask => ({ ...task, type: 'gap', answer: fixes[0] ?? '', accepted: fixes.slice(1), alt: [] });
  const fitVarsFor = (given: string) => ({
    topic: topicLabel ?? task.topic,
    pattern: pattern ? pattern.name.en : null,
    rule: pattern ? pattern.form.en : null,
    accepted: fixes.slice(1, 7),
    mode: 'replace' as const,
    task: errIt?.text ?? task.prompt,
    sentence: errIt ? errFixed(errIt, given) : given,
    expected: errIt ? errFixed(errIt, fixes[0] ?? '') : task.answer,
    given,
    uiLang: lang,
  });
  const aiYes = (out: GrammarFitOut, given: string): Partial<Fb> => ({
    alt: true,
    aiWhy: lang === 'de' ? out.why.de : out.why.en,
    tv: 'alt_ok',
    by: 'ai',
    fitsGoal: out.fitsGoal,
    ask: false,
    aiMsg: null,
    fit: { by: 'ai', pv: GRAMMAR_FIT_PV, a: given },
  });
  const aiNotYes = (res: FitResult | null, wasAsk: boolean): Partial<Fb> => {
    if (!res) return { ask: wasAsk };
    if (res.out) return { ask: false, aiMsg: res.out.fits ? 'unsure' : 'no', aiNoWhy: res.out.fits ? null : lang === 'de' ? res.out.why.de : res.out.why.en };
    if (res.err === 'busy' || res.err === 'signin' || res.err === 'retry') return { ask: true, aiMsg: res.err };
    if (res.err === 'off') {
      logWarn('grammar:fit', { message: 'Claude nicht verfügbar' }, task.key);
      return { ask: false, aiMsg: null };
    }
    return res.err ? { ask: false, aiMsg: res.err } : { ask: wasAsk };
  };

  /** „Claude fragen“ nach der Rückmeldung (Knopf): stuft nur hoch. */
  const askNow = (): void => {
    if (!fb || fit.busy || fit.ctl.current || fb.response.kind !== 'err') return;
    const given = fb.response.fix?.trim() ?? '';
    if (!given) return;
    const refresh = fb.aiMsg === 'retry';
    runFit(
      fit.ctl,
      fit.judge(`${task.topic}|${task.key}`, fitVarsFor(given), { refresh }),
      (out) => setFb((c) => (c ? { ...c, score: { ...c.score, got: c.score.max, verdict: 'correct', parts: c.score.parts.map((x) => ({ ...x, ok: true })) }, ...aiYes(out, given) } : c)),
      (res) => setFb((c) => (c ? { ...c, ...aiNotYes(res, true) } : c)),
    );
  };

  /** „Zählt“: Claude sagt, das geübte Muster ist getroffen (andere Form) → wie „Ich lag richtig“, voll gebucht. */
  const counts = (): void => {
    if (!fb) return;
    setFb({ ...fb, override: true, alt: false, tv: 'correct', by: 'me', ask: false, aiMsg: 'byMe', fit: { by: 'me', pv: GRAMMAR_FIT_PV, a: fb.given.trim() } });
  };

  /** Zielform nach „Auch richtig“ mit anderem Muster: die App prüft selbst gegen die Korrekturen der Stelle. */
  const tryTarget = (value: string): void => {
    if (!fb || fb.target) return;
    const j = judge(fixTask(), value, { fitAlt: {}, aiState: { available: false, confirmed: false, budgetLeft: 0 }, targetRetry: true });
    setFb({ ...fb, target: { given: value.trim(), ok: j.v === 'correct' || j.v === 'near' || (j.v === 'alt_ok' && j.kind === 'alt') } });
  };

  const settle = (score: C1Score, cur: { r: C1Response; meta: ResponseMeta }, extra: Partial<Fb> = {}): void => {
    // Erst ein Hinweis, dann der zweite Versuch: nur bei getippten Formen ganz ohne Punkte (Auswahl ist ratbar), nie im Check.
    if (score.verdict === 'wrong' && score.free && !retry && !noHelp) {
      firstWrong.current = givenOf(item, cur.r);
      setRetry(grammarRetryHint(task, topicLabel, false, { task, given: firstWrong.current, ...(cur.meta.picked !== undefined ? { picked: cur.meta.picked } : {}), ...(cur.meta.tapped !== undefined ? { tapped: cur.meta.tapped } : {}), lang }));
      api.focusNow();
      return;
    }
    finish(score, cur.r, cur.meta, extra);
  };

  const dontKnow = (): void => {
    if (fb) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    const cur = respRef.current;
    const response: C1Response = cur?.r ?? ({ kind: item.kind, ...(item.kind === 'kwt' || item.kind === 'ocl' || item.kind === 'wf' ? { text: '' } : item.kind === 'err' ? { tap: 'none' } : {}) } as C1Response);
    const score = scoreC1(item, response);
    setFb({ score: { ...score, got: 0, verdict: 'wrong' }, response, meta: cur?.meta ?? { form: 'default' }, given: '', dontKnow: true, override: false, ms: elapsed(), firstKeyMs: elapsed(), help, ...timing(null, cur?.meta, cur ? givenOf(item, cur.r) : '') });
    api.blur();
  };

  const override = (): void => {
    if (!fb) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    // Einspruch bei einer getippten Korrektur an der richtigen Stelle: als Emrahs Antwort gemerkt (`fitAlt` by `me`), nächstes Mal richtig.
    const fix = fb.response.kind === 'err' && typeof fb.response.tap === 'number' && fb.response.typed ? (fb.response.fix?.trim() ?? '') : '';
    setFb({ ...fb, override: true, alt: false, ask: false, ...(fix ? { tv: 'correct' as const, by: 'me' as const, aiMsg: 'byMe' as const, fit: { by: 'me' as const, pv: GRAMMAR_FIT_PV, a: fix } } : {}) });
  };

  /** Die bewertete Antwort, wie „Weiter“ sie bucht (auch beim Verlassen, Nachtrag LS3); `lex`: Wortkarten der Lexik-Aufgaben (einmal je Antwort). */
  const answerOf = (f: Fb): { a: GrammarAnswer & AttemptTiming; lex: (() => void) | null } => {
    const tv: TutorVerdict = f.tv ?? (f.override || f.score.verdict === 'correct' ? (f.alt ? 'alt_ok' : 'correct') : f.score.verdict);
    const tj: NonNullable<GrammarAnswer['tj']> = {
      v: f.override ? 'c' : TJ_V[tv],
      ...(f.dx && f.dx.cause !== 'unknown' ? { h: f.dx.cause.slice(0, 12) } : {}),
      ...(f.dx?.known && tv === 'wrong' && f.dx.vs ? { vs: f.dx.vs.slice(0, 40) } : {}),
    };
    // Zielform-Zweitversuch richtig: halbes Gewicht (Hilfe 1), ohne `firstWrong`; die erste Antwort bleibt als gemerkte Antwort (`fit`).
    if (f.target?.ok && f.response.kind === 'err') {
      const response: C1Response = { ...f.response, fix: f.target.given };
      const full: C1Score = { ...f.score, got: f.score.max, verdict: 'correct', parts: f.score.parts.map((x) => ({ ...x, ok: true })) };
      const runT: C1Run = { form: f.meta.form, inp, timeMs: f.ms, firstKeyMs: f.firstKeyMs, help: 1, ...(seenBefore ? { again: true } : {}), day, t: nextT(), lang, ctx, given: f.target.given };
      const aT = bookAnswer(task, full, response, runT);
      // S1-ZEIT: die Zielform ist ein zweiter Versuch.
      const secondTry: AttemptTiming = { ...pickAttempt(f), n: 2 };
      return { a: { ...aT, tj: { v: 'c' }, ...(f.fit ? { fit: f.fit } : {}), ...secondTry }, lex: null };
    }
    const run: C1Run = {
      form: f.meta.form,
      inp,
      timeMs: f.ms,
      firstKeyMs: f.firstKeyMs,
      help: f.dontKnow ? 3 : f.help,
      ...(f.meta.deletions !== undefined ? { deletions: f.meta.deletions } : {}),
      ...(f.meta.chars !== undefined ? { chars: f.meta.chars } : {}),
      ...(f.meta.units !== undefined ? { units: f.meta.units } : {}),
      ...(seenBefore ? { again: true } : {}),
      ...(f.dontKnow ? { dontKnow: true } : {}),
      ...(f.override ? { override: true } : {}),
      day,
      t: nextT(),
      lang,
      ctx,
      given: f.given,
    };
    const a = bookAnswer(task, f.score, f.response, run);
    // Wortkarten und Verlauf der Lexik-Aufgaben (P20): höchstens eine Wiederholung je Karte und Lerntag, nie eine neue Karte, nie im Messmodus.
    const lex =
      item.lex?.length || item.area === 'lex'
        ? () => {
            const score = f.override ? { ...f.score, verdict: 'correct' as const } : f.score;
            void bookLex({ item, score, grade: a.grade, day, lang, ms: f.ms, given: f.given, dev: inp === 'touch' ? 't' : 'k', ...(seenBefore ? { again: true } : {}), ...(noHelp ? { measure: true } : {}) });
          }
        : null;
    const booked: GrammarAnswer & AttemptTiming = {
      ...(retry && firstWrong.current !== null ? { ...a, firstWrong: firstWrong.current } : a),
      ...(f.alt && !f.override ? { alt: true } : {}),
      tj,
      ...(f.fit && !f.dontKnow ? { fit: f.fit } : {}),
      ...pickAttempt(f),
    };
    return { a: booked, lex };
  };

  // Nachtrag LS3 (wie `GrammarItem`): geprüft, aber nicht mit „Weiter“ bestätigt → beim Verlassen buchen. `booked`: beim Verbergen gebucht
  // (dieselbe Antwort geht später mit „Weiter“ weiter, ohne zweites Speichern); `done`: endgültig weitergegeben. Nie während Claude prüft.
  const leftBooked = useRef<(GrammarAnswer & AttemptTiming) | null>(null);
  const done = useRef(false);
  // Beim Verbergen schon gebucht: was die Wertung ändern würde („Ich lag richtig“, „Claude fragen“, „Als richtig werten“, Zielform) bliebe
  // wirkungslos (das spätere „Weiter“ führt nur die gebuchte Antwort weiter) – nicht anbieten.
  const [held, setHeld] = useState(false);
  const leaveNow = (mode: 'stay' | 'go'): void => {
    // Ein Fehler beim Buchen darf das Verlassen nie aufhalten (Aushängen, ✕, Seite weg): protokollieren, nicht werfen.
    try {
      if (!onLeave || !fb || done.current) return;
      // Claude prüft die Antwort gerade nach („Claude fragen“): offen lassen, nichts buchen.
      const aiOpen = fit.busy;
      if (mode === 'stay') {
        if (leftBooked.current || aiOpen) return;
        const r = answerOf(fb);
        leftBooked.current = r.a;
        r.lex?.();
        onLeave(r.a, 'stay');
        setHeld(true);
        return;
      }
      if (!leftBooked.current && aiOpen) return;
      done.current = true;
      if (leftBooked.current) {
        onLeave(leftBooked.current, 'go');
        return;
      }
      const r = answerOf(fb);
      r.lex?.();
      onLeave({ ...r.a, left: true }, 'go');
    } catch (err) {
      logError('leave:book', err, task.key);
    }
  };
  const leaveRef = useRef(leaveNow);
  useEffect(() => {
    leaveRef.current = leaveNow;
  });
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') leaveRef.current('stay');
    };
    const onHide = () => leaveRef.current('stay');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      leaveRef.current('go');
    };
  }, []);
  const hasFb = fb !== null;
  useEffect(() => {
    if (!hasFb || !onLeave) return;
    return registerLeaveBook(() => leaveRef.current('go'));
  }, [hasFb, onLeave]);

  const next = (): void => {
    if (!fb || done.current) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    done.current = true;
    let a = leftBooked.current;
    if (!a) {
      const r = answerOf(fb);
      r.lex?.();
      a = r.a;
    }
    const kind = onDone(a);
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
    day,
    area,
    p,
    locked: fb !== null,
    busy: fit.busy,
    ownFix: fb?.alt && !fb.override && fb.response.kind === 'err' ? (fb.response.fix?.trim() ?? null) : null,
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
    // Stelle getroffen: die Erklärung gilt der Korrektur, nie dem Text für eine falsch angetippte Stelle („Der Fehler liegt am Anfang …“).
    const rr = fb.response.kind === 'err' ? fb.response : null;
    const rg = item.kind === 'err' ? errRange(item) : null;
    const spotHit = !!rr && typeof rr.tap === 'number' && !!rg && rr.tap >= rg[0] && rr.tap <= rg[1];
    const m = grammarExplanation({ task, verdict: rv, given: fb.given, ...(fb.meta.picked !== undefined ? { picked: fb.meta.picked } : {}), ...(fb.meta.tapped !== undefined && !spotHit ? { tapped: fb.meta.tapped } : {}), lang, learning });
    // „Auch richtig“: die Begründung des geübten Musters steht in der Zeile „Gesucht war …“; hier nur Muster, Gegenüberstellung und der Hinweis, dass es nicht zählt.
    return fb.alt && !fb.override
      ? { ...m, ai: !!fb.aiWhy, lines: [...m.lines.filter((l) => l.k === 'pattern'), ...(fb.aiWhy ? [{ k: 'why' as const, text: fb.aiWhy }] : []), ...m.lines.filter((l) => l.k === 'contrast'), { k: 'note' as const, text: t('grAltNoCount') }] }
      : m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, lang, learning, task]);
  const depth: ExplainDepth = explainDepth({ verdict: rv ?? 'ok', p, learning });
  // Fehler finden: den Grund („Fehlalarm“, „übersehen“) sagt der Kopf in ganzen Worten (Rückmeldung 7), hier nur Punkte und US-Hinweis.
  const subScore = fb ? (item.kind === 'err' ? { got: fb.score.got, max: fb.score.max, parts: fb.score.parts, verdict: fb.score.verdict, free: fb.score.free, ...(fb.score.us ? { us: fb.score.us } : {}) } : fb.score) : null;
  const pointsSub = useResultSub(subScore ?? { got: 0, max: 1, parts: [], verdict: 'wrong', free: false });
  // Rückmeldung 7: Kopf „Richtig erkannt“ / „Nicht ganz“ mit dem getippten Wort und, wenn verfehlt, wo der Fehler steckt.
  const head = useMemo(() => {
    if (!fb || !rv || item.kind !== 'err') return null;
    const r = fb.response.kind === 'err' ? fb.response : null;
    const range = errRange(item);
    const found = !!r && typeof r.tap === 'number' && !!range && r.tap >= range[0] && r.tap <= range[1];
    const tapped = fb.meta.tapped ?? null;
    // „near“ heißt bei `err`: Stelle richtig, Korrektur falsch oder keine (domain/c1x/kinds/err.ts). Der Kopf sagt das so;
    // der Farbton bleibt „near“ (rv). Die getippte Korrektur nennt der Untertitel.
    const fix = r?.fix?.trim();
    return findHead({ verdict: rv === 'near' ? 'wrong' : rv, errWord: item.bad?.span ?? null, tapped, found, ...(fix ? { fix } : {}), ...(item.bad?.fix[0] ? { answer: item.bad.fix[0] } : {}) }, lang, t('cxNoError'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, rv, item, lang]);
  const sub = [pointsSub, head?.sub].filter((x): x is string => !!x).join(' · ') || null;
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

  const altWhy = shortWhy(task.why ? (lang === 'de' ? task.why.ok.de : task.why.ok.en) : lang === 'de' ? task.expl.de : task.expl.en);
  const wanted = item.kind === 'err' && item.bad ? (item.bad.fix[0] ?? '') : task.answer;
  const altSub = altWhy ? t('grAltWanted', { want: wanted, why: altWhy }) : t('grAltWantedBare', { want: wanted });
  // Tutor-Engine v3: die eine Handlung unter der Rückmeldung (`composeFeedback`); die Erklärung selbst bleibt das c1x-Modell oben.
  const rawAction: FeedbackAction =
    fb && model && fb.tv
      ? composeFeedback({
          base: model,
          v: fb.override ? 'correct' : fb.alt ? 'alt_ok' : fb.tv,
          by: fb.by ?? 'local',
          fitsGoal: fb.fitsGoal ?? null,
          dontKnow: fb.dontKnow,
          override: fb.override,
          dx: fb.dx ?? null,
          pat: patId,
          hyps: [],
          aiWhy: fb.aiWhy ?? null,
          altWhy: null,
          askAi: fb.ask ? 'button' : 'no',
          targetTried: !!fb.target || noHelp,
          texts: { altNoCount: t('grAltNoCount') },
        }).action
      : 'next';
  const action: FeedbackAction = held ? 'next' : rawAction;
  let feedback: ShellFeedback | null = null;
  if (fb && model && rv) {
    const typedWrong = fb.score.free && fb.score.verdict !== 'correct' && !fb.dontKnow && !fb.override;
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (typedWrong && !held) menu.override = override;
    menu.report = () => {
      logWarn('c1x:report', { message: 'Aufgabe gemeldet (lokal, nur im Protokoll)' }, item.id);
      toast(t('cxReported'));
    };
    const tutor =
      // Nur EIN KI-Einstieg je Karte (Kap. 15): bei „Claude fragen“ kein „Erklär mir meine Antwort“ daneben.
      fb.dontKnow || fb.score.verdict === 'correct' || fb.override || action === 'askAi' ? null : (
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
      ...(fb.alt && !fb.override ? { title: t('exAlsoRight') } : head?.title ? { title: head.title } : {}),
      sub: fb.alt && !fb.override ? altSub : sub,
      // Fehler finden: die Muster-Fachsprache steht unter „Mehr“, das Kontrastbeispiel (z. B. -ing gegen -ed) offen (Rückmeldung 7).
      ...(item.kind === 'err' ? { fold: ['pattern'] as const, unfold: fb.alt && !fb.override ? (['contrast', 'note'] as const) : (['contrast'] as const) } : fb.alt && !fb.override ? { unfold: ['note'] as const } : {}),
      explanation: model,
      depth,
      menu,
      tutor,
      parts: createElement(ResultParts, { score: fb.score }),
      right: item.kind === 'err' ? null : (ui.right ?? null),
      after: createElement(ResultAfter, { item, matched, day }),
      act: createElement(JudgeFoot, {
        action,
        aiMsg: fb.aiMsg ?? null,
        aiNoWhy: fb.aiNoWhy ?? null,
        busy: fit.busy,
        phase: fit.phase,
        onAsk: askNow,
        onSkip: fit.skip,
        onCounts: counts,
        want: pattern ? null : wanted,
        form: wanted,
        target: fb.target ?? null,
        onTarget: tryTarget,
      }),
      auto: !noAuto && fb.help === 0 && !fb.override && fb.score.free && !fb.alt && rawAction === 'next' && !fb.aiMsg,
    };
  }

  const primary = fb ? { label: t('exNext'), onClick: next, testId: 'next' } : { label: fit.busy ? t('exChecking') : t('exCheck'), onClick: submit, testId: 'check', disabled: !has || fit.busy };
  const aiMark: ReactNode = item.src === 'ai' ? createElement('p', { className: 'lx-t-meta text-muted', 'data-testid': 'ai-mark' }, t('cxAiMark')) : null;
  // Die Muster-Karte vor dem Prüfen entfällt am Handy: sie verdrängte die Bausteine unter den Bildschirmrand und verriet die Formel (UX-Prüfung R1).
  const aid: ReactNode = [ui.aid, aiMark].some(Boolean) ? createElement('div', { className: 'flex flex-col gap-2' }, ui.aid, aiMark) : null;

  const learnLine = learning && pattern ? { topic: topicLabel, pattern: lang === 'de' ? pattern.name.de : pattern.name.en } : { topic: null, pattern: null };
  void nonEmpty;

  const shell: ExerciseShellProps = {
    meta: { ex: `c1_${item.kind}`, id: `${task.topic}|${task.key}`, kind: item.kind },
    status: { area: 'grammar', state, kindLabel: t(`cxKindName_${item.kind}` as MessageKey), topic: learnLine.topic, pattern: learnLine.pattern, badge, ...(badgeTone ? { badgeTone } : {}), noInfo: noHelp },
    task: { text: ui.task ?? t(`cxTask_${item.kind}` as MessageKey), purpose: t('cxPurpose') },
    aid,
    prompt: ui.prompt,
    answer: fit.phase === 'slow' && !fb ? createElement('div', { className: 'flex flex-col gap-3' }, ui.answer, createElement(FitSlow, { phase: fit.phase, onSkip: fit.skip })) : ui.answer,
    hint,
    secondary,
    primary,
    feedback,
    // UX-Prüfung W4: rechts vor dem Prüfen nur „Erst selbst entscheiden …“ (Platzhalter des Gerüsts), die Regel nur als Tipp.
    side: null,
  };
  return shell;
}
