import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useT, type MessageKey } from '../../i18n';
import { Choices } from '../../engine/Choices';
import { CHOICE_LETTERS, choiceKeyRange } from '../../engine/choiceKeys';
import { Tiles } from '../../engine/Tiles';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { bindInputKind, createAttemptTracker, pickAttempt, promptChars } from '../../engine/inputKind';
import { KineticGap, hintOffset, type GapState } from '../../engine/KineticGap';
import { SpotSentence } from '../../engine/SpotSentence';
import { useSwipeLeft } from '../../engine/swipe';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { alignWords } from '../../domain/answer/align';
import { formKind } from '../../domain/answer/form';
import { checkTyped, checkWithHint } from '../../domain/answer/check';
import { maskOf } from '../../domain/answer/mask';
import { normalize } from '../../domain/answer/normalize';
import { chunkAlternatives } from '../../domain/chunks/alternatives';
import { retryHint, type RetryHint } from '../../domain/answer/retryHint';
import { checkSituation, typedForm } from '../../domain/chunks/situation';
import { scoreDictation } from '../../domain/drills/dictation';
import { packExtraOf } from '../../domain/c1pack/packFields';
import type { ExplainExample, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { wordStatus } from '../../domain/tutor/learnerWords';
import { useClock } from '../../app/clock';
import { statusDetail } from './statusText';
import { choiceVerdict, exTextKey, gapCue, meaningTwins, tileMarks, tileMissing, tileShorterAlt, tilesAnswer } from '../../domain/srs/exercise';
import { cardExamples, OWN_EXAMPLE_MIN_STAGE, storedTranslation, wantsEnrichment } from '../../domain/srs/examples';
import { explainWord, isAltAnswer } from '../../domain/srs/explainWord';
import { posKey } from '../../domain/srs/explain';
import { meaningOf, shortMeaning } from '../../domain/srs/cards';
import { autoGrade, produceGrade } from '../../domain/srs/grade';
import { wasInterrupted } from '../../domain/grade';
import { exerciseDef } from '../../domain/srs/modes';
import { stageStep } from '../../domain/srs/applyReview';
import { GERMAN_HINT_EN, HARD_ISSUES, germanHints, jaccard, precheckProduce, selfCheckProduce, shownSentences, type GermanHintId, type PrecheckIssue, type SelfCheck } from '../../domain/srs/produce';
import { sceneText } from '../../content/activation/scenes';
import { trapForCard } from '../../domain/srs/traps';
import type { AttemptInput, AttemptMeta, CheckResult, Exercise, ExerciseId, Grade, Option } from '../../domain/srs/types';
import { checkSayIt, type SayItCheck } from '../../domain/srs/sayIt';
import { inputProfile } from '../../platform/input';
import { speak, stopSpeech, useSpeech } from '../../platform/speech';
import { briefVarsOf, produceCheckV2, type ProduceCheckV2Out } from '../../prompts/produceCheckV2';
import { activateTaskVarsOf, activateTemplateFor, mailTextOf, type ActivateCheckVars, type ActivateTargetOut } from '../../prompts/activateCheck';
import { ACT_HARD_ISSUES, activateGrade, precheckAct, selfCheckAct, type ActIssue } from '../../domain/srs/actCheck';
import { HIDES_TARGET } from '../../domain/srs/actBrief';
import { dayLabel } from '../../domain/activation/actDoc';
import { ActPanel } from './ActPanel';
import { ownTextsOf, reusableSentencesOf } from './actStore';
import { TutorButton } from '../../ui/exercise/TutorButton';
import { ExerciseShell, SentenceInput, explainDepth, type ShellFeedback, type ShellMenuId, type ShellSecondary } from '../../ui/exercise';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { useCompanionSee } from '../companion/seeing';
import { companionOpenedSince, companionOpenMs } from '../companion/store';
import { saveRepairs } from '../repair/store';
import { requestExamples, useExamples } from './examples';
import { answerDueIn, commitAnswer, prepareNext, releaseLeft, useSession, type ActRecord, type Answer, type FirstKind, type LeaveMode } from './session';
import { registerLeaveBook } from '../../ui/exercise/leaveBook';
import { nextT } from './persist';
import { WordExtras } from './WordExtras';
import { reportWordCtx } from './wordCtx';
import { AiMark } from '../../ui/AiMark';

// Eine Wörter-Übung im Übungsgerüst (Lernplattform 2.0 §4.8, §5.6). Das Gerüst (`ExerciseShell`) zeichnet Status, Aufgabenzeile, Satz, Eingabe,
// Urteil, Vergleich und die Erklär-Karte; diese Datei sammelt nur Eingabe und Prüfung je Abfrageart:
//   Auswahl (mc_en, ctx_mc, listen_mc, mc_de, match, colloc_gap) → `Choices` A–D, dann „Prüfen“
//   Lücke (cloze_hint, cloze, type, colloc, wordfam, situation, dictation) → `KineticGap` in der Lücke
//   Falle finden (find_trap) → Wort antippen · Satz vervollständigen (complete) und eigener Satz (produce) → `SentenceInput`
// Keine Selbstbewertung: die Note folgt aus Richtigkeit, Zeit und Hilfe. Die Warum-Zeile nennt den echten Fehlergrund (`explainWord`).

/** Claudes Urteil über einen Satz: `produce-check@2` oder `activate-check@1` (dieselben Felder, bei Letzterem dazu `targets` und `reusable`). */
type SentenceOut = ProduceCheckV2Out & { targets?: ActivateTargetOut[]; reusable?: boolean; mainVerdict?: ProduceCheckV2Out['verdict']; alt?: string };

type Feedback = {
  result: CheckResult;
  /** Gewertete Eingabe (mit vorgegebenem Anfangsbuchstaben, falls nicht mitgetippt). */
  given: string;
  chosen: Option | null;
  grade: Grade;
  /** Abstand bis zur nächsten Fälligkeit (ms) bei dieser Note – genau der gespeicherte (`answerDueIn`). */
  dueInMs: number;
  /** Zeitstempel der Vorschau; geht beim Weitergehen als `t` an die Antwort (gleich für Anzeige und Speichern, wie beim Aufdecken). */
  t: number;
  ms: number;
  /** Einspruch „Ich lag richtig“ (M4). */
  override: boolean;
  /** Genutzte Hilfe (Tipp, zweiter Versuch, Begleiter): gewichtet die Antwort geringer. */
  hint: 0 | 1 | 2;
  /** Richtig, aber nach einer Unterbrechung (> 60 s): Note 3, die Stufe steigt nicht. */
  interrupted?: true;
  /** Richtig, die Stufe steigt aber noch nicht: so viele richtige freie Antworten an anderen Tagen fehlen noch (Erklärung unter dem Ergebnis). */
  hold?: number;
  /** „Weiß ich nicht“: die Lösung wird gezeigt, ohne Wertung als Fehlgriff. */
  dontKnow?: boolean;
  /** find_trap: das angetippte Wort. */
  tapped?: [number, number] | null;
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt und Eingabeart; fehlen ohne Kontakt. Nur gespeichert, nie für die Note. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4-Nacharbeit): gemischt, Senden vor Claude, Prompt-Länge, zweiter Versuch, verborgene Seite (siehe `AttemptMeta`). */
  mx?: AttemptMeta['mx'];
  sm?: number;
  pl?: number;
  n?: AttemptMeta['n'];
  bg?: AttemptMeta['bg'];
  /** complete/produce: Claudes Prüfung bzw. die lokale Prüfung. */
  sentence?: { out: SentenceOut | null; self: SelfCheck | null; /** Vorprüfung ohne Claude: Mangel, der den Satz als „Noch nicht“ beendet. */ issue?: PrecheckIssue | ActIssue; hints?: GermanHintId[]; /** A2–A5: Die Vorprüfung hatte schon einen Hinweis gegeben. */ helped?: boolean; /** „Sag es“: lokale Prüfung (Zielwort, Länge). */ sayIt?: SayItCheck };
};

/** Wort-Lernen 2: Beschriftung der Abrufe am Tag 0 und des ersten Abrufs danach („Gestern-Check“). */
// Abruf 1/2 sagen schon, wie gefragt wird („mit Anfangsbuchstaben“, „frei“): ohne den Namen der Übung (sonst doppelt und am Handy zweizeilig).
const RECALL_LABEL: Record<NonNullable<Exercise['recall']>, MessageKey> = { day0a: 'pxWkRecallDay0a', day0b: 'pxWkRecallDay0b', yesterday: 'pxWkRecallYesterday', first: 'pxWkRecallFirst' };
const PURPOSE: Record<number, MessageKey> ={ 1: 'purpose1', 2: 'purpose2', 3: 'purpose3', 4: 'purpose4', 5: 'purpose5' };
/** Freie Tipp-Arten: „Tipp“ deckt Platzhalter bzw. den ersten Buchstaben auf (zählt als Hilfe). */
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set(['cloze', 'cloze_part', 'type', 'situation', 'colloc', 'wordfam']);
/**
 * Arten, deren Frage die deutsche Bedeutung nach der Antwort noch zeigt – im Ergebnis nicht noch einmal (H3, Kap. 15).
 * Die Erklär-Karte nennt die Bedeutung nie als eigene Zeile; sie steht im Satz bzw. in „Merke“.
 */
const ANSWER_IS_DE: ReadonlySet<ExerciseId> = new Set(['mc_en', 'ctx_mc', 'listen_mc']);
/** Arten, deren Frage die deutsche Bedeutung nach dem Prüfen noch zeigt: „Merke“ wiederholt sie nicht. */
const MEANING_SHOWN: ReadonlySet<ExerciseId> = new Set(['mc_de', 'type', 'match', 'situation']);
const LISTEN: ReadonlySet<ExerciseId> = new Set(['listen_mc', 'dictation']);
/** Getippte Arten ohne „Gesucht: …“-Zeile: Deutsch → Englisch zeigt die Bedeutung schon groß, Diktat verriete die Lösung, Situation hat ihre Absicht. */
const SOUGHT_SKIP: ReadonlySet<ExerciseId> = new Set(['type', 'dictation', 'situation']);
/** „Erst ein Hinweis, dann die Lösung“: getippte Arten mit zweitem Versuch. Nicht Diktat, nicht Auswahl, nie im Wochen-Check (`noHelp`). */
const RETRY_EX: ReadonlySet<ExerciseId> = new Set(['cloze_hint', 'cloze', 'cloze_part', 'type', 'situation', 'colloc', 'wordfam']);
/** Arten mit einer Satzantwort (Claude prüft, lokal nur eine grobe Prüfung). */
const SENTENCE_EX: ReadonlySet<ExerciseId> = new Set(['complete', 'produce', 'say_it', 'act_scene', 'act_rewrite', 'act_impulse', 'act_combo', 'act_mail']);
// Feste leere Referenz statt `?? []` im Selektor (sonst rendert die Karte endlos neu, React-Fehler #185).
const NO_EXAMPLES: readonly { en: string; t: number }[] = [];
/** „Welches Wort passt?“ (P52): das richtige (andere) Wort mit Kurzbedeutung aus der richtigen Option. */
const contrastOtherOf = (e: Exercise): { word: string; meaning: string | null } | null => {
  const ok = e.options.find((o) => o.correct);
  return ok ? { word: ok.fromWord ?? ok.label, meaning: ok.fromMeaning ?? null } : null;
};
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHOICE_LANGS = { de: 'de', en: 'en' } as const;

/** Höchste Tipp-Stufe je Art: getippte Arten und Auswahl 2, Falle finden und Diktat 1, Satzantworten keiner. */
const maxTipOf = (ex: ExerciseId, input: Exercise['input'], hiddenAct = false): 0 | 1 | 2 => (ex === 'fits' ? 0 : SENTENCE_EX.has(ex) ? (hiddenAct ? 1 : 0) : FREE_TYPED.has(ex) || input === 'choice' ? 2 : 1);

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
  const { t, tn, lang, dateShort } = useT();
  const api = useHiddenInput();
  const ai = useAiAvailable();
  const tts = useSpeech((s) => s.status === 'ready');
  // „Passt das Wort?“: Die Optionen tragen im Bereich Domäne nur ihre Kennung (yes/no); beschriftet wird hier in der Oberflächensprache (Antwort, Lösung und Ergebnis zeigen dann Klartext).
  const e = useMemo(
    () =>
      exercise.ex === 'fits'
        ? { ...exercise, options: exercise.options.map((o) => ({ ...o, label: t(o.id === 'yes' ? 'fitsYes' : 'fitsNo'), lang })), accepted: [t(exercise.fits?.truth ? 'fitsYes' : 'fitsNo')] }
        : exercise,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuer Aufgabe oder anderer Sprache
    [exercise, lang],
  );
  const card = e.card;
  // Das Eingabeprofil der Runde (einmal eingefroren, Session) bzw. des Geräts (Wochen-Check).
  const [touch] = useState(() => {
    const s = useSession.getState();
    return s.active ? !!s.env.touch : inputProfile() === 'touch';
  });
  // Status zu Beginn der Aufgabe (Paket ST): dieselbe Rechnung wie Liste, Wortblatt, Hub und Fortschritt.
  const [stat0] = useState(() => wordStatus(card, useClock.getState().now));
  const state0 = stat0.tier;
  const [fb, setFb] = useState<Feedback | null>(null);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  /** Hinweis nach einem falschen ersten Versuch; gesetzt = zweiter Versuch läuft bzw. lief. */
  const [retry, setRetry] = useState<RetryHint | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [sentenceText, setSentenceText] = useState('');
  const [spot, setSpot] = useState<[number, number] | null>(null);
  /** Bausteine (tiles): gelegte Baustein-Nummern und der Platz, in den der Vorrat gezeichnet wird. */
  const [placed, setPlaced] = useState<number[]>([]);
  const [poolEl, setPoolEl] = useState<HTMLElement | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const askProduce = useAsk(produceCheckV2);
  // Kundenmail und Kombi-Satz laufen auf `default`, die kurzen Aufgaben auf `quick` (Lernwissenschaft M4).
  const askAct = useAsk(activateTemplateFor(e.act?.fmt ?? 'sc'));
  // Aktivierungs-Aufgaben A2–A5 prüft `activate-check@1`, „Eigener Satz“ `produce-check@2`.
  const askSentence = e.act ? askAct : askProduce;
  /** Wie oft die Vorprüfung schon zum Nachbessern geschickt hat (höchstens einmal je Aufgabe). */
  const precheckTries = useRef(0);
  const [precheckMsg, setPrecheckMsg] = useState<string | null>(null);
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
  // S1-ZEIT (P4): erster Kontakt und Eingabeart, getrennt von `firstKeyAt` (das bleibt allein für die Note). Pausen wie `measure()`.
  const [attempt] = useState(createAttemptTracker);
  const extras = extra?.items ?? NO_EXAMPLES;
  // Korrekturrunde P3 (Punkt 4, LS3): Buchung beim Verlassen. `done`: schon gebucht – `go` (Weiter oder Verlassen) bzw. `stay` (beim Verbergen
  // gespeichert, Weitergehen steht aus). Nie zweimal. Solange Claude „War das auch richtig?“ prüft, wird nichts gebucht.
  const done = useRef<false | LeaveMode>(false);
  const synBusy = useRef(false);
  const [onSynBusy] = useState(() => (b: boolean) => {
    synBusy.current = b;
  });
  /** Hinweisrunde (LS10): der erste, falsche Versuch. */
  const firstTry = useRef<string | null>(null);

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

  // S1-ZEIT (P4): Tasten und Einfügungen in der einen versteckten Eingabe (liegt außerhalb der Übung) oder in einem Feld der Übung.
  useEffect(() => bindInputKind(document, { accept: (el) => api.isInput(el) || (el instanceof Node && !!root.current?.contains(el)), tracker: attempt, now: () => performance.now(), paused: () => lookupOpenMs() - lookupAtStart.current + (companionOpenMs() - companionAtStart.current) }), [api, attempt]);

  const isChoice = e.input === 'choice';
  const isSpot = e.input === 'spot';
  const isSentence = SENTENCE_EX.has(e.ex);
  const isTyped = e.input === 'typed';
  const isTiles = e.input === 'tiles' && !!e.tiles;
  const shownSentence = isTyped || isChoice || isSpot ? (e.sentence?.sentence ?? null) : null;
  const solution = e.accepted[0] ?? card.word;
  const tileMode: 'letters' | 'words' = /\s/.test(solution) ? 'words' : 'letters';
  const meaningText = lang === 'de' ? (card.de ?? card.def) : (card.def ?? card.de);

  // ------------------------------------------------------------------ Tipp-Leiter
  // Stufe 1 Wortart und Bedeutung bzw. Erklärung (nie die Lösung), Stufe 2 der erste Buchstabe (getippt) bzw. eine falsche Option weniger (Auswahl).
  // Partnerwort getippt: Stufe 1 erster Buchstabe, Stufe 2 die Möglichkeiten (Plan §5.6). Falle finden: die Leitfrage der Falle.
  // A4 (Wort nicht gezeigt) bekommt eine Stütze: erster Buchstabe und Wortart, mit Stütze höchstens „Schwer“ (Lernwissenschaft M2).
  const hiddenAct = !!e.act && !e.act.showTarget;
  const maxTip: 0 | 1 | 2 = noHelp ? 0 : maxTipOf(e.ex, e.input, hiddenAct);
  const fam = packExtraOf(card)?.fam;
  const maskWord = (s: string): string =>
    [card.word, card.lemma, ...(e.ex === 'wordfam' ? Object.values(fam ?? {}) : [])].filter(Boolean).reduce((acc, w) => acc.replace(new RegExp(escapeRe(w), 'gi'), '…'), s);
  const trap = trapForCard(card);
  const tipBase: string | null = (() => {
    if (hiddenAct) {
      const letter = (card.kind === 'chunk' ? typedForm(card.word) : card.word).trim().charAt(0);
      const pk = posKey(card.pos);
      return letter ? t('actTip', { letter, pos: pk ? `, ${t(pk as MessageKey)}` : '' }) : null;
    }
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

  /** S1-ZEIT (P4): erster Kontakt beim Antippen (Auswahl, Baustein, Wort) – mit derselben Pausenregel wie `measure()`. */
  const touchAttempt = () => attempt.contact(performance.now(), lookupOpenMs() - lookupAtStart.current + (companionOpenMs() - companionAtStart.current));

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
    const t0 = nextT();
    const dueInMs = answerDueIn(e, { grade, ok: grade > 1, hint: hintUsed }, t0);
    const interrupted = forced === undefined && result.verdict === 'correct' && wasInterrupted({ key: e.ex, timeMs: ms, firstKeyMs: firstKey });
    // Warum die Stufe nicht steigt (M1): richtig, aber das Tor der freien Antworten ist noch zu.
    const hold = grade > 1 ? stageStep(card.doc, { t: t0, day: useSession.getState().day, ex: e.ex, grade, ...(e.colloc && e.colloc.index >= 0 ? { colIndex: e.colloc.index } : {}), ...(interrupted ? { interrupted: true as const } : {}) }).missing : 0;
    // S1-ZEIT (P4): nur gespeichert. Ohne Kontakt (z. B. „Weiß ich nicht“ sofort) fehlen `fk`, `in` und `mx`. Zweiter Versuch: nach dem Hinweis oder nach der Vorprüfung.
    const meta = attempt.meta({ start, answer: given, base: isTyped || isSentence ? 't' : 'c', second: !!retry || precheckTries.current > 0, pl: promptChars(root.current) });
    setFb({ result, given, chosen: picked, grade, dueInMs, t: t0, ms, override: false, hint: hintUsed, ...(interrupted ? { interrupted: true as const } : {}), ...(hold > 0 ? { hold } : {}), ...meta, ...extraFb });
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
    firstTry.current = given;
    setRetry(h);
    api.focusNow();
    return true;
  };

  // Gleichwertige Varianten (Paket) und Bedeutungs-Zwillinge aus deinem Wortschatz (gleiche deutsche Hauptbedeutung): „fast richtig“, nicht falsch.
  const alt = useMemo(() => [...(packExtraOf(card)?.alt ?? []), ...meaningTwins(card, useSession.getState().pool)], [card]);

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
    if (isTiles && e.tiles) {
      if (!placed.length) return;
      const given = tilesAnswer(e.tiles, placed, tileMode);
      finish(checkTyped(given, e.accepted, { lemma: card.lemma, alt }), given, null);
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
  const sentenceVars = (hints: readonly GermanHintId[] = []) => ({
    target: card.kind === 'chunk' ? typedForm(card.word) : card.word,
    meaning: meaningText ?? '',
    sentence: fullSentence(),
    uiLang: lang,
    kind: card.kind === 'chunk' || /\s/.test(card.lemma) ? ('phrase' as const) : ('word' as const),
    brief: e.brief ? briefVarsOf(e.brief) : null,
    hints: hints.slice(0, 2).map((h) => GERMAN_HINT_EN[h]),
  });
  const sentenceBusy = askSentence.phase === 'queued' || askSentence.phase === 'thinking' || askSentence.phase === 'slow' || askSentence.phase === 'streaming';

  /**
   * Ohne Claude: `produce` wie `complete` höchstens „Schwer“ und „ungeprüft“ (Lernwissenschaft H1): ob der Satz stimmt, weiß nur Claude; lokal ist
   * nur geprüft, ob das Wort vorkommt, der Satz lang genug ist und nicht abgeschrieben wirkt. Ein „Gut“ ohne Prüfung würde die Planung aufblähen.
   */
  const checkSentenceLocal = (): void => {
    const text = fullSentence();
    if (e.act) {
      // Claude nicht erreichbar: höchstens „Schwer“, ungeprüft (nie „Gut“ ohne Prüfung).
      const { grade, pre } = selfCheckAct(text, e.act, shownOf(), ownTextsOf(card.key));
      finish({ verdict: grade >= 2 ? 'near' : 'wrong' }, text, null, { sentence: { out: null, self: null, hints: pre.hints } }, grade);
      return;
    }
    const self = selfCheckProduce(text, card, shownOf());
    const completeOk = e.ex === 'complete' ? self.containsTarget && text.trim().split(/\s+/).filter(Boolean).length >= 4 : self.grade >= 2;
    const verdict: CheckResult['verdict'] = e.ex === 'complete' ? (completeOk ? 'near' : 'wrong') : self.grade >= 2 ? 'near' : 'wrong';
    const forced: Grade = e.ex === 'complete' ? (completeOk ? 2 : 1) : (Math.min(self.grade, 2) as Grade);
    finish({ verdict }, text, null, { sentence: { out: null, self, hints: germanHints(text) } }, forced);
  };

  /** Alle gezeigten Sätze der Karte (Ursprung, Beispiele, Rotation) für die Abschreibprüfung. */
  const shownOf = (): string[] => shownSentences(card, extras);

  /** Rückmeldung der Vorprüfung beim ersten Durchfall: sagt, was fehlt, und lässt einmal nachbessern (ohne Claude-Aufruf). */
  const precheckText = (issue: PrecheckIssue, hints: readonly GermanHintId[]): string => {  // hints = die sperrenden Muster
    const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
    const what =
      issue === 'target'
        ? t('ppTarget', { word: target })
        : issue === 'short'
          ? t('ppShort')
          : issue === 'copied'
            ? t('ppCopied')
            : issue === 'form'
              ? t(`ppForm_${e.brief?.form === 'q' ? 'q' : e.brief?.form === 'i' ? 'i' : 'n'}` as MessageKey)
              : t('ppGerman', { hint: hints[0] ? t(`gh_${hints[0]}` as MessageKey) : '' });
    return `${what} ${t('ppOnce')}`;
  };

  /** Vorgaben der Aufgabe A2–A5 für den Prompt (englische Beschreibungen, nie Kennungen). */
  const activateVars = (hints: readonly GermanHintId[] = []): ActivateCheckVars => {
    const task = e.act!;
    return {
      targets: task.targets.map((x) => ({
        word: x.kind === 'chunk' ? typedForm(x.word) : x.word,
        meaning: x.meaning ?? '',
        kind: x.kind === 'chunk' || /\s/.test(x.lemma) ? 'phrase' : 'word',
        shown: task.showTarget,
      })),
      sentence: fullSentence(),
      uiLang: lang,
      task: activateTaskVarsOf(task),
      source: task.source?.text ?? null,
      mail: mailTextOf(task),
      prior: ownTextsOf(card.key).slice(-3),
      hints: hints.slice(0, 2).map((h) => GERMAN_HINT_EN[h]),
    };
  };

  /** Text der Vorprüfung bei A2–A5: sagt, was fehlt (bei A4 nie das Wort selbst), und lässt einmal nachbessern. */
  const actPrecheckText = (pre: ReturnType<typeof precheckAct>): string => {
    const task = e.act!;
    const what =
      pre.issue === 'target'
        ? HIDES_TARGET.has(task.fmt)
          ? t('ppAct_targetHidden')
          : t('ppAct_target', { words: pre.missing.join(', ') })
        : pre.issue === 'short'
          ? t('ppAct_short')
          : pre.issue === 'same'
            ? t('ppAct_same')
            : pre.issue === 'copied'
              ? t('ppAct_copied')
              : pre.issue === 'shape'
                ? task.fmt === 'ml'
                  ? t('ppAct_shape_ml')
                  : t('ppAct_shape', { shape: t(`actShape_${task.shape}` as MessageKey) })
                : t('ppGerman', { hint: pre.block[0] ? t(`gh_${pre.block[0]}` as MessageKey) : '' });
    return `${what} ${t('ppOnce')}`;
  };

  /** A2–A5: Vorprüfung ohne KI, dann `activate-check@1`. Ein Aufruf je Aufgabe, nie automatisch wiederholt (A6.3). */
  async function checkAct(): Promise<void> {
    const task = e.act!;
    const text = fullSentence();
    const pre = precheckAct(text, task, shownOf(), ownTextsOf(card.key));
    if (pre.issue) {
      if (precheckTries.current === 0) {
        precheckTries.current = 1;
        setPrecheckMsg(actPrecheckText(pre));
        api.focusNow();
        return;
      }
      // Zweiter Versuch ohne Besserung: Fehlt ein Zielwort, entscheidet mit KI Claude (getrennte Wendungen erkennt die lokale Suche nicht sicher). Sonst „Noch nicht“
      // ohne Claude-Aufruf: fehlendes Wort und zu kurz sind „Nochmal“, abgeschrieben oder unverändert höchstens „Schwer“ (kein sicheres Abrufversagen).
      if (ACT_HARD_ISSUES.has(pre.issue) && !(pre.issue === 'target' && ai)) {
        const forced: Grade = pre.issue === 'target' || pre.issue === 'short' ? 1 : 2;
        finish({ verdict: 'wrong' }, text, null, { sentence: { out: null, self: null, issue: pre.issue, hints: pre.hints } }, forced);
        return;
      }
    }
    if (!ai) {
      checkSentenceLocal();
      return;
    }
    // S1-ZEIT (P4-Nacharbeit): Antwortzeit beim Tippen auf „Prüfen“, ohne das Warten auf Claude.
    attempt.send(measure().ms, promptChars(root.current));
    const out = await askAct.run(activateVars(pre.hints));
    // Fehler (not_granted, rate_limited, …): lokales Urteil auf Wunsch, ohne automatischen Neuversuch (A6.3); „Erneut versuchen“ bleibt beim Nutzer.
    if (!out) {
      attempt.unsend();
      return;
    }
    // Hat die Vorprüfung schon einen Hinweis gegeben, zählt das als Hilfe: höchstens „Schwer“ (Lernwissenschaft N3).
    const grade = activateGrade(out, precheckTries.current > 0 || tip > 0);
    const verdict: CheckResult['verdict'] = out.verdict === 'correct' ? 'correct' : out.verdict === 'minor' ? 'near' : 'wrong';
    finish({ verdict }, text, null, { sentence: { out, self: null, hints: pre.hints, helped: precheckTries.current > 0 } }, grade, true);
    // Ein falscher oder zu schwacher Satz wird zum Fehlersatz (Box 1), nur mit echter Korrektur und nur bei einem einzelnen kurzen Satz (nicht bei der Mail).
    if (task.fmt !== 'ml' && out.verdict !== 'correct' && out.fixed.trim() && out.fixed.length <= 250 && text.length <= 250 && normalize(out.fixed) !== normalize(text)) {
      void saveRepairs([{ wrong: text, right: out.fixed.trim(), why: out.why, src: 'write' }]);
    }
  }

  async function checkSentence(): Promise<void> {
    if (fb || !sentenceText.trim() || sentenceBusy) return;
    // S1-ZEIT: ein früheres Senden gilt nicht für diesen Versuch.
    attempt.unsend();
    if (e.act) {
      await checkAct();
      return;
    }
    if (e.ex === 'say_it') {
      // „Sag es“: lokal, ohne KI – Zielwort da und ganzer Satz = „Gut“; sonst „Schwer“ und ungeprüft (die Spracherkennung kann sich verhört haben).
      const text = fullSentence();
      const c = checkSayIt(text, card, e.sayIt?.de ?? '');
      finish({ verdict: c.grade >= 3 ? 'correct' : 'near' }, text, null, { sentence: { out: null, self: null, sayIt: c } }, c.grade);
      return;
    }
    let hints: GermanHintId[] = [];
    if (e.ex === 'produce') {
      // Vorprüfung (Wörter aktivieren, Stufe 1): Wort fehlt, zu kurz, abgeschrieben, falsche Satzform, typischer Deutsch-Fehler – alles ohne KI-Aufruf.
      const pre = precheckProduce(fullSentence(), card, shownOf(), e.brief);
      hints = pre.hints;
      if (pre.issue) {
        if (precheckTries.current === 0) {
          precheckTries.current = 1;
          setPrecheckMsg(precheckText(pre.issue, pre.block));
          api.focusNow();
          return;
        }
        // Zweiter Versuch ohne Besserung. „Wort fehlt“ entscheidet mit KI Claude (getrennte Wendungen wie „follow it up“ erkennt die lokale Suche nicht
        // sicher); sonst, und bei „abgeschrieben“, lokal „Noch nicht“ ohne Claude-Aufruf und ohne Fehlersatz. Weder das eine noch das andere ist ein
        // sicheres Abrufversagen: höchstens „Schwer“ (Lernwissenschaft H3). „Zu kurz“ bleibt „Nochmal“.
        if (HARD_ISSUES.has(pre.issue) && !(pre.issue === 'target' && ai)) {
          const forced: Grade = pre.issue === 'short' ? 1 : 2;
          finish({ verdict: 'wrong' }, fullSentence(), null, { sentence: { out: null, self: selfCheckProduce(fullSentence(), card, shownOf()), issue: pre.issue, hints: pre.hints } }, forced);
          return;
        }
      }
    }
    if (!ai) {
      checkSentenceLocal();
      return;
    }
    // S1-ZEIT (P4-Nacharbeit): Antwortzeit beim Tippen auf „Prüfen“, ohne das Warten auf Claude.
    attempt.send(measure().ms, promptChars(root.current));
    const out = await askProduce.run(sentenceVars(hints));
    // Fehler (not_granted, rate_limited, …): lokales Urteil, ohne automatischen Neuversuch (A6.3); „Erneut versuchen“ bleibt beim Nutzer.
    if (!out) {
      attempt.unsend();
      return;
    }
    // Hat die Vorprüfung schon einen Hinweis gegeben (Wort, Form, typischer Fehler), zählt das als Hilfe: höchstens „Schwer“ (Lernwissenschaft N3).
    const grade = (precheckTries.current > 0 ? Math.min(produceGrade(out.verdict, out.usesTarget), 2) : produceGrade(out.verdict, out.usesTarget)) as Grade;
    const verdict: CheckResult['verdict'] = out.verdict === 'correct' ? 'correct' : out.verdict === 'minor' ? 'near' : 'wrong';
    finish({ verdict }, fullSentence(), null, { sentence: { out, self: null, hints } }, grade, true);
    // Ein falscher oder zu schwacher Satz wird zum Fehlersatz (Box 1), nur mit echter Korrektur.
    if (out.verdict !== 'correct' && out.fixed.trim() && normalize(out.fixed) !== normalize(fullSentence())) {
      void saveRepairs([{ wrong: fullSentence(), right: out.fixed.trim(), why: out.why, src: 'write' }]);
    }
  }

  // ------------------------------------------------------------------ Weiter, Tipp, Weiß ich nicht

  /** Die bewertete Antwort, wie „Weiter“ sie speichert (auch beim Verlassen, Punkt 4). */
  const answerOf = (f: Feedback): Answer => {
    const rec = actRecordOf(f, e);
    const timing = pickAttempt(f);
    // Hinweisrunde (LS10): der erste, falsche Versuch geht als Fehler mit (nur wenn er sich vom gewerteten unterscheidet).
    const first = retry && firstTry.current?.trim() && normalize(firstTry.current) !== normalize(f.given) ? { firstWrong: firstTry.current } : {};
    return f.override ? { grade: 3, given: f.given, ms: f.ms, ok: true, override: true, t: f.t, ...timing } : { grade: f.grade, given: f.given, ms: f.ms, ok: f.grade > 1, hint: f.hint, t: f.t, ...(f.interrupted ? { interrupted: true as const } : {}), ...(f.sentence && !f.sentence.out && !f.override && f.sentence.sayIt?.verified !== true ? { unverified: true as const } : {}), ...(f.sentence?.sayIt?.noteOnly && !f.override ? { noteOnly: true as const } : {}), ...(rec ? { rec } : {}), ...first, ...timing };
  };

  /**
   * Punkt 4 (LS3): geprüft, aber nicht mit „Weiter“ bestätigt → beim Verlassen buchen (`left: true`). Nur in der Trainer-Runde (eigene
   * Schreibwege wie der Wochen-Check buchen selbst), nur solange diese Aufgabe in der Runde steht, nie während Claude noch prüft.
   */
  const bookLeft = (mode: LeaveMode): void => {
    if (!fb || done.current || onCommit || synBusy.current) return;
    if (useSession.getState().exercise !== exercise) return;
    done.current = mode;
    commitAnswer(answerOf(fb), mode);
  };
  /** Verlassen (Runde, Reiter, Bildschirm): buchen und weiterrechnen – oder nach einer `stay`-Buchung nur noch weitergehen. */
  const leaveNow = (): void => {
    if (done.current === 'stay') {
      done.current = 'go';
      releaseLeft();
      return;
    }
    bookLeft('go');
  };
  const leaveRef = useRef({ bookLeft, leaveNow });
  useEffect(() => {
    leaveRef.current = { bookLeft, leaveNow };
  });
  // Seite verborgen (App gewechselt, Bildschirm aus) bzw. verlassen: speichern, die Karte bleibt mit ihrem Ergebnis stehen.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') leaveRef.current.bookLeft('stay');
    };
    const onHide = () => leaveRef.current.bookLeft('stay');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      // Aushängen ohne „Weiter“ (Reiter gewechselt, Runde verlassen): buchen und weiterrechnen.
      leaveRef.current.leaveNow();
    };
  }, []);
  // ✕, Pause, Esc: `leaveSession` bucht über diese Anmeldung, BEVOR es die Aufgabe abräumt.
  useEffect(() => {
    if (!fb || onCommit) return;
    return registerLeaveBook(() => leaveRef.current.leaveNow());
  }, [fb, onCommit]);

  const next = () => {
    if (!fb) return;
    let kind: FirstKind;
    if (done.current === 'stay') {
      // Beim Verbergen schon gespeichert: nur noch weitergehen.
      done.current = 'go';
      kind = releaseLeft() ?? null;
    } else if (done.current === 'go') return;
    else {
      done.current = 'go';
      kind = (onCommit ?? commitAnswer)(answerOf(fb));
    }
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
    // Einspruch: gespeichert wird Note 3 ohne Hilfe – „Wieder in …“ zeigt diesen Abstand.
    if (fb) setFb({ ...fb, override: true, dueInMs: answerDueIn(e, { grade: 3, ok: true, override: true }, fb.t) });
  };

  useHotkeys(
    {
      enter: () => {
        if (useLookup.getState().req) return;
        if (fb) next();
        else if (isTyped || isChoice || isSpot || isTiles) check();
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

  const rv: ResultVerdict = !fb ? 'ok' : fb.dontKnow ? 'dontKnow' : fb.override ? 'ok' : fb.sentence && !fb.sentence.out && fb.result.verdict !== 'wrong' && fb.sentence.sayIt?.verified !== true ? 'unchecked' : fb.result.verdict === 'correct' ? 'ok' : fb.result.verdict === 'near' ? 'near' : 'wrong';
  const learning = state0 === 'new' || state0 === 'learning' || state0 === 'wobbly';
  const depth = explainDepth({ verdict: rv, stage: card.stage, learning });

  /** Beispiele dieser Karte für die Erklär-Karte (Ursprungssatz zuerst, dann Paket und Claude), nie der Satz der Aufgabe. */
  const exampleItems: ExplainExample[] = useMemo(() => {
    // „Dein Satz vom …“: ein früher geprüfter eigener Satz (richtig, von Claude geprüft) als Beispiel – erst ab Stufe 4, nie der Satz dieser Aufgabe.
    const own = card.kind === 'vocab' && card.stage >= OWN_EXAMPLE_MIN_STAGE ? reusableSentencesOf(card.key).slice(0, 1).map((o) => ({ en: o.text, day: o.day })) : [];
    return cardExamples(card, shownSentence, extras, own).map((x) => ({ en: x.en, de: storedTranslation(card.doc, x.en), ctx: null, ...(x.src === 'own' && x.day ? { from: t('exOwnFrom', { date: dayLabel(x.day) }) } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuer Aufgabe oder neuen Beispielen
  }, [card, shownSentence, extras]);

  // Gleichwertige Fassung der ganzen Wendung (`content/chunkAlt.ts`): richtig, mit „Auch richtig“ und der Lernform (Emrah 21.10.2026).
  const alsoRight = !!fb && fb.result.verdict === 'correct' && !fb.override && card.kind === 'chunk' && !!fb.given && checkTyped(fb.given, chunkAlternatives(card.word), { lemma: '' }).verdict === 'correct' && checkTyped(fb.given, [solution], { lemma: '' }).verdict !== 'correct';

  // Emrahs Meldung 25.10.2026: die deutsche Bedeutung groß direkt unter dem Wort im Kopf der Ergebnis-Karte (nicht bei Kontrast und Wortpartner –
  // dort hat der Kopf ein anderes Paar, und „Merke“ nennt die Verbindung). „Merke“ wiederholt sie dann nicht (`meaningShown`).
  // Situation: Die Bedeutung steht schon als Absicht („Du willst sagen: …“) und bleibt nach dem Prüfen stehen – nicht noch einmal im Kopf (Kap. 15).
  const headMeaning = useMemo(() => {
    if (e.ex === 'contrast' || e.ex === 'colloc' || e.ex === 'colloc_gap' || e.ex === 'situation') return null;
    const m = (meaningOf(card, lang) ?? '').split(/\s*;\s*/).filter(Boolean).map((x) => shortMeaning(x, lang)).join(' · ');
    return m || null;
  }, [card, lang, e.ex]);
  const model: ExplanationModel | null = useMemo(() => {
    if (!fb) return null;
    if (fb.sentence?.sayIt) return sayItModel(fb.sentence.sayIt, card, e.sayIt?.model ?? null, e.sayIt?.de ?? null, exampleItems, t);
    if (fb.sentence) return sentenceModel(fb, card, exampleItems, t, e.act);
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
      ...(headMeaning || (MEANING_SHOWN.has(e.ex) && (e.ex !== 'match' || !e.sentence)) ? { meaningShown: true } : {}),
      ...(other ? { otherMeaning: lang === 'de' ? (other.de ?? other.def) : (other.def ?? other.de) } : {}),
      ...(isAlt ? { alt: true } : {}),
      ...(alsoRight ? { alsoRight: true } : {}),
      ...(e.ex === 'fits' && e.fits ? { fits: e.fits } : {}),
      ...(e.ex === 'contrast' && e.contrastWhy ? { contrastWhy: e.contrastWhy[lang] } : {}),
      ...(e.ex === 'contrast' ? { contrastOther: contrastOtherOf(e) } : {}),
      ...((e.ex === 'colloc' || e.ex === 'colloc_gap') && e.colloc ? { colloc: e.colloc } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei einem neuen Ergebnis
  }, [fb, exampleItems]);

  // ------------------------------------------------------------------ Was der Begleiter sieht

  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const blanked = e.sentence ? `${e.sentence.sentence.slice(0, e.sentence.start)}___${e.sentence.sentence.slice(e.sentence.end)}` : '';
  // Rückmeldung 3: Bei „Wortpartner“ steht im Kopf die geübte Verbindung (mit Vorlesen), das Kartenwort nur als Zusatz.
  const collocPhrase = (e.ex === 'colloc' || e.ex === 'colloc_gap') && e.colloc?.p.trim() && normalize(e.colloc.p) !== normalize(card.word) ? e.colloc.p.trim() : null;
  // „Eigener Satz“: Anweisung in drei Wortlauten, gewählt aus Karte und Verlauf (`brief.wording`), nie beim Neuzeichnen neu gewürfelt.
  const taskText =
    e.check === 'known'
      ? t('wxKnownTask')
      : e.act
        ? t(`act_${e.act.fmt}_${e.act.wording + 1}` as MessageKey, { type: e.act.type !== '-' ? t(`actTypeIn_${e.act.type}` as MessageKey) : '' })
        : e.ex === 'produce' && e.brief
          ? t(`task_produce_${e.brief.wording + 1}` as MessageKey)
          : t(`task_${exTextKey(e)}` as MessageKey);
  const seeDetail =
    e.ex === 'mc_en' || e.ex === 'ctx_mc' || e.ex === 'fits'
      ? `${taskText}\n${e.sentence?.sentence ?? card.word}`
      : e.ex === 'situation' && e.situation
        ? `${taskText}\n${e.situation.sceneTitle}\n${e.situation.intent}`
        : `${taskText}\n${blanked || e.meaning || ''}${e.meaning && blanked ? `\n(${e.meaning})` : ''}`;
  useCompanionSee({
    area: 'trainer',
    // Das Wort selbst erst nach dem Prüfen (vorher wäre es die Lösung); davor die Bedeutung, falls vorhanden.
    label: `${t('cmpSeeTrainer')} · ${t(`exName_${exTextKey(e)}` as MessageKey)}${fb ? ` · ${card.word}` : meaningText && !meaningText.toLowerCase().includes(card.word.toLowerCase()) ? ` · ${meaningText}` : ''}`.slice(0, 60),
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
  // Der Hinweis passt zur Lücke: bei Wortpartner-Aufgaben die Wendung, sonst das Kartenwort (`gapCue`).
  const gc = gapCue(e, lang);
  const cue = () =>
    gc && !fb ? (
      <p className="lx-t-support text-muted" data-testid="cue" data-kind={gc.kind} lang={lang}>
        {t(gc.kind === 'phrase' ? 'trHintPhrase' : 'trHint', { meaning: gc.text })}
      </p>
    ) : null;
  // Emrahs Meldung 25.10.2026: Bei einer Lücke im Satz ist die deutsche Bedeutung die Frage („Gesucht: Einstellung“), kein Tipp. Sie steht als
  // ruhige Zeile direkt unter der Aufgabe (über dem Satz, am Handy nicht von der Tastatur verdeckt) und bleibt nach dem Prüfen stehen.
  const soughtFor = isTyped ? !!e.sentence && !SOUGHT_SKIP.has(e.ex) && e.check !== 'known' : isTiles && !!e.tiles && !!e.sentence;
  const sought =
    gc && soughtFor ? (
      <p className="lx-t-support text-muted" data-testid="cue" data-kind={gc.kind === 'phrase' ? 'phrase' : 'sought'} lang={lang}>
        {gc.kind === 'phrase' ? t('trHintPhrase', { meaning: gc.text }) : t(card.kind === 'chunk' ? 'pxGcSoughtPhrase' : 'pxGcSought', { meaning: gc.text })}
      </p>
    ) : null;

  const gapState: GapState = !fb ? 'input' : fb.result.verdict;
  const mask = placeholdersOnly
    ? maskOf(solution, { firstLetter: false })
    : e.ex === 'cloze_hint' || retry?.kind === 'start'
      ? maskOf(solution, { firstLetter: true, perWord: card.kind === 'chunk' })
      : FREE_TYPED.has(e.ex) && tip > 0
        ? maskOf(solution, { firstLetter: e.ex === 'wordfam' || colTyped ? tip >= 1 && !(e.ex === 'wordfam' && tip === 1) : tip >= 2, perWord: card.kind === 'chunk' })
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
        {!e.sentence && !SOUGHT_SKIP.has(e.ex) && e.check !== 'known' && cue()}
      </div>
    );
  } else if (isTiles && e.tiles) {
    // Bausteine: Der Satz zeigt die Lücke als Ablagezeile, der Vorrat steht darunter. Die Ablagezeile zeigt so viele leere Plätze, wie die Lösung Bausteine hat.
    const line = (
      <Tiles
        tiles={e.tiles}
        placed={placed}
        onChange={(p) => {
          if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
          touchAttempt();
          setPlaced(p);
        }}
        locked={!!fb}
        // Emrahs Meldung 21.10.2026: nur wirklich falsch gelegte Bausteine sind rot; richtige grün, Wörter der Lösung an falscher Stelle ↔ (gleiche Bausteine vertauschbar).
        {...(fb ? { marks: fb.result.verdict === 'correct' ? Object.fromEntries(placed.map((id) => [id, 'ok'] as const)) : tileMarks(e.tiles, placed, e.accepted, tileMode) } : {})}
        labels={{ line: t('drTileLine'), pool: t('drTilePool') }}
        markLabels={{ ok: t('drMarkOk'), near: t('drMarkNear'), off: t('drMarkOff') }}
        dupLabel={(k, n) => t('drTileDup', { k, n })}
        // So viele Plätze, wie die Lösung Bausteine hat: vorab sichtbar, wie viele gebraucht werden (Emrahs Meldung 21.10.2026).
        slots={e.tiles.filter((x) => !x.distractor).length}
        {...(e.sentence ? { poolTarget: poolEl, inline: true } : {})}
        // UX-Prüfung WL2 S1: Was in der Zeile fehlt, steht nach dem Prüfen als gestrichelter Platz „fehlt: …“ darin.
        {...(fb && fb.result.verdict !== 'correct' ? { missing: tileMissing(e.tiles, placed, e.accepted, tileMode), missingLabel: t('drTileMissing') } : {})}
      />
    );
    // UX-Prüfung WL2 S2: Gilt auch eine kürzere Fassung aus denselben Bausteinen, sagen die Plätze „bis zu“, nicht „genau so viele“.
    const upTo =
      !fb && tileShorterAlt(e.tiles, e.accepted, tileMode) ? (
        <p className="lx-t-meta text-subtle" lang={lang} data-testid="tiles-upto">
          {t('drTileUpTo', { n: e.tiles.filter((x) => !x.distractor).length })}
        </p>
      ) : null;
    prompt = (
      <div className="flex flex-col gap-3" data-testid="tiles-task">
        {!e.sentence && e.meaning && (
          <p className="lx-t-task" lang={lang} data-testid="cue-meaning">
            {e.meaning}
          </p>
        )}
        {e.sentence ? sentence(e.sentence, line) : null}
        {upTo}
      </div>
    );
    answer = e.sentence ? <div ref={setPoolEl} data-testid="tiles-pool" /> : line;
  } else if (isSpot) {
    const all = e.sentence ? wordsWithOffsets(e.sentence.sentence) : [];
    const ws = all.map((x) => x.w);
    const idx = e.sentence ? all.flatMap((w, i) => (w.start < e.sentence!.end && w.end > e.sentence!.start ? [i] : [])) : [];
    const target: [number, number] | null = idx.length ? [idx[0] as number, idx[idx.length - 1] as number] : null;
    // Nach dem Prüfen: die richtige Stelle (✓) und, falls daneben getippt, die falsche (✕).
    const marks = fb && target ? [{ span: target, tone: 'ok' as const }, ...(fb.result.verdict === 'wrong' && fb.tapped ? [{ span: fb.tapped, tone: 'wrong' as const }] : [])] : undefined;
    prompt = <SpotSentence words={ws} pick="one" selected={fb ? null : spot} onSelect={(w) => { touchAttempt(); setSpot(w); }} locked={!!fb} {...(marks ? { marks } : {})} area="trainer" source={card.path} testId="sentence" label={t('trSpotLabel')} />;
  } else if (isSentence) {
    const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
    prompt = e.act ? (
      <ActPanel task={e.act} card={card} lang={lang} />
    ) : e.ex === 'say_it' ? (
      <div className="flex flex-col gap-2" data-testid="say-it">
        <p className="lx-t-meta text-subtle">{t('pxWwSayItIntent')}</p>
        {/* UX-Prüfung M3: nur die gespeicherte deutsche Absicht – ohne sie bietet die App „Sag es“ gar nicht an (`sayItIntent`). */}
        {e.sayIt?.de ? (
          <p className="lx-t-prompt" lang="de" data-testid="say-it-intent">
            {e.sayIt.de}
          </p>
        ) : null}
        {!fb && (
          <p className="lx-t-meta text-subtle" data-testid="say-it-tip">
            {t('pxWwSayItTip')}
          </p>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="produce-target">
          <span className="text-muted">{t('actLblWord')}</span>
          <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold" lang="en" data-testid="target-chip">
            {target}
          </span>
        </p>
        {e.brief && <BriefMarks brief={e.brief} lang={lang} />}
        {e.start && (
          <p className="lx-t-prompt text-muted" lang="en" data-testid="complete-start">
            {e.start} …
          </p>
        )}
        {e.meaning && (
          <p className="lx-t-support" lang={lang} data-testid="cue">
            <span className="text-muted">{t('actTaskMarkMeaning')}: </span>
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
            setPrecheckMsg(null);
          }}
          onSubmit={() => (fb ? next() : void checkSentence())}
          disabled={!!fb || sentenceBusy}
          testId={e.ex === 'complete' ? 'complete-input' : e.ex === 'say_it' ? 'say-it-input' : e.act ? 'act-input' : 'produce-input'}
          placeholder={e.ex === 'complete' ? undefined : e.ex === 'say_it' ? t('pxWwSayItPlaceholder') : t('actPlaceholder')}
          tall={e.act?.fmt === 'ml' || e.act?.fmt === 'kb'}
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
        {(e.ex === 'mc_en' || e.ex === 'ctx_mc' || e.ex === 'fits') &&
          (e.sentence ? (
            sentence(e.sentence, null, { mark: true })
          ) : (
            <p lang="en">
              <mark className="lx-mark text-fg">{card.word}</mark>
            </p>
          ))}
        {(e.ex === 'colloc_gap' || e.ex === 'match' || e.ex === 'contrast') && e.sentence && sentence(e.sentence, gapSlot)}
        {(e.ex === 'match' || e.ex === 'colloc_gap') && e.sentence && cue()}
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
        onPick={(i) => {
          if (fb) return;
          touchAttempt();
          setChosen(i);
        }}
        lang="en"
        collapse={touch}
        why={whyUnder}
        label={t('trChoicesLabel')}
        testId="choices"
      />
    );
  }

  // P52: Satz von Claude (Wörter-Tutor `wx` oder Kontrast `cfx`) – Kennzeichnung direkt unter der Aufgabe; „Melden“ markiert genau diesen Satz.
  const aiSrc = e.ai;
  if (aiSrc) {
    prompt = (
      <div className="flex flex-col gap-2">
        {prompt}
        <AiMark variant="sentence" tpl={aiSrc.tpl} id={`${card.path}:${aiSrc.kind}:${aiSrc.en}`} onReport={() => void reportWordCtx(card.path, aiSrc.kind, aiSrc.en)} data-testid="word-ctx-mark" />
      </div>
    );
  }

  // ------------------------------------------------------------------ Rückmeldung

  const secondary: ShellSecondary[] = [];
  const canTip = !noHelp && !fb && !retry && tipAvailable && tip < maxTip;
  if (canTip) secondary.push({ id: 'hint', label: t('exHint'), onClick: showTip, testId: 'hint' });
  if (isTiles && !fb && placed.length > 0) secondary.push({ id: 'reset', label: t('drReset'), onClick: () => setPlaced([]), testId: 'tiles-reset' });
  // Bei A4 (Wort nicht gezeigt) gibt es „Weiß ich nicht“: die Lösung wird gezeigt, die Karte bekommt „Nochmal“ und kommt bald wieder.
  if (!fb && (!isSentence || e.ex === 'say_it' || (e.act && !e.act.showTarget)) && e.check !== 'known') secondary.push({ id: 'dontKnow', label: t('exDontKnow'), onClick: dontKnow, testId: 'dont-know' });

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
  const hint = fb ? null : precheckMsg ? { text: precheckMsg, tone: 'near' as const } : retryText ? { text: retryText, tone: 'near' as const } : tipText ? { text: tipText, tone: 'hint' as const } : sentenceBusy ? { text: t('exThinking'), tone: 'hint' as const } : null;

  let feedback: ShellFeedback | null = null;
  if (fb && model) {
    const c = fb.result;
    // Punkt 9: mit Hilfe (Hinweisrunde, Anfangsbuchstaben, Tipp) geschafft – der Untertitel sagt, was das zählt; die Combo wächst nicht.
    const helped = !fb.override && !fb.sentence && (!!retry || fb.hint > 0);
    const helpedRight = helped && c.verdict === 'correct' && (retry?.kind === 'start' || fb.grade === 2);
    const sub: string | null = fb.dontKnow
      ? null
      : fb.sentence?.sayIt
        ? fb.sentence.sayIt.verified
          ? fb.sentence.sayIt.found
            ? t('pxWwSayItChecked', { word: card.kind === 'chunk' ? typedForm(card.word) : card.word })
            : null
          : fb.sentence.sayIt.noteOnly
            ? t('pxWwSayItNoted')
            : t('pxWwSayItUnverified')
      : fb.sentence?.out?.fixedUnsure && fb.result.verdict !== 'correct'
        ? fb.sentence.out.errType && fb.sentence.out.errType !== 'other'
          ? t('awFixUnsureTyped', { type: t(`trErr_${fb.sentence.out.errType}` as MessageKey) })
          : t('awFixUnsure')
        : fb.override
        ? t('lrOverridden')
        : fb.sentence && !fb.sentence.out
          ? fb.sentence.issue
            ? e.act
              ? fb.sentence.issue === 'target' && hiddenAct
                ? t('ppActFinal_targetHidden', { word: card.kind === 'chunk' ? typedForm(card.word) : card.word })
                : t(`ppActFinal_${fb.sentence.issue === 'shape' || fb.sentence.issue === 'german' || fb.sentence.issue === 'form' ? 'short' : fb.sentence.issue}` as MessageKey)
              : t(`ppFinal_${fb.sentence.issue === 'form' || fb.sentence.issue === 'german' || fb.sentence.issue === 'shape' || fb.sentence.issue === 'same' ? 'short' : fb.sentence.issue}` as MessageKey)
            : e.act
              ? t('actLocalNote')
              : t('trProduceLocalNote')
          : fb.sentence?.out && fb.sentence.out.errType && fb.sentence.out.errType !== 'other' && fb.sentence.out.verdict !== 'correct'
            ? t('trProduceErrMain', { type: t(`trErr_${fb.sentence.out.errType}` as MessageKey) })
          : helpedRight
            ? retry?.kind === 'start'
              ? t('bandRightStart')
              : t('bandRightHelped')
          : alsoRight
            ? t('trSubAlsoRight', { form: solution })
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
    // Satzantwort: Die korrigierte Fassung steht offen da. Sind beide Sätze ähnlich (mehr als die Hälfte gleicher Wörter), als markierter Vergleich;
    // sonst sagt ein Wort-für-Wort-Vergleich nichts, und „Deine Antwort“ / „So ginge es“ stehen untereinander (UX-Prüfung 14.10.).
    let right: ReactNode | undefined;
    if (fixed && fb.result.verdict !== 'correct' && fixed.trim() !== fb.given.trim()) {
      if (jaccard(fb.given, fixed) > 0.5) comparison = { given: fb.given, ops: alignWords(fb.given, fixed) };
      else
        right = (
          <div className="lx-t-support flex flex-col gap-1.5" data-testid="sentence-stack">
            <p>
              <span className="text-muted">{t('actYourAnswer')}: </span>
              <span lang="en" data-testid="stack-given">
                {fb.given}
              </span>
            </p>
            <p>
              <span className="text-muted">{t('actSoItGoes')}: </span>
              <span lang="en" className="font-semibold" data-testid="stack-fixed">
                {fixed}
              </span>
            </p>
          </div>
        );
    }
    const wrongTyped = fb.result.verdict === 'wrong' && !fb.dontKnow && !fb.override && (isTyped || e.ex === 'colloc_gap');
    // UX-Prüfung W8: Falsch heißt dieselbe Karte wie in der Grammatik – „Du: …“, „Richtig: …“ und das Warum zur Form („overcame = Vergangenheit“).
    const wrongWord = fb.result.verdict === 'wrong' && !fb.override && (isTyped || isChoice);
    // Auswahl mit Warum-Zeile unter der Option: gewählte (✕) und richtige Option (✓) stehen schon da – kein „Deine Antwort … / Richtig …“ dazu
    // (UX-Prüfung 19.10.2026, Kap. 15: jede Aussage einmal).
    const shownUnder = isChoice && fb.result.verdict === 'wrong' && chosen !== null && model.lines.some((l) => l.k === 'yours');
    if (!comparison && wrongWord && !shownUnder && solution && normalize(solution) !== normalize(fb.given)) comparison = { given: fb.dontKnow ? '' : fb.given, ops: alignWords(fb.dontKnow ? '' : fb.given, solution) };
    // Band (Punkt 1b): „fast richtig“ getippt – EINE Lösungszeile „Du: … → Richtig: …“ (am Laptop zeigt die Lücke die Lösung schon).
    if (!comparison && fb.result.verdict === 'near' && !fb.override && isTyped && solution && normalize(solution) !== normalize(fb.given)) comparison = { given: fb.given, ops: alignWords(fb.given, solution), bandOnly: true };
    // Auswahl (LS6): „Du: B · Richtig: C …“ im Band statt des Wortvergleichs.
    const rightIdx = isChoice ? visibleOptions.findIndex((o) => o.correct) : -1;
    const choiceLine =
      isChoice && rightIdx >= 0 && !fb.override && (fb.result.verdict === 'wrong' || fb.dontKnow)
        ? { you: !fb.dontKnow && chosen !== null ? (CHOICE_LETTERS[chosen] ?? null) : null, right: CHOICE_LETTERS[rightIdx] ?? '', text: visibleOptions[rightIdx]?.label ?? solution }
        : null;
    // Wortpartner (colloc/colloc_gap): gesucht ist der Partner, nicht eine Form des Kartenworts – „raised = Vergangenheit von concern“ wäre falsch (UX-Prüfung 19.10.2026).
    const partnerEx = e.ex === 'colloc' || e.ex === 'colloc_gap';
    const fk = solution && !fb.override && fb.result.verdict !== 'correct' && !partnerEx ? formKind(solution, card.word, card.pos ?? null) : null;
    const formWhy =
      fk && fk !== 'misc' ? (
        // U3: steht im Block „Warum“ – keine zweite Überschrift „Warum:“ davor.
        <p className="lx-t-support m-0" data-testid="word-form-why" data-form={fk}>
          <span lang="en" className="font-semibold">
            {solution}
          </span>{' '}
          {' = '}
          {t(`form_${fk}` as MessageKey)} {t('wxFormOf', { lemma: card.word })}
        </p>
      ) : null;
    const menu: Partial<Record<ShellMenuId, () => void>> = {};
    if (wrongTyped && (isTyped || card.col.some((x) => x.ai))) menu.override = override;
    if (wrongTyped && isTyped) menu.copyOnce = () => setCopyOpen(true);
    menu.moreInfo = () => setMoreOpen(true);
    // „Weiß ich nicht“ hat keine Antwort, die man sich erklären lassen könnte (UX-Prüfung 14.10.).
    const tutor =
      fb.result.verdict === 'correct' || fb.override || fb.dontKnow ? null : (
        <TutorButton
          taskKey={`wd:${card.path}:${e.ex}:${fb.given}`}
          vars={{ topic: card.word, prompt: shownSentence ?? card.word, answer: solution, given: fb.given, pattern: meaningText ? { name: card.word, form: meaningText } : null }}
          kind="word"
          word={{ en: card.word, de: card.de ?? '', pos: card.pos ?? '', other: null, falseFriend: null }}
          store={{ kind: 'vocab', path: card.path }}
          onRight={menu.override}
          onRewrite={menu.copyOnce}
        />
      );
    feedback = {
      verdict: rv,
      // UX-Prüfung M3: „Sag es“ prüft nur das Zielwort – ehrliche Stufe „Zielwort drin“ statt eines großen „Richtig“.
      ...(e.ex === 'say_it' && !fb.override && !fb.dontKnow && fb.sentence?.sayIt?.verified && fb.sentence.sayIt.found ? { title: t('pxWwSayItTitle') } : {}),
      sub,
      comparison,
      ...(choiceLine ? { choice: choiceLine } : {}),
      ...(helped ? { helped: true } : {}),
      ...(right ? { right } : {}),
      why: formWhy ?? undefined,
      tutor,
      explanation: whyUnderRemoved(model, isChoice && fb.result.verdict === 'wrong' && chosen !== null),
      depth,
      menu,
      // Lernwissenschaft N4: „Noch natürlicher“ und „Warum besser“ stehen bei richtigem Satz offen, sonst eingeklappt (ein Antippen unter „Mehr“) – am Handy zu lang.
      ...(fb.sentence?.out?.verdict === 'correct' ? { unfold: ['note'] as const } : {}),
      // P52: der Kontrast-Schritt ändert die Planung nicht, also keine „Wieder in …“-Zeile.
      nextIn: e.ex === 'contrast' ? null : t('trAgainIn', { when: when(fb.dueInMs) }),
      stageNote: e.ex !== 'contrast' && fb.hold && !fb.override ? tn('awStageHold', fb.hold, { goal: t(card.stage + 1 >= 5 ? 'stxGoalFirm' : 'stxGoalSafe') }) : null,
      // Design-Lead: Wort, Vorlesen, Lautschrift und „Zum Wort“ stehen in der Ergebnis-Karte, genau einmal, direkt unter dem Urteil.
      // R5: im Kontrast-Schritt heißt der Kopf „avoid ≠ convince“ (richtiges Wort zuerst, beide mit Aussprache).
      head: <WordExtras card={card} open={moreOpen} lang={lang} extras={extras} part="head" other={e.ex === 'contrast' ? (contrastOtherOf(e)?.word ?? null) : null} phrase={collocPhrase} meaning={fb.sentence ? null : headMeaning} pos={posKey(card.pos)} />,
      // „War das auch richtig?“ als ruhige Zeile im Ergebnis-Block (Design-Lead), nicht mehr lose über der Karte.
      // Punkt 1d: im Band neben „Mehr“ (zweiter und letzter Zweitknopf); Ergebnis und Annehmen wachsen darunter.
      act: !fb.override && fb.result.verdict === 'wrong' && isTyped && ai && e.ex !== 'situation' ? <SynonymAsk card={card} given={fb.given} onOk={override} onBusy={onSynBusy} /> : undefined,
      foot: <WordExtras card={card} open={moreOpen} lang={lang} extras={extras} part="body" />,
      moreOpen,
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
        {fb.dontKnow && hiddenAct && <SayAnywayField word={card.kind === 'chunk' ? typedForm(card.word) : card.word} />}
      </>
    );
  }

  const kindLabel =
    e.check === 'control' ? t('nbWsControl') : e.check === 'probe' ? `${t('nbWsProbe')} · ${t(`exName_${exTextKey(e)}` as MessageKey)}` : e.check === 'known' ? t('wxKnownKind') : e.recall ? (e.recall === 'day0a' || e.recall === 'day0b' ? t(RECALL_LABEL[e.recall]) : `${t(RECALL_LABEL[e.recall])} · ${t(`exName_${exTextKey(e)}` as MessageKey)}`) : e.act ? t(`actName_${e.act.fmt}` as MessageKey) : t(`exName_${exTextKey(e)}` as MessageKey);
  const def = exerciseDef(e.ex);
  const purposeKey: MessageKey =
    e.act
      ? (`purposeAct${e.act.step}` as MessageKey)
      : e.ex === 'colloc' || e.ex === 'colloc_gap'
      ? 'purposeColloc'
      : e.ex === 'contrast'
        ? 'ttWcPurposeContrast'
        : e.ex === 'situation'
          ? 'purposeSituation'
          : e.ex === 'find_trap'
            ? 'wxPurposeTrap'
            : e.ex === 'wordfam'
              ? 'wxPurposeFam'
              : LISTEN.has(e.ex) && def.stage < 5
                ? 'purposeListen'
                : (PURPOSE[def.stage] ?? 'purpose1');

  // R5 (S5): Der Kontrast-Schritt ist eine Extra-Frage und sagt das im Wozu – mit beiden Wörtern (alphabetisch, verrät nichts) und „zählt nicht“.
  const [pairA, pairB] = e.ex === 'contrast' ? [contrastOtherOf(e)?.word, card.word].filter((w): w is string => !!w).sort((x, y) => x.localeCompare(y, 'en')) : [];
  const contrastPurpose = pairA && pairB ? t('ttWcPurposeContrastPair', { a: pairA, b: pairB }) : null;
  // Rückmeldung 6: Das Kartenwort kommt hier bewusst ein zweites Mal – sichtbar, warum (im Vergleich mit dem anderen Wort).
  const contrastOther = e.ex === 'contrast' ? (contrastOtherOf(e)?.word ?? null) : null;
  const contrastBadge = contrastOther ? t('trContrastBadge', { word: contrastOther }) : null;
  const canCheck = isChoice ? chosen !== null : isSpot ? spot !== null : isSentence ? !!sentenceText.trim() && !sentenceBusy : isTiles ? placed.length > 0 : true;
  const primary = fb
    ? { label: t('exNext'), onClick: next, testId: 'next' }
    : { label: t('exCheck'), onClick: check, testId: 'check', disabled: !canCheck, busy: sentenceBusy, busyLabel: t('exChecking') };

  return (
    <div ref={root} data-profile={touch ? 'touch' : 'keys'} data-col={e.colloc && e.colloc.index >= 0 ? e.colloc.index : undefined}>
      <ExerciseShell
        meta={{ ex: e.ex, id: card.id, stage: e.stage, kind: card.kind }}
        status={{ area: 'words', state: state0, detail: statusDetail(stat0, t, dateShort), kindLabel, badge: again ? t('trAgainBadge') : contrastBadge }}
        task={{ text: taskText, purpose: contrastPurpose ?? t(purposeKey), ...(e.act || e.ex === 'produce' ? { open: true } : {}) }}
        aid={sought}
        prompt={prompt}
        answer={answer}
        hint={hint}
        secondary={secondary}
        primary={primary}
        feedback={feedback}
        state={retry && !fb ? 'retry' : undefined}
        // UX-Prüfung S9: Wortübungen haben keine „Regel“ und keine Tasten T/? – Seitenkarte und Tastenzeile sagen nur, was es hier gibt.
        sideNote={t('exSideWord')}
        keysHint={(() => {
          const range = isChoice ? choiceKeyRange(e.options.length) : null;
          return fb ? t('exKeysHintNext') : range ? t('exKeysHintWordN', range) : t('exKeysHintWord');
        })()}
        {...(isChoice ? { choiceCount: e.options.length } : {})}
      />
    </div>
  );
}

/** Choices zeigt die Warum-Zeile schon unter der gewählten Option: sie steht nicht noch einmal in der Erklär-Karte (Kap. 15: nichts doppelt). */
function whyUnderRemoved(m: ExplanationModel, under: boolean): ExplanationModel {
  return under ? { ...m, lines: m.lines.filter((l) => l.k !== 'yours') } : m;
}

/**
 * Erklär-Karte einer Satzantwort (vier Pflichtfragen, feste Plätze): „Was hatte ich, was ist richtig?“ steht im Vergleich darüber, die Schichten
 * darunter sind `yours` = richtig/falsch und warum (nur der wichtigste Fehler), `note` 1 = C1-Fassung, `note` 2 = warum sie besser ist.
 * Ohne Claude: nur die grobe lokale Prüfung und die gefundenen Deutsch-Fehler.
 */
function sentenceModel(fb: Feedback, card: Exercise['card'], examples: ExplainExample[], t: (k: MessageKey, v?: Record<string, string | number>) => string, act?: Exercise['act']): ExplanationModel {
  const out = fb.sentence?.out ?? null;
  const self = fb.sentence?.self ?? null;
  const issue = fb.sentence?.issue;
  const lines: ExplanationModel['lines'] = [{ k: 'pattern', name: card.word, formula: null }];
  if (out) {
    lines.push({ k: 'yours', given: fb.given, text: out.why, head: t('actWhyHead') });
    // Mehrere Zielwörter: je Wort ein Satz „richtig benutzt“ bzw. „fehlt oder falsch benutzt“ (nur wenn mindestens eines Probleme macht).
    if (act && out.targets && out.targets.length > 1 && out.targets.some((x) => !(x.used && x.correct))) {
      lines.push({ k: 'note', text: `${t('actTargetsFeedback')}: ${act.targets.map((x, i) => `${x.word} – ${out.targets?.[i]?.used && out.targets[i]?.correct ? t('actTargetOk') : t('actTargetBad')}`).join(' · ')}` });
    }
    if (out.better.trim()) {
      lines.push({ k: 'note', text: `${t('trProduceBetter')}: ${out.better.trim()}` });
      if (out.whyBetter.trim()) lines.push({ k: 'note', text: `${t('trProduceWhyBetter')}: ${out.whyBetter.trim()}` });
    }
  } else if (self) {
    lines.push({ k: 'why', text: issue ? t(`ppFinal_${issue === 'form' || issue === 'german' ? 'short' : issue}` as MessageKey) : self.containsTarget ? (self.longEnough ? (self.notCopied ? t('trProduceLocalOk') : t('ppCopied')) : t('ppShort')) : t('trProduceMissing') });
    for (const h of fb.sentence?.hints ?? []) lines.push({ k: 'note', text: t(`gh_${h}` as MessageKey) });
  } else if (act) {
    // A2–A5 ohne Claudes Urteil: entweder hat die Vorprüfung den Text beendet, oder Claude war nicht erreichbar.
    lines.push({ k: 'why', text: issue ? t(`ppActFinal_${issue === 'shape' || issue === 'german' || issue === 'form' ? 'short' : issue}` as MessageKey) : t('actLocalNote') });
    for (const h of fb.sentence?.hints ?? []) lines.push({ k: 'note', text: t(`gh_${h}` as MessageKey) });
  }
  return { lines, examples, mark: [card.word, card.lemma], ai: !!out, source: 'card' };
}

/**
 * Erklär-Karte zu „Sag es“. UX-Prüfung M3/S10: Steht das Zielwort im Satz, sagt das schon die Zeile unter dem Urteil („Geprüft ist nur …“) – keine
 * zweite „Richtig, weil“-Zeile. Sonst erklärt die eine Zeile, was fehlt. Der englische Satz zur Absicht steht als erstes „Beispiel“ (so heißt er auch im Text).
 */
function sayItModel(c: SayItCheck, card: Exercise['card'], model: string | null, de: string | null, examples: ExplainExample[], t: (k: MessageKey, v?: Record<string, string | number>) => string): ExplanationModel {
  const word = card.kind === 'chunk' ? typedForm(card.word) : card.word;
  const lines: ExplanationModel['lines'] = [{ k: 'pattern', name: card.word, formula: null }];
  const found = c.found && c.longEnough && !c.german;
  if (!found) lines.push({ k: 'why', text: c.german ? t('pxWwSayItGerman') : !c.found ? t('pxWwSayItMissing', { word }) : t('pxWwSayItShort') });
  const rest = model ? examples.filter((x) => x.en !== model) : examples;
  return { lines, examples: model ? [{ en: model, de: de || null }, ...rest] : rest, mark: [card.word, card.lemma], ai: false, source: 'card' };
}

/**
 * Was die Sammelakte `act/<Monat>` von einer Satzantwort festhält (nur „Eigener Satz“ und A2–A5, nie ein „Weiß ich nicht“): der Satz, Claudes Urteil mit den
 * drei Schichten, geprüft ja/nein, wiederverwendbar (nur wenn Claude „richtig“ sagte und den Satz für natürlich hält) und bei mehreren Zielwörtern das Urteil je Wort.
 */
function actRecordOf(fb: Feedback, e: Exercise): ActRecord | undefined {
  if (!fb.sentence || fb.dontKnow || (e.ex !== 'produce' && !e.act)) return undefined;
  const out = fb.sentence.out;
  // Das Urteil für die Karte der Aufgabe: bei mehreren Zielwörtern nach dem Hauptzielwort allein (`mainVerdict`), ein Fehler am Partnerwort zählt hier nicht (Lernwissenschaft H2).
  const mv = out ? (out.mainVerdict ?? out.verdict) : null;
  const mainOk = !out?.targets?.[0] || (out.targets[0].used && out.targets[0].correct);
  const v = mv && mainOk ? (mv === 'correct' ? 'c' : mv === 'minor' ? 'm' : 'w') : mv ? 'w' : fb.grade >= 2 ? 'm' : 'w';
  // „Eigener Satz“ (produce-check@2) kennt `reusable` nicht: dort gilt „richtig, ohne nötige Korrektur“.
  const reusable = !!out && out.verdict === 'correct' && (out.reusable ?? true);
  const helped = fb.sentence.helped === true;
  const ts: ActRecord['ts'] =
    e.act && out?.targets && out.targets.length > 1
      ? e.act.targets.map((x, i): [string, 'c' | 'm' | 'w'] => [x.key, out.targets?.[i]?.used && out.targets[i]?.correct ? (i === 0 ? v : 'c') : 'w'])
      : undefined;
  return { s: fb.given, ...(out?.better.trim() ? { b: out.better } : {}), ...(out?.why.trim() ? { w: out.why } : {}), v, k: out ? 1 : 0, ...(helped ? { hp: true as const } : {}), ...(reusable ? { r: true } : {}), ...(ts ? { ts } : {}), ...(out?.errType ? { et: out.errType } : {}) };
}

/**
 * A4, „Weiß ich nicht“: Das Wort ist jetzt gezeigt; ein freiwilliger Satz damit schließt die Aufgabe positiv ab (Lernwissenschaft M2). Er zählt nicht
 * und ändert keine Note – die Antwort „Weiß ich nicht“ bleibt „Nochmal“.
 */
function SayAnywayField({ word }: { word: string }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const ok = value.trim().split(/\s+/).filter(Boolean).length >= 4 && value.toLowerCase().includes(word.toLowerCase().slice(0, Math.max(4, word.length - 2)));
  return (
    <div className="flex flex-col gap-1" data-testid="say-anyway">
      <label className="lx-t-support text-muted" htmlFor="say-anyway-input">
        {t('actSayAnywayLabel', { word })}
      </label>
      <input id="say-anyway-input" className="lx-field" lang="en" value={value} placeholder={t('actPlaceholder')} onChange={(ev) => setValue(ev.target.value)} data-testid="say-anyway-input" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <p className="lx-t-meta text-subtle">{t('actSayAnywayHint')}</p>
      {ok && (
        <p className="lx-t-meta text-ok-text" role="status">
          ✓
        </p>
      )}
    </div>
  );
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
function SynonymAsk({ card, given, onOk, onBusy }: { card: Exercise['card']; given: string; onOk: () => void; onBusy: (busy: boolean) => void }) {
  return <SynonymCheck card={card} given={given} onOk={onOk} onBusy={onBusy} />;
}

import { SynonymCheck } from './SynonymCheck';

/** Vorgaben des eigenen Satzes sichtbar: die Lage als Satz, darunter Marken für Form, Ton und Zeit (Wörter aktivieren, Stufe 1). */
function BriefMarks({ brief, lang }: { brief: NonNullable<Exercise['brief']>; lang: 'de' | 'en' }) {
  const { t } = useT();
  const chip = 'rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold';
  return (
    <div className="flex flex-col gap-2" data-testid="produce-brief" data-code={brief.code}>
      <p className="lx-t-prompt" lang={lang} data-testid="brief-scene">
        <span className="text-muted">{t('brLage')}: </span>
        {sceneText(brief.scene, lang)}
      </p>
      <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="brief-marks">
        <span className={chip} data-testid="brief-form">
          {t('actLblShape')}: {t(`brForm_${brief.form}` as MessageKey)}
        </span>
        {brief.tone !== '-' && (
          <span className={chip} data-testid="brief-tone">
            {t('brToneLbl')}: {t(`brTone_${brief.tone}` as MessageKey)}
          </span>
        )}
        {brief.tense !== '-' && (
          <span className={chip} data-testid="brief-tense">
            {t('brTenseLbl')}: {t(`brTense_${brief.tense}` as MessageKey)}
          </span>
        )}
      </p>
      <p className="lx-t-meta text-muted">{t('brShort')}</p>
    </div>
  );
}
