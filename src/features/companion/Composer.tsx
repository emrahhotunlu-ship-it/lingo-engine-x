import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAiStatus } from '../../ai/status';
import { useT } from '../../i18n';
import { KEY_PREFIX, local } from '../../platform/storage';
import { Icon } from '../../ui/Icon';

// Eingabe des Begleiters (Phase 5 §8.1): 16 px (kein Zoom am iPhone), wächst bis 6 Zeilen.
// Desktop: Enter sendet, Umschalt+Enter bricht um. Touch: Return bricht um, gesendet wird mit
// dem Knopf. Entwurf lokal (`lx:draft:chat`). Während einer Antwort: Stopp statt Senden.

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

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * 6 + 20)}px`;
  }, [value]);

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

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    // Touch-Geräte: Return bricht um, gesendet wird mit dem Knopf.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    send();
  };

  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(pausedUntil);
  return (
    <div className="flex flex-col gap-1.5">
      {paused && (
        <p className="text-xs text-muted" role="status" data-testid="chat-paused">
          {t('aiBusy')} · {t('cmpPausedUntil', { time })}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-solid p-1.5 pl-3 focus-within:border-[var(--lx-fg-subtle)]">
        <label className="sr-only" htmlFor="chat-input">
          {t('cmpInputLabel')}
        </label>
        <textarea
          id="chat-input"
          ref={area}
          rows={1}
          value={value}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('cmpPlaceholder')}
          enterKeyHint="send"
          maxLength={MAX}
          className="max-h-48 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-fg outline-none placeholder:text-subtle"
          data-testid="chat-input"
        />
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-surface-strong text-fg"
            aria-label={t('cmpStop')}
            title={t('cmpStop')}
            data-testid="chat-stop"
          >
            <span className="block size-3.5 rounded-[3px] bg-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!value.trim() || paused}
            className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-40"
            aria-label={t('cmpSend')}
            title={t('cmpSend')}
            data-testid="chat-send"
            data-ai=""
          >
            <Icon name="arrowRight" size={20} className="-rotate-90" />
          </button>
        )}
      </div>
    </div>
  );
}
