import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useSharedTarget } from '../../engine/shared';
import { useLive } from '../../data/live';
import { alignWords, splitWords } from '../../domain/answer/align';
import { maskOf } from '../../domain/answer/mask';
import { topicById } from '../../domain/content';
import type { ExplainDepth, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { topicP } from '../../domain/grammar/bkt';
import { checkFind, checkGrammar, checkKwt, checkMeaning, closeVariant } from '../../domain/grammar/check';
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
import { ExerciseShell, FixedSentence, SentenceInput, explainDepth, findHead, markSpans, type ShellFeedback, type ShellMenuId, type ShellSecondary } from '../../ui/exercise';
import { useCompanionSee } from '../companion/seeing';
import { nextT } from '../progress/persist';
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
  /** Wochen-Check und Vortest (M10): ohne Tipp, ohne Platzhalter und ohne Zweitversuch – es wird gemessen, nicht geholfen. */
  noHelp?: boolean;
  /** Eingabeprofil der Runde (einmal eingefroren). Ohne Angabe das des Geräts. */
  profile?: InputProfile;
  /** Themenrunde oder Einführung: die Musterkarte steht offen. */
  topicRound?: boolean;
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
};


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

function LegacyGrammarItem({ task, ctx, day, onDone, area = 'trainer', badge = null, noHelp = false, profile: profileProp, topicRound = false }: GrammarItemProps) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const [profile] = useState<InputProfile>(() => profileProp ?? inputProfile());
  const doc = useLive((s) => s.collections.grammar?.get(task.topic));
  const [pStart] = useState(() => topicP(task.topic, doc, now));
  const p = topicP(task.topic, doc, now);
  const pattern = useMemo(() => patternOf(task), [task]);
  const patId = task.pat ?? pattern?.id ?? null;
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
  const [locateMisses, setLocateMisses] = useState(0);
  const [copyOpen, setCopyOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Menü ⋯ „Zeig es mir“ (P61): der Struktur-Film zum Muster der Aufgabe, falls es einen gibt.
  const [filmOpen, setFilmOpen] = useState(false);
  const film = filmEnabled() ? filmFor(task.topic, patId) : null;
  const firstWrong = useRef<string | null>(null);
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

  const solution = task.answer;
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
  const hintVisible = !!task.hint && (task.prompt.includes(task.hint) || type === 'gap' || (whole && type === 'transform'));

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
    setFb({ verdict, check, given, dontKnow: false, grade, ms, help, judged: 'local', unsure: false, override: false, ...extra });
    if ((gapKind || findTask) && profile === 'touch') api.blur();
  };

  const submit = () => {
    if (fb) return;
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
          // Stelle gefunden: weiter mit dem Ersatz. Die Zeit zählt ab hier.
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
      if (!given.trim() && task.answer.trim()) return;
      const res = checkFind(task, { replacement: given });
      if (res.verdict === 'wrong' && closeVariant({ answer: task.answer, accepted: task.accepted }, given)) finishCheck('near', res, given, { judged: 'noai', unsure: true, tapped: tappedWord() });
      else finishCheck(res.verdict, res, given, { tapped: tappedWord() });
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
    const res = type === 'kwt' ? checkKwt(task, given) : checkGrammar(task, given);
    if (res.verdict !== 'wrong' || !res.needsJudge) {
      finishCheck(res.verdict, res, given);
      return;
    }
    // Bewertung sofort, kein Warten auf Claude: sehr ähnlich zur Lösung → mögliche gültige Variante („nicht sicher prüfbar“), sonst falsch.
    if (closeVariant(task, given)) finishCheck('near', res, given, { judged: 'noai', unsure: true });
    else finishCheck('wrong', res, given);
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
    const spot = findTask && stage === 'replace' ? tappedWord() : undefined;
    setFb({ verdict: 'wrong', check: null, given: '', dontKnow: true, grade: 1, ms: elapsed(), help, judged: 'local', unsure: false, override: false, ...(spot ? { spot } : {}) });
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
      dev: profile === 'touch' ? 't' : 'k',
      ...(fb.override ? { override: true } : {}),
      ...(retry && firstWrong.current !== null ? { firstWrong: firstWrong.current } : {}),
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
  const model: ExplanationModel | null = useMemo(() => {
    if (!fb) return null;
    const verdict: ResultVerdict = fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.verdict === 'correct' ? 'ok' : fb.verdict === 'near' ? 'near' : 'wrong';
    return tighten(grammarExplanation({ task, verdict, given: fb.given, ...(picked !== undefined ? { picked } : {}), ...(fb.tapped !== undefined ? { tapped: fb.tapped } : {}), lang, learning }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, lang, learning, task]);

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

  const maxTip = choiceType ? 2 : gapKind || type === 'kwt' ? 3 : findTask && stage === 'replace' ? 2 : type === 'correct' || whole ? 2 : 2;
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
            {t('grCue', { cue: task.hint })}
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
      </div>
    );
  } else if (findTask) {
    const words = wordsOfPrompt;
    if (fb) {
      const marks = err ? [{ span: [err[0], err[1]] as [number, number], tone: fb.verdict === 'wrong' ? ('wrong' as const) : ('ok' as const) }] : [];
      prompt = <SpotSentence words={words} pick="one" selected={null} onSelect={() => undefined} locked marks={marks} area={area} source={src.source} testId="spot-sentence" />;
    } else if (stage === 'locate') {
      prompt = <SpotSentence words={words} pick="one" selected={tapped} onSelect={setTapped} area={area} source={src.source} testId="spot-sentence" />;
    } else if (err) {
      const before = words.slice(0, err[0]).join(' ');
      const after = words.slice(err[1] + 1).join(' ');
      prompt = (
        <p lang="en" data-testid="spot-replace">
          {before && <span>{before} </span>}
          {gapNode}
          {after && <span> {after}</span>}
        </p>
      );
    } else prompt = null;
  } else if (type === 'correct') {
    prompt = <SentenceInput mode="free" value={text} onChange={(v) => { if (firstKeyAt.current === null) firstKeyAt.current = performance.now(); setText(v); }} onSubmit={primaryGo} disabled={!!fb} testId="correct-input" />;
  } else {
    // Umformung ohne Lücke (ganzer Satz): Auftragssatz oben, leeres Feld darunter.
    prompt = (
      <div className="flex flex-col gap-3">
        <EnglishText as="p" text={task.prompt} {...src} testId="transform-from" />
        {task.hint && !task.prompt.includes(task.hint) && (
          <p className="lx-t-support text-muted" lang={/[äöüÄÖÜß]/.test(task.hint) ? 'de' : lang} data-testid="cue">
            {t('grCue', { cue: task.hint })}
          </p>
        )}
        <SentenceInput mode="free" value={text} onChange={(v) => { if (firstKeyAt.current === null) firstKeyAt.current = performance.now(); setText(v); }} onSubmit={primaryGo} disabled={!!fb} testId="correct-input" />
      </div>
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
    const sub: string | null = fb.dontKnow
      ? null
      : fb.override
        ? t('lrOverridden')
        : fb.unsure
          ? t('grUnsure')
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
          const full = (fill: string): string => base.replace(GAP, fill.trim());
          comparison = { given: full(fb.given), ops: alignWords(full(fb.given), full(task.answer)), compact: true };
        }
      }
    }
    const wrongTyped = fb.verdict === 'wrong' && !choiceType && !fb.dontKnow && !fb.override;
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (wrongTyped && !findTask) menu.override = override;
    if (wrongTyped) menu.copyOnce = () => setCopyOpen(true);
    menu.wholeTopic = () => setSheet(true);
    if (film) menu.showMe = () => setFilmOpen(true);
    // KI-Tutor: Aufgabe, Antwort und Lösung wie bisher in „Erklär mir meine Antwort“ (Bedeutungsaufgabe: Sätze als Text).
    const mx = task.x?.kind === 'meaning' ? task.x : null;
    const meaningText = (k: string | null): string => (mx ? (k === 'a' ? mx.a : k === 'b' ? mx.b : k === 'both' ? 'Both sentences mean the same' : (k ?? '')) : (k ?? ''));
    const pickedKey = mx && chosen !== null ? (MEANING_KEYS[chosen] ?? null) : null;
    const tutor = fb.dontKnow || fb.verdict === 'correct' || fb.override ? null : (
      <TutorButton
        taskKey={`gr:${task.key}:${fb.picked ?? fb.given}`}
        vars={{
          topic: task.topic,
          prompt: mx ? `${mx.q.en}\nA: ${mx.a}\nB: ${mx.b}` : task.prompt,
          answer: mx ? meaningText(solution) : solution,
          given: mx ? meaningText(pickedKey) : (fb.picked ?? fb.given),
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
      const errWord = err ? wordsOfPrompt.slice(err[0], err[1] + 1).join(' ') : null;
      const h = findHead({ verdict: rv, errWord, tapped: tappedNow, found }, lang);
      const fixed = task.x?.kind === 'find' ? task.x.fixed : null;
      find = {
        ...(h.title ? { title: h.title } : {}),
        sub: [sub, h.sub].filter((x): x is string => !!x).join(' · ') || null,
        ...(fixed ? { right: <FixedSentence from={task.prompt} to={fixed} testId="find-correction" /> } : {}),
        fold: ['pattern'],
        unfold: ['contrast'],
      };
    }
    feedback = { verdict: rv, sub, comparison, explanation: model, depth, menu, tutor, auto: fb.help.level === 0 && !fb.override, ...find };
  }

  const kindLabel = t(findTask ? 'gxKind_find' : type === 'kwt' ? 'gxKind_kwt' : type === 'meaning' ? 'gxKind_meaning' : (`grKind_${type}` as MessageKey));
  const taskKey: MessageKey = findTask ? (stage === 'locate' ? 'gxTask_find1' : 'gxTask_find2') : type === 'kwt' ? 'gxTask_kwt' : type === 'meaning' ? 'gxTask_meaning' : type === 'transform' && whole ? 'grTask_transformWhole' : (`grTask_${type}` as MessageKey);
  const purposeKey: MessageKey = findTask ? 'gxPurpose_find' : type === 'kwt' ? 'gxPurpose_kwt' : type === 'meaning' ? 'gxPurpose_meaning' : 'purposeGrammar';
  const learnLine = learning && pattern ? { topic: topicLabel, pattern: lang === 'de' ? pattern.name.de : pattern.name.en } : { topic: null, pattern: null };
  // UX-Prüfung W1 (07.10.2026): vor dem Prüfen kein „Geübt wird: …“ – das Muster steht danach in der Rückmeldekarte.
  const taskText = t(taskKey);

  const primary = fb
    ? { label: t('exNext'), onClick: () => next(), testId: 'next' }
    : { label: t('exCheck'), onClick: () => submit(), testId: 'check', disabled: choiceType ? chosen === null : findTask && stage === 'locate' ? !tapped : false };


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
    >
      <ExerciseShell
        meta={{ ex: `gr_${type}`, id: `${task.topic}|${task.key}`, kind: type }}
        status={{ area: 'grammar', state, kindLabel, topic: learnLine.topic, pattern: learnLine.pattern, badge }}
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

