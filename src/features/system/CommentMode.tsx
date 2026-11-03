import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { commentsAvailable, openCommentAt } from '../../platform/comments';

// Rückmeldung per Kommentar (Emrah 03.11.2026): Knopf „Kommentieren“ am rechten Rand, auf jedem Bildschirm. Ein Tipp
// schaltet den Kommentar-Modus an; der nächste Tipp auf irgendeine Stelle öffnet dort das Kommentarfeld von claude.ai
// (Fähigkeit `comments`, nur `openComposer`). Im Modus löst der Tipp nichts in der App aus (kein Knopf, keine Eingabe).
// Wischen bleibt Wischen: nur ein Tipp ohne Bewegung zählt. Ohne Fähigkeit (Test-Umgebung, alte Ansicht) unsichtbar.

const UI = '[data-lx-cmode-ui]';
const SLOP = 10;

export function CommentMode() {
  const { t } = useT();
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const down = useRef<{ x: number; y: number; el: Element } | null>(null);
  const swallowNext = useRef(false);

  useEffect(() => {
    let live = true;
    void commentsAvailable().then((a) => live && setOk(a));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.setAttribute('data-lx-cmode', '');
    const ours = (e: Event) => e.target instanceof Element && e.target.closest(UI) !== null;
    const block = (e: Event) => {
      if (ours(e)) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (ours(e)) return;
      block(e);
      e.preventDefault();
      down.current = e.target instanceof Element ? { x: e.clientX, y: e.clientY, el: e.target } : null;
    };
    const onUp = (e: PointerEvent) => {
      if (ours(e)) return;
      block(e);
      const d = down.current;
      down.current = null;
      if (!d || Math.abs(e.clientX - d.x) > SLOP || Math.abs(e.clientY - d.y) > SLOP) return;
      swallowNext.current = true;
      setOn(false);
      void openCommentAt(d.el).then((r) => {
        if (r === 'busy') toast(t('shCommentBusy'));
        else if (r === 'unavailable') {
          setOk(false);
          toast(t('shCommentOff'), 'error');
        } else if (r === 'error') toast(t('shCommentError'), 'error');
      });
    };
    const onCancel = () => {
      down.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOn(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('mousedown', block, true);
    window.addEventListener('mouseup', block, true);
    window.addEventListener('touchstart', block, true);
    window.addEventListener('touchend', block, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      root.removeAttribute('data-lx-cmode');
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('mousedown', block, true);
      window.removeEventListener('mouseup', block, true);
      window.removeEventListener('touchstart', block, true);
      window.removeEventListener('touchend', block, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [on, t]);

  // Der Klick nach dem Tipp (und jeder Klick im Modus) erreicht die App nicht. Ohne Uhr: die nächste Berührung räumt ab.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(UI)) return;
      if (document.documentElement.hasAttribute('data-lx-cmode') || swallowNext.current) {
        swallowNext.current = false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    const onDown = () => {
      if (!document.documentElement.hasAttribute('data-lx-cmode')) swallowNext.current = false;
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, []);

  if (!ok) return null;
  return (
    <div data-lx-cmode-ui="" data-uncommentable="">
      {on ? (
        <div className="lx-cmode-bar" role="status" data-testid="comment-mode-bar">
          <Icon name="chat" size={18} />
          <span>{t('shCommentHint')}</span>
          <button type="button" className="lx-cmode-cancel" onClick={() => setOn(false)} data-testid="comment-mode-cancel">
            {t('shCommentCancel')}
          </button>
        </div>
      ) : (
        <button type="button" className="lx-cmode-btn" onClick={() => setOn(true)} aria-label={t('shComment')} title={t('shComment')} data-testid="comment-mode">
          <Icon name="chat" size={20} />
        </button>
      )}
    </div>
  );
}
