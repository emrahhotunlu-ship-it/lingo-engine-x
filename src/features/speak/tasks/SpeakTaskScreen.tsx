import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsk } from '../../../ai/useAsk';
import { useAiAvailable } from '../../../ai/scope';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import type { ScreenProps } from '../../../app/registry';
import { EnglishText } from '../../../engine/EnglishText';
import { SpeakButton } from '../../../engine/SpeakButton';
import { useT, type MessageKey } from '../../../i18n';
import { stopSpeech } from '../../../platform/speech';
import { speakTaskCheck, STC_TEXT_MAX, type SpeakTaskCheckOut, type SpeakTaskKind } from '../../../prompts/nb/p5/speakTaskCheck';
import { Button } from '../../../ui/Button';
import { FeedbackPanel } from '../../../ui/FeedbackPanel';
import type { Feedback, Fix } from '../../../ui/feedback/types';
import { SessionEnd } from '../../../ui/SessionEnd';
import { useCompanionSee } from '../../companion/seeing';
import { AiRunPanel, isBusy } from '../../input/AiRunPanel';
import { saveLookupCard } from '../../lookup/store';
import { logAnswers, nextRound, Note, TaskHead, TimeBar, TrainingBar, useCountdown } from '../../nbdrill/shared';
import { ChartSvg } from './ChartSvg';
import { BACKS, CHART_SEC, CHARTS, CIRCUM_SEC, CIRCUMS, PITCH_ADD, PITCH_ROUNDS, PITCHES, type ChartItem } from './content';
import { usesTarget, wordDiff, wordsPerMinute } from './logic';

// Kurze Sprechaufgaben unter Sprechen › Training (Neubau N79, B9 – Lehrer I7, I8, W10, S9):
// - Pitch in 30/60/120 s: dieselbe Kernbotschaft in drei Runden, erst das Muster anhören,
// - Zahlen und Grafiken präsentieren: lokal gezeichnetes Diagramm in 60 s beschreiben,
// - Umschreiben statt stocken: Fachwort erklären, ohne es zu benutzen; danach wird es eine Karte,
// - Rückübersetzung: EN-Satz lesen → verdecken → aus der deutschen Fassung wieder EN, Vergleich.
// Ablauf je Schritt: Vorbereitung → Sprechzeit (Zeitbalken, nur Anzeige: nichts wird abgebrochen)
// mit Feld für Tippen oder Diktiertaste → Prüfen → Rückmeldung (FeedbackPanel). Claude prüft über
// das KI-Tor (`speak-task-check@1`); ohne KI oder bei Fehler: Muster zum Vergleich, „Weiter“
// wartet nie. Gespeichert wird nur ins Tagesprotokoll (freiwillig = Extra).

type Step = {
  id: string;
  /** Sprechzeit (s); 0 = ohne Zeitbalken. */
  sec: number;
  /** Bezug für die Prüfung (Englisch). */
  ref: string;
  model: string;
  /** Aufgabe (Englisch) für den Prompt. */
  task: string;
};

type Phase = 'prep' | 'answer' | 'review';
type Result = { id: string; text: string; ok: boolean; ms: number };

const TITLE: Record<SpeakTaskKind, MessageKey> = {
  pitch: 'nbSprechenTaskPitch',
  chart: 'nbSprechenTaskChart',
  circum: 'nbSprechenTaskCircum',
  back: 'nbSprechenTaskBack',
};

const PURPOSE: Record<SpeakTaskKind, MessageKey> = {
  pitch: 'nbSprechenPitchPurpose',
  chart: 'nbSprechenChartPurpose',
  circum: 'nbSprechenCircumPurpose',
  back: 'nbSprechenBackPurpose',
};

const PER_SESSION = 3;

const at = <T,>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length] as T;

/** Schritte einer Sitzung (reihum andere Inhalte über den lokalen Rundenzähler). */
export function stepsFor(kind: SpeakTaskKind, round: number): Step[] {
  if (kind === 'pitch') {
    const p = at(PITCHES, round);
    return PITCH_ROUNDS.map((sec) => ({ id: `${p.id}-${sec}`, sec, ref: p.core.en, model: p.model, task: `Give an elevator pitch of about ${sec} seconds with this core message. ${PITCH_ADD[sec].en}` }));
  }
  if (kind === 'chart') {
    const c = at(CHARTS, round);
    return [{ id: c.id, sec: CHART_SEC, ref: chartRef(c), model: c.model, task: 'Describe the chart: the overall trend, one comparison and a conclusion.' }];
  }
  if (kind === 'circum') {
    return Array.from({ length: PER_SESSION }, (_, i) => {
      const w = at(CIRCUMS, round * PER_SESSION + i);
      return { id: w.id, sec: CIRCUM_SEC, ref: `Target word (must not be used): ${w.en}. German term: ${w.de}`, model: w.model, task: `Explain what "${w.en}" means to a customer in one or two sentences without using the word.` };
    });
  }
  return Array.from({ length: PER_SESSION }, (_, i) => {
    const b = at(BACKS, round * PER_SESSION + i);
    return { id: b.id, sec: 0, ref: `Original sentence: ${b.en}`, model: b.en, task: `Translate this German sentence back into English: ${b.de}` };
  });
}

/** Diagrammdaten als eine Zeile für den Prompt. */
export function chartRef(c: ChartItem): string {
  const pairs = c.labels.map((l, i) => `${l} ${c.values[i] ?? 0}`).join(', ');
  return `${c.kind} chart "${c.title}" (${c.unit}): ${pairs}`;
}

export function SpeakTaskScreen({ route }: ScreenProps<'sptask'>) {
  const [round] = useState(() => nextRound(`sptask-${route.kind}`));
  return <Task key={route.kind} kind={route.kind} round={round} />;
}

function Task({ kind, round }: { kind: SpeakTaskKind; round: number }) {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const steps = useMemo(() => stepsFor(kind, round), [kind, round]);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('prep');
  const [draft, setDraft] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [ms, setMs] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const ask = useAsk(speakTaskCheck);
  const step = steps[pos] as Step;
  useCompanionSee({ area: 'speak', label: `${t('spTraining')} · ${t(TITLE[kind])}`, phase: phase === 'review' ? 'feedback' : phase === 'answer' ? 'question' : 'idle', ...(phase === 'review' ? { reveal: step.model.slice(0, 600) } : {}) });
  useEffect(() => () => stopSpeech(), []);

  const left = useCountdown(step.sec * 1000, phase === 'answer' && step.sec > 0, () => setTimeUp(true), `${pos}`);

  const begin = () => {
    stopSpeech();
    setPhase('answer');
    setStartedAt(Date.now());
    setTimeUp(false);
    field.current?.focus();
  };

  const check = (refresh = false) => {
    const text = draft.trim();
    if (phase === 'answer') {
      setMs(startedAt ? Date.now() - startedAt : 0);
      setPhase('review');
    }
    if (ai && text) void ask.run({ kind, task: step.task, ref: step.ref, model: step.model, answer: text, seconds: step.sec, uiLang: lang }, refresh ? { refresh: true } : {});
  };

  const circum = kind === 'circum' ? at(CIRCUMS, round * PER_SESSION + pos) : null;
  const used = !!circum && usesTarget(draft, circum.en);
  const data = ask.phase === 'done' ? ask.data : null;
  const fb = feedbackOf({ kind, text: draft.trim(), step, data, used, usedWhy: t('nbSprechenCircumUsed'), noAnswer: t('nbSprechenNoAnswer') });

  const next = () => {
    const ok = fb.verdict === 'ok' || (fb.verdict === 'unchecked' && !!draft.trim() && !used);
    const res: Result = { id: step.id, text: draft.trim(), ok, ms };
    logAnswers([
      { type: `nb-sp-${kind}`, ref: `sptask/${kind}/${step.id}`, q: step.task.slice(0, 300), given: res.text.slice(0, 600), ans: (data?.better ?? step.model).slice(0, 600), ok, ms, day: useClock.getState().today, lang, duty: false, t: Date.now() },
    ]);
    setResults((r) => [...r, res]);
    ask.stop();
    if (pos + 1 >= steps.length) {
      setDone(true);
      return;
    }
    setPos(pos + 1);
    setPhase('prep');
    setDraft('');
    setMs(0);
    setTimeUp(false);
  };

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="sptask" data-kind={kind} data-state="done">
        <TrainingBar unit={null} progress={null} onClose={back} />
        <SessionEnd right={results.filter((r) => r.ok).length} total={results.length} ms={results.reduce((n, r) => n + r.ms, 0)} next={{ label: t('nbSprechenTaskDone'), run: back }} />
      </div>
    );
  }

  const busy = isBusy(ask.phase);
  const showFb = phase === 'review' && !busy;
  const status = kind === 'pitch' ? t('nbSprechenPitchRound', { n: pos + 1, s: step.sec }) : t('nbSprechenItemOf', { n: pos + 1, m: steps.length });
  const wpm = kind === 'pitch' && phase === 'review' ? wordsPerMinute(draft, ms) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="sptask" data-kind={kind} data-pos={pos} data-phase={phase} data-state="open">
      <TrainingBar unit={null} progress={{ n: pos + 1, total: steps.length }} />
      <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid={`sptask-${kind}`} data-id={step.id}>
        <TaskHead status={status} task={taskLine(kind, step, pos, round, t)} purpose={t(PURPOSE[kind])} />
        <Stimulus kind={kind} step={step} pos={pos} round={round} phase={phase} />

        {phase === 'prep' && (
          <div>
            <Button variant="primary" onClick={begin} data-testid="sptask-start">
              {kind === 'back' ? t('nbSprechenBackHide') : step.sec > 0 ? t('nbSprechenStart', { s: step.sec }) : t('nbSprechenStartFree')}
            </Button>
          </div>
        )}

        {phase !== 'prep' && (
          <div className="flex flex-col gap-3">
            {phase === 'answer' && step.sec > 0 && <TimeBar left={left} total={step.sec * 1000} label={t('nbSprechenSpeakTime')} testId="sptask-time" />}
            {phase === 'answer' && timeUp && <Note tone="info">{t('nbSprechenTimeUp')}</Note>}
            {phase === 'answer' && <p className="text-xs text-muted">{t('nbSprechenDictateHint')}</p>}
            <textarea
              ref={field}
              className="lx-field min-h-28 text-base"
              lang="en"
              rows={kind === 'pitch' && step.sec >= 60 ? 6 : 4}
              maxLength={STC_TEXT_MAX}
              value={draft}
              readOnly={phase !== 'answer'}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t('nbSprechenAnswer')}
              placeholder={t('nbSprechenAnswer')}
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="sptask-input"
            />
            {phase === 'answer' && (
              <div>
                <Button variant="primary" onClick={() => check()} disabled={!draft.trim()} data-testid="sptask-check" data-ai={ai ? '' : undefined}>
                  {t('nbSprechenCheck')}
                </Button>
              </div>
            )}
          </div>
        )}

        {phase === 'review' && (
          <div className="flex flex-col gap-4 border-t border-line pt-4" data-testid="sptask-review" data-mode={data ? 'ai' : busy ? 'busy' : 'self'}>
            {(busy || ask.phase === 'error') && <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => check(true)} skeleton={busy} />}
            {kind === 'back' && <BackCompare original={step.model} mine={draft.trim()} />}
            {wpm > 0 && <p className="lx-tnum text-xs text-muted" data-testid="sptask-wpm">{t('nbSprechenWpm', { n: wpm })}</p>}
            {showFb && <FeedbackPanel fb={fb} onNext={next} area="speak" testId="feedback" />}
            {showFb && circum && <SaveWord de={circum.de} en={circum.en} ex={circum.ex} id={circum.id} />}
          </div>
        )}
      </article>
    </div>
  );
}

function taskLine(kind: SpeakTaskKind, step: Step, pos: number, round: number, t: ReturnType<typeof useT>['t']): string {
  if (kind === 'pitch') return t('nbSprechenPitchTask', { s: step.sec });
  if (kind === 'chart') return t('nbSprechenChartTask');
  if (kind === 'circum') return t('nbSprechenCircumTask', { de: at(CIRCUMS, round * PER_SESSION + pos).de });
  return t('nbSprechenBackTask');
}

/** Rückmeldung: mit Claude (Urteil, Kern, Korrekturen, bessere Fassung) oder ohne – Muster zum Vergleich. */
export function feedbackOf(o: { kind: SpeakTaskKind; text: string; step: Pick<Step, 'model'>; data: SpeakTaskCheckOut | null; used: boolean; usedWhy: string; noAnswer: string }): Feedback {
  const usedFix: Fix[] = o.used ? [{ kind: 'goal', mine: '', right: '', why: o.usedWhy }] : [];
  if (o.data) {
    const d = o.data;
    return {
      verdict: o.used ? 'wrong' : d.verdict,
      effect: `${d.core} ${d.effect}`.trim(),
      ...(o.text ? { mine: o.text } : {}),
      solution: d.better,
      fixes: [...usedFix, ...d.fixes.map((f) => ({ kind: 'form' as const, mine: f.mine, right: f.right, why: f.why }))],
      ...(o.kind !== 'back' && o.step.model && o.step.model !== d.better ? { upgrades: [{ to: o.step.model }] } : {}),
      why: { question: `${o.text} → ${d.better}` },
    };
  }
  return { verdict: 'unchecked', mine: o.text || o.noAnswer, solution: o.step.model, fixes: usedFix };
}

function Stimulus({ kind, step, pos, round, phase }: { kind: SpeakTaskKind; step: Step; pos: number; round: number; phase: Phase }) {
  const { t, lang } = useT();
  const [de, setDe] = useState(false);
  if (kind === 'pitch') {
    const p = at(PITCHES, round);
    const sec = step.sec as (typeof PITCH_ROUNDS)[number];
    return (
      <div className="flex flex-col gap-3" data-testid="sptask-stimulus">
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('nbSprechenPitchCore')}</p>
          <div className="flex items-start gap-2">
            <EnglishText text={p.core.en} area="business" source={`sptask/pitch/${p.id}`} className="flex-1 text-lg font-medium leading-relaxed" />
            <SpeakButton text={p.core.en} />
          </div>
          <button type="button" className="self-start text-sm text-muted underline-offset-2 hover:underline" onClick={() => setDe((v) => !v)} aria-expanded={de}>
            {t('nbSprechenInGerman')}
          </button>
          {de && <p className="text-sm text-muted">{p.core.de}</p>}
        </div>
        <p className="text-sm">
          <span className="font-medium">{t('nbSprechenPitchAdd')}:</span> {lang === 'de' ? PITCH_ADD[sec].de : PITCH_ADD[sec].en}
        </p>
        {pos === 0 && phase === 'prep' && (
          <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="sptask-model">
            <div className="flex items-center justify-between gap-2">
              <p className="lx-eyebrow">{t('nbSprechenPitchModel')}</p>
              <SpeakButton text={p.model} testId="sptask-model-speak" />
            </div>
            <EnglishText text={p.model} area="business" source={`sptask/pitch/${p.id}`} className="text-sm leading-relaxed" />
          </div>
        )}
      </div>
    );
  }
  if (kind === 'chart') {
    const c = at(CHARTS, round);
    return (
      <div className="flex flex-col gap-3" data-testid="sptask-stimulus">
        <ChartSvg chart={c} label={t('nbSprechenChartAlt', { title: c.title })} />
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('nbSprechenChartPhrases')}</p>
          <p className="flex flex-wrap gap-2">
            {c.phrases.map((x) => (
              <span key={x} className="lx-chip" lang="en">
                {x}
              </span>
            ))}
          </p>
        </div>
      </div>
    );
  }
  if (kind === 'circum') {
    const w = at(CIRCUMS, round * PER_SESSION + pos);
    return (
      <p className="text-2xl font-semibold tracking-tight" data-testid="sptask-stimulus" lang="de">
        {w.de}
      </p>
    );
  }
  const b = at(BACKS, round * PER_SESSION + pos);
  return (
    <div className="flex flex-col gap-3" data-testid="sptask-stimulus">
      {phase === 'prep' ? (
        <>
          <p className="text-sm text-muted">{t('nbSprechenBackRead')}</p>
          <div className="flex items-start gap-2">
            <EnglishText text={b.en} area="speak" source={`sptask/back/${b.id}`} className="flex-1 text-lg font-medium leading-relaxed" testId="sptask-original" />
            <SpeakButton text={b.en} />
          </div>
        </>
      ) : (
        <p className="text-lg leading-relaxed" lang="de" data-testid="sptask-german">
          {b.de}
        </p>
      )}
    </div>
  );
}

/** Rückübersetzung: Original und eigene Fassung nebeneinander, abweichende Wörter markiert. */
function BackCompare({ original, mine }: { original: string; mine: string }) {
  const { t } = useT();
  const d = wordDiff(original, mine);
  const mark = (w: { w: string; same: boolean }, i: number) => (
    <span key={i} className={w.same ? '' : 'rounded bg-gold-soft px-0.5 text-gold-text'} data-diff={w.same ? undefined : 'x'}>
      {w.w}{' '}
    </span>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="sptask-compare">
      <div className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('nbSprechenBackOriginal')}</p>
        <p lang="en" className="text-base leading-relaxed">
          {d.orig.map(mark)}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('nbSprechenBackMine')}</p>
        <p lang="en" className="text-base leading-relaxed">
          {mine ? d.mine.map(mark) : '–'}
        </p>
      </div>
      <p className="lx-tnum text-xs text-muted sm:col-span-2">{t('nbSprechenBackSame', { n: d.same, m: d.orig.length })}</p>
    </div>
  );
}

/** Umschreiben: danach wird das richtige Wort eine Karte (Lehrer W10). */
function SaveWord({ de, en, ex, id }: { de: string; en: string; ex: string; id: string }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const save = async () => {
    if (state === 'busy' || state === 'saved') return;
    setState('busy');
    const r = await saveLookupCard({ word: en, de, pos: 'noun', ex, surface: en, src: 'coach', origin: { v: 1, kind: 'business', ref: `circum/${id}`, title: de, t: Date.now() }, today: useClock.getState().today });
    setState(r === 'saved' || r === 'added' || r === 'exists' ? 'saved' : 'failed');
  };
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="sptask-word">
      <p className="text-sm">
        {t('nbSprechenCircumWord')} <EnglishText as="span" text={en} area="business" className="font-semibold" />
      </p>
      <Button variant="secondary" icon={state === 'saved' ? 'check' : 'bookmarkPlus'} disabled={state === 'saved' || state === 'busy'} onClick={() => void save()} data-testid="sptask-save" data-state={state}>
        {state === 'saved' ? t('nbSprechenCircumSaved') : t('nbSprechenCircumSave')}
      </Button>
      {state === 'failed' && <span className="text-sm text-danger-text">{t('nbSprechenCircumSaveFailed')}</span>}
    </div>
  );
}
