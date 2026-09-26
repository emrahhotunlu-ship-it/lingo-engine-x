import { useEffect, useMemo, useRef, useState } from 'react';
import { speak, speechChunks, stopSpeech, unlockSpeech, type SpeakOutcome } from '../platform/speech';
import { Button } from '../ui/Button';
import { InputIcon } from '../ui/InputIcon';

// Abspielleiste für Hörtexte (Plan §4.2, R4): Abspielen/Anhalten, „Satz zurück", Tempo
// 0,8 · 0,9 · 1,0 und „Abschnitt i von n". `speak` wird synchron im Klick aufgerufen (iPhone),
// die Stücke sind ≤ 150 Zeichen; `onChunk` zeigt das laufende Stück und erlaubt den Wiedereinstieg.

export const RATES = [0.8, 0.9, 1] as const;

type Labels = { play: string; stop: string; back: string; rate: string; part: (i: number, n: number) => string };

type Props = {
  text: string;
  rate: number;
  onRate: (r: number) => void;
  labels: Labels;
  /** Abspielen ab dem Anfang (zählt als „gehört"). */
  onPlayFromStart?: () => void;
  /** Ausgabe beendet: `done` = bis zum Ende gehört, `unavailable` = kein Ton. */
  onOutcome?: (o: SpeakOutcome, fromStart: boolean) => void;
  onChunk?: (i: number, n: number) => void;
};

export function AudioBar({ text, rate, onRate, labels, onPlayFromStart, onOutcome, onChunk }: Props) {
  const chunks = useMemo(() => speechChunks(text), [text]);
  const n = Math.max(1, chunks.length);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);

  useEffect(() => () => stopSpeech(), []);

  const play = (from: number) => {
    unlockSpeech();
    const id = ++run.current;
    const start = Math.min(n - 1, Math.max(0, from));
    const fromStart = start === 0;
    if (fromStart) onPlayFromStart?.();
    setPlaying(true);
    setI(start);
    void speak(text, {
      rate,
      startAt: start,
      onChunk: (k, total) => {
        if (run.current !== id) return;
        setI(k);
        onChunk?.(k, total);
      },
    }).then((o) => {
      if (run.current !== id) return;
      setPlaying(false);
      if (o === 'done') setI(0);
      onOutcome?.(o, fromStart);
    });
  };

  const stop = () => {
    run.current++;
    stopSpeech();
    setPlaying(false);
  };

  const back = () => {
    const target = Math.max(0, i - 1);
    if (playing) play(target);
    else setI(target);
  };

  const pct = Math.round(((playing ? i + 1 : i) / n) * 100);

  return (
    <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-4" data-testid="audio-bar">
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button variant="primary" onClick={stop} data-testid="audio-stop">
            <span className="inline-flex items-center gap-2">
              <InputIcon name="stop" size={18} />
              {labels.stop}
            </span>
          </Button>
        ) : (
          <Button variant="primary" onClick={() => play(i)} data-testid="audio-play">
            <span className="inline-flex items-center gap-2">
              <InputIcon name="play" size={18} />
              {labels.play}
            </span>
          </Button>
        )}
        <Button variant="ghost" onClick={back} disabled={i === 0 && !playing} data-testid="audio-back">
          <span className="inline-flex items-center gap-2">
            <InputIcon name="rewind" size={18} />
            {labels.back}
          </span>
        </Button>
        <div role="radiogroup" aria-label={labels.rate} className="ml-auto flex items-center gap-1 rounded-[var(--radius-control)] bg-track p-1">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={Math.abs(rate - r) < 0.01}
              onClick={() => onRate(r)}
              data-testid="audio-rate"
              data-rate={r}
              className={`min-h-11 min-w-11 rounded-[calc(var(--radius-control)-4px)] px-2 text-sm lx-tnum ${Math.abs(rate - r) < 0.01 ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'text-muted'}`}
            >
              {r.toFixed(1)}×
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--lx-ch-listen)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="lx-tnum text-xs text-muted" data-testid="audio-progress" data-i={i + 1} data-n={n} aria-live="off">
          {labels.part(i + 1, n)}
        </p>
      </div>
    </div>
  );
}
