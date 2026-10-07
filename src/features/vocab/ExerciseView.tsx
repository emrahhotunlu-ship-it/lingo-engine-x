import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useT, type MessageKey } from '../../i18n';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset, type GapState } from '../../engine/KineticGap';
import { SpotSentence } from '../../engine/SpotSentence';
import { useSwipeLeft } from '../../engine/swipe';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { alignWords } from '../../domain/answer/align';
import { checkTyped, checkWithHint } from '../../domain/answer/check';
import { maskOf } from '../../domain/answer/mask';
import { normalize } from '../../domain/answer/normalize';
import { retryHint, type RetryHint } from '../../domain/answer/retryHint';
import { checkSituation, typedForm } from '../../domain/chunks/situation';
import { scoreDictation } from '../../domain/drills/dictation';
import { packExtraOf } from '../../domain/c1pack/packFields';
import type { ExplainExample, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { unitState } from '../../domain/metrics';
import { choiceVerdict } from '../../domain/srs/exercise';
import { cardExamples, storedTranslation, wantsEnrichment } from '../../domain/srs/examples';
import { explainWord, isAltAnswer } from '../../domain/srs/explainWord';
import { posKey } from '../../domain/srs/explain';
import { autoGrade, produceGrade } from '../../domain/srs/grade';
import { exerciseDef } from '../../domain/srs/modes';
import { selfCheckProduce, type SelfCheck } from '../../domain/srs/produce';
import { reviewFsrs } from '../../domain/srs/scheduler';
import { noteWeight } from '../../domain/srs/weight';
import { trapForCard } from '../../domain/srs/traps';
import type { CheckResult, Exercise, ExerciseId, Grade, Option } from '../../domain/srs/types';
import { inputProfile } from '../../platform/input';
import { speak, stopSpeech, useSpeech } from '../../platform/speech';
import { produceCheck, type ProduceCheckOut } from '../../prompts/produceCheck';
import { ExerciseShell, SentenceInput, explainDepth, type ShellFeedback, type ShellMenuId, type ShellSecondary } from '../../ui/exercise';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { useCompanionSee } from '../companion/seeing';
import { companionOpenedSince, companionOpenMs } from '../companion/store';
import { saveRepairs } from '../repair/store';
import { requestExamples, useExamples } from './examples';
import { commitAnswer, prepareNext, useSession, type Answer, type FirstKind } from './session';
import { WordExtras } from './WordExtras';

// Eine Wörter-Übung im Übungsgerüst (Lernplattform 2.0 §4.8, §5.6). Das Gerüst (`ExerciseShell`) zeichnet Status, Aufgabenzeile, Satz, Eingabe,
// Urteil, Vergleich und die Erklär-Karte; diese Datei sammelt nur Eingabe und Prüfung je Abfrageart:
//   Auswahl (mc_en, ctx_mc, listen_mc, mc_de, match, colloc_gap) → `Choices` A–D, dann „Prüfen“
//   Lücke (cloze_hint, cloze, type, colloc, wordfam, situation, dictation) → `KineticGap` in der Lücke
//   Falle finden (find_trap) → Wort antippen · Satz vervollständigen (complete) und eigener Satz (produce) → `SentenceInput`
// Keine Selbstbewertung: die Note folgt aus Richtigkeit, Zeit und Hilfe. Die Warum-Zeile nennt den echten Fehlergrund (`explainWord`).

type Feedback = {
  result: CheckResult;
  /** Gewertete Eingabe (mit vorgegebenem Anfangsbuchstaben, falls nicht mitgetippt). */
  given: string;
  chosen: Option | null;
  grade: Grade;
  /** Abstand bis zur nächsten Fälligkeit (ms) bei dieser Note. */
  dueInMs: number;
  ms: number;
  /** Einspruch „Ich lag richtig“ (M4). */
  override: boolean;
  /** Genutzte Hilfe (Tipp, zweiter Versuch, Begleiter): gewichtet die Antwort geringer. */
  hint: 0 | 1 | 2;
  /** „Weiß ich nicht“: die Lösung wird gezeigt, ohne Wertung als Fehlgriff. */
  dontKnow?: boolean;
  /** find_trap: das angetippte Wort. */
  tapped?: [number, number] | null;
  /** complete/produce: Claudes Prüfung bzw. die lokale Prüfung. */
  sentence?: { out: ProduceCheckOut | null; self: SelfCheck | null };
};

const PURPOSE: Record<number, MessageKey> = { 1: 'purpose1', 2: 'purpose2', 3: 'purpose3', 4: 'purpose4', 5: 'purpose5' };
/** Freie Tipp-Arten: „Tipp“ deckt Platzhalter bzw. den ersten Buchstaben auf (zählt als Hilfe). */
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set(['cloze', 'type', 'situation', 'colloc', 'wordfam']);
/**
 * Arten, deren Frage die deutsche Bedeutung nach der Antwort noch zeigt – im Ergebnis nicht noch einmal (H3, Kap. 15).
 * Die Erklär-Karte nennt die Bedeutung nie als eigene Zeile; sie steht im Satz bzw. in „Merke“.
 */
const ANSWER_IS_DE: ReadonlySet<ExerciseId> = new Set(['mc_en', 'ctx_mc', 'listen_mc']);
/** Arten, deren Frage die deutsche Bedeutung nach dem Prüfen noch zeigt: „Merke“ wiederholt sie nicht. */
const MEANING_SHOWN: ReadonlySet<ExerciseId> = new Set(['mc_de', 'type', 'match', 'situation']);
const LISTEN: ReadonlySet<ExerciseId> = new Set(['listen_mc', 'dictation']);
/** „Erst ein Hinweis, dann die Lösung“: getippte Arten mit zweitem Versuch. Nicht Diktat, nicht Auswahl, nie im Wochen-Check (`noHelp`). */
const RETRY_EX: ReadonlySet<ExerciseId> = new Set(['cloze_hint', 'cloze', 'type', 'situation', 'colloc', 'wordfam']);
/** Arten mit einer Satzantwort (Claude prüft, lokal nur eine grobe Prüfung). */
const SENTENCE_EX: ReadonlySet<ExerciseId> = new Set(['complete', 'produce']);
// Feste leere Referenz statt `?? []` im Selektor (sonst rendert die Karte endlos neu, React-Fehler #185).
const NO_EXAMPLES: readonly { en: string; t: number }[] = [];
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHOICE_LANGS = { de: 'de', en: 'en' } as const;

/** Höchste Tipp-Stufe je Art: getippte Arten und Auswahl 2, Falle finden und Diktat 1, Satzantworten keiner. */
const maxTipOf = (ex: ExerciseId, input: Exercise['input']): 0 | 1 | 2 => (SENTENCE_EX.has(ex) ? 0 : FREE_TYPED.has(ex) || input === 'choice' ? 2 : 1);

/** Wörter eines Satzes mit Zeichenstellen (für „Falle finden“: angetipptes Wort ↔ Stelle der Falle). */
function wordsWithOffsets(text: string): Array<{ w: string; start: number; end: number }> {
  const out: Array<{ w: string; start: number; end: number }> = [];
  for (const m of text.matchAll(/\S+/g)) out.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

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
  const e = exercise;
  const card = e.card;
  // Das Eingabeprofil der Runde (einmal eingefroren, Session) bzw. des Geräts (Wochen-Check).
  const [touch] = useState(() => {
    const s = useSession.getState();
    return s.active ? !!s.env.touch : inputProfile() === 'touch';
  });
  const [state0] = useState(() => unitState(card));
  const [fb, setFb] = useState<Feedback | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  /** Hinweis nach einem falschen ersten Versuch; gesetzt = zweiter Versuch läuft bzw. lief. */
  const [retry, setRetry] = useState<RetryHint | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [sentenceText, setSentenceText] = useState('');
  const [spot, setSpot] = useState<[number, number] | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const askSentence = useAsk(produceCheck);
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
  const extras = extra?.items ?? NO_EXAMPLES;

  // n+1 vorberechnen, sobald das Ergebnis steht (nur Trainer-Runde, im Leerlauf).
  const hasResult = fb !== null;
  useEffect(() => {
    if (!hasResult || onCommit) return;
    const id = window.setTimeout(prepareNext, 30);
    return () => window.clearTimeout(id);
  }, [hasResult, onCommit]);

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

  const isChoice = e.input === 'choice';
  const isSpot = e.input === 'spot';
  const isSentence = SENTENCE_EX.has(e.ex);
  const isTyped = e.input === 'typed';
  const shownSentence = isTyped || isChoice || isSpot ? (e.sentence?.sentence ?? null) : null;
  const solution = e.accepted[0] ?? card.word;
  const meaningText = lang === 'de' ? (card.de ?? card.def) : (card.def ?? card.de);

  // ------------------------------------------------------------------ Tipp-Leiter
  // Stufe 1 Wortart und Bedeutung bzw. Erklärung (nie die Lösung), Stufe 2 der erste Buchstabe (getippt) bzw. eine falsche Option weniger (Auswahl).
  // Partnerwort getippt: Stufe 1 erster Buchstabe, Stufe 2 die Möglichkeiten (Plan §5.6). Falle finden: die Leitfrage der Falle.
  const maxTip: 0 | 1 | 2 = noHelp ? 0 : maxTipOf(e.ex, e.input);
  const fam = packExtraOf(card)?.fam;
  const maskWord = (s: string): string =>
    [card.word, card.lemma, ...(e.ex === 'wordfam' ? Object.values(fam ?? {}) : [])].filter(Boolean).reduce((acc, w) => acc.replace(new RegExp(escapeRe(w), 'gi'), '…'), s);
  const trap = trapForCard(card);
  const tipBase: string | null = (() => {
    if (e.ex === 'find_trap') return trap ? (lang === 'de' ? trap.hint.de : trap.hint.en) : null;
    const pk = posKey(card.pos);
    const def = card.def ? maskWord(card.def) : null;
    const de = lang === 'de' && card.de ? maskWord(card.de) : null;
    // Zeigt die Frage die Bedeutung schon (e.meaning), kommt die Erklärung; sonst die Bedeutung.
    const mean = ANSWER_IS_DE.has(e.ex) ? def : e.meaning ? (def ?? de) : (de ?? def);
    return [pk ? t(pk as MessageKey) : null, mean].filter(Boolean).join(' · ') || null;
  })();
  const colTyped = e.ex === 'colloc';
  const tipAvailable = maxTip > 0 && (FREE_TYPED.has(e.ex) || !!tipBase);
  const removedId = tip >= 2 && isChoice ? (e.options.find((o) => !o.correct)?.id ?? null) : null;
  const visibleOptions = removedId ? e.options.filter((o) => o.id !== removedId) : e.options;
  /** Hilfe für die Note: Partnerwort getippt zeigt schon mit Stufe 1 den ersten Buchstaben (= Hilfe 2). */
  const gradeTip: 0 | 1 | 2 = colTyped && tip > 0 ? 2 : tip;
  const hintShown = e.ex === 'cloze_hint' || (FREE_TYPED.has(e.ex) && (e.ex === 'wordfam' ? tip >= 1 : colTyped ? tip >= 1 : tip >= 2)) || retry?.kind === 'start';
  const placeholdersOnly = e.check === 'known' && touch;

  /** Antwortzeit ohne offenes Nachschlagen und Begleiter; Hören ab Tonende. */
  const measure = () => {
    const nowPerf = performance.now();
    const paused = lookupOpenMs() - lookupAtStart.current + (companionOpenMs() - companionAtStart.current);
    const start = LISTEN.has(e.ex) && audioEnd.current !== null ? audioEnd.current : shownAt.current;
    return { nowPerf, ms: Math.max(0, Math.round(nowPerf - start - paused)) };
  };

  const finish = (result: CheckResult, given: string, picked: Option | null, extraFb: Partial<Feedback> = {}, forced?: Grade, aiChecked = false) => {
    const { ms } = measure();
    // Den Begleiter vor dem Prüfen zu öffnen zählt als Hilfe: höchstens „Schwer“ (E5-05, A7).
    const companionHelp = companionOpenedSince(shownAt.current);
    const start = LISTEN.has(e.ex) && audioEnd.current !== null ? audioEnd.current : shownAt.current;
    const firstKey = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - start - firstKeyLookup.current));
    const hintUsed: 0 | 1 | 2 = companionHelp || retry ? 2 : gradeTip;
    const g =
      forced ??
      autoGrade(e.ex, result, {
        submitMs: ms,
        firstKeyMs: firstKey,
        chars: solution.length,
        deletions: deletions.current,
        // Zweiter Versuch nach dem Hinweis zählt wie „Tipp“ Stufe 2: höchstens „Schwer“.
        hintLevel: hintUsed,
        replays: Math.max(0, plays.current - 1),
        profile: touch ? 'touch' : 'keys',
        ...(aiChecked ? { aiChecked: true } : {}),
      });
    // „Beginnt mit …“ hieß: Emrah wusste das Wort nicht – auch ein Treffer danach ist „Nochmal“.
    const g2: Grade = retry?.kind === 'start' && forced === undefined ? 1 : g;
    const grade = forced !== undefined && companionHelp ? (Math.min(forced, 2) as Grade) : g2;
    const t0 = Date.now();
    const after = reviewFsrs(card.fsrs, grade, t0, noteWeight(e.ex, hintUsed));
    const dueInMs = Math.max(0, after.due - t0);
    setFb({ result, given, chosen: picked, grade, dueInMs, ms, override: false, hint: hintUsed, ...extraFb });
    // Fehlen Beispiele, ergänzt Claude sie einmal (ausgelöst durch „Prüfen“).
    if (ai && wantsEnrichment(card, shownSentence, Date.now())) requestExamples(card);
    // Touch: Tastatur schließen, damit Ergebnis und Beispiele sichtbar sind.
    if ((isTyped || isSentence) && touch) api.blur();
    if (LISTEN.has(e.ex)) stopSpeech();
  };

  /**
   * Erster Versuch falsch (nicht „fast richtig“) → Hinweis statt Lösung. Die Eingabe bleibt
   * stehen, der Fokus bleibt in der Lücke (iPhone: im selben Handler). `true`, wenn so.
   */
  const offerRetry = (given: string, result: CheckResult): boolean => {
    if (retry || noHelp || !RETRY_EX.has(e.ex) || e.check === 'known') return false;
    const h = retryHint(given, e.accepted, e.ex === 'situation' ? typedForm(card.word) : card.lemma, result);
    if (!h) return false;
    setRetry(h);
    api.focusNow();
    return true;
  };

  const alt = useMemo(() => packExtraOf(card)?.alt ?? [], [card]);

  const check = () => {
    if (fb) return;
    if (isChoice) {
      const o = chosen === null ? null : (visibleOptions[chosen] ?? null);
      if (!o) return;
      finish(choiceVerdict(e, o), o.label, o);
      return;
    }
    if (isSpot) {
      if (!spot || !e.sentence) return;
      const ws = wordsWithOffsets(e.sentence.sentence);
      const a = ws[spot[0]];
      const b = ws[spot[1]];
      if (!a || !b) return;
      const ok = a.start < e.sentence.end && b.end > e.sentence.start;
      finish(ok ? { verdict: 'correct' } : { verdict: 'wrong' }, ws.slice(spot[0], spot[1] + 1).map((x) => x.w).join(' '), null, { tapped: spot });
      return;
    }
    if (isSentence) {
      void checkSentence();
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
    const r = checkWithHint(typed.current, e.accepted, { lemma: card.lemma, knownWords, alt }, hint);
    if (offerRetry(r.effective, r.result)) return;
    finish(r.result, r.effective, null);
  };

  // ------------------------------------------------------------------ Satzantworten (complete, produce)

  const fullSentence = (): string => {
    const body = sentenceText.trim();
    return e.start ? `${e.start.trim()} ${body}`.trim() : body;
  };
  const sentenceVars = () => ({
    target: card.kind === 'chunk' ? typedForm(card.word) : card.word,
    meaning: meaningText ?? '',
    sentence: fullSentence(),
    uiLang: lang,
    kind: card.kind === 'chunk' || /\s/.test(card.lemma) ? ('phrase' as const) : ('word' as const),
  });
  const sentenceBusy = askSentence.phase === 'queued' || askSentence.phase === 'thinking' || askSentence.phase === 'slow' || askSentence.phase === 'streaming';

  /** Lokal: `produce` bis „Gut“ wie bisher; `complete` höchstens „Schwer“ (die Notentabelle deckelt ohne Claude-Bestätigung). */
  const checkSentenceLocal = (): void => {
    const text = fullSentence();
    const self = selfCheckProduce(text, card);
    const completeOk = e.ex === 'complete' ? self.containsTarget && text.trim().split(/\s+/).filter(Boolean).length >= 4 : self.grade >= 2;
    const verdict: CheckResult['verdict'] = e.ex === 'complete' ? (completeOk ? 'near' : 'wrong') : self.grade === 3 ? 'correct' : self.grade === 2 ? 'near' : 'wrong';
    const forced: Grade = e.ex === 'complete' ? (completeOk ? 2 : 1) : self.grade;
    finish({ verdict }, text, null, { sentence: { out: null, self } }, forced);
  };

  async function checkSentence(): Promise<void> {
    if (fb || !sentenceText.trim() || sentenceBusy) return;
    if (!ai) {
      checkSentenceLocal();
      return;
    }
    const out = await askSentence.run(sentenceVars());
    // Fehler (not_granted, rate_limited, …): lokales Urteil, ohne automatischen Neuversuch (A6.3); „Erneut versuchen“ bleibt beim Nutzer.
    if (!out) return;
    const grade = produceGrade(out.verdict, out.usesTarget);
    const verdict: CheckResult['verdict'] = out.verdict === 'correct' ? 'correct' : out.verdict === 'minor' ? 'near' : 'wrong';
    finish({ verdict }, fullSentence(), null, { sentence: { out, self: null } }, grade, true);
    // Ein falscher oder zu schwacher Satz wird zum Fehlersatz (Box 1), nur mit echter Korrektur.
    if (out.verdict !== 'correct' && out.fixed.trim() && normalize(out.fixed) !== normalize(fullSentence())) {
      void saveRepairs([{ wrong: fullSentence(), right: out.fixed.trim(), why: out.why, src: 'write' }]);
    }
  }

  // ------------------------------------------------------------------ Weiter, Tipp, Weiß ich nicht

  const next = () => {
    if (!fb) return;
    const ans: Answer = fb.override ? { grade: 3, given: fb.given, ms: fb.ms, ok: true, override: true } : { grade: fb.grade, given: fb.given, ms: fb.ms, ok: fb.grade > 1, hint: fb.hint };
    const kind = (onCommit ?? commitAnswer)(ans);
    // Tastatur am iPhone: im selben Handler fokussieren bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };

  const showTip = () => {
    setTip((v) => (v === 0 ? 1 : 2));
    if (isTyped) api.focusNow();
  };

  const dontKnow = () => {
    if (fb) return;
    finish({ verdict: 'wrong' }, '', null, { dontKnow: true }, 1);
  };

  const override = () => {
    if (fb) setFb({ ...fb, override: true });
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (isTyped || isChoice || isSpot) check();
      },
    },
    api.isInput,
  );

  // Am Handy: nach der Rückmeldung nach links wischen = „Weiter“ (Kap. 4.5); Knopf, Enter und Autoweiter bleiben.
  useSwipeLeft(next, fb !== null);

  const when = (ms: number): string => {
    const min = Math.round(ms / 60_000);
    if (min < 60) return t('ivMin', { n: Math.max(1, min) });
    const h = Math.round(ms / 3_600_000);
    if (h < 24) return t('ivHour', { n: h });
    return tn('ivDay', Math.round(ms / 86_400_000));
  };

  // ------------------------------------------------------------------ Urteil und Erklär-Karte

  const rv: ResultVerdict = !fb ? 'ok' : fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.sentence && !fb.sentence.out && e.ex === 'complete' && fb.result.verdict !== 'wrong' ? 'unchecked' : fb.result.verdict === 'correct' ? 'ok' : fb.result.verdict === 'near' ? 'near' : 'wrong';
  const learning = state0 === 'new' || state0 === 'learning';
  const depth = explainDepth({ verdict: rv, stage: card.stage, learning });

  /** Beispiele dieser Karte für die Erklär-Karte (Ursprungssatz zuerst, dann Paket und Claude), nie der Satz der Aufgabe. */
  const exampleItems: ExplainExample[] = useMemo(() => cardExamples(card, shownSentence, extras).map((x) => ({ en: x.en, de: storedTranslation(card.doc, x.en), ctx: null })), [card, shownSentence, extras]);

  const model: ExplanationModel | null = useMemo(() => {
    if (!fb) return null;
    if (fb.sentence) return sentenceModel(fb, card, lang, exampleItems);
    const picked = fb.chosen ? { label: fb.chosen.label, ...(fb.chosen.fromWord ? { fromWord: fb.chosen.fromWord } : {}), ...(fb.chosen.fromMeaning ? { fromMeaning: fb.chosen.fromMeaning } : {}) } : null;
    const isAlt = fb.result.verdict !== 'correct' && isAltAnswer(card, fb.given);
    // Verwechslung (getippt): die Bedeutung des anderen Worts aus dem Wortschatz der Runde – damit steht der echte Grund da.
    const other = fb.result.kind === 'confusable' && fb.result.otherWord ? useSession.getState().pool.find((c) => normalize(c.lemma) === normalize(fb.result.otherWord ?? '')) : undefined;
    return explainWord({
      card,
      ex: e.ex,
      verdict: fb.override ? 'ok' : fb.dontKnow ? 'dontKnow' : isAlt ? 'near' : fb.result.verdict === 'correct' ? 'ok' : fb.result.verdict === 'near' ? 'near' : 'wrong',
      given: fb.given,
      check: fb.result,
      picked,
      lang,
      solution,
      examples: exampleItems,
      ...(MEANING_SHOWN.has(e.ex) && (e.ex !== 'match' || !e.sentence) ? { meaningShown: true } : {}),
      ...(other ? { otherMeaning: lang === 'de' ? (other.de ?? other.def) : (other.def ?? other.de) } : {}),
      ...(isAlt ? { alt: true } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei einem neuen Ergebnis
  }, [fb, exampleItems]);

  // ------------------------------------------------------------------ Was der Begleiter sieht

  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const blanked = e.sentence ? `${e.sentence.sentence.slice(0, e.sentence.start)}___${e.sentence.sentence.slice(e.sentence.end)}` : '';
  const taskText = e.check === 'known' ? t('wxKnownTask') : t(`task_${e.ex}` as MessageKey);
  const seeDetail =
    e.ex === 'mc_en' || e.ex === 'ctx_mc'
      ? `${taskText}\n${e.sentence?.sentence ?? card.word}`
      : e.ex === 'situation' && e.situation
        ? `${taskText}\n${e.situation.sceneTitle}\n${e.situation.intent}`
        : `${taskText}\n${blanked || e.meaning || ''}${e.meaning && blanked ? `\n(${e.meaning})` : ''}`;
  useCompanionSee({
    area: 'trainer',
    label: `${t('cmpSeeTrainer')} · ${t(`exName_${e.ex}` as MessageKey)}`,
    phase: fb ? 'feedback' : 'question',
    detail: seeDetail,
    ...(fb ? { reveal: `Solution: ${solution}. Learner: ${fb.given || '(empty)'}` } : { mask: [solution, card.word, card.lemma, ...e.accepted] }),
  });

  // ------------------------------------------------------------------ Satz und Eingabe

  /** Der Satz der Übung mit antippbaren Wörtern; `slot` = die Lücke, `mark` = die Lösung hervorheben. */
  const sentence = (span: NonNullable<Exercise['sentence']>, slot: ReactNode | null, opts: { mark?: boolean } = {}) => (
    <EnglishText
      as="p"
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
      <p className="lx-t-support text-muted" data-testid="cue" lang={lang}>
        {t('trHint', { meaning: text })}
      </p>
    ) : null;

  const gapState: GapState = !fb ? 'input' : fb.result.verdict;
  const mask = placeholdersOnly
    ? maskOf(solution, { firstLetter: false })
    : e.ex === 'cloze_hint' || retry?.kind === 'start'
      ? maskOf(solution, { firstLetter: true })
      : FREE_TYPED.has(e.ex) && tip > 0
        ? maskOf(solution, { firstLetter: e.ex === 'wordfam' || colTyped ? tip >= 1 && !(e.ex === 'wordfam' && tip === 1) : tip >= 2 })
        : null;
  const gapReveal = fb && fb.result.verdict !== 'correct' && isTyped ? { solution, given: fb.given.trim() ? fb.given : null } : null;
  const gapNode = (
    <KineticGap
      label={e.sentence ? t('trGapLabel', { sentence: `${e.sentence.sentence.slice(0, e.sentence.start)}…${e.sentence.sentence.slice(e.sentence.end)}` }) : t('trTypeLabel', { meaning: e.meaning ?? '' })}
      maxLength={Math.max(40, solution.length + 10)}
      state={gapState}
      marks={fb?.result.verdict === 'near' ? fb.result.marks : undefined}
      mask={mask}
      shown={fb ? fb.given : null}
      reveal={gapReveal}
      silent
      onChange={(v, info) => {
        typed.current = v;
        if (info.firstKey && firstKeyAt.current === null) {
          firstKeyAt.current = performance.now();
          firstKeyLookup.current = lookupOpenMs() - lookupAtStart.current;
        }
        deletions.current += info.deleted;
      }}
      onEnter={() => (fb ? next() : check())}
    />
  );

  const replay =
    LISTEN.has(e.ex) && tts && !fb && e.speak ? (
      <Button variant="secondary" icon="speaker" onClick={play} data-testid="replay">
        {t('trReplay')}
      </Button>
    ) : null;

  let prompt: ReactNode;
  let answer: ReactNode = null;
  if (isTyped) {
    const freeCue = e.ex === 'type' && e.meaning;
    prompt = (
      <div className="flex flex-col gap-3">
        {e.ex === 'situation' && e.situation && (
          <>
            <div className="lx-inset lx-t-support flex flex-col gap-1" data-testid="situation-scene">
              <p className="font-semibold">{e.situation.sceneTitle}</p>
              {e.situation.situation && <p className="text-muted">{e.situation.situation}</p>}
              {e.situation.counterpart && <p className="lx-t-meta text-muted">{e.situation.counterpart}</p>}
            </div>
            <p className="lx-t-support" data-testid="situation-intent" lang={lang}>
              <span className="text-muted">{t('trSituationIntent')}</span> <span className="font-semibold">{e.situation.intent}</span>
            </p>
          </>
        )}
        {e.ex === 'wordfam' && e.famFrom && (
          <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="wordfam-from">
            <span className="text-muted">{t('wxFamFrom', { pos: t(`wxFam_${e.famFrom.pos}` as MessageKey) })}</span>
            <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold tracking-wide" lang="en">
              {e.famFrom.word}
            </span>
          </p>
        )}
        {freeCue && (
          <p className="lx-t-task" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {replay}
        {e.sentence && e.ex !== 'situation' ? (
          sentence(e.sentence, gapNode)
        ) : (
          <p lang="en" data-testid="sentence">
            {gapNode}
          </p>
        )}
        {e.ex !== 'type' && e.ex !== 'dictation' && e.ex !== 'situation' && e.check !== 'known' && cue(e.meaning)}
      </div>
    );
  } else if (isSpot) {
    const all = e.sentence ? wordsWithOffsets(e.sentence.sentence) : [];
    const ws = all.map((x) => x.w);
    const idx = e.sentence ? all.flatMap((w, i) => (w.start < e.sentence!.end && w.end > e.sentence!.start ? [i] : [])) : [];
    const target: [number, number] | null = idx.length ? [idx[0] as number, idx[idx.length - 1] as number] : null;
    // Nach dem Prüfen: die richtige Stelle (✓) und, falls daneben getippt, die falsche (✕).
    const marks = fb && target ? [{ span: target, tone: 'ok' as const }, ...(fb.result.verdict === 'wrong' && fb.tapped ? [{ span: fb.tapped, tone: 'wrong' as const }] : [])] : undefined;
    prompt = <SpotSentence words={ws} pick="one" selected={fb ? null : spot} onSelect={setSpot} locked={!!fb} {...(marks ? { marks } : {})} area="trainer" source={card.path} testId="sentence" label={t('trSpotLabel')} />;
  } else if (isSentence) {
    const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
    prompt = (
      <div className="flex flex-col gap-3">
        <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="produce-target">
          <span className="text-muted">{t('trProduceTarget', { word: '' }).replace(/\s*$/, '')}</span>
          <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold" lang="en" data-testid="target-chip">
            {target}
          </span>
        </p>
        {e.start && (
          <p className="lx-t-prompt text-muted" lang="en" data-testid="complete-start">
            {e.start} …
          </p>
        )}
        {e.meaning && (
          <p className="lx-t-support text-muted" lang={lang} data-testid="cue">
            {e.meaning}
          </p>
        )}
      </div>
    );
    answer = (
      <div className="flex flex-col gap-2">
        <SentenceInput
          mode="free"
          value={sentenceText}
          onChange={(v) => {
            if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
            setSentenceText(v);
          }}
          onSubmit={() => (fb ? next() : void checkSentence())}
          disabled={!!fb || sentenceBusy}
          testId={e.ex === 'complete' ? 'complete-input' : 'produce-input'}
        />
        {!fb && <AiRunPanel phase={askSentence.phase} error={askSentence.error} onStop={askSentence.stop} onRetry={() => void checkSentence()} skeleton={false} />}
        {!fb && askSentence.error && (
          <div>
            <Button variant="ghost" onClick={checkSentenceLocal} data-testid="produce-local">
              {t('trProduceLocal')}
            </Button>
          </div>
        )}
      </div>
    );
  } else {
    // Auswahl
    const correctIdx = visibleOptions.findIndex((o) => o.correct);
    const filled = fb?.chosen ? (fb.result.verdict === 'correct' ? fb.chosen.label : solution) : '';
    const gapSlot = (
      <span className="lx-gap" data-testid="gap" data-state={!fb ? 'input' : fb.result.verdict === 'correct' ? 'correct' : 'reveal'} style={{ width: 'auto' }}>
        {filled || ' '}
      </span>
    );
    prompt = (
      <div className="flex flex-col gap-3">
        {(e.ex === 'mc_de' || (e.ex === 'match' && !e.sentence)) && e.meaning && (
          <p className="lx-t-task" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.ex === 'listen_mc' && replay}
        {e.ex === 'listen_mc' && fb && e.sentence && sentence(e.sentence, null, { mark: true })}
        {e.ex === 'listen_mc' && fb && !e.sentence && (
          <p lang="en">
            <mark className="lx-mark text-fg">{card.word}</mark>
          </p>
        )}
        {(e.ex === 'mc_en' || e.ex === 'ctx_mc') &&
          (e.sentence ? (
            sentence(e.sentence, null, { mark: true })
          ) : (
            <p lang="en">
              <mark className="lx-mark text-fg">{card.word}</mark>
            </p>
          ))}
        {(e.ex === 'colloc_gap' || e.ex === 'match') && e.sentence && sentence(e.sentence, gapSlot)}
        {e.ex === 'match' && e.sentence && cue(e.meaning)}
      </div>
    );
    // Die Warum-Zeile steht bei einer falschen Wahl unter der gewählten Option (und nicht noch einmal in der Erklär-Karte).
    const whyUnder: Partial<Record<number, string>> = {};
    if (model && fb && fb.result.verdict === 'wrong' && chosen !== null) {
      const yours = model.lines.find((l) => l.k === 'yours');
      if (yours && yours.k === 'yours') whyUnder[chosen] = yours.text;
    }
    answer = (
      <Choices
        options={visibleOptions.map((o) => o.label)}
        langs={visibleOptions.map((o) => CHOICE_LANGS[o.lang])}
        chosen={chosen}
        correct={correctIdx >= 0 ? correctIdx : null}
        revealed={!!fb}
        onPick={(i) => !fb && setChosen(i)}
        lang="en"
        collapse={touch}
        why={whyUnder}
        label={t('trChoicesLabel')}
        testId="choices"
      />
    );
  }

  // ------------------------------------------------------------------ Rückmeldung

  const secondary: ShellSecondary[] = [];
  const canTip = !noHelp && !fb && !retry && tipAvailable && tip < maxTip;
  if (canTip) secondary.push({ id: 'hint', label: t('exHint'), onClick: showTip, testId: 'hint' });
  if (!fb && !isSentence && e.check !== 'known') secondary.push({ id: 'dontKnow', label: t('exDontKnow'), onClick: dontKnow, testId: 'dont-know' });

  const tipText = ((): string | null => {
    if (fb || tip < 1) return null;
    if (colTyped && tip >= 2) return t('wxPartnerTip', { options: e.options.map((o) => o.label).join(' · ') });
    if (colTyped) return null;
    return tipBase;
  })();
  const retryText = !retry
    ? null
    : retry.kind === 'spelling'
      ? t('rhSpelling')
      : retry.kind === 'form'
        ? t('rhForm')
        : retry.words > 1
          ? t('rhStartPhrase', { start: retry.start, n: retry.words })
          : tn('rhStartWord', retry.letters, { start: retry.start });
  const hint = fb ? null : retryText ? { text: retryText, tone: 'near' as const } : tipText ? { text: tipText, tone: 'hint' as const } : sentenceBusy ? { text: t('exThinking'), tone: 'hint' as const } : null;

  let feedback: ShellFeedback | null = null;
  if (fb && model) {
    const c = fb.result;
    const sub: string | null = fb.dontKnow
      ? null
      : fb.override
        ? t('lrOverridden')
        : fb.sentence && !fb.sentence.out
          ? t('trProduceLocalNote')
          : c.variant === 'uk' && c.us
            ? t('trUsHint', { us: c.us })
            : c.kind === 'typo'
              ? t('wxSubTypo')
              : c.kind === 'form'
                ? t('wxSubForm')
                : c.kind === 'synonym' || (c.verdict !== 'correct' && isAltAnswer(card, fb.given))
                  ? t('wxSubSynonym')
                  : null;
    let comparison: ShellFeedback['comparison'] = null;
    const fixed = fb.sentence?.out?.fixed;
    if (fixed && fb.result.verdict !== 'correct' && normalize(fixed) !== normalize(fb.given)) comparison = { given: fb.given, ops: alignWords(fb.given, fixed) };
    const wrongTyped = fb.result.verdict === 'wrong' && !fb.dontKnow && !fb.override && (isTyped || e.ex === 'colloc_gap');
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (wrongTyped && (isTyped || card.col.some((x) => x.ai))) menu.override = override;
    if (wrongTyped && isTyped) menu.copyOnce = () => setCopyOpen(true);
    menu.moreInfo = () => setMoreOpen(true);
    feedback = {
      verdict: rv,
      sub,
      comparison,
      explanation: whyUnderRemoved(model, isChoice && fb.result.verdict === 'wrong' && chosen !== null),
      depth,
      menu,
      nextIn: t('trAgainIn', { when: when(fb.dueInMs) }),
      auto: fb.hint === 0 && !fb.override && !fb.sentence && !fb.dontKnow,
    };
  }

  if (fb) {
    answer = (
      <>
        {answer}
        {(e.ex === 'colloc' || e.ex === 'colloc_gap') && e.colloc?.ai && (
          <p className="lx-t-meta text-subtle" data-testid="colloc-ai-note">
            {t('nbWsColAiNote')}
          </p>
        )}
        {e.ex === 'situation' && e.situation?.then && (
          <p className="lx-t-support" data-testid="situation-then">
            <span className="text-muted">{t('sitThen')}</span> <span lang="en">„{e.situation.then}“</span>
          </p>
        )}
        {copyOpen && fb.result.verdict === 'wrong' && isTyped && <CopyOnceField solution={solution} />}
        {!fb.override && fb.result.verdict === 'wrong' && isTyped && ai && e.ex !== 'situation' && <SynonymAsk card={card} given={fb.given} onOk={override} />}
        <WordExtras card={card} open={moreOpen} lang={lang} extras={extras} />
      </>
    );
  }

  const kindLabel =
    e.check === 'control' ? t('nbWsControl') : e.check === 'probe' ? `${t('nbWsProbe')} · ${t(`exName_${e.ex}` as MessageKey)}` : e.check === 'known' ? t('wxKnownKind') : t(`exName_${e.ex}` as MessageKey);
  const def = exerciseDef(e.ex);
  const purposeKey: MessageKey =
    e.ex === 'colloc' || e.ex === 'colloc_gap'
      ? 'purposeColloc'
      : e.ex === 'situation'
        ? 'purposeSituation'
        : e.ex === 'find_trap'
          ? 'wxPurposeTrap'
          : e.ex === 'wordfam'
            ? 'wxPurposeFam'
            : LISTEN.has(e.ex) && def.stage < 5
              ? 'purposeListen'
              : (PURPOSE[def.stage] ?? 'purpose1');

  const canCheck = isChoice ? chosen !== null : isSpot ? spot !== null : isSentence ? !!sentenceText.trim() && !sentenceBusy : true;
  const primary = fb
    ? { label: t('exNext'), onClick: next, testId: 'next' }
    : { label: t('exCheck'), onClick: check, testId: 'check', disabled: !canCheck, busy: sentenceBusy, busyLabel: t('exChecking') };

  return (
    <div ref={root} data-profile={touch ? 'touch' : 'keys'} data-col={e.colloc && e.colloc.index >= 0 ? e.colloc.index : undefined}>
      <ExerciseShell
        meta={{ ex: e.ex, id: card.id, stage: e.stage, kind: card.kind }}
        status={{ area: 'words', state: state0, kindLabel, badge: again ? t('trAgainBadge') : null }}
        task={{ text: taskText, purpose: t(purposeKey) }}
        prompt={prompt}
        answer={answer}
        hint={hint}
        secondary={secondary}
        primary={primary}
        feedback={feedback}
        state={retry && !fb ? 'retry' : undefined}
      />
    </div>
  );
}

/** Choices zeigt die Warum-Zeile schon unter der gewählten Option: sie steht nicht noch einmal in der Erklär-Karte (Kap. 15: nichts doppelt). */
function whyUnderRemoved(m: ExplanationModel, under: boolean): ExplanationModel {
  return under ? { ...m, lines: m.lines.filter((l) => l.k !== 'yours') } : m;
}

/** Erklär-Karte einer Satzantwort: Claudes Begründung als „Deine Antwort“, die natürlichere Fassung als Hinweis; lokal nur die grobe Prüfung. */
function sentenceModel(fb: Feedback, card: Exercise['card'], lang: 'de' | 'en', examples: ExplainExample[]): ExplanationModel {
  const out = fb.sentence?.out ?? null;
  const self = fb.sentence?.self ?? null;
  const lines: ExplanationModel['lines'] = [{ k: 'pattern', name: card.word, formula: null }];
  if (out) {
    lines.push({ k: 'yours', given: fb.given, text: out.why });
    if (out.better.trim()) lines.push({ k: 'note', text: `${lang === 'de' ? 'Noch natürlicher' : 'More natural'}: ${out.better.trim()}` });
  } else if (self) {
    lines.push({ k: 'why', text: self.containsTarget ? (self.longEnough ? (lang === 'de' ? 'Das Wort kommt vor und der Satz ist lang genug.' : 'The word is in your sentence and it is long enough.') : lang === 'de' ? 'Schreib einen ganzen Satz (mindestens sechs Wörter).' : 'Write a whole sentence (at least six words).') : lang === 'de' ? 'Das Wort kommt in deinem Satz nicht vor.' : 'The word is missing from your sentence.' });
  }
  return { lines, examples, mark: [card.word, card.lemma], ai: !!out, source: 'card' };
}

/** „Einmal richtig schreiben“ (M5): freiwillig, zählt nicht als Antwort und ändert keine Note. */
function CopyOnceField({ solution }: { solution: string }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const ok = value.trim().toLowerCase() === solution.trim().toLowerCase();
  return (
    <div className="flex flex-col gap-1" data-testid="copy-once">
      <input className="lx-field" lang="en" value={value} onChange={(ev) => setValue(ev.target.value)} aria-label={t('lrCopyLabel')} data-testid="copy-once-input" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {ok && (
        <p className="lx-t-meta text-ok-text" role="status">
          ✓
        </p>
      )}
    </div>
  );
}

/** „War das auch richtig?“ (nur auf Antippen): Ohne Antippen gibt es keine Claude-Anfrage. */
function SynonymAsk({ card, given, onOk }: { card: Exercise['card']; given: string; onOk: () => void }) {
  return <SynonymCheck card={card} given={given} onOk={onOk} />;
}

import { SynonymCheck } from './SynonymCheck';
