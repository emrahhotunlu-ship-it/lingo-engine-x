import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { initStt, listen, useStt } from '../platform/stt';

// Mikrofon-Knopf (Plan D5, §7): existiert NUR, wenn die Spracheingabe verfügbar ist. Das Ergebnis
// geht an `onText` (ins Textfeld), gesendet wird nie automatisch. Scheitert ein Start, ist der
// Knopf sofort und dauerhaft weg (stt.ts merkt sich das). Zustände: bereit → hört zu → Text.

type Props = { onText: (text: string) => void; onInterim?: (text: string) => void; disabled?: boolean };

export function MicButton({ onText, onInterim, disabled }: Props) {
  const { t } = useT();
  const status = useStt((s) => s.status);
  const listening = useStt((s) => s.listening);
  const [note, setNote] = useState<'none' | 'nospeech'>('none');
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (useStt.getState().status === 'unknown') initStt();
    return () => ctl.current?.abort();
  }, []);

  if (status !== 'available') return null;

  const toggle = async () => {
    if (listening) {
      ctl.current?.abort();
      return;
    }
    setNote('none');
    const c = new AbortController();
    ctl.current = c;
    const res = await listen({ lang: 'en-US', signal: c.signal, ...(onInterim ? { onInterim } : {}) });
    if (ctl.current === c) ctl.current = null;
    if ('text' in res) onText(res.text);
    else if (res.error === 'no-speech') setNote('nospeech');
  };

  return (
    <span className="relative inline-flex items-center">
      <motion.button
        type="button"
        data-testid="mic"
        data-listening={listening || undefined}
        aria-pressed={listening}
        aria-label={listening ? t('micListening') : t('micStart')}
        title={listening ? t('micListening') : t('micStart')}
        disabled={disabled}
        whileTap={{ scale: 0.94 }}
        onClick={() => void toggle()}
        className={`lx-mic inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${listening ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-surface hover:text-fg'}`}
      >
        <Icon name={listening ? 'stop' : 'mic'} size={20} />
      </motion.button>
      {note === 'nospeech' && (
        <span role="status" className="absolute bottom-full right-0 mb-2 w-max max-w-56 rounded-xl bg-surface-solid px-3 py-2 text-xs text-muted shadow-lg">
          {t('micNoSpeech')}
        </span>
      )}
    </span>
  );
}
