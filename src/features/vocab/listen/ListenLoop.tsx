import { useEffect, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { loopItems, type LoopItem } from '../../../domain/srs/listen';
import { EnglishText } from '../../../engine/EnglishText';
import { useT } from '../../../i18n';
import { logWarn } from '../../../platform/diagnostics';
import { speak, stopSpeech, useSpeech } from '../../../platform/speech';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { ExerciseTop } from '../../learn/ui';
import { useVocabCards } from '../hub/data';

// Hörschleife (plan.md N35, markt GL1/GL3): 10 Sätze aus fälligen Karten. Die Sprachausgabe spricht
// den Satz, Pause zum Nachsprechen, spricht ihn noch einmal, dann der nächste. Keine Bewertung,
// schreibt nichts – zählt nicht als Wiederholung (Extra). Grenze: stoppt bei gesperrtem Bildschirm.

type Phase = 'speak' | 'repeat';

/** Pause zum Nachsprechen: etwa so lang wie der Satz gesprochen dauert (2–8 s). */
export const repeatPauseMs = (sentence: string): number => Math.min(8000, Math.max(2000, sentence.split(/\s+/).filter(Boolean).length * 420));
const GAP_MS = 900;

export function ListenLoop() {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const cards = useVocabCards();
  const now = useClock((s) => s.now);
  const tts = useSpeech((s) => s.status === 'ready');
  // Einmal beim Öffnen eingefroren: Live-Änderungen mischen die Schleife nicht neu.
  const [items] = useState<LoopItem[]>(() => loopItems(cards, now));
  const [idx, setIdx] = useState(0);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>('speak');
  const [paused, setPaused] = useState(false);
  const [showText, setShowText] = useState(false);
  const item = items[idx] ?? null;
  const done = items.length > 0 && idx >= items.length;

  useEffect(() => {
    if (!item || paused || !tts) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
    const say = async (): Promise<boolean> => {
      setPhase('speak');
      const o = await speak(item.sentence);
      if (!alive) return false;
      if (o === 'done') return true;
      // Unterbrochen (andere Ausgabe, Bildschirm gesperrt) oder nicht verfügbar: anhalten statt weiterzählen.
      if (o !== 'stopped') logWarn('vocab:loop', { code: o, message: 'Sprachausgabe der Hörschleife' }, item.key);
      setPaused(true);
      return false;
    };
    void (async () => {
      if (!(await say())) return;
      setPhase('repeat');
      await wait(repeatPauseMs(item.sentence));
      if (!alive || !(await say())) return;
      await wait(GAP_MS);
      if (alive) setIdx((i) => i + 1);
    })();
    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
      stopSpeech();
    };
  }, [item, paused, tts, run]);

  const close = () => {
    stopSpeech();
    back();
  };
  const restart = () => {
    setIdx(0);
    setPaused(false);
    setRun((r) => r + 1);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="listen-loop">
      <ExerciseTop onClose={close} closeLabel={t('nbWsLoopClose')} closeTestId="loop-close" progress={item ? { n: idx + 1, total: items.length } : null} progressTestId="loop-progress" ctx="extra" />
      <section className="lx-glass lx-exercise flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-medium text-muted" data-testid="task">
            {t('nbWsLoopTask')}
          </h2>
          <p className="text-sm text-subtle">{t('nbWsLoopPurpose')}</p>
        </header>
        {!tts ? (
          <p className="text-base text-muted" role="status" data-testid="loop-no-tts">
            {t('nbWsLoopNoTts')}
          </p>
        ) : items.length === 0 ? (
          <p className="text-base text-muted" data-testid="loop-empty">
            {t('nbWsLoopNone')}
          </p>
        ) : done ? (
          <div className="flex flex-col gap-4" data-testid="loop-done">
            <p className="text-lg font-semibold">{t('nbWsLoopDone', { n: items.length })}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="refresh" onClick={restart} data-testid="loop-again">
                {t('nbWsLoopAgain')}
              </Button>
              <Button variant="secondary" onClick={close}>
                {t('close')}
              </Button>
            </div>
          </div>
        ) : item ? (
          <>
            <p className="lx-tnum text-sm text-muted" data-testid="loop-count">
              {t('nbWsLoopProgress', { n: idx + 1, total: items.length })}
            </p>
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center" aria-live="polite">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-accent-text" data-testid="loop-phase" data-phase={paused ? 'paused' : phase}>
                <Icon name={phase === 'repeat' && !paused ? 'mic' : 'speaker'} size={18} />
                {paused ? t('nbWsLoopPause') : phase === 'repeat' ? t('nbWsLoopRepeat') : t('nbWsLoopSpeaking')}
              </span>
              {showText && <EnglishText as="p" className="lx-sentence" text={item.sentence} area="trainer" source={item.key} title={item.word} testId="loop-sentence" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={paused ? 'play' : 'stop'} onClick={() => setPaused((p) => !p)} data-testid="loop-toggle">
                {paused ? t('nbWsLoopPlay') : t('nbWsLoopPause')}
              </Button>
              <Button variant="secondary" iconAfter="arrowRight" onClick={() => setIdx((i) => i + 1)} data-testid="loop-next">
                {t('nbWsLoopNext')}
              </Button>
              <Button variant="ghost" onClick={() => setShowText((v) => !v)} aria-pressed={showText} data-testid="loop-text">
                {showText ? t('nbWsLoopHideText') : t('nbWsLoopShowText')}
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
