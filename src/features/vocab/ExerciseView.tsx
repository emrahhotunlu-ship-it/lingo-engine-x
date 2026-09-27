import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { CardStatus } from '../../engine/CardStatus';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { ExerciseFrame } from '../../engine/ExerciseFrame';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset, type GapState } from '../../engine/KineticGap';
import { Tiles } from '../../engine/Tiles';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { checkTyped, checkWithHint } from '../../domain/answer/check';
import { answerDiff, charDiff } from '../../domain/answer/diff';
import { formKind } from '../../domain/answer/form';
import { maskOf } from '../../domain/answer/mask';
import { retryHint, type RetryHint } from '../../domain/answer/retryHint';
import { normalize } from '../../domain/answer/normalize';
import { checkSituation, typedForm } from '../../domain/chunks/situation';
import { scoreDictation } from '../../domain/drills/dictation';
import { tokenize } from '../../domain/text/tokenize';
import { chunkWhy } from '../../domain/srs/chunkCards';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf, type Confidence } from '../../domain/srs/confidence';
import { cardExamples, EXAMPLES_MIN, storedExamples } from '../../domain/srs/examples';
import { posKey } from '../../domain/srs/explain';
import { autoGrade, produceGrade } from '../../domain/srs/grade';
import { exerciseDef } from '../../domain/srs/modes';
import { selfCheckProduce, type SelfCheck } from '../../domain/srs/produce';
import { reviewFsrs } from '../../domain/srs/scheduler';
import { locate } from '../../domain/srs/context';
import { choiceVerdict, tilesAnswer } from '../../domain/srs/exercise';
import { locateChunk } from '../../domain/srs/chunkCards';
import type { CheckResult, ContextSpan, Exercise, ExerciseId, Grade, Option, TrainCard } from '../../domain/srs/types';
import { speak, stopSpeech, useSpeech } from '../../platform/speech';
import { produceCheck, type ProduceCheckOut } from '../../prompts/produceCheck';
import { requestExamples, useExamples } from './examples';
import { commitAnswer, type Answer, type FirstKind } from './session';
import { CopyOnce, NextButton, OverrideButton } from '../learn/ui';
import { AiRunPanel } from '../input/AiRunPanel';
import { MnemonicBlock } from './mnemonic';
import { RetryHintLine } from '../learn/RetryHint';
import { useCompanionSee } from '../companion/seeing';
import { companionOpenedSince, companionOpenMs } from '../companion/store';

// Eine Übung (CLAUDE.md A7 „Emrahs Rückmeldung zum Trainer"): Status oben, Aufgabe in einer
// Zeile, Antwort → Prüfen → Ergebnis mit Markierung, Bedeutung, Formhinweis, Beispielsätzen.
// Die Note bestimmt die App aus Richtigkeit, Zeit und genutzter Hilfe – nur „Weiter".
// Abfragearten laut phase1-plan §4.2: Auswahl (mc_en, listen_mc, mc_de, match, colloc), im Satz
// finden (spot), Bausteine (tiles), Tippen in die Lücke (cloze_hint, cloze, type, dictation,
// speed, situation) und eigener Satz (produce, mit Claude; bei Ausfall „Ohne Claude prüfen").

type Feedback = {
  result: CheckResult;
  /** Gewertete Eingabe (mit vorgegebenem Anfangsbuchstaben, falls nicht mitgetippt). */
  given: string;
  chosen: Option | null;
  grade: Grade;
  /** Abstand bis zur nächsten Fälligkeit (ms) bei dieser Note. */
  dueInMs: number;
  /** Sicherheit nach dieser Antwort (Status passt zu Ergebnis und Abstand, F5). */
  confidence: Confidence;
  ms: number;
  /** Einspruch „Ich lag richtig" (M4). */
  override: boolean;
  /** spot: angetippte Stelle. */
  picked?: { start: number; end: number } | null;
  /** speed: Zeit abgelaufen. */
  timedOut?: boolean;
  /** produce: Claudes Prüfung bzw. die Prüfung ohne Claude. */
  produce?: { out: ProduceCheckOut | null; self: SelfCheck | null };
};

const PURPOSE: Record<number, MessageKey> = { 1: 'purpose1', 2: 'purpose2', 3: 'purpose3', 4: 'purpose4', 5: 'purpose5' };
/** Freie Tipp-Arten: „Tipp" deckt Platzhalter bzw. den ersten Buchstaben auf (zählt als Hilfe). */
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set(['cloze', 'type', 'situation']);
/** Arten, deren Frage schon die Bedeutung ist bzw. die sie als Stütze zeigen – im Ergebnis nicht noch einmal (H3). */
const MEANING_ASKED: ReadonlySet<ExerciseId> = new Set(['mc_en', 'listen_mc', 'mc_de', 'type', 'spot', 'match', 'tiles', 'situation']);
/** Arten, die den Satz vor dem Prüfen zeigen (Beispiele wiederholen ihn nicht). */
const SHOWS_SENTENCE: ReadonlySet<ExerciseId> = new Set(['colloc', 'mc_en', 'spot', 'match', 'tiles', 'listen_mc']);
const LISTEN: ReadonlySet<ExerciseId> = new Set(['listen_mc', 'dictation']);
/**
 * „Erst ein Hinweis, dann die Lösung" (Lernberatung Vorschlag 4): getippte Arten mit zweitem
 * Versuch. Nicht Diktat und Tempo (Zeitbalken), nicht Auswahl, nie im Wochen-Check (`noHelp`).
 */
const RETRY_EX: ReadonlySet<ExerciseId> = new Set(['cloze_hint', 'cloze', 'type', 'situation']);

export function ExerciseView({
  exercise,
  knownWords,
  again = false,
  onDone,
  onCommit,
  noHelp = false,
}: {
  exercise: Exercise;
  knownWords: ReadonlySet<string>;
  /** Kommt die Karte nach einem Fehler in dieser Runde noch einmal (F10)? */
  again?: boolean;
  onDone: (kind: FirstKind) => void;
  /** Eigener Schreibweg (z. B. Wörter-Schritt der Lektion); Standard: die Trainer-Runde. */
  onCommit?: (ans: Answer) => FirstKind;
  /** Wochen-Check (M10): ohne Tipp-Knopf – der Check misst, statt zu helfen. */
  noHelp?: boolean;
}) {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const ai = useAiAvailable();
  const tts = useSpeech((s) => s.status === 'ready');
  const now = useClock((s) => s.now);
  const e = exercise;
  const card = e.card;
  const [fb, setFb] = useState<Feedback | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  /** Hinweis nach einem falschen ersten Versuch; gesetzt = zweiter Versuch läuft bzw. lief. */
  const [retry, setRetry] = useState<RetryHint | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);
  const [prodText, setProdText] = useState('');
  const [left, setLeft] = useState(e.limitMs ?? 0);
  const [confidenceBefore] = useState(() => confidenceOf(card, now));
  const produceAsk = useAsk(produceCheck);
  const extra = useExamples((s) => s.byCard[card.id]);
  const typed = useRef('');
  const firstKeyAt = useRef<number | null>(null);
  const firstKeyLookup = useRef(0);
  const deletions = useRef(0);
  const shownAt = useRef(0);
  const lookupAtStart = useRef(0);
  const companionAtStart = useRef(0);
  const plays = useRef(0);
  const audioEnd = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const prodInput = useRef<HTMLTextAreaElement>(null);

  const play = () => {
    if (!e.speak) return;
    plays.current += 1;
    void speak(e.speak).then(() => {
      if (audioEnd.current === null) audioEnd.current = performance.now();
    });
  };

  useEffect(() => {
    shownAt.current = performance.now();
    lookupAtStart.current = lookupOpenMs();
    companionAtStart.current = companionOpenMs();
    // Hören: der Satz kommt sofort (die Uhr beginnt am Tonende).
    if (LISTEN.has(e.ex) && e.speak) play();
    // Tastatur am Desktop (F7): liegt der Fokus nirgends, beginnt er bei der Übung.
    const a = document.activeElement;
    if (!a || a === document.body) root.current?.querySelector<HTMLElement>('[data-testid="exercise"]')?.focus({ preventScroll: true });
    return () => {
      if (LISTEN.has(e.ex)) stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Einblenden dieser Übung
  }, []);

  const shownSentence = e.input === 'typed' || SHOWS_SENTENCE.has(e.ex) ? (e.sentence?.sentence ?? null) : null;
  const solution = e.accepted[0] ?? card.word;
  // Der Hinweis „beginnt mit …" deckt in der Lücke den ersten Buchstaben auf (wie „Tipp" Stufe 2).
  const hintShown = e.ex === 'cloze_hint' || (FREE_TYPED.has(e.ex) && tip >= 2) || retry?.kind === 'start';
  const meaningText = lang === 'de' ? card.de : card.def;

  /** Antwortzeit ohne offenes Nachschlagen und Begleiter; Hören ab Tonende. */
  const measure = () => {
    const nowPerf = performance.now();
    const paused = lookupOpenMs() - lookupAtStart.current + (companionOpenMs() - companionAtStart.current);
    const start = LISTEN.has(e.ex) && audioEnd.current !== null ? audioEnd.current : shownAt.current;
    return { nowPerf, ms: Math.max(0, Math.round(nowPerf - start - paused)) };
  };

  const finish = (result: CheckResult, given: string, chosen: Option | null, extraFb: Partial<Feedback> = {}, forced?: Grade) => {
    const { ms } = measure();
    // Den Begleiter vor dem Prüfen zu öffnen zählt als Hilfe: höchstens „Schwer" (E5-05, A7).
    const companionHelp = companionOpenedSince(shownAt.current);
    const start = LISTEN.has(e.ex) && audioEnd.current !== null ? audioEnd.current : shownAt.current;
    const firstKey = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - start - firstKeyLookup.current));
    const g =
      forced ??
      autoGrade(e.ex, result, {
        submitMs: ms,
        firstKeyMs: firstKey,
        chars: solution.length,
        deletions: deletions.current,
        // Zweiter Versuch nach dem Hinweis zählt wie „Tipp" Stufe 2: höchstens „Schwer". Die Zeit ist
        // die Gesamtzeit ab dem Einblenden (beide Versuche); durch die Deckelung entscheidet sie
        // nicht mehr über die Note, bleibt aber als ehrliche Antwortzeit gespeichert.
        hintLevel: companionHelp || retry ? 2 : FREE_TYPED.has(e.ex) ? tip : 0,
        tiles: e.tiles?.length ?? 0,
        replays: Math.max(0, plays.current - 1),
        ...(e.limitMs ? { limitMs: e.limitMs } : {}),
        ...(extraFb.timedOut ? { timedOut: true } : {}),
      });
    // „Beginnt mit …" hieß: Emrah wusste das Wort nicht – auch ein Treffer danach ist „Nochmal".
    const g2: Grade = retry?.kind === 'start' && forced === undefined ? 1 : g;
    const grade = forced !== undefined && companionHelp ? (Math.min(forced, 2) as Grade) : g2;
    const t0 = Date.now();
    const after = reviewFsrs(card.fsrs, grade, t0);
    const dueInMs = Math.max(0, after.due - t0);
    const confidence = confidenceOf({ isNew: false, stage: Math.max(1, card.stage) as TrainCard['stage'], fsrs: after }, t0);
    setFb({ result, given, chosen, grade, dueInMs, ms, confidence, override: false, ...extraFb });
    // Fehlen Beispiele, ergänzt Claude sie einmal (ausgelöst durch „Prüfen").
    if (ai && storedExamples(card.doc).length === 0 && cardExamples(card, shownSentence).length < EXAMPLES_MIN) requestExamples(card);
    // Touch: Tastatur schließen, damit Ergebnis und Beispiele sichtbar sind.
    if (e.input === 'typed' && window.matchMedia('(pointer: coarse)').matches) api.blur();
    if (LISTEN.has(e.ex)) stopSpeech();
  };

  /**
   * Erster Versuch falsch (nicht „fast richtig") → Hinweis statt Lösung. Die Eingabe bleibt
   * stehen, der Fokus bleibt in der Lücke (iPhone: im selben Handler). `true`, wenn so.
   */
  const offerRetry = (given: string, result: CheckResult): boolean => {
    if (retry || noHelp || !RETRY_EX.has(e.ex)) return false;
    const h = retryHint(given, e.accepted, e.ex === 'situation' ? typedForm(card.word) : card.lemma, result);
    if (!h) return false;
    setRetry(h);
    api.focusNow();
    return true;
  };

  const check = (chosen: Option | null, opts: { timedOut?: boolean } = {}) => {
    if (fb) return;
    if (e.input === 'choice') {
      if (!chosen) return;
      finish(choiceVerdict(e, chosen), chosen.label, chosen);
      return;
    }
    if (e.input === 'tiles') {
      if (!placed.length) return;
      const given = tilesAnswer(e.tiles ?? [], placed, /\s/.test(solution) ? 'words' : 'letters');
      finish(checkTyped(given, e.accepted, { lemma: card.lemma }), given, null);
      return;
    }
    if (e.ex === 'situation') {
      let given = typed.current.trim();
      // Zweiter Versuch mit aufgedecktem Anfangsbuchstaben: wer ihn nicht mittippt, meint ihn mit.
      const first = retry?.kind === 'start' ? maskOf(solution, { firstLetter: true })[0] : undefined;
      if (first?.kind === 'slot' && first.hint && given && hintOffset([first], given) === 1) {
        const withHint = first.hint + given;
        if (checkSituation(withHint, { accepted: e.accepted, en: card.word }).verdict !== 'wrong') given = withHint;
      }
      const res = checkSituation(given, { accepted: e.accepted, en: card.word });
      if (offerRetry(given, res)) return;
      finish(res, given, null);
      return;
    }
    if (e.ex === 'dictation' && /\s/.test(solution)) {
      // Mehrwort (Wendung): Wort-für-Wort wie beim Diktat (domain/drills/dictation.ts).
      const given = typed.current.trim();
      const typedCheck = checkTyped(given, e.accepted, { lemma: card.lemma });
      finish(typedCheck.verdict === 'correct' ? typedCheck : { verdict: scoreDictation(given, solution).verdict }, given, null);
      return;
    }
    const hint = hintShown ? (maskOf(solution, { firstLetter: true }).find((c) => c.kind === 'slot')?.hint ?? null) : null;
    const r = checkWithHint(typed.current, e.accepted, { lemma: card.lemma, knownWords }, hint);
    if (!opts.timedOut && offerRetry(r.effective, r.result)) return;
    finish(r.result, r.effective, null, opts.timedOut ? { timedOut: true } : {});
  };
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  // speed: Zeitbalken; bei Ablauf wird die Eingabe geprüft (richtig → höchstens „Schwer").
  useEffect(() => {
    if (e.ex !== 'speed' || !e.limitMs || fb) return;
    const limit = e.limitMs;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const l = Math.max(0, limit - (performance.now() - t0));
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(id);
        checkRef.current(null, { timedOut: true });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [e.ex, e.limitMs, fb]);

  const pickSpot = (start: number, end: number, text: string) => {
    if (fb || !e.sentence) return;
    const s = e.sentence;
    const ok = start < s.end && end > s.start;
    finish(ok ? { verdict: 'correct' } : { verdict: 'wrong' }, text, null, { picked: { start, end } });
  };

  const produceVars = () => ({
    target: card.kind === 'chunk' ? typedForm(card.word) : card.word,
    meaning: meaningText ?? '',
    sentence: prodText.trim(),
    uiLang: lang,
    kind: card.kind === 'chunk' || /\s/.test(card.lemma) ? ('phrase' as const) : ('word' as const),
  });

  const produceLocal = () => {
    if (fb || !prodText.trim()) return;
    const self = selfCheckProduce(prodText.trim(), card);
    const verdict = self.grade === 3 ? 'correct' : self.grade === 2 ? 'near' : 'wrong';
    finish({ verdict }, prodText.trim(), null, { produce: { out: null, self } }, self.grade);
  };

  const produceBusy = produceAsk.phase === 'queued' || produceAsk.phase === 'thinking' || produceAsk.phase === 'slow' || produceAsk.phase === 'streaming';

  const checkProduce = async () => {
    if (fb || !prodText.trim() || produceBusy) return;
    prodInput.current?.blur();
    if (!ai) {
      produceLocal();
      return;
    }
    const out = await produceAsk.run(produceVars());
    if (!out) return;
    const grade = produceGrade(out.verdict, out.usesTarget);
    const verdict = out.verdict === 'correct' ? 'correct' : out.verdict === 'minor' ? 'near' : 'wrong';
    finish({ verdict }, prodText.trim(), null, { produce: { out, self: null } }, grade);
  };

  const next = () => {
    if (!fb) return;
    const ans: Answer = fb.override ? { grade: 3, given: fb.given, ms: fb.ms, ok: true, override: true } : { grade: fb.grade, given: fb.given, ms: fb.ms, ok: fb.grade > 1 };
    const kind = (onCommit ?? commitAnswer)(ans);
    // Tastatur am iPhone: im selben Handler fokussieren bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };

  const showTip = () => {
    setTip((v) => (v === 0 ? 1 : 2));
    api.focusNow();
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (e.input === 'typed') check(null);
        else if (e.input === 'tiles') check(null);
      },
      digit: (n) => {
        if (fb || e.input !== 'choice' || useLookup.getState().req) return;
        const o = e.options[n - 1];
        if (o) check(o);
      },
    },
    api.isInput,
  );

  const when = (ms: number): string => {
    const min = Math.round(ms / 60_000);
    if (min < 60) return t('ivMin', { n: Math.max(1, min) });
    const h = Math.round(ms / 3_600_000);
    if (h < 24) return t('ivHour', { n: h });
    return tn('ivDay', Math.round(ms / 86_400_000));
  };

  const gapState: GapState = !fb ? 'input' : fb.result.verdict;
  const helped = e.ex === 'cloze_hint';
  const mask =
    helped || retry?.kind === 'start'
      ? maskOf(solution, { firstLetter: true })
      : FREE_TYPED.has(e.ex) && tip > 0
        ? maskOf(solution, { firstLetter: tip >= 2 })
        : null;
  const retryText = !retry
    ? null
    : retry.kind === 'spelling'
      ? t('rhSpelling')
      : retry.kind === 'form'
        ? t('rhForm')
        : retry.words > 1
          ? t('rhStartPhrase', { start: retry.start, n: retry.words })
          : tn('rhStartWord', retry.letters, { start: retry.start });
  const src = { area: 'trainer' as const, source: card.path, title: card.word };

  // Was der Begleiter sieht (Phase 5 §8.4): vor dem Prüfen Aufgabe und Satz mit ___, nie die Lösung.
  const blanked = e.sentence ? `${e.sentence.sentence.slice(0, e.sentence.start)}___${e.sentence.sentence.slice(e.sentence.end)}` : '';
  const task = t(`task_${e.ex}` as MessageKey);
  const seeDetail =
    e.ex === 'mc_en'
      ? `${task}\n${e.sentence?.sentence ?? card.word}`
      : e.ex === 'situation' && e.situation
        ? `${task}\n${e.situation.sceneTitle}\n${e.situation.intent}`
        : `${task}\n${blanked || e.meaning || ''}${e.meaning && blanked ? `\n(${e.meaning})` : ''}`;
  useCompanionSee({
    area: 'trainer',
    label: `${t('cmpSeeTrainer')} · ${t(`exName_${e.ex}` as MessageKey)}`,
    phase: fb ? 'feedback' : 'question',
    detail: seeDetail,
    ...(fb ? { reveal: `Solution: ${solution}. Learner: ${fb.given || '(empty)'}` } : { mask: [solution, card.word, card.lemma, ...e.accepted] }),
  });

  const sentence = (span: ContextSpan, slot: ReactNode | null, opts: { mark?: boolean } = {}) => (
    <EnglishText
      as="p"
      className="lx-sentence"
      testId="sentence"
      text={span.sentence}
      {...src}
      slot={slot ? { start: span.start, end: span.end, node: slot } : null}
      highlight={opts.mark ? [span.start, span.end] : null}
      exclude={opts.mark && !fb ? [span.start, span.end] : null}
    />
  );

  const cue = (text: string | null) =>
    text && !fb ? (
      <p className="text-sm text-muted" data-testid="cue" lang={lang}>
        {t('trHint', { meaning: text })}
      </p>
    ) : null;

  const replayButton = LISTEN.has(e.ex) && tts && !fb && e.speak ? (
    <div>
      <Button variant="secondary" icon="speaker" onClick={play} data-testid="replay">
        {t('trReplay')}
      </Button>
    </div>
  ) : null;

  // ------------------------------------------------------------------ Aufgabe
  let body: ReactNode;
  if (e.input === 'typed') {
    const gap = (
      <KineticGap
        label={e.sentence ? t('trGapLabel', { sentence: `${e.sentence.sentence.slice(0, e.sentence.start)}…${e.sentence.sentence.slice(e.sentence.end)}` }) : t('trTypeLabel', { meaning: e.meaning ?? '' })}
        maxLength={Math.max(40, solution.length + 10)}
        state={gapState}
        marks={fb?.result.verdict === 'near' ? fb.result.marks : undefined}
        mask={mask}
        shown={fb ? fb.given : null}
        onChange={(v, info) => {
          typed.current = v;
          if (info.firstKey && firstKeyAt.current === null) {
            firstKeyAt.current = performance.now();
            firstKeyLookup.current = lookupOpenMs() - lookupAtStart.current;
          }
          deletions.current += info.deleted;
        }}
        onEnter={() => (fb ? next() : check(null))}
      />
    );
    const freeCue = (e.ex === 'type' || (e.ex === 'speed' && !e.sentence)) && e.meaning;
    body = (
      <>
        {e.ex === 'situation' && e.situation && (
          <>
            <div className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 text-sm" data-testid="situation-scene">
              <p className="font-semibold">{e.situation.sceneTitle}</p>
              {e.situation.situation && <p className="text-muted">{e.situation.situation}</p>}
              {e.situation.counterpart && <p className="text-xs text-subtle">{e.situation.counterpart}</p>}
            </div>
            <p className="text-base" data-testid="situation-intent" lang={lang}>
              <span className="text-muted">{t('trSituationIntent')}</span> <span className="font-semibold">{e.situation.intent}</span>
            </p>
          </>
        )}
        {freeCue && (
          <p className="text-xl font-semibold tracking-tight" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.ex === 'speed' && !fb && (
          <div className="lx-speed" role="progressbar" aria-label={t('trSpeedBar')} aria-valuemin={0} aria-valuemax={e.limitMs ?? 0} aria-valuenow={Math.round(left)} data-testid="speed-bar" data-left-ms={Math.round(left)}>
            <span style={{ width: `${e.limitMs ? (left / e.limitMs) * 100 : 0}%` }} />
          </div>
        )}
        {replayButton}
        {e.sentence && e.ex !== 'situation' ? (
          sentence(e.sentence, gap)
        ) : (
          <p className="lx-sentence" lang="en">
            {gap}
          </p>
        )}
        {retryText && !fb && <RetryHintLine text={retryText} />}
        {e.ex !== 'type' && e.ex !== 'dictation' && e.ex !== 'situation' && !(e.ex === 'speed' && !e.sentence) && cue(e.meaning)}
      </>
    );
  } else if (e.input === 'spot') {
    body = (
      <>
        {e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.sentence && !fb && <SpotSentence text={e.sentence.sentence} onPick={pickSpot} label={t('trSpotLabel')} />}
        {e.sentence && fb && (
          <SpotSentence text={e.sentence.sentence} onPick={pickSpot} label={t('trSpotLabel')} picked={fb.picked ?? null} target={[e.sentence.start, e.sentence.end]} locked />
        )}
      </>
    );
  } else if (e.input === 'tiles') {
    const current = tilesAnswer(e.tiles ?? [], placed, /\s/.test(solution) ? 'words' : 'letters');
    const slot = (
      <span className="lx-gap" data-testid="gap" data-state={!fb ? 'input' : fb.result.verdict} style={{ width: 'auto', minWidth: '3.5em' }} lang="en">
        {fb ? (fb.result.verdict === 'correct' ? fb.given : solution) : current || ' '}
      </span>
    );
    body = (
      <>
        {e.sentence ? (
          sentence(e.sentence, slot)
        ) : (
          <p className="lx-sentence" lang="en">
            {slot}
          </p>
        )}
        {cue(e.meaning)}
        <Tiles tiles={e.tiles ?? []} placed={placed} onChange={(p) => {
          if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
          setPlaced(p);
        }} locked={!!fb} labels={{ line: t('trTilesLine'), pool: t('trTilesPool') }} />
      </>
    );
  } else if (e.input === 'produce') {
    const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
    const busy = produceAsk.phase === 'queued' || produceAsk.phase === 'thinking' || produceAsk.phase === 'slow' || produceAsk.phase === 'streaming';
    body = (
      <>
        <p className="text-xl font-semibold tracking-tight" lang="en" data-testid="produce-target">
          {t('trProduceTarget', { word: target })}
        </p>
        {e.meaning && (
          <p className="text-sm text-muted" lang={lang} data-testid="cue">
            {e.meaning}
          </p>
        )}
        <textarea
          ref={prodInput}
          className="lx-field min-h-24 text-base"
          lang="en"
          rows={3}
          value={prodText}
          readOnly={!!fb || busy}
          onChange={(ev) => {
            if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
            setProdText(ev.target.value);
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              if (fb) next();
              else void checkProduce();
            }
          }}
          aria-label={t('trProduceLabel')}
          placeholder={t('trProduceLabel')}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-testid="produce-input"
        />
        {!fb && <AiRunPanel phase={produceAsk.phase} error={produceAsk.error} onStop={produceAsk.stop} onRetry={() => void checkProduce()} skeleton={false} />}
        {!fb && produceAsk.error && (
          <div>
            <Button variant="ghost" onClick={produceLocal} data-testid="produce-local">
              {t('trProduceLocal')}
            </Button>
          </div>
        )}
      </>
    );
  } else {
    const filled = fb?.chosen ? (fb.result.verdict === 'correct' ? fb.chosen.label : solution) : '';
    const gapSlot = (
      <span className="lx-gap" data-testid="gap" data-state={!fb ? 'input' : fb.result.verdict === 'correct' ? 'correct' : 'reveal'} style={{ width: 'auto' }}>
        {filled || ' '}
      </span>
    );
    body = (
      <>
        {(e.ex === 'mc_de' || (e.ex === 'match' && !e.sentence)) && e.meaning && (
          <p className="text-xl font-semibold tracking-tight" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.ex === 'listen_mc' && replayButton}
        {e.ex === 'listen_mc' && fb && e.sentence && sentence(e.sentence, null, { mark: true })}
        {e.ex === 'listen_mc' && fb && !e.sentence && (
          <p className="lx-sentence" lang="en">
            <mark className="lx-mark text-fg">{card.word}</mark>
          </p>
        )}
        {e.ex === 'mc_en' &&
          (e.sentence ? (
            sentence(e.sentence, null, { mark: true })
          ) : (
            <p className="lx-sentence" lang="en">
              <mark className="lx-mark text-fg">{card.word}</mark>
            </p>
          ))}
        {(e.ex === 'colloc' || e.ex === 'match') && e.sentence && sentence(e.sentence, gapSlot)}
        {e.ex === 'match' && e.sentence && cue(e.meaning)}
        <Choices items={e.options} chosen={fb?.chosen?.id ?? null} onChoose={(id) => check(e.options.find((o) => o.id === id) ?? null)} label={t('trChoicesLabel')} />
      </>
    );
  }

  // ------------------------------------------------------------------ Ergebnis
  let result: ReactNode = undefined;
  if (fb) {
    const v = fb.result;
    const prod = fb.produce;
    const verdictKey: MessageKey = fb.override
      ? 'lrOverridden'
      : prod
        ? v.verdict === 'correct'
          ? 'trProduceCorrect'
          : v.verdict === 'near'
            ? 'trProduceMinor'
            : 'trProduceWrong'
        : fb.timedOut && v.verdict !== 'correct'
          ? 'trTimeUp'
          : v.verdict === 'correct'
            ? v.variant === 'uk'
              ? 'trVerdictUk'
              : 'trVerdictCorrect'
            : v.verdict === 'near'
              ? v.kind === 'form'
                ? 'trVerdictForm'
                : v.kind === 'typo'
                  ? 'trVerdictTypo'
                  : v.kind === 'synonym'
                    ? 'trVerdictSynonym'
                    : 'trVerdictNear'
              : 'trVerdictWrong';
    const tone = v.verdict === 'correct' ? 'text-accent-text' : v.verdict === 'near' ? 'text-gold-text' : 'text-danger-text';
    const answerLang = e.ex === 'mc_en' || e.ex === 'listen_mc' ? lang : 'en';
    const writes = e.input === 'typed' || e.input === 'tiles';
    // „fast richtig": Buchstaben gold, fehlende eingefügt; falsch: ganze Wörter rot (H2).
    // „to" vor Verben ist beim Tippen freiwillig: für den Vergleich weglassen.
    const bare = (x: string) => x.trim().replace(/^to\s+/i, '');
    const nearChars = writes && v.verdict === 'near' && !bare(fb.given).includes(' ') && !bare(solution).includes(' ');
    const chars = nearChars ? charDiff(bare(fb.given), bare(solution)) : [];
    const diff = writes && !nearChars ? answerDiff(bare(fb.given), bare(solution)) : [];
    // Bedeutung nur, wo sie nicht schon die Frage war (H3).
    const meaning = MEANING_ASKED.has(e.ex) || (e.ex === 'speed' && !e.sentence) ? null : meaningText;
    const pk = posKey(card.pos);
    const fk = e.input === 'typed' && card.kind === 'vocab' && v.verdict !== 'correct' ? formKind(solution, card.lemma, card.pos) : null;
    const col = e.ex === 'colloc' && e.colloc ? e.colloc : null;
    const examples = cardExamples(card, shownSentence, extra?.items ?? []);
    const target = (x: string): readonly [number, number] | null => {
      const hit = card.kind === 'chunk' ? locateChunk(x, card.word) : (locate(x, card.lemma) ?? (card.context ? locate(x, card.context.gap) : null));
      return hit ? [hit.start, hit.end] : null;
    };
    const loadingExamples = extra?.status === 'loading' && examples.length < EXAMPLES_MIN;
    const why = chunkWhy(card, lang);
    result = (
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE_OUT }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className={`text-base font-semibold ${fb.override ? 'text-accent-text' : tone}`} data-testid="verdict" data-verdict={fb.override ? 'correct' : v.verdict}>
            {t(verdictKey, { solution })}
          </p>
          {v.verdict !== 'correct' && writes && (
            <p className="text-sm leading-relaxed">
              <span className="text-muted">{t('trYour')}: </span>
              <span lang={answerLang} data-testid="given">
                {!normalize(fb.given) ? (
                  <span className="text-muted">{t('trEmpty')}</span>
                ) : chars.length ? (
                  <span data-testid="char-diff">
                    {chars.map((p, i) => (
                      <span key={i} className={p.kind === 'ok' ? undefined : p.kind === 'off' ? 'lx-diff-near' : 'lx-diff-missing'} data-diff={p.kind}>
                        {p.text}
                      </span>
                    ))}
                  </span>
                ) : diff.length ? (
                  <span data-testid="word-diff">
                    {diff.map((p, i) => (
                      <span key={i} className={p.ok ? undefined : 'lx-diff-off'} data-off={p.ok ? undefined : ''}>
                        {p.text}
                      </span>
                    ))}
                  </span>
                ) : (
                  fb.given
                )}
              </span>
              <span className="text-muted"> · {t('trSolution')}: </span>
              <span className="font-semibold" lang={answerLang} data-testid="solution">
                {solution}
              </span>
            </p>
          )}
          {v.verdict !== 'correct' && e.input === 'spot' && (
            <p className="text-sm leading-relaxed">
              <span className="text-muted">{t('trSolution')}: </span>
              <span className="font-semibold" lang="en" data-testid="solution">
                {solution}
              </span>
            </p>
          )}
          {v.variant === 'uk' && v.us && (
            <p className="text-sm text-muted" data-testid="us-hint">
              {t('trUsHint', { us: v.us })}
            </p>
          )}
        </div>
        {prod && <ProduceResult given={fb.given} out={prod.out} self={prod.self} />}
        {col ? (
          <p className="text-sm" data-testid="meaning">
            <span className="font-semibold" lang="en">
              {col.p}
            </span>
            {lang === 'de' && col.de && (
              <>
                <span className="text-muted"> – </span>
                <span lang="de">{col.de}</span>
              </>
            )}
          </p>
        ) : (
          (meaning || pk) && (
            <p className="text-sm" data-testid="meaning">
              <span className="font-semibold" lang="en">
                {card.word}
              </span>
              {meaning && (
                <>
                  <span className="text-muted"> – </span>
                  <span lang={lang}>{meaning}</span>
                </>
              )}
              {pk && <span className="text-muted"> · {t(pk as MessageKey)}</span>}
            </p>
          )
        )}
        {why && (
          <p className="text-sm text-muted" lang={lang} data-testid="chunk-why">
            {why}
          </p>
        )}
        {fk && (
          <p className="text-sm" data-testid="form-hint">
            <span className="font-semibold">{t('trFormHint', { form: t(`form_${fk}` as MessageKey), word: solution })}</span>
            <span className="text-muted"> · {t('trBaseForm', { lemma: card.lemma })}</span>
          </p>
        )}
        {e.ex === 'situation' && e.situation?.then && (
          <p className="text-sm" data-testid="situation-then">
            <span className="text-muted">{t('sitThen')}</span> <span lang="en">„{e.situation.then}“</span>
          </p>
        )}
        {(examples.length > 0 || loadingExamples) && (
          <div className="flex flex-col gap-1.5" data-testid="examples">
            <p className="lx-eyebrow">{t('trExamples')}</p>
            <ul className="flex flex-col gap-1.5">
              {examples.map((x) => (
                <li key={x.en} className="text-[0.95rem] leading-relaxed" data-testid="example" data-src={x.src}>
                  <EnglishText as="span" text={x.en} {...src} highlight={target(x.en)} />
                </li>
              ))}
            </ul>
            {loadingExamples && (
              <p className="text-sm text-subtle" data-testid="examples-loading">
                {t('trExamplesLoading')}
              </p>
            )}
          </div>
        )}
        <MnemonicBlock card={card} />
        {v.verdict === 'wrong' && e.input === 'typed' && !fb.override && <OverrideButton onOverride={() => setFb({ ...fb, override: true })} />}
        {v.verdict === 'wrong' && e.input === 'typed' && <CopyOnce solution={solution} />}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-subtle" data-testid="due-in" data-grade={fb.override ? 3 : fb.grade}>
            {t('trAgainIn', { when: when(fb.dueInMs) })}
          </span>
          <NextButton onNext={next} auto={v.verdict === 'correct' && tip === 0 && !retry && !fb.override && !prod} />
        </div>
      </motion.div>
    );
  }

  const def = exerciseDef(e.ex);
  const confidence: Confidence = fb ? fb.confidence : confidenceBefore;
  const purposeKey: MessageKey =
    e.ex === 'colloc' ? 'purposeColloc' : e.ex === 'situation' ? 'purposeSituation' : LISTEN.has(e.ex) && def.stage < 5 ? 'purposeListen' : (PURPOSE[def.stage] ?? 'purpose1');
  const actions =
    !fb && (e.input === 'typed' || e.input === 'tiles' || e.input === 'produce') ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={() => (e.input === 'produce' ? void checkProduce() : check(null))}
          disabled={(e.input === 'tiles' && !placed.length) || (e.input === 'produce' && (!prodText.trim() || produceBusy))}
          data-testid="check"
        >
          {t('trCheck')}
        </Button>
        {FREE_TYPED.has(e.ex) && tip < 2 && !noHelp && !retry && (
          <Button variant="ghost" icon="lightbulb" onClick={showTip} data-testid="hint" data-level={tip}>
            {tip === 0 ? t('trTip') : t('trTipLetter')}
          </Button>
        )}
      </div>
    ) : undefined;
  return (
    <div ref={root}>
      <ExerciseFrame
        status={
          <CardStatus
            dots={confidenceDots(confidence)}
            level={confidence}
            word={t(CONFIDENCE_KEYS[confidence])}
            label={t('confLabel', { level: t(CONFIDENCE_KEYS[confidence]) })}
            again={again ? t('trAgainBadge') : null}
            kind={t(`exName_${e.ex}` as MessageKey)}
            kindLabel={t('exKindLabel', { name: '' }).trim()}
          />
        }
        task={task}
        infoLabel={t('trInfo')}
        purpose={t(purposeKey)}
        body={body}
        actions={actions}
        resultLabel={t('trResultLabel')}
        result={result}
        meta={{ ex: e.ex, card: card.id, col: e.colloc?.index, stage: e.stage, kind: card.kind }}
      />
    </div>
  );
}

/** Satz mit antippbaren Wörtern als Antwort (spot) – kein Nachschlagen vor dem Prüfen. */
function SpotSentence({
  text,
  onPick,
  label,
  picked = null,
  target = null,
  locked = false,
}: {
  text: string;
  onPick: (start: number, end: number, word: string) => void;
  label: string;
  picked?: { start: number; end: number } | null;
  target?: readonly [number, number] | null;
  locked?: boolean;
}) {
  const tokens = useMemo(() => tokenize(text), [text]);
  return (
    <p className="lx-sentence" lang="en" role="group" aria-label={label} data-testid="sentence">
      {tokens.map((tk, i) => {
        if (tk.kind !== 'word') return <span key={i}>{tk.text}</span>;
        const inTarget = !!target && tk.start < target[1] && tk.end > target[0];
        const isPicked = !!picked && tk.start < picked.end && tk.end > picked.start;
        const state = !locked ? undefined : inTarget ? 'correct' : isPicked ? 'wrong' : undefined;
        return (
          <button
            key={i}
            type="button"
            className="lx-word lx-spot"
            data-testid="spot-word"
            data-word={tk.text}
            data-start={tk.start}
            data-state={state}
            disabled={locked}
            onClick={() => onPick(tk.start, tk.end, tk.text)}
          >
            {tk.text}
          </button>
        );
      })}
    </p>
  );
}

/** Ergebnis des eigenen Satzes: Claudes Korrektur, Begründung und natürlichere Fassung. */
function ProduceResult({ given, out, self }: { given: string; out: ProduceCheckOut | null; self: SelfCheck | null }) {
  const { t, lang } = useT();
  const src = { area: 'trainer' as const, source: null, title: null };
  return (
    <div className="flex flex-col gap-2" data-testid="produce-result" data-source={out ? 'ai' : 'self'}>
      <p className="text-sm" lang="en" data-testid="given">
        <span className="text-muted">{t('trYour')}: </span>
        {given}
      </p>
      {out && out.fixed.trim() !== '' && normalize(out.fixed) !== normalize(given) && (
        <p className="text-sm">
          <span className="text-muted">{t('trProduceFixed')}: </span>
          <EnglishText as="span" text={out.fixed} {...src} testId="produce-fixed" />
        </p>
      )}
      {out && (
        <p className="text-sm" lang={lang} data-testid="produce-why">
          {out.why}
        </p>
      )}
      {out?.better && (
        <p className="text-sm">
          <span className="text-muted">{t('trProduceBetter')}: </span>
          <EnglishText as="span" text={out.better} {...src} testId="produce-better" />
        </p>
      )}
      {self && (
        <>
          {!self.containsTarget && (
            <p className="text-sm" lang={lang}>
              {t('trProduceMissing')}
            </p>
          )}
          {self.containsTarget && !self.longEnough && (
            <p className="text-sm" lang={lang}>
              {t('trProduceShort')}
            </p>
          )}
          <p className="text-xs text-subtle" data-testid="produce-local-note">
            {t('trProduceLocalNote')}
          </p>
        </>
      )}
    </div>
  );
}
