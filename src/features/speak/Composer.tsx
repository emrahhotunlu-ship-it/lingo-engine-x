import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../../i18n';
import { MicButton } from '../../engine/MicButton';
import { Icon } from '../../ui/Icon';
import { KEY_PREFIX, local } from '../../platform/storage';

// Eingabezeile des Rollenspiels (Plan §5.2): mehrzeilig (≤ 600 Zeichen), unten fest mit
// `env(safe-area-inset-bottom)` und Ausgleich der Bildschirmtastatur über `visualViewport`
// (iPhone, A7.4, H5). Enter sendet am Desktop, Umschalt+Enter macht eine neue Zeile; am Handy
// der Knopf „Senden“. Wendungs-Chips fügen an der Einfügemarke ein. Entwurf in localStorage.

export const COMPOSER_MAX = 600;
const DRAFT_DELAY_MS = 500;

/** Abstand der Bildschirmtastatur zum unteren Rand (0, wenn keine offen ist). */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

type Props = {
  sceneId: string;
  useful: ReadonlyArray<{ en: string; de: string }>;
  busy: boolean;
  /** Text, der nach einem Fehler oder Stopp zurück ins Feld kommt. */
  restore: { text: string; chip: boolean; n: number } | null;
  onSend: (text: string, usedChip: boolean) => void;
};

export function Composer({ sceneId, useful, busy, restore, onSend }: Props) {
  const { t } = useT();
  const key = `${KEY_PREFIX}draft:speak:${sceneId}`;
  const [text, setText] = useState(() => local.get(key) ?? '');
  const [chip, setChip] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const inset = useKeyboardInset();
  const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

  // Entwurf nach 500 ms Ruhe sichern (Bequemlichkeit, Kap. 3.1).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (text.trim()) local.set(key, text);
      else local.remove(key);
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [text, key]);

  // Nach Fehler oder Stopp: eigener Satz zurück ins Feld.
  const lastRestore = useRef(0);
  useEffect(() => {
    if (!restore || restore.n === lastRestore.current) return;
    lastRestore.current = restore.n;
    setText(restore.text);
    setChip(restore.chip);
  }, [restore]);

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    onSend(v, chip);
    setText('');
    setChip(false);
    local.remove(key);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && fine && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const insert = (phrase: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${phrase}${after && !/^\s/.test(after) ? ' ' : ''}${after}`.slice(0, COMPOSER_MAX);
    setText(next);
    setChip(true);
    const caret = (before + pad + phrase).length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div
      className="lx-glass fixed inset-x-0 z-30 border-t border-line px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6 lg:static lg:z-auto lg:rounded-2xl lg:border lg:pb-3"
      style={{ bottom: inset }}
      data-testid="composer"
    >
      {useful.length > 0 && (
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('spUseful')}>
          {useful.map((u) => (
            <button
              key={u.en}
              type="button"
              data-testid="chip-useful"
              lang="en"
              title={u.de}
              onClick={() => insert(u.en)}
              className="min-h-11 shrink-0 rounded-full border border-line px-3 text-sm text-muted hover:bg-surface hover:text-fg"
            >
              {u.en}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="rp-composer">
          {t('spPlaceholder')}
        </label>
        <textarea
          id="rp-composer"
          ref={ref}
          data-testid="composer-input"
          lang="en"
          rows={2}
          maxLength={COMPOSER_MAX}
          value={text}
          placeholder={t('spPlaceholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-subtle focus:border-[var(--lx-accent)]"
        />
        <MicButton
          disabled={busy}
          onText={(heard) => {
            setText((cur) => `${cur.trim() ? `${cur.trim()} ` : ''}${heard}`.slice(0, COMPOSER_MAX));
            ref.current?.focus();
          }}
        />
        <button
          type="button"
          data-testid="composer-send"
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label={t('spSend')}
          title={t('spSend')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  );
}
