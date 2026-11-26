import { useT } from '../i18n';
import { IconButton } from '../ui/Button';
import { speak, useSpeakWaiting, useSpeech } from '../platform/speech';
import { usePrefetchSpeech } from './usePrefetchSpeech';

// 🔊 für einen englischen Text (Plan §5.2). Nur sichtbar, wenn Sprachausgabe möglich ist.

export function SpeakButton({ text, label, testId }: { text: string; label?: string; testId?: string }) {
  const { t } = useT();
  const status = useSpeech((s) => s.status);
  const waiting = useSpeakWaiting(text);
  usePrefetchSpeech(text);
  if (status === 'unsupported' || status === 'novoice' || !text.trim()) return null;
  // Stimme 2.0: wartet die Ausgabe auf die gute Stimme, pulsiert der Lautsprecher ruhig (statt sofort die Gerätestimme).
  return (
    <IconButton
      icon="speaker"
      label={label ?? t('lkListen')}
      onClick={() => void speak(text)}
      data-testid={testId ?? 'speak-btn'}
      className="shrink-0"
      aria-busy={waiting || undefined}
      data-voice-wait={waiting ? '' : undefined}
    />
  );
}
