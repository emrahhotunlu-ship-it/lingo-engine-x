import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { Icon } from '../../../ui/Icon';
import { Button } from '../../../ui/Button';
import { Chips } from '../../../ui/Chips';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { logWarn } from '../../../platform/diagnostics';
import { elementPath, savePen, screenInfo, type PenKind, type PenScreen, type PenTarget } from './save';
import type { Box } from './shot';

// Stift-Werkzeug (Emrah 09.11.2026, ersetzt das Kommentarfeld von claude.ai): Griff am rechten Rand auf jedem Bildschirm.
// Tipp → Auswahl-Modus: eine Stelle antippen ODER einen Rahmen ziehen. Danach Bild der Stelle (im Browser gezeichnet),
// Art (Funktion / Design / Fehler) und Text; „Senden“ speichert alles als `pen/<id>`, Claude Code liest es dort.
// Im Auswahl-Modus löst kein Tipp etwas in der App aus.

const UI = '[data-lx-pen-ui]';
const SLOP = 10;

type Phase = 'idle' | 'pick' | 'shoot' | 'form';
type Draft = { box: Box; el: Element | null; img: string | null; screen: PenScreen; target: PenTarget };

export function PenMode() {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>('idle');
  const [drag, setDrag] = useState<Box | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kind, setKind] = useState<PenKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState('lx:pen-shot');
  const down = useRef<{ x: number; y: number; el: Element | null } | null>(null);
  const swallowNext = useRef(false);

  async function capture(el: Element | null, box: Box) {
    const screen = screenInfo();
    const target: PenTarget = { text: el?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? null, path: elementPath(el), box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) } };
    setPhase('shoot');
    let img: string | null = null;
    try {
      const m = await import('./shot');
      img = await m.shoot(el, box);
      setTool(m.penShotMark());
    } catch (err) {
      logWarn('pen:shot', err);
    }
    setDraft({ box, el, img, screen, target });
    setText('');
    setPhase('form');
  }

  // Auswahl: Tipp oder Rahmen.
  useEffect(() => {
    if (phase !== 'pick') return;
    const root = document.documentElement;
    root.setAttribute('data-lx-pen', '');
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
      down.current = { x: e.clientX, y: e.clientY, el: e.target instanceof Element ? e.target : null };
    };
    const onMove = (e: PointerEvent) => {
      const d = down.current;
      if (!d) return;
      block(e);
      if (Math.abs(e.clientX - d.x) > SLOP || Math.abs(e.clientY - d.y) > SLOP) {
        setDrag({ x: Math.min(d.x, e.clientX), y: Math.min(d.y, e.clientY), w: Math.abs(e.clientX - d.x), h: Math.abs(e.clientY - d.y) });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (ours(e)) return;
      block(e);
      const d = down.current;
      down.current = null;
      setDrag(null);
      if (!d) return;
      swallowNext.current = true;
      const moved = Math.abs(e.clientX - d.x) > SLOP || Math.abs(e.clientY - d.y) > SLOP;
      let box: Box;
      let el: Element | null;
      if (moved) {
        box = { x: Math.min(d.x, e.clientX), y: Math.min(d.y, e.clientY), w: Math.abs(e.clientX - d.x), h: Math.abs(e.clientY - d.y) };
        el = document.elementsFromPoint(box.x + box.w / 2, box.y + box.h / 2).find((n) => !n.closest(UI)) ?? null;
      } else {
        // Ein Tipp auf ein Symbol meint den ganzen Knopf bzw. die ganze Zeile.
        el = d.el?.closest('button, a, label, [role="button"], [role="radio"], li') ?? d.el;
        const r = el?.getBoundingClientRect();
        box = r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: d.x - 20, y: d.y - 20, w: 40, h: 40 };
      }
      void capture(el, box);
    };
    const onCancel = () => {
      down.current = null;
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('idle');
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('mousedown', block, true);
    window.addEventListener('mouseup', block, true);
    window.addEventListener('touchstart', block, true);
    window.addEventListener('touchend', block, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      root.removeAttribute('data-lx-pen');
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('mousedown', block, true);
      window.removeEventListener('mouseup', block, true);
      window.removeEventListener('touchstart', block, true);
      window.removeEventListener('touchend', block, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [phase]);

  // Der Klick nach dem Tipp erreicht die App nicht.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(UI)) return;
      if (document.documentElement.hasAttribute('data-lx-pen') || swallowNext.current) {
        swallowNext.current = false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    const onDown = () => {
      if (!document.documentElement.hasAttribute('data-lx-pen')) swallowNext.current = false;
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, []);

  const close = () => {
    setPhase('idle');
    setDraft(null);
  };

  const send = async () => {
    if (!draft || busy) return;
    setBusy(true);
    const ok = await savePen({ kind, text: text.trim(), img: draft.img ?? '', screen: draft.screen, target: draft.target, tool });
    setBusy(false);
    if (ok) {
      toast(t('penSent'));
      close();
    } else toast(t('penFailed'), 'error');
  };

  return (
    <div data-lx-pen-ui="" data-uncommentable="">
      {phase === 'idle' && (
        <button type="button" className="lx-cmode-btn" onClick={() => setPhase('pick')} aria-label={t('penOpen')} title={t('penOpen')} data-testid="pen-open">
          <Icon name="pen" size={20} />
        </button>
      )}
      {(phase === 'pick' || phase === 'shoot') && (
        <div className="lx-cmode-bar" role="status" data-testid="pen-bar">
          <Icon name="pen" size={18} />
          <span>{phase === 'pick' ? t('penHint') : t('penShooting')}</span>
          {phase === 'pick' && (
            <button type="button" className="lx-cmode-cancel" onClick={() => setPhase('idle')} data-testid="pen-cancel">
              {t('shCommentCancel')}
            </button>
          )}
        </div>
      )}
      {drag && <div className="lx-pen-rect" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} aria-hidden="true" />}
      <Sheet open={phase === 'form'} onClose={close} title={t('penTitle')} closeLabel={t('shCommentCancel')} fit>
        <div className="flex flex-col gap-4" data-lx-pen-ui="">
          {draft?.img ? (
            <img src={draft.img} alt={t('penShotAlt')} className="max-h-72 w-full rounded-xl border border-line object-contain" data-testid="pen-img" />
          ) : (
            <p className="text-sm text-muted">{t('penNoShot')}</p>
          )}
          <Chips<PenKind>
            label={t('penKind')}
            value={kind}
            onChange={setKind}
            testId="pen-kind"
            options={[
              { value: 'function', label: t('penKindFunction') },
              { value: 'design', label: t('penKindDesign') },
              { value: 'bug', label: t('penKindBug') },
            ]}
          />
          <label className="flex flex-col gap-2 text-sm">
            <span>{t('penText')}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="lx-field min-h-24 rounded-xl border border-line bg-track p-3 text-base" placeholder={t('penPlaceholder')} data-testid="pen-text" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              {t('shCommentCancel')}
            </Button>
            <Button variant="primary" icon="send" onClick={() => void send()} busy={busy} disabled={!text.trim()} data-testid="pen-send">
              {t('penSend')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
