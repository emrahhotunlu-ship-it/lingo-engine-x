import { useState } from 'react';
import { useT } from '../../i18n';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { logError } from '../../platform/diagnostics';
import { clampRate, previewVoice, RATE_MAX, RATE_MIN, setSpeechPrefs, useSpeech } from '../../platform/speech';
import { local } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { toast } from '../../ui/Toast';
import { AUTOPLAY_KEY, autoplayOn } from '../../app/voice/autoplay';
import { resolveVoice } from '../../domain/progress/settings';

// Einstellungen „Stimme“ (Plan §5.6): englische Stimmen (en-US zuerst) mit Probehören, Tempo
// 0,8–1,1 (gespeichert beim Loslassen, nicht beim Ziehen), „Antworten im Rollenspiel vorlesen“.
// Stimme und Tempo stehen in `app/profile.voice`/`.rate` (Felder der alten App); optimistisch mit
// Rückrollen. Der Vorlese-Schalter ist Bequemlichkeit (localStorage).

async function saveProfile(patch: Record<string, unknown>, rollback: () => void, failText: string): Promise<void> {
  const writer = getWriter();
  if (!writer) return;
  try {
    await writer.patch('app/profile', patch, useLive.getState().docs['app/profile']);
  } catch (err) {
    logError('settings:voice', err);
    rollback();
    toast(failText, 'error');
  }
}

export function VoiceSection() {
  const { t } = useT();
  const status = useSpeech((s) => s.status);
  // Befund 30.09.: die en-US-Einschränkung vom Vortag blendete auch echte, von Emrah bewusst
  // heruntergeladene Premium-Stimmen aus (z. B. „Jamie", keine en-US-Stimme) – genau die Stimmen,
  // die beim Suchen nach besserer Sprachqualität helfen sollten. Die Liste zeigt deshalb wieder
  // alle englischen Varianten; Spaß-Stimmen bleiben draußen (`isNovelty` in `platform/speech.ts`).
  const voices = useSpeech((s) => s.voices ?? []);
  const current = useSpeech((s) => s.voiceName);
  const profile = useLive((s) => s.docs['app/profile']);
  const savedRate = clampRate(typeof profile?.rate === 'number' ? profile.rate : 1);
  // Plan E13: gespeicherte Stimme fehlt auf diesem Gerät → Hinweis, genutzt wird die beste en-US-Stimme.
  const voiceMissing = status === 'ready' && resolveVoice(profile?.voice, voices, current).missing;
  const [rate, setRate] = useState(savedRate);
  const [autoplay, setAutoplay] = useState(autoplayOn);
  // Gespeicherter Wert hat sich geändert (anderes Gerät, Rückrollen): Anzeige nachziehen.
  const [shown, setShown] = useState(savedRate);
  if (shown !== savedRate) {
    setShown(savedRate);
    setRate(savedRate);
  }

  const chooseVoice = (name: string) => {
    const prev = typeof profile?.voice === 'string' ? profile.voice : null;
    setSpeechPrefs({ voice: name });
    void saveProfile({ voice: name }, () => setSpeechPrefs({ voice: prev }), t('saveFailed'));
  };

  const commitRate = () => {
    const r = Math.round(clampRate(rate) * 100) / 100;
    if (r === savedRate) return;
    setSpeechPrefs({ rate: r });
    void saveProfile(
      { rate: r },
      () => {
        setSpeechPrefs({ rate: savedRate });
        setRate(savedRate);
      },
      t('saveFailed'),
    );
  };

  return (
    <section className="flex flex-col gap-3" data-testid="voice-section">
      <h3 className="lx-eyebrow">{t('voiceTitle')}</h3>
      {voiceMissing && (
        <p className="text-sm text-muted" data-testid="voice-missing">
          {t('setVoiceMissing')}
        </p>
      )}
      {status === 'unsupported' || status === 'novoice' ? (
        <p className="text-sm text-muted">{t('voiceNone')}</p>
      ) : (
        <>
          <div role="radiogroup" aria-label={t('voiceTitle')} className="flex max-h-60 flex-col gap-1 overflow-y-auto" data-testid="voice-select">
            {voices.map((v) => {
              const on = v.name === current;
              return (
                <div key={v.name} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-voice={v.name}
                    onClick={() => chooseVoice(v.name)}
                    className={`flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm ${on ? 'bg-surface-strong font-semibold' : 'hover:bg-surface'}`}
                  >
                    <span>{v.name}</span>
                    <span className="text-xs text-muted">{v.lang}</span>
                  </button>
                  <Button variant="ghost" icon="speaker" onClick={() => void previewVoice(v.name)} data-testid="voice-preview" aria-label={`${t('voicePreview')}: ${v.name}`}>
                    {t('voicePreview')}
                  </Button>
                </div>
              );
            })}
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="flex items-center justify-between">
              <span>{t('voiceRate')}</span>
              <span className="lx-tnum text-muted">{rate.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={RATE_MIN}
              max={RATE_MAX}
              step={0.05}
              value={rate}
              data-testid="voice-rate"
              onChange={(e) => setRate(Number(e.target.value))}
              onPointerUp={commitRate}
              onKeyUp={commitRate}
              onBlur={commitRate}
              className="h-11 accent-[var(--lx-accent)]"
            />
          </label>
        </>
      )}
      <Switch
        checked={autoplay}
        label={t('voiceAutoplay')}
        testId="voice-autoplay"
        onChange={(v) => {
          setAutoplay(v);
          local.set(AUTOPLAY_KEY, v ? '1' : '0');
        }}
      />
    </section>
  );
}
