import { useEffect } from 'react';
import { prefetchSpeech } from '../platform/speech';
import { useNeuralVoice } from '../platform/voice/neural';

/**
 * Sichtbarer Anhören-Knopf: die neue Stimme rechnet seinen Text schon vorab, damit der Tipp sofort spielt
 * (Emrah 10.11.2026). Läuft erneut, sobald die neue Stimme bereit wird.
 */
export function usePrefetchSpeech(texts: string | readonly string[], rate?: number): void {
  const ready = useNeuralVoice((s) => s.status === 'ready');
  const key = typeof texts === 'string' ? texts : texts.join('\u0001');
  useEffect(() => {
    if (!ready) return;
    for (const t of key.split('\u0001')) if (t.trim()) prefetchSpeech(t, rate === undefined ? {} : { rate });
  }, [ready, key, rate]);
}
