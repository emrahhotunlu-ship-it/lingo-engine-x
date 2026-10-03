import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAiAvailable } from '../../../ai/scope';
import { useAsk } from '../../../ai/useAsk';
import { useClock } from '../../../app/clock';
import { leaveBack } from '../../../app/nav';
import { compareTask } from '../../../content/compare';
import { useLive } from '../../../data/live';
import { useDocWatch } from '../../../data/watch';
import { compareOffer, measure, monthOf, readCompare, SPEAK_SEC, type CompareRun, type CompareSide } from '../../../domain/compare/compare';
import { wordCount } from '../../../domain/input/textStats';
import { useT } from '../../../i18n';
import { compare, type CompareOut } from '../../../prompts/compare';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { toast } from '../../../ui/Toast';
import { AiRunPanel } from '../../input/AiRunPanel';
import { ExerciseTop, TaskLine } from '../../learn/ui';
import { COMPARE_DOC, CompareSides, CompareVerdictText, monthName } from './CompareView';
import { saveCompareRun, saveCompareVerdict } from './store';

// Monatliche Vergleichsaufgabe (Backlog B1): 1. Sprechen – 45 Sekunden (Diktiertaste der Tastatur
// oder tippen), 2. Schreiben – dieselbe Mail-Aufgabe wie beim letzten Mal, 3. Ergebnis – beide
// Fassungen nebeneinander, Messwerte, und Claude beschreibt den Fortschritt (compare@1). Ohne
// frühere Fassung ist dieser Lauf die Ausgangsfassung für den nächsten Monat.

type Phase = 'speak' | 'write' | 'result';
const MIN_WORDS = 15;

function useOwnPhrases(): string[] {
  const chunks = useLive((s) => s.collections.chunk);
  return useMemo(() => [...(chunks?.values() ?? [])].map((d) => (typeof d.en === 'string' ? d.en : '')).filter(Boolean), [chunks]);
}

/** 45-s-Balken: ein reiner Anzeige-Timer (kein KI-Aufruf), endet mit `onOver`. */
function SpeakTimer({ start, onOver }: { start: number; onOver: () => void }) {
  const { t } = useT();
  const [left, setLeft] = useState(SPEAK_SEC);
  const over = useRef(onOver);
  useEffect(() => {
    over.current = onOver;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const l = Math.max(0, SPEAK_SEC - Math.floor((Date.now() - start) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        over.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [start]);
  return (
    <div className="flex items-center gap-3" data-testid="cmp-timer" data-left={left}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${(left / SPEAK_SEC) * 100}%` }} />
      </div>
      <span className="lx-tnum text-xs text-muted" role="timer" aria-live="off">
        {t('nbProfilCmpLeft', { s: left })}
      </span>
    </div>
  );
}

export function CompareScreen() {
  const { t, lang } = useT();
  const id = useId();
  const ai = useAiAvailable();
  const today = useClock((s) => s.today);
  const watched = useDocWatch(COMPARE_DOC);
  const runs = useMemo(() => readCompare(watched.data), [watched.data]);
  const phrases = useOwnPhrases();
  // Einmal beim Start festgelegt: Aufgabe und Vergleichsfassung ändern sich während der Übung nicht.
  const [offer, setOffer] = useState<ReturnType<typeof compareOffer> | null>(null);
  if (!offer && watched.status !== 'loading') setOffer(compareOffer(today, runs));
  const task = compareTask(offer?.task);
  const base = offer?.base ?? null;
  const [phase, setPhase] = useState<Phase>('speak');
  const [speak, setSpeak] = useState('');
  const [speakStart, setSpeakStart] = useState<number | null>(null);
  const [speakSec, setSpeakSec] = useState<number | null>(null);
  const [write, setWrite] = useState('');
  const [run, setRun] = useState<CompareRun | null>(null);
  const [saved, setSaved] = useState<'no' | 'ok' | 'failed'>('no');
  const ask = useAsk(compare);
  const verdict: CompareOut | null = ask.data ?? null;

  const endSpeak = () => {
    if (speakStart === null || speakSec !== null) return;
    setSpeakSec(Math.min(SPEAK_SEC, (Date.now() - speakStart) / 1000));
  };

  const askVerdict = async (r: CompareRun, opts: { refresh?: boolean } = {}) => {
    if (!base || !ai) return;
    const out = await ask.run(
      {
        uiLang: lang,
        speakTask: task.speak.en,
        writeTask: task.write.en,
        before: { speak: base.speak.text, write: base.write.text, speakM: base.speak.m, writeM: base.write.m, month: base.month },
        now: { speak: r.speak.text, write: r.write.text, speakM: r.speak.m, writeM: r.write.m, month: r.month },
      },
      opts,
    );
    if (out) void saveCompareVerdict(r.month, { ...out, lang, pv: `${compare.id}@${compare.version}` });
  };

  const finish = async () => {
    const sec = speakSec ?? SPEAK_SEC;
    const speakSide: CompareSide = { text: speak.trim(), m: measure(speak, phrases, sec), sec: Math.round(sec) };
    const writeSide: CompareSide = { text: write.trim(), m: measure(write, phrases) };
    const r: CompareRun = { month: monthOf(today), day: today, t: Date.now(), task: task.id, speak: speakSide, write: writeSide, ...(base ? { base: base.month } : {}) };
    setRun(r);
    setPhase('result');
    const ok = await saveCompareRun(r);
    setSaved(ok ? 'ok' : 'failed');
    if (!ok) toast(t('nbProfilCmpNotSaved'));
    if (ok) void askVerdict(r);
  };

  const progress = { n: phase === 'speak' ? 1 : phase === 'write' ? 2 : 3, total: 3 };
  const speakWords = wordCount(speak);
  const writeWords = wordCount(write);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-4 sm:py-8" data-testid="compare" data-phase={phase} data-base={base?.month ?? ''}>
      <ExerciseTop onClose={() => leaveBack()} closeTestId="cmp-close" progress={progress} ctx="extra" />
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight" id={`${id}-title`}>
          {t('nbProfilCmpTitle')}
        </h1>
        <p className="text-sm text-muted" data-testid="cmp-lead">
          {base ? t('nbProfilCmpLeadBase', { month: monthName(base.month, lang, today) }) : t('nbProfilCmpLeadFirst')}
        </p>
      </header>

      {phase === 'speak' && (
        <section className="flex flex-col gap-4" data-testid="cmp-speak">
          <TaskLine task={t('nbProfilCmpSpeakTask', { s: SPEAK_SEC })} purpose={t('nbProfilCmpPurpose')} />
          <Card className="flex flex-col gap-2">
            <p className="text-base font-medium" data-testid="cmp-speak-q">
              {task.speak[lang]}
            </p>
          </Card>
          {speakStart !== null && speakSec === null && <SpeakTimer start={speakStart} onOver={endSpeak} />}
          <textarea
            value={speak}
            onChange={(e) => {
              if (speakStart === null) setSpeakStart(Date.now());
              setSpeak(e.target.value);
            }}
            readOnly={speakSec !== null}
            rows={6}
            lang="en"
            autoCapitalize="sentences"
            spellCheck={false}
            aria-label={t('nbProfilCmpSpeakLabel')}
            placeholder={t('nbProfilCmpSpeakPh')}
            data-testid="cmp-speak-input"
            className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
          />
          <p className="text-xs text-subtle">{speakSec !== null ? t('nbProfilCmpTimeUp') : t('nbProfilCmpDictate')}</p>
          <div>
            <Button
              variant="primary"
              disabled={speakWords < 5}
              onClick={() => {
                endSpeak();
                setPhase('write');
              }}
              data-testid="cmp-speak-done"
            >
              {t('nbProfilCmpNext')}
            </Button>
          </div>
        </section>
      )}

      {phase === 'write' && (
        <section className="flex flex-col gap-4" data-testid="cmp-write">
          <TaskLine task={t('nbProfilCmpWriteTask')} purpose={t('nbProfilCmpPurpose')} />
          <Card>
            <p className="text-base font-medium" data-testid="cmp-write-q">
              {task.write[lang]}
            </p>
          </Card>
          <textarea
            value={write}
            onChange={(e) => setWrite(e.target.value)}
            rows={10}
            lang="en"
            autoCapitalize="sentences"
            spellCheck={false}
            aria-label={t('nbProfilCmpWriteLabel')}
            data-testid="cmp-write-input"
            className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="lx-tnum text-xs text-subtle">{t('nbProfilCmpWords', { n: writeWords, min: MIN_WORDS })}</span>
            <Button variant="primary" disabled={writeWords < MIN_WORDS} onClick={() => void finish()} data-testid="cmp-write-done">
              {t('nbProfilCmpFinish')}
            </Button>
          </div>
        </section>
      )}

      {phase === 'result' && run && (
        <section className="flex flex-col gap-5" data-testid="cmp-result" data-saved={saved}>
          <CompareSides run={run} base={base} />
          {base ? (
            <Card className="flex flex-col gap-3" data-testid="cmp-verdict-card">
              <h2 className="lx-eyebrow">{t('nbProfilCmpVerdict')}</h2>
              {verdict ? (
                <CompareVerdictText v={verdict} />
              ) : ai ? (
                <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void askVerdict(run, { refresh: true })} />
              ) : (
                <p className="text-sm text-muted">{t('aiUnavailable')}</p>
              )}
            </Card>
          ) : (
            <p className="text-sm text-muted" data-testid="cmp-first">
              {t('nbProfilCmpFirstDone')}
            </p>
          )}
          <div>
            <Button variant="primary" onClick={() => leaveBack()} data-testid="cmp-close-end">
              {t('nbProfilCmpDone')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
