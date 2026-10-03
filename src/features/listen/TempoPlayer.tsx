import { useEffect, useMemo, useRef, useState } from 'react';
import { ladderRate, type Ladder } from '../../domain/input/ladder';
import { useT } from '../../i18n';
import { speak, speechChunks, stopSpeech, unlockSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { InputIcon } from '../../ui/InputIcon';
import { Switch } from '../../ui/Switch';

// Abspielleiste mit Tempo-Leiter (Neubau N54, Lehrer H2, Readlang): Satz für Satz, ▶/⏸, Satz ↺,
// ‹ ›, wahlweise Pause nach jedem Satz. 1. Hören mit dem Leiter-Tempo (0,9 bzw. 1,0), jedes weitere
// Hören schneller (1,1). Nur auf Klick gestartet (iPhone), nie automatisch. Stücke ≤ 150 Zeichen
// kommen aus `speechChunks` (Sprachausgabe am Handy nicht abgehackt, A7).

type Props = {
  text: string;
  ladder: Ladder;
  /** Fertig gehörte Durchgänge (von außen, z. B. nach dem Fortsetzen). */
  passes: number;
  /** Ein Durchgang ist bis zum letzten Satz gelaufen. */
  onPass: (passes: number) => void;
  /** Satz-Position (Fortsetzen). */
  pos?: number;
  onPos?: (i: number) => void;
};

const GAP_MS = 350;

export function TempoPlayer({ text, ladder, passes, onPass, pos = 0, onPos }: Props) {
  const { t } = useT();
  const chunks = useMemo(() => speechChunks(text), [text]);
  const n = Math.max(1, chunks.length);
  const [i, setI] = useState(() => Math.min(n - 1, Math.max(0, pos)));
  const [playing, setPlaying] = useState(false);
  const [stepwise, setStepwise] = useState(false);
  const [manual, setManual] = useState<number | null>(null);
  const run = useRef(0);
  const timer = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const pass = passes + 1;
  const rate = manual ?? ladderRate(ladder, pass);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(
    () => () => {
      run.current++;
      if (timer.current !== null) window.clearTimeout(timer.current);
      stopSpeech();
    },
    [],
  );

  const setPos = (k: number) => {
    setI(k);
    onPos?.(k);
  };

  const playFrom = (k: number, once = false) => {
    unlockSpeech();
    clear();
    const id = ++run.current;
    setPlaying(true);
    const step = (j: number) => {
      if (run.current !== id) return;
      if (j >= chunks.length) {
        setPlaying(false);
        setPos(0);
        setManual(null);
        onPass(passes + 1);
        return;
      }
      setPos(j);
      last.current = j;
      void speak(chunks[j] ?? '', { rate }).then((o) => {
        if (run.current !== id) return;
        if (o !== 'done') {
          setPlaying(false);
          return;
        }
        if (once || stepwise) {
          setPlaying(false);
          if (j + 1 >= chunks.length) step(j + 1);
          else setPos(j + 1);
          return;
        }
        timer.current = window.setTimeout(() => step(j + 1), GAP_MS);
      });
    };
    step(k);
  };

  const stop = () => {
    run.current++;
    clear();
    stopSpeech();
    setPlaying(false);
  };

  // Satz ↺: der laufende bzw. zuletzt gehörte Satz noch einmal.
  const again = () => playFrom(playing ? i : (last.current ?? i), true);
  const prev = () => (playing ? playFrom(Math.max(0, i - 1)) : setPos(Math.max(0, i - 1)));
  const next = () => (playing ? playFrom(Math.min(n - 1, i + 1)) : setPos(Math.min(n - 1, i + 1)));
  const rates = [0.8, 0.9, 1, 1.1];
  const pct = Math.round(((playing ? i + 1 : i) / n) * 100);

  return (
    <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-4" data-testid="tempo-player" data-pass={pass} data-rate={rate} data-playing={playing || undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="lx-eyebrow" data-testid="tempo-pass">
          {t('nbLesenPass', { n: pass, rate: rate.toFixed(1) })}
        </p>
        <p className="lx-tnum text-xs text-muted" data-testid="tempo-pos" data-i={i + 1} data-n={n}>
          {t('nbLesenSentenceOf', { i: i + 1, n })}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--lx-ch-listen)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button variant="primary" onClick={stop} data-testid="tempo-stop">
            <span className="inline-flex items-center gap-2">
              <InputIcon name="stop" size={18} />
              {t('lsStop')}
            </span>
          </Button>
        ) : (
          <Button variant="primary" onClick={() => playFrom(i)} data-testid="tempo-play">
            <span className="inline-flex items-center gap-2">
              <InputIcon name="play" size={18} />
              {i > 0 ? t('nbLesenContinue') : t('lsPlay')}
            </span>
          </Button>
        )}
        <IconButton icon="undo" label={t('nbLesenRepeat')} onClick={again} data-testid="tempo-repeat" />
        <IconButton icon="arrowLeft" label={t('nbLesenPrev')} onClick={prev} disabled={i === 0} data-testid="tempo-prev" />
        <IconButton icon="arrowRight" label={t('nbLesenNext')} onClick={next} disabled={i >= n - 1} data-testid="tempo-next" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Switch checked={stepwise} onChange={setStepwise} label={t('nbLesenStepwise')} testId="tempo-stepwise" />
          <span aria-hidden="true">{t('nbLesenStepwise')}</span>
        </div>
        <div role="radiogroup" aria-label={t('lsRate')} className="flex items-center gap-1 rounded-[var(--radius-control)] bg-track p-1">
          {rates.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={Math.abs(rate - r) < 0.01}
              onClick={() => setManual(r)}
              data-testid="tempo-rate"
              data-rate={r}
              className={`min-h-11 min-w-11 rounded-[calc(var(--radius-control)-4px)] px-2 text-sm lx-tnum ${Math.abs(rate - r) < 0.01 ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'text-muted'}`}
            >
              {r.toFixed(1)}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
