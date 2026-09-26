import { useEffect, useMemo, useRef, useState } from 'react';
import type { ListeningItem } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { speak, speechChunks, stopSpeech, unlockSpeech, useSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { InputIcon } from '../../ui/InputIcon';

// Transkript nach den Fragen (Plan §4.2 Nr. 5, M12): jeder Abschnitt einzeln abspielbar, das
// laufende Stück ist markiert. „Satz für Satz mit Pause" spielt einen Abschnitt, zeigt „Jetzt du"
// und macht eine Pause zum Nachsprechen – ohne Wertung. Nur auf Klick gestartet (iPhone).

type Props = { item: ListeningItem; rate: number };

/** Nachsprech-Pause: etwa so lang wie der Abschnitt selbst, mindestens 1,5 s. */
export const shadowPauseMs = (chunk: string, rate: number): number => Math.max(1500, Math.round((chunk.length * 70) / Math.max(0.5, rate)));

export function TranscriptView({ item, rate }: Props) {
  const { t, lang } = useT();
  const speech = useSpeech((s) => s.status);
  const chunks = useMemo(() => speechChunks(item.text), [item.text]);
  const [active, setActive] = useState<number | null>(null);
  const [shadow, setShadow] = useState<{ i: number; phase: 'listen' | 'you' } | null>(null);
  const run = useRef(0);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
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

  const playOne = (i: number) => {
    unlockSpeech();
    clearTimer();
    setShadow(null);
    const id = ++run.current;
    setActive(i);
    void speak(chunks[i] ?? '', { rate }).then(() => {
      if (run.current === id) setActive(null);
    });
  };

  const shadowStep = (i: number, id: number) => {
    if (run.current !== id) return;
    const chunk = chunks[i];
    if (chunk === undefined) {
      setShadow(null);
      setActive(null);
      return;
    }
    setShadow({ i, phase: 'listen' });
    setActive(i);
    void speak(chunk, { rate }).then((o) => {
      if (run.current !== id) return;
      if (o !== 'done') {
        setShadow(null);
        setActive(null);
        return;
      }
      setShadow({ i, phase: 'you' });
      timer.current = window.setTimeout(() => shadowStep(i + 1, id), shadowPauseMs(chunk, rate));
    });
  };

  const startShadow = () => {
    unlockSpeech();
    clearTimer();
    const id = ++run.current;
    shadowStep(0, id);
  };

  const stopShadow = () => {
    run.current++;
    clearTimer();
    stopSpeech();
    setShadow(null);
    setActive(null);
  };

  return (
    <section className="flex flex-col gap-3" data-testid="transcript">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t('lsTranscript')}</h3>
        {speech === 'ready' &&
          (shadow ? (
            <Button variant="ghost" onClick={stopShadow} data-testid="shadow-stop">
              {t('lsShadowStop')}
            </Button>
          ) : (
            <Button onClick={startShadow} data-testid="shadow-start">
              <span className="inline-flex items-center gap-2">
                <InputIcon name="mic" size={18} />
                {t('lsShadowMode')}
              </span>
            </Button>
          ))}
      </div>
      <p className="text-sm text-muted" lang={lang}>
        {t('lsShadow')}
      </p>
      {shadow && (
        <p className="text-sm font-semibold" role="status" data-testid="shadow-phase" data-phase={shadow.phase} lang={lang}>
          {shadow.phase === 'you' ? t('lsYourTurn') : t('lsListening')} · {t('lsPart', { i: shadow.i + 1, n: chunks.length })}
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {chunks.map((c, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 rounded-xl px-2 py-1 transition-colors ${active === i ? 'bg-[var(--lx-cyan-soft)]' : ''}`}
            data-testid="transcript-part"
            data-active={active === i || undefined}
          >
            {speech === 'ready' && <IconButton icon="speaker" label={t('lsPlayPart', { i: i + 1 })} onClick={() => playOne(i)} className="flex-none" />}
            <EnglishText text={c} area="listen" source={item.ref} title={item.title} className="py-2 text-base leading-relaxed" />
          </li>
        ))}
      </ol>
    </section>
  );
}
