import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav } from '../../app/nav';
import { watchDoc } from '../../data/watch';
import { useT } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ChatPane } from './ChatPane';
import { clampRect, defaultRect, fullRect, homeVp, isLow, isPhone, keyboardRect, loadWin, moveRect, movePill, parkedPill, pillRect, resizeRect, saveWin, type Handle, type Rect, type Vp, type WinMode } from './floatWindow';
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

/** Höhe der festen Aktionsleiste und der unteren Reiterleiste, soweit sie das Fenster (Breite `x0`…`x1`) verdecken könnten. */
function measureReserve(x0: number, x1: number): number {
  let reserve = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid="actionbar"], .dz-tabbar')) {
    const r = el.getBoundingClientRect();
    if (r.height < 8 || r.width < 8 || r.top < window.innerHeight * 0.4 || r.right <= x0 || r.left >= x1) continue;
    reserve = Math.max(reserve, window.innerHeight - r.top);
  }
  return Math.ceil(reserve);
}

/** Unterkante der Kopf-Symbole der Seite (Pille parkt darunter); sonst ein fester Wert. */
function measureHeadBottom(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid="topbar"], [data-testid="page-bar"], [data-testid="open-companion"]')) {
    if (el.closest('[data-testid="companion"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < 120) bottom = Math.max(bottom, r.bottom);
  }
  return Math.ceil(bottom || 56) + 8;
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
  { h: 'w', cls: 'left-0 top-4 bottom-11 w-2 cursor-ew-resize' },
  { h: 'e', cls: 'right-0 top-4 bottom-11 w-2 cursor-ew-resize' },
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
  const coarse = inputProfile() === 'touch';
  const mobile = isPhone(size.w, size.h, coarse);
  // Immer aktiv: greift erst, wenn die Tastatur wirklich mehr als 80 px nimmt.
  const kb = useKeyboardBox(true);
  const [reserve, setReserve] = useState(0);
  const [head, setHead] = useState(56);
  const [pillPos, setPillPos] = useState<Rect | null>(null);
  const [custom, setCustom] = useState<Rect | null>(() => loadWin()?.rect ?? null);
  const [smooth, setSmooth] = useState(false);
  const inside = useRef(true);
  useChatWatch();

  const modal = mode === 'full';
  // Sichtbarer Bereich: bei offener Tastatur nur der Teil darüber (visualViewport).
  const vp: Vp = kb ? { left: 0, top: kb.top, width: size.w, height: kb.height } : { left: 0, top: 0, width: size.w, height: size.h };
  // Standard- und Pillenlage liegen über der Aktionsleiste und der Reiterleiste (frei verschiebbar bleibt das Fenster im ganzen Bereich `vp`).
  const home = kb ? vp : homeVp(vp, reserve);
  // Während des Ziehens wird die Lage direkt am Element gesetzt (`paint`), nicht im Zustand: das Fenster folgt dem Finger
  // ohne Neuaufbau des Chats. Beim Loslassen übernimmt der Zustand denselben Wert.
  const vpRef = useRef(vp);
  // Gemerkte oder Standardlage, bei jedem Zeichnen neu in den sichtbaren Bereich geklemmt (Drehen, Fenstergröße).
  const base = clampRect(custom ?? defaultRect(home, mobile), vp);
  const baseRef = useRef(base);
  const low = isLow(vp.height, !!kb);
  // Pille: vom Nutzer gezogene Lage, sonst am Handy oben rechts unter den Kopf-Symbolen, am Desktop am unteren Rand des Fensters (über den Leisten).
  const pillBase = (r: Rect, v: Vp, h: Vp): Rect => {
    if (pillPos) return movePill(pillPos, 0, 0, v);
    return mobile && !custom ? parkedPill(v, head) : pillRect(r, h === v ? v : custom ? v : h);
  };
  const place = (r: Rect, v: Vp): Rect => (modal ? fullRect(v, mobile) : minimized ? pillBase(r, v, home) : kb && mobile ? keyboardRect(r, v) : r);
  const shown = place(base, vp);
  const pillRef = useRef(shown);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);

  // Leisten messen: bei Größen- und Seitenwechsel, wenn die Aktionsleiste erscheint oder verschwindet (`html[data-actionbar]`)
  // und wenn das Fenster in die Kontextspalte dockt oder sie freigibt (`html[data-lx-dock]`).
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const x0 = mobile ? 0 : window.innerWidth - 480;
      setReserve((old) => {
        const n = measureReserve(x0, window.innerWidth);
        return old === n ? old : n;
      });
      setHead((old) => {
        const n = measureHeadBottom();
        return old === n ? old : n;
      });
    };
    const later = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    later();
    const obs = new MutationObserver(later);
    // `data-lx-dock`: Andocken in die Kontextspalte und Lösen davon ändern die Breite der Aktionsleiste (app/shell/ContextHost).
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-actionbar', 'data-theme', 'data-lx-dock'] });
    const host = document.getElementById('lx-actionbar-host');
    if (host) obs.observe(host, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener('resize', later);
    };
  }, [mobile, size.w, size.h, route]);

  const modalRef = useRef(modal);
  useEffect(() => {
    vpRef.current = vp;
    baseRef.current = base;
    pillRef.current = shown;
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
    setPillPos(null);
    setMinimized(!minimized);
  };

  const paint = (r: Rect) => {
    const el = panel.current;
    if (!el) return;
    const p = r;
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
    const pillDrag = minimized && handle === 'move';
    const start = pillDrag ? pillRef.current : baseRef.current;
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
      next = pillDrag ? movePill(start, dx, dy, vpRef.current) : handle === 'move' ? moveRect(start, dx, dy, vpRef.current) : resizeRect(handle, start, dx, dy, vpRef.current);
      paint(next);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', finish);
      if (moved && pillDrag) {
        setPillPos(next);
      } else if (moved) {
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
        data-low={low && !modal ? '' : undefined}
        data-phone={mobile ? '' : undefined}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: reduced ? DURATION.fast : DURATION.slow, ease: EASE_OUT }}
        style={style}
        className={`group/cmp pointer-events-auto fixed @container flex flex-col overflow-hidden bg-surface-solid shadow-2xl outline-none ${fullMobile ? 'pt-[env(safe-area-inset-top)]' : 'rounded-[1.25rem] border border-line-strong'} ${smooth ? 'transition-[left,top,width,height] duration-200 ease-out' : ''}`}
      >
        <header
          className={`relative flex flex-none items-center gap-1 px-2 pt-2.5 pb-1 select-none sm:px-3 ${modal ? '' : 'cursor-grab touch-none active:cursor-grabbing'}`}
          onPointerDown={(e) => startGesture(e, 'move')}
          title={modal ? undefined : t('cmpMoveHint')}
          data-testid="companion-grip"
        >
          {!modal && <span className="pointer-events-none absolute top-1 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--lx-line-strong)]" aria-hidden="true" data-testid="companion-grab" />}
          <h2 id={titleId} className="flex flex-none items-center gap-2 px-2 text-lg font-semibold tracking-tight">
            <Icon name="sparkle" size={20} />
            <span className={minimized ? '' : 'sr-only @min-[30rem]:not-sr-only'}>{t('cmpTitle')}</span>
          </h2>
          {minimized ? (
            <span className="min-w-0 flex-1" />
          ) : (
            <div role="tablist" aria-label={t('cmpTabsLabel')} className="mx-auto flex flex-none rounded-[var(--radius-control)] bg-track p-1">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === x.id}
                  onClick={() => setCompanionTab(x.id)}
                  className={`min-h-11 whitespace-nowrap rounded-[calc(var(--radius-control)-4px)] px-2 text-sm transition-colors @min-[26rem]:px-4 ${tab === x.id ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'font-medium text-muted hover:text-fg'}`}
                  data-testid={`companion-tab-${x.id}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-none items-center gap-1">
          {!modal && <IconButton icon={minimized ? 'restore' : 'minus'} label={minimized ? t('cmpRestore') : t('cmpMinimize')} onClick={toggleMin} className="flex-none" data-testid="companion-min" />}
          {!minimized && <IconButton icon={modal ? 'shrink' : 'expand'} label={modal ? t('cmpFloat') : t('cmpFull')} onClick={() => switchMode(modal ? 'float' : 'full')} className="flex-none @max-[22rem]:hidden" data-testid="companion-mode" />}
          <IconButton icon="close" label={t('close')} onClick={closeCompanion} className="flex-none" data-testid="companion-close" />
          </div>
        </header>
        <div className={minimized ? 'hidden' : 'flex min-h-0 flex-1 flex-col'} aria-hidden={minimized ? true : undefined}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-5 pb-2.5 group-data-[low]/cmp:hidden sm:px-6" data-testid="companion-sub">
            <p className="flex min-w-0 flex-1 items-center @max-[26rem]:basis-full gap-2 text-xs text-muted" data-testid="seeing" data-area={seeing?.area ?? route}>
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
            <div className="relative h-11 flex-none touch-none" data-testid="companion-foot">
              <div className="absolute inset-y-0 left-14 right-14 cursor-ns-resize touch-none" onPointerDown={(e) => startGesture(e, 's')} aria-hidden="true" />
              <div className="absolute inset-y-0 left-0 w-14 cursor-nesw-resize touch-none" onPointerDown={(e) => startGesture(e, 'sw')} aria-hidden="true" />
              <div
                className="absolute inset-y-0 right-0 flex w-14 cursor-nwse-resize touch-none items-center justify-center text-subtle"
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
