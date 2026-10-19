import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useSharedTarget } from '../../engine/shared';
import { useLive } from '../../data/live';
import { alignWords, splitWords } from '../../domain/answer/align';
import { maskOf } from '../../domain/answer/mask';
import { topicById } from '../../domain/content';
import type { ExplainDepth, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { topicP } from '../../domain/grammar/bkt';
import { asAlsoRight, checkFind, checkGrammar, checkMeaning } from '../../domain/grammar/check';
import { shortWhy } from '../../domain/grammar/alsoRight';
import { grammarExplanation } from '../../domain/grammar/explain';
import { patternOf } from '../../domain/grammar/patterns';
import { topicState } from '../../domain/grammar/path';
import { formHint } from '../../domain/grammar/rules';
import { grammarRetryHint, type GrammarRetryHint } from '../../domain/grammar/retryHint';
import { scaffolded, splitTransform, wholeSentence, type InputProfile } from '../../domain/grammar/tasks';
import { learnGrade } from '../../domain/learn/grade';
import type { Ctx, GrammarAnswer, GrammarCheck, GrammarTask, Help, Verdict } from '../../domain/learn/types';
import { patsOf, patternState } from '../../domain/metrics/pattern';
import type { Grade } from '../../domain/srs/types';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset, type GapState } from '../../engine/KineticGap';
import { SpotSentence } from '../../engine/SpotSentence';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup, type WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { inputProfile } from '../../platform/input';
import { TutorButton } from '../../ui/exercise/TutorButton';
import { ExerciseShell, SentenceInput, explainDepth, findHead, markSpans, type ShellFeedback, type ShellMenuId, type ShellSecondary } from '../../ui/exercise';
import { useCompanionSee } from '../companion/seeing';
import { nextT } from '../progress/persist';
import { abandonFit, fitAiState, runFit, useFitJudge, type FitResult } from './fit';
import { FitSlow } from './FitSlow';
import { JudgeFoot, type AiMsg, type TargetState } from './JudgeFoot';
import { judge, readFitAlt, type Judgement } from '../../domain/tutor/judge';
import { composeFeedback, contrastProof, type FeedbackAction } from '../../domain/tutor/feedback';
import { factOf, maxHint, miniLesson } from '../../domain/tutor/policy';
import { tutorPreview } from '../tutor/sessionStore';
import type { Diagnosis } from '../../domain/tutor/diagnose';
import type { Verdict as TutorVerdict } from '../../domain/tutor/tutorTypes';
import { legacyNorm } from '../../domain/grammar/key';
import { GRAMMAR_FIT_PV, type GrammarFitOut, type GrammarFitVars } from '../../prompts/grammarFit';
import { learnerNow, lintOnce, scheduleLearner } from '../tutor/learnerLive';
import { logWarn } from '../../platform/diagnostics';
import { isC1Task } from '../../domain/c1x/runtime';
import { C1Item } from '../c1x/C1Item';
import { TopicSheet } from './GrammarScreen';
import { filmFor } from '../../domain/c1/anim';
import { FilmSheet, filmEnabled } from '../c1/film/FilmLauncher';

// Eine Grammatikaufgabe im Übungsgerüst (Lernplattform 2.0 §5.2). Das Gerüst (`ExerciseShell`) zeichnet Status, Aufgabenzeile, Satz,
// Eingabe, Urteil, Vergleich und die Erklär-Karte; diese Datei sammelt nur Eingabe und Prüfung je Aufgabenart:
//   mc · meaning → `Choices` A–D (Auswahl, dann „Prüfen“)     gap · transform mit Lücke → `KineticGap` in der Lücke
//   kwt          → breite Lücke, Schlüsselwort als Chip        find → Wort antippen (`SpotSentence`), dann nur die Stelle ersetzen
//   correct · ganze Umformung → `SentenceInput` (nur Tastatur; am Handy wird `correct` zu `find`)
// Keine Selbstbewertung: die Note folgt aus Richtigkeit, Zeit und Hilfe. Die Erklärung kommt aus dem Muster der Aufgabe
// (`grammarExplanation`); ohne Musterdatei steht nur die aufgabeneigene Erklärung da, nie ein Zufallsbeispiel.

type Next = 'typed' | 'choice' | null | void;

export type GrammarItemProps = {
  task: GrammarTask;
  ctx: Ctx;
  day: string;
  onDone: (a: GrammarAnswer) => Next;
  area?: WordTapArea;
  /** Zusatz in der Statuszeile (z. B. „Deine Fehler“, „Kurztest 1/2“). */
  badge?: string | null;
  /** Farbe des Zusatzes (`hint` = neutral-cyan, z. B. „Themen-Test“); Standard Bernstein. */
  badgeTone?: 'near' | 'hint';
  /** Wochen-Check und Vortest (M10): ohne Tipp, ohne Platzhalter und ohne Zweitversuch – es wird gemessen, nicht geholfen. */
  noHelp?: boolean;
  /** Eingabeprofil der Runde (einmal eingefroren). Ohne Angabe das des Geräts. */
  profile?: InputProfile;
  /** Themenrunde oder Einführung: die Musterkarte steht offen. */
  topicRound?: boolean;
  /** Grammatikrunde mit Tutor-Engine (S3): nach 2 Fehlern gleicher Ursache kommt statt der Rückmeldung die Mini-Lektion. */
  tutor?: boolean;
};

type Fb = {
  verdict: Verdict;
  check: GrammarCheck | null;
  given: string;
  /** Auswahl: der gewählte Text bzw. a/b/both; „Fehler finden“: das angetippte Wort oder `none`. */
  picked?: string;
  tapped?: string;
  /** „Fehler finden“, „Weiß ich nicht“ nach gefundener Stelle: das getippte Wort (nur für den Kopf der Rückmeldung, nicht gebucht). */
  spot?: string;
  dontKnow: boolean;
  grade: Grade;
  ms: number;
  help: Help;
  judged: GrammarAnswer['judged'];
  unsure: boolean;
  override: boolean;
  /** Begründung von Claude bei „Auch richtig“ (nur Anzeige). */
  aiWhy?: string;
  /** Tutor-Engine v3: Urteil (c/a/n/w/u im Protokoll), wer es gefällt hat, ob das Zielmuster getroffen ist, Diagnose. */
  tv: TutorVerdict;
  by: 'local' | 'ai' | 'me';
  fitsGoal: boolean | null;
  dx: Diagnosis | null;
  /** Begründung einer anderen gültigen Korrektur (`errAlt`, Sprache gewählt). */
  altWhy?: string;
  /** „Claude fragen“ wird angeboten (lokal abgelehnt oder unsicher, Claude nutzbar, nicht automatisch gefragt). */
  ask: boolean;
  /** Ruhige Zeile zum Urteil von Claude bzw. zu seinem Fehler (§6.4). */
  aiMsg?: AiMsg | null;
  aiNoWhy?: string | null;
  /** Gelernte Antwort für `fitAlt` (Claudes Ja `ai`, Emrahs Einspruch oder „Zählt“ `me`). */
  fit?: { by: 'ai' | 'me'; pv: string; a: string };
  /** Zweitversuch „Zielform“ (nach „Auch richtig“ mit anderem Muster). */
  target?: TargetState;
};

/** Urteil der Tutor-Engine → Protokollfeld `v`. */
const TJ_V: Record<TutorVerdict, 'c' | 'a' | 'n' | 'w' | 'u'> = { correct: 'c', alt_ok: 'a', near: 'n', wrong: 'w', unsure: 'u' };


/** Uhr (eigene Funktion, damit die Zeitnahme nie als Teil des Zeichnens gilt). */
const tick = (): number => performance.now();
const GAP = /_{3,}/;
const MEANING_KEYS = ['a', 'b', 'both'] as const;
/** „Ohne Hilfe“ im Vortest: jede Antwort in höchstens 20 s (§5.3). */
const nonEmpty = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

/**
 * Eine Grammatikaufgabe. Aufgaben des Aufgabensystems c1x (`task.c1`, Lernplattform 3.0) zeichnet `C1Item` im selben Gerüst;
 * alle anderen die bisherige Oberfläche (`LegacyGrammarItem`).
 */
export function GrammarItem(props: GrammarItemProps) {
  const { task } = props;
  return isC1Task(task) ? <C1Item {...props} task={task} /> : <LegacyGrammarItem {...props} />;
}

function LegacyGrammarItem({ task, ctx, day, onDone, area = 'trainer', badge = null, badgeTone, noHelp = false, profile: profileProp, topicRound = false, tutor: tutorOn = false }: GrammarItemProps) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const [profile] = useState<InputProfile>(() => profileProp ?? inputProfile());
  const doc = useLive((s) => s.collections.grammar?.get(task.topic));
  const [pStart] = useState(() => topicP(task.topic, doc, now));
  const p = topicP(task.topic, doc, now);
  const pattern = useMemo(() => patternOf(task), [task]);
  // Bei Claude-Aufgaben entscheidet der Anzeige-Wächter (`patternOf`), nicht das gespeicherte `pat`.
  const patId = task.src === 'ai' ? (pattern?.id ?? null) : (task.pat ?? pattern?.id ?? null);
  const patEntry = patId ? patsOf(doc)[patId] : undefined;
  // Lernphase: die ersten 3 Antworten auf ein Muster und jede Themenrunde (§5.1). Dann steht die Musterkarte offen.
  const learning = !!pattern && (topicRound || (patEntry?.n ?? 0) < 3);
  const state = patId && pattern ? patternState(patEntry, day) : topicState(task.topic, doc, now);
  const tp = topicById(task.topic);
  const topicLabel = tp ? (lang === 'en' ? (tp.name_en ?? tp.name) : tp.name) : task.topic;

  const type = task.type;
  const choiceType = type === 'mc' || type === 'meaning';
  const findTask = type === 'find';
  const err = task.x?.kind === 'find' ? task.x.err : null;
  const whole = wholeSentence(task);
  const wordsOfPrompt = useMemo(() => (findTask ? splitWords(task.prompt) : []), [findTask, task.prompt]);

  const [fb, setFb] = useState<Fb | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2 | 3>(0);
  const [retry, setRetry] = useState<GrammarRetryHint | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [text, setText] = useState(type === 'correct' ? task.prompt : '');
  // „Fehler finden“: Schritt 1 (Stelle antippen) → Schritt 2 (nur die Stelle ersetzen).
  const [stage, setStage] = useState<'locate' | 'replace'>('locate');
  const [tapped, setTapped] = useState<[number, number] | null>(null);
  // Die Stelle, die ersetzt wird: die Fehlerstelle oder eine andere gültige (`errAlt`, z. B. der Hauptsatz bei „Walking …“).
  const [activeErr, setActiveErr] = useState<[number, number] | null>(null);
  const [locateMisses, setLocateMisses] = useState(0);
  const [copyOpen, setCopyOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Menü ⋯ „Zeig es mir“ (P61): der Struktur-Film zum Muster der Aufgabe, falls es einen gibt.
  const [filmOpen, setFilmOpen] = useState(false);
  const film = filmEnabled() ? filmFor(task.topic, patId) : null;
  const firstWrong = useRef<string | null>(null);
  const fit = useFitJudge();
  const typed = useRef('');
  const shownAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const lookupAt = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  // Kap. 4.4: Die Heldenkarte von Heute gleitet in die erste Aufgabe (nur direkt nach dem Start).
  const { ref: sharedRef, shared } = useSharedTarget<HTMLDivElement>('lx-hero');

  useEffect(() => {
    shownAt.current = performance.now();
    lookupAt.current = lookupOpenMs();
    const a = document.activeElement;
    if (!a || a === document.body) root.current?.focus({ preventScroll: true });
  }, []);
  // Tutor-Engine v3: Aufgaben-Prüfung als Warnzähler (§4.2) und Lernermodell zum Rundenstart (§3.1, verzögert).
  useEffect(() => {
    lintOnce(task);
    if (!learnerNow()) scheduleLearner();
  }, [task]);
  const hasFb = fb !== null;
  useEffect(() => {
    if (hasFb) scheduleLearner();
  }, [hasFb]);

  const solution = task.answer;
  // Fehler finden an einer anderen gültigen Stelle: deren Lösung (für Anzeige und Claude).
  const errSpan: [number, number] | null = activeErr ?? err;
  const errAltHere = findTask && activeErr && err && (activeErr[0] !== err[0] || activeErr[1] !== err[1]) ? ((task.x?.kind === 'find' ? task.x.errAlt : undefined)?.find((a) => a.err[0] === activeErr[0] && a.err[1] === activeErr[1]) ?? null) : null;
  const spotAnswer = errAltHere ? errAltHere.answer : solution;
  const typedKind = !choiceType && !findTask;
  const gapKind = typedKind && !whole && (type === 'gap' || type === 'transform' || type === 'kwt');
  const scaff = type === 'gap' && scaffolded(pStart) && !noHelp;
  const maskShown = gapKind && type !== 'kwt' && (scaff || tip >= 3);
  const mask = maskShown ? maskOf(solution, { firstLetter: tip >= 3 }) : null;
  // Jede Stufe der Tipp-Leiter zählt als Hilfe: H1 (Leitfrage) bis „Gut“, H2 (Formel) und H3 (erster Buchstabe) bis „Schwer“; der Zweitversuch wie H2/H3.
  const help: Help = { level: tip >= 2 || retry ? 2 : tip >= 1 ? 1 : 0 };

  useCompanionSee({
    area: 'grammar',
    label: `${t('grTitle')} · ${topicLabel}`,
    phase: fb ? 'feedback' : 'question',
    detail: task.options?.length ? `${task.prompt}\n${task.options.join(' / ')}` : task.prompt,
    ...(fb ? { reveal: `Solution: ${solution}. Learner: ${fb.given || '(empty)'}` } : { mask: [solution, ...task.accepted] }),
  });

  const elapsed = () => Math.max(0, Math.round(performance.now() - shownAt.current - (lookupOpenMs() - lookupAt.current)));
  const hintVisible = !!task.hint && (task.prompt.includes(task.hint) || type === 'gap' || type === 'transform');

  // ------------------------------------------------------------------ Prüfen

  const finishCheck = (verdict: Verdict, check: GrammarCheck | null, given: string, extra: Partial<Fb> = {}) => {
    // Erster Versuch falsch → Leitfrage statt Lösung; die Eingabe bleibt stehen. Nicht bei Auswahl, nicht im Wochen-Check, nicht bei „nicht sicher prüfbar“.
    if (verdict === 'wrong' && !retry && !noHelp && !choiceType && !extra.unsure) {
      firstWrong.current = given;
      setRetry(grammarRetryHint(task, tp ? topicLabel : null, hintVisible, { task, given, lang, ...(extra.tapped ? { tapped: extra.tapped } : {}) }));
      if (whole || type === 'correct') root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
      else api.focusNow();
      return;
    }
    // Zeit: Gesamtzeit ab dem Einblenden über beide Versuche; bei „Fehler finden“ ab dem Fund der Stelle (§4.10).
    const ms = elapsed();
    const firstKeyMs = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current));
    const grade = learnGrade(type, verdict, { submitMs: ms, firstKeyMs }, help, profile);
    const tv: TutorVerdict = verdict === 'correct' ? (check?.kind === 'other' ? 'alt_ok' : 'correct') : verdict;
    setFb({ verdict, check, given, dontKnow: false, grade, ms, help, judged: 'local', unsure: false, override: false, tv, by: 'local', fitsGoal: null, dx: null, ask: false, ...extra });
    if ((gapKind || findTask) && profile === 'touch') api.blur();
  };

  /** Felder der Rückmeldung aus dem Urteil der Tutor-Engine. */
  const fromJudge = (j: Judgement): Partial<Fb> => ({
    tv: j.v,
    by: j.by,
    fitsGoal: j.fitsGoal,
    dx: j.dx,
    ask: j.askAi === 'button',
    ...(j.altWhy ? { altWhy: lang === 'de' ? j.altWhy.de : j.altWhy.en } : {}),
  });

  /** Claudes Ja: „Auch richtig“ (Art `other`), gebucht ohne Beleg; gemerkt in `fitAlt` beim Buchen. */
  const aiYes = (out: GrammarFitOut, given: string): Partial<Fb> => ({
    judged: 'ai',
    aiWhy: lang === 'de' ? out.why.de : out.why.en,
    tv: 'alt_ok',
    by: 'ai',
    fitsGoal: out.fitsGoal,
    unsure: false,
    ask: false,
    aiMsg: null,
    fit: { by: 'ai', pv: GRAMMAR_FIT_PV, a: given.trim() },
  });

  /** Kein Ja von Claude: Meldung je Fehlerart (§6.4). `null` = übersprungen oder abgebrochen (das lokale Urteil bleibt, der Knopf auch). */
  const aiNotYes = (r: FitResult | null, wasAsk: boolean): Partial<Fb> => {
    if (!r) return { ask: wasAsk };
    if (r.out) return { ask: false, aiMsg: r.out.fits ? 'unsure' : 'no', aiNoWhy: r.out.fits ? null : lang === 'de' ? r.out.why.de : r.out.why.en };
    switch (r.err) {
      case 'busy':
      case 'signin':
      case 'retry':
        return { ask: true, aiMsg: r.err };
      case 'off':
        logWarn('grammar:fit', { message: 'Claude nicht verfügbar' }, task.key);
        return { ask: false, aiMsg: null };
      case 'final':
      case 'bug':
      case 'limit':
        return { ask: false, aiMsg: r.err };
      default:
        return { ask: wasAsk };
    }
  };

  /** Eingaben für `grammar-fit@2` zu einer Antwort (Lücke, Umformung, Schlüsselwort, ganzer Satz oder Ersatz der Stelle). */
  const fitVars = (given: string): GrammarFitVars => {
    const common = {
      topic: topicLabel,
      pattern: pattern ? pattern.name.en : null,
      rule: pattern ? pattern.form.en : null,
      goal: task.goal ? task.goal.en : null,
      accepted: [...task.accepted, ...(task.alt ?? [])].slice(0, 6),
      given: given.trim(),
      uiLang: lang,
    };
    if (findTask && errSpan) {
      const whole2 = (fill: string): string => [...wordsOfPrompt.slice(0, errSpan[0]), fill.trim(), ...wordsOfPrompt.slice(errSpan[1] + 1)].filter(Boolean).join(' ');
      return { ...common, accepted: errAltHere ? [...errAltHere.accepted].slice(0, 6) : common.accepted, mode: 'replace', task: task.prompt, sentence: whole2(given), expected: whole2(spotAnswer) };
    }
    if (whole || type === 'correct') return { ...common, mode: 'transform', task: task.prompt, sentence: given.trim(), expected: solution };
    const base = type === 'transform' ? (task.prompt.split('→').pop() ?? '').trim() : task.prompt;
    const full = (fill: string): string => base.replace(GAP, fill.trim());
    return { ...common, mode: type === 'kwt' ? 'kwt' : type === 'transform' ? 'transform' : 'gap', task: base, sentence: full(given), expected: full(solution) };
  };

  /**
   * Urteil der Tutor-Engine für eine getippte Antwort (§2.1): „Auch richtig“ zuerst (Lösung, Familien, `alt`, `fitAlt`, `errAlt`), dann die
   * Diagnose. Unsicher → automatisch Claude nur mit `sampleConfirmed` und Tagesbremse, sonst `near` mit Knopf „Claude fragen“ (ohne KI ohne Knopf).
   */
  const settleTyped = (given: string, word?: string): void => {
    const j = judge(task, given, { fitAlt: readFitAlt(doc), aiState: fitAiState(), model: learnerNow(), ...(findTask && errSpan ? { tapped: errSpan } : {}) });
    const res = j.check;
    const at = word !== undefined ? { tapped: word } : {};
    const jx = fromJudge(j);
    if (j.v === 'correct') {
      // Gültige andere Korrektur (`errAlt`) oder Emrahs früherer Einspruch (`fitAlt` by me): richtig, voll gebucht.
      const check: GrammarCheck = res.verdict === 'correct' ? res : { ...res, verdict: 'correct', ...(j.altWhy ? { kind: 'alt' as const } : {}) };
      finishCheck('correct', check, given, { ...jx, ...at, ...(j.by === 'me' ? { aiMsg: 'byMe' as const } : {}) });
      return;
    }
    if (j.v === 'alt_ok') {
      // Lokal (`alt`, Familie) oder Claudes früheres Ja (`fitAlt` by ai, ohne neuen Aufruf).
      finishCheck('correct', j.by === 'ai' ? asAlsoRight(res) : res, given, { ...jx, ...at, ...(j.by === 'ai' ? { judged: 'ai' as const } : {}) });
      return;
    }
    if (j.v === 'near') {
      finishCheck('near', res, given, { ...jx, ...at });
      return;
    }
    if (j.v === 'unsure') {
      const local = (r: FitResult | null): void => finishCheck('near', res, given, { ...jx, ...at, judged: 'noai', unsure: true, ...aiNotYes(r, j.askAi !== 'no') });
      if (j.askAi === 'auto') {
        runFit(fit.ctl, fit.judge(`${task.topic}|${task.key}`, fitVars(given)), (out) => finishCheck('correct', asAlsoRight(res), given, { ...jx, ...at, ...aiYes(out, given) }), local);
        return;
      }
      finishCheck('near', res, given, { ...jx, ...at, judged: 'noai', unsure: true });
      return;
    }
    finishCheck('wrong', res, given, { ...jx, ...at });
  };

  /** „Claude fragen“ nach der Rückmeldung (Knopf, auch „Erneut versuchen“): stuft nur hoch, nie herunter. */
  const askNow = (): void => {
    if (!fb || fit.busy || fit.ctl.current) return;
    const given = fb.given;
    const refresh = fb.aiMsg === 'retry';
    const wasCheck = fb.check;
    runFit(
      fit.ctl,
      fit.judge(`${task.topic}|${task.key}`, fitVars(given), { refresh }),
      (out) => setFb((cur) => (cur ? { ...cur, verdict: 'correct', check: asAlsoRight(wasCheck ?? { verdict: 'wrong', ops: [], needsJudge: false }), ...aiYes(out, given) } : cur)),
      (r) => setFb((cur) => (cur ? { ...cur, ...aiNotYes(r, true) } : cur)),
    );
  };

  const submit = () => {
    if (fb || fit.ctl.current) return;
    if (choiceType) {
      if (chosen === null) return;
      if (type === 'mc') {
        const opt = (task.options ?? [])[chosen] ?? '';
        finishCheck(checkGrammar(task, opt).verdict, checkGrammar(task, opt), opt, { picked: opt });
      } else {
        const pick = MEANING_KEYS[chosen] ?? 'a';
        const res = checkMeaning(task, pick);
        finishCheck(res.verdict, res, pick, { picked: pick });
      }
      return;
    }
    if (findTask) {
      if (stage === 'locate') {
        if (!tapped) return;
        const res = checkFind(task, { tapped });
        if (res.found && err) {
          // Stelle gefunden (auch eine andere gültige Stelle, `errAlt`): weiter mit dem Ersatz. Die Zeit zählt ab hier.
          setActiveErr(res.altErr ?? err);
          setStage('replace');
          shownAt.current = tick();
          firstKeyAt.current = null;
          lookupAt.current = lookupOpenMs();
          typed.current = '';
          api.focusNow();
          return;
        }
        if (res.found) {
          // (err === null kann hier nicht gefunden werden – nur „Kein Fehler“.)
          return;
        }
        missLocate(wordsOfPrompt.slice(tapped[0], tapped[1] + 1).join(' '), res);
        return;
      }
      const given = typed.current;
      // Ein Wort zu viel (Ersatz leer, `checkFind` wertet leer dann als richtig): leer prüfen ist hier die Lösung. Vorher blieb „Prüfen“ wirkungslos (Altbefund grammarPatterns, Profil touch).
      if (!given.trim() && spotAnswer.trim()) return;
      settleTyped(given, tappedWord());
      return;
    }
    let given: string;
    if (whole || type === 'correct') given = text;
    else {
      given = typed.current;
      if (tip >= 3 && mask) {
        const first = mask[0];
        if (first?.kind === 'slot' && first.hint && hintOffset(mask, given) === 1) given = first.hint + given;
      }
    }
    if (!given.trim()) return;
    settleTyped(given);
  };

  const tappedWord = (): string | undefined => (tapped ? wordsOfPrompt.slice(tapped[0], tapped[1] + 1).join(' ') : undefined);

  /** Stelle verfehlt (oder „Kein Fehler“ bei einem Satz mit Fehler): erst Leitfrage und ein zweiter Versuch, dann die Auflösung. */
  const missLocate = (word: string, res: GrammarCheck) => {
    if (locateMisses < 1 && !noHelp) {
      setLocateMisses(1);
      setRetry(grammarRetryHint(task, tp ? topicLabel : null, false, { task, tapped: word, lang }));
      setTapped(null);
      return;
    }
    const ms = elapsed();
    finishCheck('wrong', res, word, { tapped: word, grade: 1, ms, help });
  };

  const noError = () => {
    if (fb || !findTask) return;
    const res = checkFind(task, { tapped: 'none' });
    if (res.verdict === 'correct') finishCheck('correct', res, '', { tapped: 'none', picked: 'none' });
    else missLocate('none', res);
  };

  const dontKnow = () => {
    if (fb) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    const spot = findTask && stage === 'replace' ? tappedWord() : undefined;
    setFb({ verdict: 'wrong', check: null, given: '', dontKnow: true, grade: 1, ms: elapsed(), help, judged: 'local', unsure: false, override: false, tv: 'wrong', by: 'local', fitsGoal: null, dx: null, ask: false, ...(spot ? { spot } : {}) });
    api.blur();
  };

  /** „Ich lag richtig“: zählt allein auf Emrahs Tipp (§1 Frage 4) und wird für diese Aufgabe gemerkt (`fitAlt` by me). */
  const override = () => {
    if (!fb) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    setFb({ ...fb, verdict: 'correct', grade: Math.min(3, Math.max(2, fb.grade)) as Grade, override: true, tv: 'correct', by: 'me', ask: false, aiMsg: 'byMe', ...(fb.given.trim() && !fb.dontKnow ? { fit: { by: 'me' as const, pv: GRAMMAR_FIT_PV, a: fb.given.trim() } } : {}) });
  };

  /** „Zählt“ (Claude: das Zielmuster in anderer Form): wie „Ich lag richtig“, dann voll gebucht. */
  const counts = () => {
    if (!fb) return;
    setFb({ ...fb, verdict: 'correct', grade: Math.min(3, Math.max(2, fb.grade)) as Grade, override: true, tv: 'correct', by: 'me', ask: false, aiMsg: 'byMe', fit: { by: 'me', pv: GRAMMAR_FIT_PV, a: fb.given.trim() } });
  };

  /** Zielform-Zweitversuch nach „Auch richtig“ mit anderem Muster: die App bewertet selbst (ohne Claude), halbes Gewicht beim Buchen. */
  const tryTarget = (value: string) => {
    if (!fb || fb.target) return;
    const j = judge(task, value, { fitAlt: {}, aiState: { available: false, confirmed: false, budgetLeft: 0 }, targetRetry: true, ...(findTask && errSpan ? { tapped: errSpan } : {}) });
    const ok = j.v === 'correct' || j.v === 'near' || (j.v === 'alt_ok' && j.kind === 'alt');
    setFb({ ...fb, target: { given: value.trim(), ok } });
  };

  const next = () => {
    if (!fb) return;
    if (fit.ctl.current) {
      abandonFit(fit.ctl);
      fit.cancel();
    }
    const tj: GrammarAnswer['tj'] = {
      v: TJ_V[fb.tv],
      ...(fb.dx && fb.dx.cause !== 'unknown' ? { h: fb.dx.cause } : {}),
      ...(fb.dx?.known && fb.dx.vs && fb.tv === 'wrong' ? { vs: fb.dx.vs } : {}),
    };
    const alt = fb.check?.kind === 'other' && !fb.override;
    const sameAsFirst = firstWrong.current !== null && legacyNorm(firstWrong.current) === legacyNorm(fb.given);
    const a: GrammarAnswer = fb.target?.ok
      ? {
          // Zielform im Zweitversuch richtig: halbes Gewicht (Hilfe-Stufe 1), ohne `firstWrong`, nicht mehr „Auch richtig“.
          kind: 'g',
          t: nextT(),
          day,
          lang,
          ctx,
          task,
          given: fb.target.given,
          dontKnow: false,
          verdict: 'correct',
          grade: 2,
          ms: fb.ms,
          help: { level: 1 },
          judged: 'local',
          dev: profile === 'touch' ? 't' : 'k',
          tj: { v: 'c' },
          ...(fb.fit ? { fit: fb.fit } : {}),
        }
      : {
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
          ...(alt ? { alt: true } : {}),
          dev: profile === 'touch' ? 't' : 'k',
          ...(fb.override ? { override: true } : {}),
          ...(retry && firstWrong.current !== null && !(alt && sameAsFirst) ? { firstWrong: firstWrong.current } : {}),
          tj,
          ...(fb.fit ? { fit: fb.fit } : {}),
        };
    const kind = onDone(a);
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };

  const primaryGo = () => {
    if (fb) next();
    else submit();
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (!choiceType || chosen !== null) submit();
      },
    },
    api.isInput,
  );

  // ------------------------------------------------------------------ Erklärung

  const picked = fb?.picked;
  // Rückmeldung der Tutor-Engine (§5, `composeFeedback`): Ziel → Urteil (Kopf) → seine Form → Grund → höchstens ein Extra → Handlung.
  const composed: { model: ExplanationModel; action: FeedbackAction; lesson: boolean } | null = useMemo(() => {
    if (!fb) return null;
    const verdict: ResultVerdict = fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.verdict === 'correct' ? 'ok' : fb.verdict === 'near' ? 'near' : 'wrong';
    const m0 = tighten(grammarExplanation({ task, verdict, given: fb.given, ...(picked !== undefined ? { picked } : {}), ...(fb.tapped !== undefined && !(findTask && stage === 'replace') ? { tapped: fb.tapped } : {}), lang, learning }));
    // „Auch richtig“ zählt nur bei Art `other` als solches; eine lokale Familie (`alt`) und `errAlt` sind richtig (voll gebucht).
    const v: TutorVerdict = fb.override ? 'correct' : fb.tv === 'alt_ok' && fb.check?.kind !== 'other' ? 'correct' : fb.tv;
    const out = composeFeedback({
      base: m0,
      v,
      by: fb.by,
      fitsGoal: fb.fitsGoal,
      dontKnow: fb.dontKnow,
      override: fb.override,
      dx: fb.dx,
      pat: patId,
      hyps: learnerNow()?.hyps ?? [],
      aiWhy: fb.aiWhy ?? null,
      altWhy: fb.altWhy ?? null,
      askAi: fb.ask ? 'button' : 'no',
      targetTried: !!fb.target || noHelp,
      texts: { altNoCount: t('grAltNoCount') },
    });
    const m = out.model;
    // Tutor-Engine (S3, Rang 3): zweiter Fehler mit derselben Ursache am selben Muster → Mini-Lektion statt Abfrage (Vorschau; gebucht wird mit „Weiter“).
    if (tutorOn && pattern && fb.verdict === 'wrong' && !fb.override) {
      const fact = factOf(
        { task, verdict: fb.verdict, dontKnow: fb.dontKnow, ...(fb.dx && fb.dx.cause !== 'unknown' ? { tj: { v: 'w' as const, h: fb.dx.cause } } : {}) },
        task.errorT === null,
      );
      const model0 = learnerNow();
      if (tutorPreview(fact, model0).move === 'explain') {
        const mini = miniLesson(pattern, contrastProof(fb.dx, patId, model0?.hyps ?? []), lang);
        const goal = m.lines.filter((l) => l.k === 'pattern').slice(0, 1);
        return { model: { ...m, lines: [...goal, ...mini.lines], examples: mini.examples, ai: false }, action: 'next' as const, lesson: true };
      }
    }
    // „Kein Fehler“ gewählt (intern 'none'): in „Deine Antwort“ steht der Name des Knopfs, nicht das Rohwort.
    const model = fb.picked === 'none' || fb.tapped === 'none' ? { ...m, lines: m.lines.map((l) => (l.k === 'yours' && l.given === 'none' ? { ...l, given: t('exNoError') } : l)) } : m;
    return { model, action: out.action, lesson: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, lang, learning, task, findTask, stage, patId, noHelp, tutorOn]);
  const lesson = composed?.lesson ?? false;
  const model = composed?.model ?? null;

  const rv: ResultVerdict = !fb ? 'ok' : fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.verdict === 'correct' ? 'ok' : fb.verdict === 'near' ? (fb.unsure ? 'near' : 'near') : 'wrong';
  const depth: ExplainDepth = explainDepth({ verdict: rv, p, learning });

  // ------------------------------------------------------------------ Hinweise (Tipp-Leiter und Zweitversuch)

  const tipText = (): string => {
    if (tip === 1) return pattern ? `${t('gxHintPattern')}: ${lang === 'de' ? pattern.nudge.de : pattern.nudge.en}` : formHint(task, lang);
    if (tip >= 2) return pattern ? `${t('gxHintFormula')}: ${lang === 'de' ? pattern.form.de : pattern.form.en}` : (task.hint ?? formHint(task, lang));
    return '';
  };
  const retryText = (r: GrammarRetryHint): string => (r.kind === 'nudge' ? r.text : r.kind === 'hint' ? t('rhGrammarHint', { hint: r.text }) : r.kind === 'topic' ? t('rhGrammarTopic', { topic: r.name }) : t('rhGrammarVerb'));
  const hint = fb ? null : retry ? { text: retryText(retry), tone: 'near' as const } : tip > 0 && tipText() ? { text: tipText(), tone: 'hint' as const } : null;

  // Hinweisleiter (Tutor-Engine, Rang 1): Leitfrage → Formel → erster Buchstabe (nur bei Lücken).
  const maxTip = maxHint(task);
  const canTip = !noHelp && !retry && !fb && tip < maxTip && !(findTask && stage === 'locate');
  const secondary: ShellSecondary[] = [
    ...(findTask && stage === 'locate' ? [{ id: 'noError' as const, label: t('exNoError'), onClick: () => noError(), testId: 'no-error' }] : []),
    ...(canTip ? [{ id: 'hint' as const, label: t('exHint'), onClick: () => moreTip(), testId: 'hint' }] : []),
    { id: 'dontKnow' as const, label: t('exDontKnow'), onClick: () => dontKnow(), testId: 'dont-know' },
  ];
  function moreTip(): void {
    setTip((v) => Math.min(3, v + 1) as 1 | 2 | 3);
    if (!choiceType && !findTask) api.focusNow();
  }

  // ------------------------------------------------------------------ Satz und Eingabe

  const src = { area, source: `grammar/${task.topic}` };
  const gapState: GapState = !fb ? 'input' : fb.verdict;
  const gapReveal = fb && fb.verdict === 'wrong' && gapKind ? { solution, given: fb.given.trim() ? fb.given : null } : null;
  const gapNode = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={Math.max(40, solution.length + 16)}
      state={gapState}
      mask={mask}
      shown={fb ? fb.given : null}
      reveal={gapReveal}
      silent
      busy={fit.busy}
      onChange={(v, info) => {
        typed.current = v;
        if (info.firstKey && firstKeyAt.current === null) firstKeyAt.current = performance.now();
      }}
      onEnter={() => primaryGo()}
    />
  );
  // Signalwort des Musters leuchtet bei Tipp 1 im Satz auf.
  const lit = (sentence: string): [number, number] | null => {
    const sp = tip >= 1 && pattern && !fb ? markSpans(sentence, pattern.signals)[0] : undefined;
    return sp ? [sp[0], sp[1]] : null;
  };
  const sentenceWithSlot = (sentence: string, slot: ReactNode) => {
    const m = GAP.exec(sentence);
    if (!m) return <EnglishText as="p" text={sentence} {...src} />;
    const hl = lit(sentence);
    return <EnglishText as="p" testId="sentence" text={sentence} {...src} {...(hl && (hl[1] <= m.index || hl[0] >= m.index + m[0].length) ? { highlight: hl } : {})} slot={{ start: m.index, end: m.index + m[0].length, node: slot }} />;
  };

  let prompt: ReactNode;
  let answer: ReactNode = null;
  const solved = task.prompt.includes('___') ? task.prompt.replace(GAP, solution) : null;

  if (type === 'mc') {
    const shown = fb ? (fb.verdict === 'correct' ? (fb.picked ?? '') : solution) : chosen !== null ? ((task.options ?? [])[chosen] ?? '') : '';
    prompt = sentenceWithSlot(
      task.prompt,
      <span className="lx-gap" data-testid="gap" data-state={!fb ? 'input' : fb.verdict === 'correct' ? 'correct' : 'reveal'} style={{ width: 'auto' }}>
        {shown || '   '}
      </span>,
    );
    const opts = task.options ?? [];
    const why: Partial<Record<number, string>> = {};
    if (model && fb && fb.verdict === 'wrong' && chosen !== null) {
      const yours = model.lines.find((l) => l.k === 'yours');
      if (yours && yours.k === 'yours') why[chosen] = yours.text;
    }
    answer = <Choices options={opts} chosen={chosen} correct={opts.indexOf(solution) >= 0 ? opts.indexOf(solution) : null} revealed={!!fb} onPick={(i) => !fb && setChosen(i)} lang="en" collapse={profile === 'touch'} why={why} label={t('trChoicesLabel')} testId="choices" />;
  } else if (type === 'meaning' && task.x?.kind === 'meaning') {
    const x = task.x;
    prompt = (
      <p lang={lang} data-testid="meaning-q">
        {lang === 'de' ? x.q.de : x.q.en}
      </p>
    );
    const correctIdx = MEANING_KEYS.indexOf(task.answer as 'a' | 'b' | 'both');
    const why: Partial<Record<number, string>> = {};
    if (model && fb && fb.verdict === 'wrong' && chosen !== null) {
      const yours = model.lines.find((l) => l.k === 'yours');
      if (yours && yours.k === 'yours') why[chosen] = yours.text;
    }
    answer = <Choices options={[x.a, x.b, t('gxMeaningBoth')]} langs={['en', 'en', lang]} chosen={chosen} correct={correctIdx >= 0 ? correctIdx : null} revealed={!!fb} onPick={(i) => !fb && setChosen(i)} lang="en" collapse={profile === 'touch'} why={why} label={t('trChoicesLabel')} testId="choices" />;
  } else if (type === 'gap') {
    prompt = (
      <>
        {sentenceWithSlot(task.prompt, gapNode)}
        {task.hint && !task.prompt.includes(task.hint) && (
          <p className="lx-t-support text-muted" lang={/[äöüÄÖÜß]/.test(task.hint) ? 'de' : lang} data-testid="cue">
            {t('grCue', { cue: task.hint.replace(/^\((.*)\)$/, '$1') })}
          </p>
        )}
      </>
    );
  } else if (type === 'kwt' && task.x?.kind === 'kwt') {
    const x = task.x;
    prompt = (
      <div className="flex flex-col gap-2">
        <EnglishText as="p" className="text-muted" text={x.from} {...src} testId="transform-from" />
        <p className="flex flex-wrap items-center gap-2">
          <span className="lx-t-meta text-muted">{t('gxKeyWord')}</span>
          <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold tracking-wide" lang="en" data-testid="kwt-key">
            {x.key}
          </span>
          <span className="lx-t-meta text-muted">{t('gxKwtWords', { min: x.words[0], max: x.words[1] })}</span>
        </p>
        {sentenceWithSlot(task.prompt, gapNode)}
      </div>
    );
  } else if (type === 'transform' && !whole) {
    const { from, target } = splitTransform(task.prompt);
    prompt = (
      <div className="flex flex-col gap-2">
        {from && <EnglishText as="p" className="text-muted" text={from} {...src} testId="transform-from" />}
        {sentenceWithSlot(target, gapNode)}
        {task.hint && !task.prompt.includes(task.hint) && (
          <p className="lx-t-support text-muted" lang={/[äöüÄÖÜß]/.test(task.hint) ? 'de' : lang} data-testid="cue">
            {t('grCue', { cue: task.hint.replace(/^\((.*)\)$/, '$1') })}
          </p>
        )}
      </div>
    );
  } else if (findTask) {
    const words = wordsOfPrompt;
    if (fb) {
      // Wie c1x `Err`: das falsche Original-Wort ist nie grün. Es steht durchgestrichen mit der Korrektur daneben („~~hear~~ → hearing“);
      // grün nur bei richtiger Antwort und nur zusammen mit der Korrektur (ohne Korrektur, z. B. „streichen“, bleibt es rot).
      // Eigene Fassung zeigen bei „Auch richtig“, nach Einspruch und bei einer anderen gültigen Stelle (`errAlt`), sonst die Lösung der Stelle.
      const own = (fb.check?.kind === 'other' && !fb.override) || (fb.verdict === 'correct' && (errAltHere || fb.by === 'me')) ? fb.given.trim() : '';
      const fixText = own || spotAnswer.trim() || null;
      const marks = errSpan ? [{ span: [errSpan[0], errSpan[1]] as [number, number], tone: fb.verdict === 'correct' && fixText ? ('ok' as const) : ('wrong' as const), ...(fixText ? { fix: fixText } : {}) }] : [];
      prompt = <SpotSentence words={words} pick="one" selected={null} onSelect={() => undefined} locked marks={marks} area={area} source={src.source} testId="spot-sentence" />;
    } else if (stage === 'locate') {
      prompt = <SpotSentence words={words} pick="one" selected={tapped} onSelect={setTapped} area={area} source={src.source} testId="spot-sentence" />;
    } else if (errSpan) {
      const before = words.slice(0, errSpan[0]).join(' ');
      const after = words.slice(errSpan[1] + 1).join(' ');
      prompt = (
        <p lang="en" data-testid="spot-replace">
          {before && <span>{before} </span>}
          <span className="lx-diff-off mr-1" data-testid="spot-original">
            {words.slice(errSpan[0], errSpan[1] + 1).join(' ')}
          </span>
          {gapNode}
          {after && <span> {after}</span>}
        </p>
      );
    } else prompt = null;
  } else if (type === 'correct') {
    prompt = <SentenceInput mode="free" value={text} onChange={(v) => { if (firstKeyAt.current === null) firstKeyAt.current = performance.now(); setText(v); }} onSubmit={primaryGo} disabled={!!fb || fit.busy} testId="correct-input" />;
  } else {
    // Umformung ohne Lücke (ganzer Satz): Auftragssatz oben, leeres Feld darunter.
    prompt = (
      <div className="flex flex-col gap-3">
        <EnglishText as="p" text={task.prompt} {...src} testId="transform-from" />
        {task.hint && !task.prompt.includes(task.hint) && (
          <p className="lx-t-support text-muted" lang={/[äöüÄÖÜß]/.test(task.hint) ? 'de' : lang} data-testid="cue">
            {t('grCue', { cue: task.hint.replace(/^\((.*)\)$/, '$1') })}
          </p>
        )}
        <SentenceInput mode="free" value={text} onChange={(v) => { if (firstKeyAt.current === null) firstKeyAt.current = performance.now(); setText(v); }} onSubmit={primaryGo} disabled={!!fb || fit.busy} testId="correct-input" />
      </div>
    );
  }
  if (fit.phase === 'slow' && !fb) {
    answer = (
      <>
        {answer}
        <FitSlow
          phase={fit.phase}
          onSkip={fit.skip}
        />
      </>
    );
  }
  if (copyOpen && fb) {
    answer = (
      <>
        {answer}
        <CopyOnceField solution={type === 'correct' ? task.answer : (solved ?? solution)} />
      </>
    );
  }

  // ------------------------------------------------------------------ Rückmeldung

  let feedback: ShellFeedback | null = null;
  if (fb && model) {
    const c = fb.check;
    const why = shortWhy(task.why ? (lang === 'de' ? task.why.ok.de : task.why.ok.en) : lang === 'de' ? task.expl.de : task.expl.en);
    const altLine = why ? t('grAltWanted', { want: solution, why }) : t('grAltWantedBare', { want: solution });
    const sub: string | null = lesson
      ? t('ttLessonWhy')
      : fb.dontKnow
      ? null
      : fb.override
        ? t('lrOverridden')
        : fb.check?.kind === 'other'
          ? altLine
          : fb.unsure
          ? t('grUnsure')
          : fb.altWhy
          ? t('ttJgAltErr')
          : c?.kind === 'uk' && c.us
            ? t('trUsHint', { us: c.us })
            : c?.kind === 'contraction'
              ? t('grVerdictContraction')
              : c?.kind === 'alt'
                ? t('grVerdictAlt')
                : c?.kind === 'typo'
                  ? t('trVerdictTypo')
                  : c?.kind === 'form'
                    ? t('grVerdictForm')
                    : c?.kind === 'key'
                      ? t('gxKwtKeyMissing')
                      : c?.kind === 'words'
                        ? t('gxKwtWordCount')
                        : null;
    // Vergleich nur, wo Lücke und Optionen die Lösung nicht schon zeigen (§5.2).
    let comparison: ShellFeedback['comparison'] = null;
    if (fb.verdict === 'wrong' && !fb.dontKnow && !fb.override) {
      if (type === 'correct' || (type === 'transform' && whole)) comparison = { given: fb.given, ops: c?.ops ?? alignWords(fb.given, task.answer) };
      else if (type === 'kwt' && (c?.ops ?? []).filter((o) => o.op !== 'eq').length > 1) comparison = { given: fb.given, ops: c?.ops ?? [] };
      else if ((type === 'gap' || type === 'transform') && !choiceType && nonEmpty(fb.given)) {
        // Die Lücke zeigt nur ein Wort: Der Vergleich nennt den ganzen Satz („Du: … → Richtig: …“) mit der markierten Stelle.
        const base = type === 'transform' ? (task.prompt.split('→').pop() ?? '').trim() : task.prompt;
        if (GAP.test(base)) {
          // Der Wort-Hinweis hinter der Lücke („___ (have)“) gehört nicht in den ausgeschriebenen Satz.
          const full = (fill: string): string => base.replace(/_{3,}(\s*\([^)]*\))?/, fill.trim());
          comparison = { given: full(fb.given), ops: alignWords(full(fb.given), full(task.answer)), compact: true };
        }
      }
    }
    const wrongTyped = fb.verdict === 'wrong' && !choiceType && !fb.dontKnow && !fb.override;
    // Einspruch auch bei „unsicher“ (gebucht wie „Fast“): die Antwort war vielleicht richtig, die App konnte es nur nicht belegen.
    const disputable = wrongTyped || (fb.verdict === 'near' && fb.tv === 'unsure' && !choiceType && !fb.dontKnow && !fb.override);
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (disputable && !findTask) menu.override = override;
    if (wrongTyped) menu.copyOnce = () => setCopyOpen(true);
    menu.wholeTopic = () => setSheet(true);
    if (film) menu.showMe = () => setFilmOpen(true);
    // KI-Tutor: Aufgabe, Antwort und Lösung wie bisher in „Erklär mir meine Antwort“ (Bedeutungsaufgabe: Sätze als Text).
    const mx = task.x?.kind === 'meaning' ? task.x : null;
    const meaningText = (k: string | null): string => (mx ? (k === 'a' ? mx.a : k === 'b' ? mx.b : k === 'both' ? 'Both sentences mean the same' : (k ?? '')) : (k ?? ''));
    const pickedKey = mx && chosen !== null ? (MEANING_KEYS[chosen] ?? null) : null;
    // Fehler finden: Claude bekommt Ganzsätze (Aufgabe, eigene Fassung, Lösung), nicht das Rohwort „none“ gegen eine Teillösung – sonst fehlte
    // der Bezug und die Abweichung (`ops`) war sinnlos (vermutete Ursache der Meldung „Antwort war unvollständig“).
    const fixedFull = task.x?.kind === 'find' ? task.x.fixed : null;
    const findGiven = (): string => {
      if (fb.picked === 'none' || fb.tapped === 'none' || !tapped) return task.prompt;
      return [...wordsOfPrompt.slice(0, tapped[0]), fb.given.trim(), ...wordsOfPrompt.slice(tapped[1] + 1)].filter(Boolean).join(' ');
    };
    const tutor = fb.dontKnow || fb.verdict === 'correct' || fb.override ? null : (
      <TutorButton
        taskKey={`gr:${task.key}:${fb.picked ?? fb.given}`}
        vars={{
          topic: task.topic,
          prompt: mx ? `${mx.q.en}\nA: ${mx.a}\nB: ${mx.b}` : findTask && fixedFull ? `Find the mistake in this sentence: ${task.prompt}` : task.prompt,
          answer: mx ? meaningText(solution) : findTask && fixedFull ? fixedFull : solution,
          given: mx ? meaningText(pickedKey) : findTask && fixedFull ? findGiven() : (fb.picked ?? fb.given),
          pattern: pattern ? { name: lang === 'de' ? pattern.name.de : pattern.name.en, form: lang === 'de' ? pattern.form.de : pattern.form.en } : null,
        }}
        pattern={pattern}
        store={{ kind: 'grammar', topic: task.topic, q: task.prompt }}
        onRight={menu.override}
        onRewrite={menu.copyOnce}
      />
    );
    // Rückmeldung 7 (Fehler finden): Kopf „Richtig erkannt“ / „Nicht ganz“ mit dem getippten Wort, darunter der korrigierte Satz mit sichtbarer
    // Änderung (auch bei richtiger Antwort und „Weiß ich nicht“); die Muster-Fachsprache unter „Mehr“, das Kontrastbeispiel offen.
    let find: Partial<ShellFeedback> = {};
    if (findTask) {
      const tappedNow = fb.spot ?? fb.tapped ?? null;
      const found = stage === 'replace' && !!tappedNow && tappedNow !== 'none';
      const errWord = errSpan ? wordsOfPrompt.slice(errSpan[0], errSpan[1] + 1).join(' ') : null;
      const fix = found && !fb.dontKnow ? fb.given.trim() : '';
      const h = findHead({ verdict: rv, errWord, tapped: tappedNow, found, ...(fix ? { fix } : {}), answer: spotAnswer }, lang);
      find = {
        ...(h.title ? { title: h.title } : {}),
        // Andere gültige Stelle (`errAlt`): „Du hast … getippt“ entfällt, die Zeile sagt schon, was passiert ist.
        sub: [sub, fb.altWhy ? null : h.sub].filter((x): x is string => !!x).join(' · ') || null,
        fold: ['pattern'],
        unfold: ['contrast'],
      };
    }
    // „Auch richtig“ (Art `other`): eigener Kopf, nie rot; bleibt stehen (kein Weiter von allein), damit „Gesucht war …“ gelesen wird.
    const alsoRight = c?.kind === 'other' && !fb.override;
    // Handlung aus `composeFeedback`: „Claude fragen“, „Zählt“ oder Zielform schreiben; dazu die Zeile zum Urteil von Claude (§6.4).
    const action: FeedbackAction = composed?.action ?? 'next';
    // Zielform als Formel („used to + Grundform“), nicht als Lösung: der Zweitversuch soll abrufen, nicht abschreiben.
    const want = pattern ? (lang === 'de' ? pattern.form.de : pattern.form.en) : solution;
    const foot = (
      <JudgeFoot
        action={action}
        aiMsg={fb.aiMsg ?? null}
        aiNoWhy={fb.aiNoWhy ?? null}
        busy={fit.busy}
        phase={fit.phase}
        onAsk={askNow}
        onSkip={fit.skip}
        onCounts={counts}
        want={want}
        target={fb.target ?? null}
        onTarget={tryTarget}
      />
    );
    feedback = {
      verdict: rv,
      ...(alsoRight ? { title: t('exAlsoRight') } : {}),
      sub,
      comparison,
      explanation: model,
      depth,
      menu,
      tutor,
      foot,
      auto: fb.help.level === 0 && !fb.override && !alsoRight && action === 'next' && !fb.aiMsg && !lesson,
      ...find,
      ...(alsoRight ? { unfold: [...(find.unfold ?? []), 'note' as const] } : {}),
    };
  }

  const kindLabel = t(findTask ? 'gxKind_find' : type === 'kwt' ? 'gxKind_kwt' : type === 'meaning' ? 'gxKind_meaning' : (`grKind_${type}` as MessageKey));
  const taskKey: MessageKey = findTask ? (stage === 'locate' ? 'gxTask_find1' : 'gxTask_find2') : type === 'kwt' ? 'gxTask_kwt' : type === 'meaning' ? 'gxTask_meaning' : type === 'transform' && whole ? 'grTask_transformWhole' : (`grTask_${type}` as MessageKey);
  const purposeKey: MessageKey = findTask ? 'gxPurpose_find' : type === 'kwt' ? 'gxPurpose_kwt' : type === 'meaning' ? 'gxPurpose_meaning' : 'purposeGrammar';
  const learnLine = learning && pattern ? { topic: topicLabel, pattern: lang === 'de' ? pattern.name.de : pattern.name.en } : { topic: null, pattern: null };
  // UX-Prüfung W1 (07.10.2026): vor dem Prüfen kein „Geübt wird: …“ – das Muster steht danach in der Rückmeldekarte.
  const goalText = findTask && task.goal && (stage === 'replace' || !!fb) ? (lang === 'de' ? task.goal.de : task.goal.en) : '';
  const taskText = goalText ? `${t(taskKey)} ${t('grGoal', { goal: goalText })}` : t(taskKey);

  const primary = fb
    ? { label: t('exNext'), onClick: () => next(), testId: 'next' }
    : { label: fit.busy ? t('exChecking') : t('exCheck'), onClick: () => submit(), testId: 'check', disabled: fit.busy || (choiceType ? chosen === null : findTask && stage === 'locate' ? !tapped : false) };


  return (
    <div
      ref={(el) => {
        root.current = el;
        sharedRef.current = el;
      }}
      tabIndex={-1}
      className="outline-none"
      data-testid="gr-item"
      data-type={type}
      data-topic={task.topic}
      data-src={task.src}
      data-pat={patId ? '1' : undefined}
      data-profile={profile}
      data-shared={shared ? '' : undefined}
      data-review={task.errorT !== null ? '' : undefined}
      data-lesson={lesson ? '' : undefined}
    >
      <ExerciseShell
        meta={{ ex: `gr_${type}`, id: `${task.topic}|${task.key}`, kind: type }}
        status={{ area: 'grammar', state, kindLabel, topic: learnLine.topic, pattern: learnLine.pattern, badge, ...(badgeTone ? { badgeTone } : {}), noInfo: noHelp }}
        task={{ text: taskText, purpose: t(purposeKey) }}
        // UX-Prüfung W1/W4: keine Regelkarte vor dem Prüfen (verrät die Lösung) – weder am Handy noch rechts am Laptop; die Regel gibt es als Tipp.
        aid={null}
        prompt={prompt}
        answer={answer}
        hint={hint}
        secondary={secondary}
        primary={primary}
        feedback={feedback}
        side={null}
      />
      {sheet && <TopicSheet topic={task.topic} onClose={() => setSheet(false)} inRound />}
      {film && <FilmSheet film={film} open={filmOpen} onClose={() => setFilmOpen(false)} />}
    </div>
  );
}

/**
 * Höchstens 45 sichtbare Wörter am Handy (§4.6): Der typische Fehler steht offen nur mit den beiden Sätzen; seine Ursache und – bei falscher
 * Antwort, wo „Deine Antwort“ schon genau erklärt – der ganze Fehler rutschen in den Aufklappbereich (Zeile „Hinweis“).
 */
function tighten(m: ExplanationModel): ExplanationModel {
  const hasYours = m.lines.some((l) => l.k === 'yours');
  const w = (x: string | null | undefined): number => (x ? x.split(/\s+/).filter(Boolean).length : 0);
  // Offene Wörter ohne den typischen Fehler: Muster, „Deine Antwort“, Warum und das eine offene Beispiel.
  const base =
    m.lines.reduce((n, l) => n + (l.k === 'pattern' ? w(l.name) + w(l.formula) : l.k === 'yours' ? w(l.given) + w(l.text) : l.k === 'why' ? w(l.text) : 0), 0) + w(m.examples[0]?.en);
  const lines = m.lines.flatMap((l): ExplanationModel['lines'] => {
    if (l.k !== 'mistake') return [l];
    const cause = nonEmpty(l.cause) ? l.cause : '';
    const sentences = w(l.bad) + w(l.good);
    // Passt der Fehler mit seinen zwei Sätzen noch in die 45 Wörter, bleibt er offen (ohne Ursache); sonst steht er unter „Mehr“.
    if (!hasYours && base + sentences <= 45) return cause ? [{ k: 'mistake', bad: l.bad, good: l.good, cause: null }, { k: 'note', text: cause }] : [l];
    return [{ k: 'note', text: `${l.bad} → ${l.good}${cause ? ` · ${cause}` : ''}` }];
  });
  // Die Reihenfolge bleibt: pattern → yours → why → mistake → contrast → note (Notizen zuletzt).
  const order = ['pattern', 'yours', 'why', 'mistake', 'contrast', 'note'];
  return { ...m, lines: [...lines].sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)) };
}

/** „Einmal richtig schreiben“ (M5): freiwillig, zählt nicht als Antwort und ändert keine Note. */
function CopyOnceField({ solution }: { solution: string }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const ok = nonEmpty(value) && value.trim().toLowerCase() === solution.trim().toLowerCase();
  return (
    <label className="flex flex-col gap-1">
      <span className="lx-t-support text-muted">{t('lrCopyLabel')}</span>
      <input className="lx-field" lang="en" autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} data-testid="copy-input" data-state={ok ? 'correct' : undefined} autoFocus />
      {ok && (
        <span className="lx-t-support text-ok-text" data-testid="copy-ok">
          {t('lrCopyOk')}
        </span>
      )}
    </label>
  );
}

