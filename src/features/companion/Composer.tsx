import { useEffect, useRef, useState } from 'react';
import { useAiStatus } from '../../ai/status';
import { useT } from '../../i18n';
import { KEY_PREFIX, local } from '../../platform/storage';
import { ChatInput } from '../../ui/chat/ChatInput';

// Eingabe des Begleiters (Phase 5 §8.1) auf der gemeinsamen Eingabezeile (ui/chat/ChatInput):
// Entwurf lokal (`lx:draft:chat`), Vorbelegung, Pause nach `rate_limited`. Während einer
// Antwort: Stopp statt Senden.

const DRAFT_KEY = `${KEY_PREFIX}draft:chat`;
const MAX = 2_000;

type Props = {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  prefill: { text: string; seq: number } | null;
  focusSeq: number;
};

export function Composer({ running, onSend, onStop, prefill, focusSeq }: Props) {
  const { t } = useT();
  const [value, setValue] = useState(() => local.get(DRAFT_KEY) ?? '');
  const area = useRef<HTMLTextAreaElement>(null);
  const pausedUntil = useAiStatus((s) => s.pausedUntil);
  const [now, setNow] = useState(() => Date.now());
  const paused = pausedUntil > now;

  // Nach der Pause wieder freigeben (ein Zeitgeber je Pause, keine Schleife).
  useEffect(() => {
    if (pausedUntil <= Date.now()) return;
    const id = window.setTimeout(() => setNow(Date.now()), pausedUntil - Date.now() + 50);
    return () => window.clearTimeout(id);
  }, [pausedUntil]);

  // Vorbelegung (z. B. gestoppte Nachricht zurück): einmal je `seq` übernehmen (abgeleiteter Zustand).
  const [seenSeq, setSeenSeq] = useState(prefill?.seq ?? 0);
  if (prefill && prefill.seq !== seenSeq) {
    setSeenSeq(prefill.seq);
    setValue(prefill.text);
  }
  useEffect(() => {
    if (prefill) area.current?.focus();
  }, [prefill]);

  useEffect(() => {
    if (focusSeq > 0) area.current?.focus({ preventScroll: true });
  }, [focusSeq]);

  const change = (v: string) => {
    const next = v.slice(0, MAX);
    setValue(next);
    if (next) local.set(DRAFT_KEY, next);
    else local.remove(DRAFT_KEY);
  };

  const send = () => {
    const text = value.trim();
    if (!text || running || paused) return;
    onSend(text);
    change('');
  };

  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(pausedUntil);
  return (
    <div className="flex flex-col gap-1.5">
      {paused && (
        <p className="text-xs text-muted" role="status" data-testid="chat-paused">
          {t('aiBusy')} · {t('cmpPausedUntil', { time })}
        </p>
      )}
      <ChatInput
        id="chat-input"
        ref={area}
        value={value}
        onChange={change}
        onSend={send}
        disabled={paused}
        running={running}
        onStop={onStop}
        maxLength={MAX}
        label={t('cmpInputLabel')}
        placeholder={t('cmpPlaceholder')}
        sendLabel={t('cmpSend')}
        stopLabel={t('cmpStop')}
        testIds={{ input: 'chat-input', send: 'chat-send', stop: 'chat-stop' }}
        sendAi
      />
    </div>
  );
}
