import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav } from '../../app/nav';
import { watchDoc } from '../../data/watch';
import { useT } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ChatPane } from './ChatPane';
import { clampRect, defaultRect, fullRect, isMobileWidth, loadWin, moveRect, pillRect, resizeRect, saveWin, type Handle, type Rect, type Vp, type WinMode } from './floatWindow';
import { useCurrentSeeing } from './seeing';
import { closeCompanion, isTurnRunning, newConversation, receiveChatDoc, removeAttach, setCompanionTab, setMinimized, setTier, setWinMode, useCompanion, type CompanionTab } from './store';
import { TranslatePane } from './translate/TranslatePane';
import { useKeyboardBox } from '../../ui/chat/keyboard';

// Der Claude-Begleiter als frei bewegliches Schwebefenster (Rückmeldung Emrah): Die Aufgabe dahinter
// bleibt bedienbar (kein Scrim, keine Fokusfalle, die Seite scrollt weiter). Verschieben über die
// Kopfzeile, Größe über Kanten und Ecken (am Handy Griff unten rechts), Lage und Größe je Gerät
// gemerkt (floatWindow.ts). Knöpfe: Verkleinern (nur die Kopfleiste bleibt als Pille), Vollbild
// (modal wie früher), Schließen. Keine schmale Seitenleiste (Kap. 15). Standard: Handy unteres
// Drittel (~60 % Höhe), Desktop unten rechts. Esc schließt nur, wenn der Fokus zuletzt im Fenster
// lag (Vollbild: immer; das Nachschlage-Fenster fängt Esc vorher ab).

export function CompanionLayer() {
  const open = useCompanion((s) => s.open);
  return <AnimatePresence>{open && <CompanionOverlay key="companion" />}</AnimatePresence>;
}

function useChatWatch(): void {
  const db = useCapabilities((s) => s.db);
  useEffect(() => {
    if (db !== 'ready') {
      if (db === 'absent') useCompanion.setState({ saveState: 'local', loaded: true });
      return;
    }
    const handle = getDb();
    if (!handle) return;
    // E5-19: genau ein Abo auf app/chat, nur solange der Begleiter offen ist.
    return watchDoc(handle, 'app/chat', (w) => receiveChatDoc(w.data, w.ok));
  }, [db]);
}

/** Unsichtbare Zieh-Streifen an den Kanten und oberen Ecken (unten sitzt die Fußleiste mit dem Griff). */
const HANDLES: Array<{ h: Handle; cls: string }> = [
  { h: 'n', cls: 'inset-x-4 top-0 h-2 cursor-ns-resize' },
  { h: 'nw', cls: 'left-0 top-0 size-4 cursor-nwse-resize' },
  { h: 'ne', cls: 'right-0 top-0 size-4 cursor-nesw-resize' },
  { h: 'w', cls: 'left-0 top-4 bottom-8 w-2 cursor-ew-resize' },
  { h: 'e', cls: 'right-0 top-4 bottom-8 w-2 cursor-ew-resize' },
];

function CompanionOverlay() {
  const { t } = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const tab = useCompanion((s) => s.tab);
  const attach = useCompanion((s) => s.attach);
  const tier = useCompanion((s) => s.tier);
  const mode = useCompanion((s) => s.winMode);
  const minimized = useCompanion((s) => s.minimized);
  const seeing = useCurrentSeeing();
  const route = useNav((s) => s.route.name);
  const ai = useAiAvailable();
  const reduced = useReducedMotion();
  const [focusSeq, setFocusSeq] = useState(0);
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const mobile = isMobileWidth(size.w);
  const kb = useKeyboardBox(mobile);
  const [custom, setCustom] = useState<Rect | null>(() => loadWin()?.rect ?? null);
  const [smooth, setSmooth] = useState(false);
  const inside = useRef(true);
  useChatWatch();

  const modal = mode === 'full';
  // Sichtbarer Bereich: bei offener Tastatur nur der Teil darüber (visualViewport).
  const vp: Vp = kb ? { left: 0, top: kb.top, width: size.w, height: kb.height } : { left: 0, top: 0, width: size.w, height: size.h };
  // Während des Ziehens wird die Lage direkt am Element gesetzt (`paint`), nicht im Zustand: das Fenster folgt dem Finger
  // ohne Neuaufbau des Chats. Beim Loslassen übernimmt der Zustand denselben Wert.
  const vpRef = useRef(vp);
  // Gemerkte oder Standardlage, bei jedem Zeichnen neu in den sichtbaren Bereich geklemmt (Drehen, Fenstergröße).
  const base = clampRect(custom ?? defaultRect(vp), vp);
  const baseRef = useRef(base);
  const place = (r: Rect, v: Vp): Rect => (modal ? fullRect(v) : minimized ? pillRect(r, v) : r);
  const shown = place(base, vp);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);

  const modalRef = useRef(modal);
  useEffect(() => {
    vpRef.current = vp;
    baseRef.current = base;
    modalRef.current = modal;
  });
  useEffect(() => {
    const mark = (e: Event) => {
      inside.current = !!panel.current && e.target instanceof Node && panel.current.contains(e.target);
    };
    // Esc auch dann, wenn der Fokus gerade auf der Seite liegt, weil der Knopf, den man gedrückt hatte, verschwand
    // (z. B. ein Vorschlag): maßgeblich ist, wo der Fokus zuletzt war.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && (modalRef.current || inside.current)) closeCompanion();
    };
    document.addEventListener('focusin', mark);
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('focusin', mark);
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    opener.current = document.activeElement;
    const id = window.setTimeout(() => setFocusSeq(1), 40);
    return () => {
      window.clearTimeout(id);
      // Fokus zurück zum auslösenden Element, aber nur, wenn er nicht schon in der Aufgabe liegt.
      const ae = document.activeElement;
      if (ae && ae !== document.body) return;
      const back = opener.current;
      const target = back instanceof HTMLElement && back.isConnected ? back : document.querySelector<HTMLElement>('[data-testid="open-companion"]');
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Nur das Vollbild sperrt das Scrollen der Seite dahinter.
  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  const animate = () => {
    if (reduced) return;
    setSmooth(true);
    window.setTimeout(() => setSmooth(false), 260);
  };
  const switchMode = (m: WinMode) => {
    animate();
    saveWin({ rect: baseRef.current, mode: m });
    setWinMode(m);
  };
  const toggleMin = () => {
    animate();
    setMinimized(!minimized);
  };

  const paint = (r: Rect) => {
    const el = panel.current;
    if (!el) return;
    const p = minimized ? pillRect(r, vpRef.current) : r;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${p.w}px`;
    el.style.height = `${p.h}px`;
  };

  // Verschieben (Kopfzeile) und Größe ändern (Kanten/Ecken): Pointer-Events für Maus und Finger.
  const startGesture = (e: ReactPointerEvent<HTMLElement>, handle: Handle | 'move') => {
    if (modal || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (handle === 'move' && e.target instanceof Element && e.target.closest('button, [role="tab"], a, input, textarea, select')) return;
    if (handle !== 'move' && minimized) return;
    const el = e.currentTarget;
    const id = e.pointerId;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const start = baseRef.current;
    const wasMin = minimized;
    let moved = false;
    let next = start;
    e.preventDefault();
    try {
      el.setPointerCapture(id);
    } catch (err) {
      logWarn('companion:capture', err);
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      next = handle === 'move' ? moveRect(start, dx, dy, vpRef.current) : resizeRect(handle, start, dx, dy, vpRef.current);
      paint(next);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', finish);
      if (moved) {
        setCustom(next);
        saveWin({ rect: next, mode: 'float' });
      } else if (wasMin && handle === 'move' && ev.type === 'pointerup') {
        // Tippen auf die Pille klappt sie wieder auf.
        toggleMin();
      }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCompanion();
      return;
    }
    if (!modal || e.key !== 'Tab' || !panel.current) return;
    // Fokusfalle nur im Vollbild (aria-modal): am Ende wieder vorn beginnen und umgekehrt.
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
      (el) => el.offsetParent !== null && el.tabIndex >= 0,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const areaLabel = seeing?.label ?? (route === 'overview' ? t('cmpSeeOverview') : t('cmpSeeToday'));
  const tabs: Array<{ id: CompanionTab; label: string }> = [
    // Neubau (plan.md §1.2): Umschalter „Übersetzen · Fragen“.
    { id: 'translate', label: t('cmpTabTranslate') },
    { id: 'chat', label: t('cmpTabChat') },
  ];

  const fullMobile = modal && mobile;
  const style = { left: shown.x, top: shown.y, width: shown.w, height: shown.h };
  return (
    // Die Ebene fängt keine Eingaben ab: nur das Fenster selbst (und im Vollbild am Desktop der Scrim) reagiert.
    <div className="pointer-events-none fixed inset-0 z-40">
      {modal && !mobile && (
        <motion.div
          className="pointer-events-auto absolute inset-0"
          style={{ background: 'var(--lx-scrim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base }}
          onClick={closeCompanion}
          aria-hidden="true"
        />
      )}
      <motion.div
        ref={panel}
        role="dialog"
        {...(modal ? { 'aria-modal': true } : {})}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="companion"
        data-tab={tab}
        data-mode={modal ? 'full' : 'float'}
        data-minimized={minimized ? '' : undefined}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: reduced ? DURATION.fast : DURATION.slow, ease: EASE_OUT }}
        style={style}
        className={`pointer-events-auto fixed @container flex flex-col overflow-hidden bg-surface-solid shadow-2xl outline-none ${fullMobile ? 'pt-[env(safe-area-inset-top)]' : 'rounded-[1.25rem] border border-line'} ${smooth ? 'transition-[left,top,width,height] duration-200 ease-out' : ''}`}
      >
        <header
          className={`flex flex-none items-center gap-1 px-2 pt-1.5 pb-1 select-none sm:px-3 ${modal ? '' : 'cursor-grab touch-none active:cursor-grabbing'}`}
          onPointerDown={(e) => startGesture(e, 'move')}
          title={modal ? undefined : t('cmpMoveHint')}
          data-testid="companion-grip"
        >
          <h2 id={titleId} className="flex flex-none items-center gap-2 px-2 text-lg font-semibold tracking-tight">
            <Icon name="sparkle" size={20} />
            <span className={minimized ? '' : 'sr-only @min-[30rem]:not-sr-only'}>{t('cmpTitle')}</span>
          </h2>
          {minimized ? (
            <span className="min-w-0 flex-1" />
          ) : (
            <div role="tablist" aria-label={t('cmpTabsLabel')} className="mx-auto flex rounded-[var(--radius-control)] bg-track p-1">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === x.id}
                  onClick={() => setCompanionTab(x.id)}
                  className={`min-h-11 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm transition-colors @min-[26rem]:px-4 ${tab === x.id ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'font-medium text-muted hover:text-fg'}`}
                  data-testid={`companion-tab-${x.id}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
          {!modal && <IconButton icon={minimized ? 'expand' : 'minus'} label={minimized ? t('cmpRestore') : t('cmpMinimize')} onClick={toggleMin} className="flex-none" data-testid="companion-min" />}
          {!minimized && <IconButton icon={modal ? 'shrink' : 'expand'} label={modal ? t('cmpFloat') : t('cmpFull')} onClick={() => switchMode(modal ? 'float' : 'full')} className="flex-none @max-[22rem]:hidden" data-testid="companion-mode" />}
          <IconButton icon="close" label={t('close')} onClick={closeCompanion} className="flex-none" data-testid="companion-close" />
        </header>
        <div className={minimized ? 'hidden' : 'flex min-h-0 flex-1 flex-col'} aria-hidden={minimized ? true : undefined}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-5 pb-2.5 sm:px-6">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted" data-testid="seeing" data-area={seeing?.area ?? route}>
              <span className="inline-block size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
              <span className="min-w-0 break-words">{t('cmpSeeing', { label: areaLabel })}</span>
            </p>
            {tab === 'chat' && ai && (
              <div role="radiogroup" aria-label={t('cmpTierLabel')} className="flex rounded-full bg-track p-0.5 text-xs">
                {(['quick', 'default'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={tier === v}
                    onClick={() => setTier(v)}
                    className={`lx-hit rounded-full px-3 ${tier === v ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
                    data-testid={`chat-tier-${v}`}
                  >
                    {v === 'quick' ? t('cmpTierQuick') : t('cmpTierDeep')}
                  </button>
                ))}
              </div>
            )}
            {tab === 'chat' && <IconButton icon="plus" label={t('cmpNew')} onClick={() => void newConversation()} disabled={isTurnRunning()} className="-my-1 flex-none" data-testid="chat-new" />}
            {tab === 'chat' && attach && (
              <p className="flex w-full min-w-0 items-center gap-1 rounded-2xl bg-accent-soft py-0.5 pr-0.5 pl-3 text-sm text-accent-text" data-testid="chat-attach">
                <span className="min-w-0 flex-1 break-words">
                  {t('cmpAbout', { word: attach.word })}
                  <span className="text-muted" lang="en">
                    {' '}
                    · „{attach.sentence.slice(0, 48)}
                    {attach.sentence.length > 48 ? '…' : ''}“
                  </span>
                </span>
                <button
                  type="button"
                  onClick={removeAttach}
                  className="ml-auto -m-1 inline-flex size-11 flex-none items-center justify-center rounded-full hover:bg-surface"
                  aria-label={t('cmpAttachRemove')}
                  data-testid="chat-attach-remove"
                >
                  <Icon name="close" size={16} />
                </button>
              </p>
            )}
          </div>
          {tab === 'chat' ? <ChatPane focusSeq={focusSeq} /> : <TranslatePane focusSeq={focusSeq} />}
          {!modal && (
            // Fußleiste mit dem Griff unten rechts (am Handy gut greifbar): hier sitzt die Größenänderung, nichts überdeckt die Eingabe.
            <div className="relative h-8 flex-none touch-none" data-testid="companion-foot">
              <div className="absolute inset-y-0 left-12 right-12 cursor-ns-resize touch-none" onPointerDown={(e) => startGesture(e, 's')} aria-hidden="true" />
              <div className="absolute inset-y-0 left-0 w-12 cursor-nesw-resize touch-none" onPointerDown={(e) => startGesture(e, 'sw')} aria-hidden="true" />
              <div
                className="absolute inset-y-0 right-0 flex w-14 cursor-nwse-resize touch-none items-center justify-end pr-2.5 text-subtle"
                onPointerDown={(e) => startGesture(e, 'se')}
                title={t('cmpResize')}
                data-testid="companion-resize"
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <path d="M14 5L5 14M14 10l-4 4" />
                </svg>
              </div>
            </div>
          )}
        </div>
        {!modal && !minimized &&
          HANDLES.map(({ h, cls }) => (
            <div key={h} className={`absolute touch-none ${cls}`} onPointerDown={(e) => startGesture(e, h)} aria-hidden="true" data-testid={`companion-edge-${h}`} />
          ))}
      </motion.div>
    </div>
  );
}
