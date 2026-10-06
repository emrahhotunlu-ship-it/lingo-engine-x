import { motion } from 'framer-motion';
import { forwardRef, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { DURATION, EASE_OUT } from '../motion';
import { inputProfile } from '../../platform/input';

// Gemeinsame Eingabezeile aller Gespräche (Rollenspiel Phase 3, Begleiter Phase 5): 16 px (kein
// Zoom am iPhone), wächst bis 6 Zeilen. Desktop: Enter sendet, Umschalt+Enter bricht um. Touch:
// Return bricht um, gesendet wird mit dem Knopf. Läuft eine Antwort und ist `onStop` gesetzt,
// steht dort „Stopp" statt „Senden". Entwurf, Vorbelegung und Zusatzknöpfe (Mikrofon) bleiben
// beim jeweiligen Modul; Texte kommen als fertige Beschriftungen herein (src/i18n).

export type ChatInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** Senden gesperrt (z. B. Antwort läuft, Pause nach `rate_limited`). */
  disabled?: boolean;
  running?: boolean;
  onStop?: () => void;
  maxLength: number;
  label: string;
  placeholder: string;
  sendLabel: string;
  stopLabel?: string;
  /** Sprache des Eingabetexts (Rollenspiel: Englisch). */
  lang?: string;
  /** Zusatzknöpfe vor „Senden" (z. B. Spracheingabe). */
  extra?: ReactNode;
  testIds: { input: string; send: string; stop?: string };
  sendAi?: boolean;
};

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput(p, outer) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRef = (el: HTMLTextAreaElement | null) => {
    inner.current = el;
    if (typeof outer === 'function') outer(el);
    else if (outer) outer.current = el;
  };

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * 6 + 20)}px`;
  }, [p.value]);

  const send = () => {
    if (!p.value.trim() || p.disabled || p.running) return;
    p.onSend();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    // Touch-Geräte: Return bricht um, gesendet wird mit dem Knopf.
    if (inputProfile() === 'touch') return;
    e.preventDefault();
    send();
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-solid p-1.5 pl-3 focus-within:border-[var(--lx-fg-subtle)]">
      <label className="sr-only" htmlFor={p.id}>
        {p.label}
      </label>
      <textarea
        id={p.id}
        ref={setRef}
        rows={1}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value.slice(0, p.maxLength))}
        onKeyDown={onKey}
        placeholder={p.placeholder}
        enterKeyHint="send"
        maxLength={p.maxLength}
        {...(p.lang ? { lang: p.lang } : {})}
        className="max-h-48 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-fg outline-none placeholder:text-subtle"
        data-testid={p.testIds.input}
      />
      {p.extra}
      {p.running && p.onStop ? (
        <button
          type="button"
          onClick={p.onStop}
          className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-surface-strong text-fg"
          aria-label={p.stopLabel}
          title={p.stopLabel}
          data-testid={p.testIds.stop}
        >
          <span className="block size-3.5 rounded-[3px] bg-current" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={!p.value.trim() || !!p.disabled || !!p.running}
          className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-40"
          aria-label={p.sendLabel}
          title={p.sendLabel}
          data-testid={p.testIds.send}
          {...(p.sendAi ? { 'data-ai': '' } : {})}
        >
          <Icon name="send" size={20} />
        </button>
      )}
    </div>
  );
});

/** Pille „Neue Antwort ↓": erscheint nur, wenn man hochgescrollt hat und Neues dazukam (in `AnimatePresence`). */
export function NewerPill({ label, onClick, testId, className, arrow }: { label: string; onClick: () => void; testId: string; className: string; arrow?: boolean }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      onClick={onClick}
      className={`lx-glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-xl ${className}`}
      data-testid={testId}
    >
      {label}
      {arrow && <Icon name="arrowDown" size={16} />}
    </motion.button>
  );
}
