import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { MicButton } from '../../engine/MicButton';
import { ChatInput } from '../../ui/chat/ChatInput';
import { useKeyboardInset } from '../../ui/chat/keyboard';
import { usePageScrollPadding } from '../../ui/chat/scroll';
import { Icon } from '../../ui/Icon';
import { KEY_PREFIX, local } from '../../platform/storage';

// Eingabezeile des Rollenspiels (Plan §5.2) auf der gemeinsamen Eingabezeile (ui/chat/ChatInput):
// ≤ 600 Zeichen, unten fest mit `env(safe-area-inset-bottom)` und Ausgleich der Bildschirmtastatur
// über `visualViewport` (iPhone, A7.4, H5). Wendungs-Chips fügen an der Einfügemarke ein,
// Spracheingabe als Zusatzknopf. Entwurf in localStorage.
// Eingeklappt (R5, „Sag’s nochmal“ offen): nur eine Zeile „Zurück zum Gespräch“; Chips und Feld bleiben im DOM (Entwurf, Einfüge-Merker), sind aber
// verborgen. Am Handy setzt der Bereich `scroll-padding-bottom` der Seite (ui/chat/scroll), damit fokussierte Felder nicht darunter verschwinden.

export const COMPOSER_MAX = 600;
const DRAFT_DELAY_MS = 500;

type Props = {
  sceneId: string;
  useful: ReadonlyArray<{ en: string; de: string }>;
  busy: boolean;
  /** Text, der nach einem Fehler oder Stopp zurück ins Feld kommt. */
  restore: { text: string; chip: boolean; n: number } | null;
  /** `pasted` (LP3 P51): Text eingefügt (Paste/Drop) – das Gespräch zählt dann nicht für K7. */
  onSend: (text: string, usedChip: boolean, pasted: boolean) => void;
  /** Eingeklappt: statt Eingabe und Chips nur „Zurück zum Gespräch“ (`onExpand`). */
  collapsed?: boolean;
  onExpand?: () => void;
};

export function Composer({ sceneId, useful, busy, restore, onSend, collapsed = false, onExpand }: Props) {
  const { t } = useT();
  const key = `${KEY_PREFIX}draft:speak:${sceneId}`;
  const [text, setText] = useState(() => local.get(key) ?? '');
  const [chip, setChip] = useState(false);
  const [pasted, setPasted] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const inset = useKeyboardInset();
  const box = useRef<HTMLDivElement>(null);
  usePageScrollPadding(box, inset, collapsed);

  // Entwurf nach 500 ms Ruhe sichern (Bequemlichkeit, Kap. 3.1).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (text.trim()) local.set(key, text);
      else local.remove(key);
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [text, key]);

  // LP3 P51: Einfügen (Paste/Drop) merken – eingefügte Sätze zählen nie für K7. Die gemeinsame Eingabezeile kennt kein onPaste, deshalb am Element.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => setPasted(true);
    el.addEventListener('paste', mark);
    el.addEventListener('drop', mark);
    return () => {
      el.removeEventListener('paste', mark);
      el.removeEventListener('drop', mark);
    };
  }, []);

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
    onSend(v, chip, pasted);
    setText('');
    setChip(false);
    setPasted(false);
    local.remove(key);
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
      ref={box}
      className="lx-glass fixed inset-x-0 z-30 border-t border-line px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6 lg:static lg:z-auto lg:rounded-2xl lg:border lg:pb-3"
      style={{ bottom: inset }}
      data-testid="composer"
      data-collapsed={collapsed ? '' : undefined}
    >
      {collapsed && (
        <button
          type="button"
          onClick={onExpand}
          className="lx-hit flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted hover:text-fg"
          data-testid="composer-back"
        >
          <Icon name="chat" size={16} />
          {t('spBackToTalk')}
        </button>
      )}
      <div hidden={collapsed}>
      {useful.length > 0 && (
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('spUseful')} data-hscroll="">
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
      <ChatInput
        id="rp-composer"
        ref={ref}
        value={text}
        onChange={setText}
        onSend={submit}
        disabled={busy}
        maxLength={COMPOSER_MAX}
        lang="en"
        label={t('spPlaceholder')}
        placeholder={t('spPlaceholder')}
        sendLabel={t('spSend')}
        testIds={{ input: 'composer-input', send: 'composer-send' }}
        extra={
          <MicButton
            disabled={busy}
            onText={(heard) => {
              setText((cur) => `${cur.trim() ? `${cur.trim()} ` : ''}${heard}`.slice(0, COMPOSER_MAX));
              ref.current?.focus();
            }}
          />
        }
      />
      </div>
    </div>
  );
}
