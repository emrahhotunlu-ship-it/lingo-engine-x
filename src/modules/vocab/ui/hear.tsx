import { useEffect, useRef, useState } from 'react';
import { Icon, local, speak, stopSpeech, usePrefetchSpeech, useSpeech, useT } from '../sharedUi';

// Politur P2 (Emrah 13.11.2026, E3 „Hören“): Ton der Wörter-Karten. Die Einführung und die Vorkarte „Kennst du es schon?“ lesen von selbst
// vor, die Hör-Karten („Hören → Bedeutung“, „Satz hören → Wort“) stellen ihre Frage als Ton. Vorlesen startet erst, wenn die Karte steht,
// höchstens einmal je Karte (nie doppelt bei Rücksprung, Neuzeichnen oder StrictMode), und hört beim Kartenwechsel auf.

/** Kann das Gerät gerade vorlesen? (`LearnEnv.audio`; „lädt“ zählt mit – die Stimme kommt dann meist sofort, sonst springt die Karte auf Text.) */
export function audioReady(): boolean {
  const s = useSpeech.getState().status;
  return s === 'ready' || s === 'loading';
}

/** Einstellung „Neue Wörter vorlesen“ (Einstellungen › Stimme, Browser-Bequemlichkeit, Standard an; `app/voice/autoplay.ts` `SPEAK_NEW_KEY`). */
export const speakNewOn = (): boolean => local.get('lx:speak-new') !== '0';

/** Schon von selbst vorgelesen (Schlüssel je Karte). Lebt, solange die Seite offen ist – auch über das Verlassen der Runde hinweg. */
const said = new Set<string>();

/** Nur für Tests: vergessen, was schon vorgelesen wurde. */
export function resetAutoSpeak(): void {
  said.clear();
}

/**
 * Liest `text` einmal von selbst vor, sobald die Karte steht (`on`). `key` merkt sich die Karte: zeigt die Runde dieselbe Karte noch einmal
 * (Rücksprung, Fortsetzen), bleibt sie still. Wird die Karte verlassen, bevor der Text zu Ende ist, hört das Vorlesen auf und die Karte gilt
 * als nicht vorgelesen. `onSpent` bekommt die Vorlesezeit (sie zählt nicht als Antwortzeit).
 */
export function useAutoSpeak(text: string | null, on: boolean, key: string, onSpent?: (ms: number) => void): void {
  usePrefetchSpeech(text ?? '');
  const spent = useRef(onSpent);
  useEffect(() => {
    spent.current = onSpent;
  });
  useEffect(() => {
    if (!on || !text || said.has(key)) return;
    said.add(key);
    let open = true;
    const start = performance.now();
    void speak(text).then((r) => {
      open = false;
      if (r !== 'done' && r !== 'stopped') said.delete(key);
      spent.current?.(performance.now() - start);
    });
    return () => {
      if (!open) return;
      said.delete(key);
      stopSpeech();
    };
  }, [on, text, key]);
}

/**
 * Großer Anhören-Knopf der Hör-Karten (und kleiner auf der Vorkarte). Nach dem ersten Abspielen heißt er „Noch einmal anhören“. Ohne Stimme
 * unsichtbar – dann zeigt die Karte ohnehin die Textform.
 */
export function HearButton({ text, testId, label, big = false, heard = false, onSpent }: { text: string; testId: string; label: string; big?: boolean; heard?: boolean; onSpent?: (ms: number) => void }) {
  const { t } = useT();
  const status = useSpeech((x) => x.status);
  const speaking = useSpeech((x) => x.speaking);
  const [played, setPlayed] = useState(heard);
  usePrefetchSpeech(text);
  if (status === 'unsupported' || status === 'novoice' || !text.trim()) return null;
  const play = async () => {
    setPlayed(true);
    const start = performance.now();
    await speak(text);
    onSpent?.(performance.now() - start);
  };
  return (
    <button
      type="button"
      className="lx-kspeak"
      style={big ? { minHeight: 64, padding: '0 24px', fontSize: 18, gap: 10 } : undefined}
      onClick={() => void play()}
      aria-label={label}
      data-testid={testId}
      data-speaking={speaking ? '' : undefined}
    >
      <Icon name="speaker" size={big ? 24 : 18} aria-hidden="true" />
      <span>{t(played ? 'vmHearAgain' : 'vmHearPlay')}</span>
    </button>
  );
}
