import { motion } from 'framer-motion';
import { StepBoundary } from '../../app/shell/Boundary';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { FLUENCY_QUESTIONS } from '../../content/fluency/questions';
import { appendSpoken, FLUENCY_ROUNDS, questionFor, roundStats, timeLeft, type RoundIndex } from '../../domain/fluency/fluency';
import { FLUENCY_TEXT_MAX, fluencyId, fluencyPath, type FluencyFeedback, type FluencyItem, type FluencyRound } from '../../domain/fluency/fluencyDoc';
import { repairsFromCorrections } from '../../domain/say/say';
import { EnglishText } from '../../engine/EnglishText';
import { MicButton } from '../../engine/MicButton';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { useStt } from '../../platform/stt';
import { fluencyCheck, type FluencyCheckOut } from '../../prompts/fluencyCheck';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Fold, FoldGroup } from '../../ui/Fold';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea, type DraftHandle } from '../input/DraftArea';
import { flush } from '../progress/persist';
import { saveRepairs } from '../repair/store';
import { TakeChunkButton } from '../speak/TakeChunkButton';
import { recordFluencyDone, saveFluencyItem } from './persist';
import { useDocWatch } from '../../data/watch';
import { tuesdayOf, tuesdayWpm } from '../../domain/fluency/wpm';
import { unitResult } from '../../domain/speak/unitResult';
import { fluencyResume, type FluencySnap } from '../speak/resumable';
import { TargetBar } from '../speak/TargetBar';
import { finishUnit, unitBlockOf } from '../speak/unit';
import { useUnitCtx } from '../speak/useUnit';

// Flüssigkeit 90 – 60 – 45 (Lernberatung 27.09., V6 / Vorschlag 5, 4-3-2-Methode): eine Frage,
// dreimal dieselbe Antwort – 90 s, 60 s, 45 s –, gesprochen (Spracheingabe, wenn verfügbar)
// oder getippt. Ein sichtbarer Zeitbalken läuft ab; bei 0 wird das Feld gesperrt, der Text bleibt
// ganz erhalten (auch ein Satz, den die Spracherkennung noch liefert). Danach ruhige Kennzahlen
// ohne KI (Wörter, Wörter pro Minute, Anteil ganzer Sätze – kein Punktestand) und fluency-check@1:
// was flüssiger wurde, zwei fehlende Wendungen („Merken“), 0–3 Fehler → Reparatur-Sätze.
// Freiwillig (`act.fluency`), keine Selbstbewertung (A7).


type Phase = 'ready' | 'run' | 'result';

const fmt = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Monotone Uhr: der Zeitbalken folgt der echten Zeit, auch wenn `Date` angehalten ist. */
const mono = (): number => performance.now();

/** Runden aus der Momentaufnahme tolerant lesen (Fortsetzen, G3). */
function roundsOf(list: FluencySnap['rounds']): FluencyRound[] {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return list.map((r) => ({ sec: n(r.sec), text: typeof r.text === 'string' ? r.text.slice(0, FLUENCY_TEXT_MAX) : '', ms: n(r.ms), words: n(r.words), wpm: n(r.wpm), sentences: n(r.sentences), full: n(r.full) }));
}

/** Neubau N73: Wörter pro Minute im 45-s-Durchgang, am Freitag gegen Dienstag. */
function WpmCard({ rounds, day, q }: { rounds: FluencyRound[]; day: string; q: string }) {
  const { t } = useT();
  const r45 = rounds.find((r) => r.sec === 45);
  const tue = tuesdayOf(day);
  const cur = useDocWatch(fluencyPath(day), !!tue);
  const prev = useDocWatch(tue ? fluencyPath(tue) : fluencyPath(day), !!tue && fluencyPath(tue) !== fluencyPath(day));
  const before = tue ? tuesdayWpm([cur.data, prev.data], day, q) : null;
  if (!r45) return null;
  return (
    <Card as="div" channel="speak" className="flex flex-col gap-1" data-testid="fluency-wpm" data-wpm={r45.wpm} data-tue={before ?? undefined}>
      <p className="lx-eyebrow">{t('nbSprechenWpmTitle')}</p>
      <p className="lx-tnum text-2xl font-semibold">{t('nbSprechenWpm', { n: r45.wpm })}</p>
      {before !== null && <p className="lx-tnum text-sm text-muted" data-testid="fluency-wpm-tue">{t('nbSprechenWpmCompare', { n: before })}</p>}
    </Card>
  );
}

const fbOf = (o: FluencyCheckOut | null): FluencyFeedback | null => (o ? { progress: o.progress, missing: o.missing, corrections: o.corrections } : null);

/** Zeitbalken: läuft ab, bei 0 ein ruhiger Hinweis. `onOver` genau einmal. */
function TimeBar({ start, total, onOver }: { start: number; total: number; onOver: () => void }) {
  const { t } = useT();
  const [now, setNow] = useState(mono);
  const fired = useRef(false);
  const cb = useRef(onOver);
  useEffect(() => {
    cb.current = onOver;
  });
  useEffect(() => {
    const id = window.setInterval(() => setNow(mono()), 250);
    return () => window.clearInterval(id);
  }, []);
  const s = timeLeft(start, now, total);
  useEffect(() => {
    if (s.over && !fired.current) {
      fired.current = true;
      cb.current();
    }
  }, [s.over]);
  return (
    <div className="flex items-center gap-3" data-testid="fluency-timer" data-left={Math.ceil(s.leftMs / 1000)} data-over={s.over ? '' : undefined}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={t('fluTimeLeft', { t: fmt(s.leftMs) })} aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={Math.ceil(s.leftMs / 1000)}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${s.share * 100}%` }} />
      </div>
      <span className="lx-tnum min-w-12 text-right text-xs text-muted" aria-live="off">
        {fmt(s.leftMs)}
      </span>
    </div>
  );
}

export function FluencyScreen() {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  const listening = useStt((s) => s.listening);
  const sttStatus = useStt((s) => s.status);
  const [day] = useState(() => useClock.getState().today);
  const unit = useNav((s) => (s.route.name === 'fluency' ? unitBlockOf(s.route.unit) : null));
  const ctx = useUnitCtx('task.fluency', unit);
  const [restored] = useState<FluencySnap | null>(() => fluencyResume.take());
  const [shift, setShift] = useState(0);
  // Tageseinheit (Di/Fr): Frage A der Woche; Fortsetzen: dieselbe Frage.
  const fixedQ = restored?.q ?? (unit ? (ctx?.theme?.fluencyQ ?? null) : null);
  const q = useMemo(() => {
    const fixed = shift === 0 && fixedQ ? FLUENCY_QUESTIONS.find((x) => x.id === fixedQ) : undefined;
    return fixed ?? questionFor(FLUENCY_QUESTIONS, day, shift);
  }, [day, shift, fixedQ]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState<RoundIndex>(() => (restored ? (restored.round as RoundIndex) : 0));
  const [rounds, setRounds] = useState<FluencyRound[]>(() => (restored ? roundsOf(restored.rounds) : []));
  const [start, setStart] = useState(0);
  const [over, setOver] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [t0, setT0] = useState(() => restored?.t0 ?? Date.now());
  const [fb, setFb] = useState<FluencyCheckOut | null>(null);
  const [repairs, setRepairs] = useState<{ state: 'idle' | 'saved' | 'failed'; n: number }>({ state: 'idle', n: 0 });
  const [saveFailed, setSaveFailed] = useState(false);
  const ask = useAsk(fluencyCheck);
  const draft = useRef<DraftHandle>(null);
  const done = useRef<FluencyItem | null>(null);
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const itemId = useMemo(() => (q ? fluencyId(q.id, t0) : ''), [q, t0]);
  const key = (r: number) => `fluency:${day}:${q?.id ?? ''}:${r}`;
  const sec = FLUENCY_ROUNDS[round];

  // Fortsetzen (G3): Frage, Runde und gesprochene Runden; das Ende löscht die Momentaufnahme.
  useEffect(() => {
    if (!q) return;
    if (phase === 'result') fluencyResume.clear();
    else fluencyResume.set({ q: q.id, round, t0, rounds: rounds.map((r) => ({ ...r })), ...(unit ? { unit } : {}) });
  }, [phase, q, round, t0, rounds, unit]);

  useCompanionSee({ area: 'speak', label: t('fluTitle'), phase: phase === 'result' ? 'feedback' : 'idle', ...(q ? { detail: `Fluency question: ${q.en}` } : {}) });
  useHotkeys({ escape: () => go({ name: 'speak' }) }, () => false);

  const item = (list: FluencyRound[], f: FluencyCheckOut | null): FluencyItem | null =>
    q ? { id: itemId, t: t0, day, q: q.id, kind: q.kind, rounds: list, fb: fbOf(f), ms: list.reduce((a, r) => a + r.ms, 0), lang, ai: !!f } : null;

  const begin = () => {
    setText(loadDraft(key(round)));
    setInterim('');
    setOver(false);
    setStart(mono());
    setPhase('run');
    requestAnimationFrame(() => draft.current?.focus());
  };

  const check = async (list: FluencyRound[]) => {
    if (!q || !ai) return;
    const r = await ask.run({ question: q.en, rounds: list.map((x) => ({ sec: x.sec, text: x.text })), uiLang: lang });
    if (!r) return;
    setFb(r);
    const it = item(list, r);
    if (it) {
      done.current = it;
      void saveFluencyItem(it).then((ok) => ok || setSaveFailed(true));
    }
    const all = list.map((x) => x.text).join('\n\n');
    const add = repairsFromCorrections(all, r.corrections, q.en, 'fluency');
    if (add.length) {
      const ok = await saveRepairs(add);
      setRepairs({ state: ok ? 'saved' : 'failed', n: add.length });
    }
  };

  const endRound = async () => {
    if (phase !== 'run' || listening || !q) return;
    const used = Math.min(sec * 1000, Math.max(0, mono() - start));
    const body = text.trim().slice(0, FLUENCY_TEXT_MAX);
    const st = roundStats(body, used);
    const list = [...rounds, { sec, text: body, ms: Math.round(used), words: st.words, wpm: st.wpm, sentences: st.sentences, full: st.full }];
    setRounds(list);
    clearDraft(key(round));
    if (round < 2) {
      setRound((round + 1) as RoundIndex);
      setPhase('ready');
      return;
    }
    setPhase('result');
    const it = item(list, null);
    if (!it) return;
    done.current = it;
    const [a, b] = await Promise.all([saveFluencyItem(it), recordFluencyDone(it, q.en)]);
    setSaveFailed(!a || !b);
    await check(list);
  };

  const retrySave = async () => {
    const it = done.current;
    if (!it) return;
    const [a, b] = await Promise.all([saveFluencyItem(it), flush()]);
    setSaveFailed(!a || !b);
  };

  /** Tageseinheit: Block 3 abschließen (Text der 45-s-Runde, Korrekturen). */
  const reportUnit = () => {
    const it = done.current;
    if (!unit || !it || !q) return;
    const lastText = [...it.rounds].reverse().find((r) => r.text.trim())?.text ?? '';
    finishUnit('task.fluency', unit, unitResult('task.fluency', `${fluencyPath(it.day)}#${it.id}`, lastText, fb?.corrections ?? [], null));
  };

  /** „Nochmal, aber besser“ (N74): dieselbe Frage, drei neue Runden. */
  const againSame = () => {
    setRound(0);
    setRounds([]);
    setFb(null);
    setRepairs({ state: 'idle', n: 0 });
    setSaveFailed(false);
    setT0(Date.now());
    done.current = null;
    setPhase('ready');
  };

  const restart = () => {
    setShift((n) => n + 1);
    setRound(0);
    setRounds([]);
    setFb(null);
    setRepairs({ state: 'idle', n: 0 });
    setSaveFailed(false);
    setT0(Date.now());
    done.current = null;
    setPhase('ready');
  };

  if (!q) return null;
  const last = rounds[rounds.length - 1];
  const status = [t(`fluKind_${q.kind}`), phase === 'result' ? t('fluDone') : t('fluRound', { n: round + 1 }), phase === 'result' ? null : t('fluSec', { s: sec })].filter(Boolean).join(' · ');

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="fluency"
      data-phase={phase}
      data-round={round + 1}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon="close" label={t('inLeave')} onClick={() => go({ name: 'speak' })} data-testid="fluency-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: 'var(--lx-ch-speak)' }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {t('fluTitle')}
          </h1>
        </div>
        <p className="lx-tnum text-xs font-medium text-muted" data-testid="fluency-status">
          {status}
        </p>
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium" data-testid="task">
            {phase === 'result' ? t('fluTaskResult') : round === 0 ? t('fluTaskFirst') : t('fluTaskAgain', { s: sec })}
          </p>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('inInfo')}
            aria-expanded={info}
            aria-controls={`${infoId}-purpose`}
            onClick={() => setInfo((v) => !v)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={`${infoId}-purpose`} className="text-sm text-muted" data-testid="purpose">
            {t('fluPurpose')}
          </p>
        )}
      </header>

      {/* G4: eine kaputte Aufgabe kostet nur diesen Schritt. */}
      <StepBoundary resetKey={`${phase}-${round}`} scope="fluency">
      <div className="flex max-w-3xl flex-col gap-5">
        <Card channel="speak" className="flex flex-col gap-2" data-testid="fluency-question" data-q={q.id}>
          <p className="lx-eyebrow">{t('fluQuestion')}</p>
          <EnglishText text={q.en} area="speak" title={t('fluTitle')} className="text-lg leading-snug font-medium" />
          {lang === 'de' && <p className="text-sm text-muted">{q.de}</p>}
          {phase === 'ready' && round === 0 && (
            <div>
              <Button variant="ghost" icon="refresh" onClick={() => setShift((n) => n + 1)} data-testid="fluency-other">
                {t('fluOther')}
              </Button>
            </div>
          )}
        </Card>

        <ol className="flex gap-2" aria-label={t('fluResult')} data-testid="fluency-rounds">
          {FLUENCY_ROUNDS.map((s, i) => {
            const state = phase === 'result' || i < round ? 'done' : i === round ? 'current' : 'next';
            return (
              <li
                key={s}
                data-state={state}
                className={`lx-tnum inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm ${state === 'current' ? 'bg-accent text-accent-fg font-semibold' : state === 'done' ? 'lx-glass text-accent-text' : 'lx-glass text-muted'}`}
              >
                {state === 'done' && <Icon name="check" size={14} />}
                {t('fluSec', { s })}
              </li>
            );
          })}
        </ol>

        {phase === 'ready' && (
          <div className="flex flex-col gap-3">
            {last && (
              <p className="lx-tnum text-sm text-muted" data-testid="fluency-last">
                {t('fluLast', { n: rounds.length, w: last.words, wpm: last.wpm })}
              </p>
            )}
            <div>
              <Button variant="primary" size="lg" icon="play" onClick={begin} data-testid="fluency-start">
                {t('fluStart', { n: round + 1, s: sec })}
              </Button>
            </div>
          </div>
        )}

        {phase === 'run' && (
          <>
            <TargetBar text={text} ctx={ctx} />
            <TimeBar key={`${round}-${start}`} start={start} total={sec * 1000} onOver={() => setOver(true)} />
            <DraftArea handle={draft} value={text} onChange={(v) => setText(v.slice(0, FLUENCY_TEXT_MAX))} label={t('fluDraftLabel')} draftKey={key(round)} rows={6} disabled={over} testId="fluency-draft" />
            <div className="flex flex-wrap items-center gap-3">
              <MicButton
                onText={(heard) => {
                  setInterim('');
                  setText((cur) => appendSpoken(cur, heard).slice(0, FLUENCY_TEXT_MAX));
                }}
                onInterim={setInterim}
              />
              {over ? (
                <Button variant="primary" size="lg" iconAfter="arrowRight" disabled={listening} onClick={() => void endRound()} data-testid="fluency-next">
                  {t('fluNext')}
                </Button>
              ) : (
                <Button onClick={() => void endRound()} disabled={listening} data-testid="fluency-end">
                  {t('fluFinishEarly')}
                </Button>
              )}
            </div>
            {listening && interim && (
              <p className="text-sm text-muted italic" lang="en" data-testid="fluency-interim">
                {interim}
              </p>
            )}
            {listening && <p className="text-xs text-subtle">{t('fluListening')}</p>}
            {over && (
              <p className="text-sm text-accent-text" role="status" data-testid="fluency-timeup">
                {t('fluTimeUp')}
              </p>
            )}
            {!over && sttStatus === 'available' && !listening && <p className="text-xs text-subtle">{t('fluSpeakHint')}</p>}
          </>
        )}

        {phase === 'result' && (
          <Result
            rounds={rounds}
            fb={fb}
            ai={ai}
            aiPhase={ask.phase}
            aiError={ask.phase === 'error' ? ask.error : null}
            onStop={ask.stop}
            onRetry={() => void check(rounds)}
            question={q.en}
            sourceRef={`${fluencyPath(day)}#${itemId}`}
            repairs={repairs}
            repairsText={repairs.state === 'saved' ? tn('fluRepairsSaved', repairs.n) : ''}
            saveFailed={saveFailed}
            onRetrySave={() => void retrySave()}
            onAgain={restart}
            onAgainSame={againSame}
            onBack={() => go({ name: 'speak' })}
            onUnit={unit ? reportUnit : null}
            day={day}
            qId={q.id}
          />
        )}
      </div>
      </StepBoundary>
    </motion.section>
  );
}

type ResultProps = {
  rounds: FluencyRound[];
  fb: FluencyCheckOut | null;
  ai: boolean;
  aiPhase: Parameters<typeof AiRunPanel>[0]['phase'];
  aiError: Parameters<typeof AiRunPanel>[0]['error'];
  onStop: () => void;
  onRetry: () => void;
  question: string;
  sourceRef: string;
  repairs: { state: 'idle' | 'saved' | 'failed'; n: number };
  repairsText: string;
  saveFailed: boolean;
  onRetrySave: () => void;
  onAgain: () => void;
  onAgainSame: () => void;
  onBack: () => void;
  /** Tageseinheit: Block 3 melden (statt „Zurück“). */
  onUnit: (() => void) | null;
  day: string;
  qId: string;
};

/** Ergebnis: ruhige Kennzahlen je Runde, Rückmeldung von Claude, die drei Fassungen. */
function Result({ rounds, fb, ai, aiPhase, aiError, onStop, onRetry, question, sourceRef, repairs, repairsText, saveFailed, onRetrySave, onAgain, onAgainSame, onBack, onUnit, day, qId }: ResultProps) {
  const { t, lang } = useT();
  const first = rounds[0];
  const third = rounds[2];
  return (
    <div className="flex flex-col gap-5" data-testid="fluency-result">
      <WpmCard rounds={rounds} day={day} q={qId} />
      <Card as="div" className="flex flex-col gap-3" data-testid="fluency-stats">
        <p className="lx-eyebrow">{t('fluResult')}</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-1.5 pr-2 font-normal">
                {t('fluColRound')}
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">
                {t('fluColWords')}
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">
                {t('fluColWpm')}
              </th>
              <th scope="col" className="py-1.5 text-right font-normal">
                {t('fluColFull')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={i} className="border-t border-line" data-testid="fluency-stat" data-words={r.words} data-wpm={r.wpm} data-full={r.full} data-sentences={r.sentences}>
                <th scope="row" className="lx-tnum py-2 pr-2 font-normal text-muted">
                  {t('fluSec', { s: r.sec })}
                </th>
                <td className="lx-tnum py-2 pr-2 text-right">{r.words}</td>
                <td className="lx-tnum py-2 pr-2 text-right">{r.wpm}</td>
                <td className="lx-tnum py-2 text-right">{r.sentences ? t('fluPct', { p: Math.round((r.full / r.sentences) * 100) }) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {first && third && first.words > 0 && third.words > 0 && <p className="text-sm text-muted">{t('fluSummary', { wpm: third.wpm, wpm1: first.wpm })}</p>}
      </Card>

      {!ai && !fb && (
        <p className="text-sm text-muted" data-testid="fluency-noai">
          {t('fluNoAi')}
        </p>
      )}
      <AiRunPanel phase={aiPhase} error={aiError} onStop={onStop} onRetry={onRetry} />

      {fb && (
        <div className="flex flex-col gap-4" data-testid="fluency-feedback">
          <Card as="div" channel="speak" className="flex flex-col gap-2" data-testid="fluency-progress">
            <p className="lx-eyebrow">{t('fluProgress')}</p>
            <p className="text-base leading-relaxed">{fb.progress}</p>
          </Card>
          {fb.missing.length > 0 && (
            <Card as="div" className="flex flex-col gap-3" data-testid="fluency-missing">
              <p className="lx-eyebrow">{t('fluMissing')}</p>
              <ul className="flex flex-col gap-4">
                {fb.missing.map((m, i) => (
                  <li key={`${m.phrase}-${i}`} className="flex flex-col gap-1" data-testid="fluency-phrase">
                    <EnglishText text={m.phrase} area="speak" title={question} className="text-base font-semibold" />
                    <p className="text-sm text-muted">{lang === 'de' ? m.de : m.def}</p>
                    <EnglishText text={m.example} area="speak" title={question} className="text-sm leading-relaxed" />
                    <div>
                      <TakeChunkButton
                        compact
                        input={{ en: m.phrase, de: m.de, def: m.def, kind: 'phrase', register: 'neutral', why: '', whyLang: lang, level: 'C1', src: { kind: 'fluency', ref: sourceRef, title: question.slice(0, 120), utterance: '', upgraded: m.example } }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card as="div" className="flex flex-col gap-3" data-testid="fluency-corrections" data-n={fb.corrections.length}>
            <p className="lx-eyebrow">{t('fluCorrections')}</p>
            {fb.corrections.length === 0 && <p className="text-sm text-muted">{t('fluNoCorrections')}</p>}
            <ul className="flex flex-col gap-3">
              {fb.corrections.map((c, i) => (
                <li key={`${c.wrong}-${i}`} className="flex flex-col gap-1" data-testid="fluency-correction">
                  <p className="text-sm text-muted line-through decoration-danger-text/60" lang="en">
                    {c.wrong}
                  </p>
                  <EnglishText text={c.right} area="speak" title={question} className="text-base font-medium" />
                  <p className="text-sm text-muted">{c.why}</p>
                </li>
              ))}
            </ul>
            {repairs.state === 'saved' && (
              <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="fluency-repairs" data-n={repairs.n}>
                <Icon name="check" size={16} />
                {repairsText}
              </p>
            )}
            {repairs.state === 'failed' && (
              <p className="text-sm text-danger-text" role="alert" data-testid="fluency-repairs-failed">
                {t('fluRepairsFailed')}
              </p>
            )}
          </Card>
        </div>
      )}

      <FoldGroup label={t('fluYourRounds')}>
        {rounds.map((r, i) => (
          <Fold key={i} title={`${t('fluRoundShort', { n: i + 1 })} · ${t('fluSec', { s: r.sec })}`} meta={t('fluMeta', { w: r.words, wpm: r.wpm })} testId="fluency-version">
            {r.text ? <EnglishText as="div" text={r.text} area="speak" title={question} className="pb-3 text-base leading-relaxed" /> : <p className="pb-3 text-sm text-muted">{t('fluEmptyRound')}</p>}
          </Fold>
        ))}
      </FoldGroup>

      {saveFailed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-danger-text" role="alert" data-testid="fluency-save-failed">
          <span>{t('fluSaveFailed')}</span>
          <Button onClick={onRetrySave} icon="refresh">
            {t('fluRetrySave')}
          </Button>
        </div>
      )}

      {onUnit ? (
        // Tageseinheit: „Weiter“ ist nie von der KI blockiert (G6).
        <div>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onUnit} data-testid="fluency-unit-next">
            {t('nbSprechenUnitDone')}
          </Button>
        </div>
      ) : (
        !isBusy(aiPhase) && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={onBack} data-testid="fluency-back">
              {t('fluBack')}
            </Button>
            <Button icon="refresh" onClick={onAgainSame} data-testid="fluency-again-same">
              {t('nbSprechenAgain')}
            </Button>
            <Button variant="ghost" onClick={onAgain} data-testid="fluency-again">
              {t('fluAgain')}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
