import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav } from '../../app/nav';
import { watchDoc } from '../../data/watch';
import { useT } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ChatPane } from './ChatPane';
import { useCurrentSeeing } from './seeing';
import { closeCompanion, isTurnRunning, newConversation, receiveChatDoc, removeAttach, setCompanionTab, setTier, useCompanion, type CompanionTab } from './store';
import { TranslatePane } from './translate/TranslatePane';
import { useKeyboardBox } from '../../ui/chat/keyboard';

// Der Claude-Begleiter als großes Overlay (Phase 5 §8.1, Kap. 6.12): am Handy ein Vollbild-Blatt,
// am Desktop zentriert min(56rem, 92vw) × min(88vh, 60rem) – keine schmale Seitenleiste (Kap. 15).
// Kopf: Titel, Reiter Fragen | Übersetzen, „Neues Gespräch", Schließen. Darunter: was Claude
// gerade sieht, ggf. der Bezug (Wort). Esc schließt (erst das Nachschlage-Fenster, dann das Overlay).

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

function CompanionOverlay() {
  const { t } = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const tab = useCompanion((s) => s.tab);
  const attach = useCompanion((s) => s.attach);
  const tier = useCompanion((s) => s.tier);
  const seeing = useCurrentSeeing();
  const route = useNav((s) => s.route.name);
  const onPreply = useNav((s) => s.route.name === 'speak' && s.route.seg === 'preply');
  const ai = useAiAvailable();
  const [focusSeq, setFocusSeq] = useState(0);
  const [mobile] = useState(() => window.innerWidth < 768);
  const kb = useKeyboardBox(mobile);
  useChatWatch();

  // Esc schließt das Overlay auch dann, wenn der Fokus gerade nirgends im Dialog liegt (z. B. nach
  // einem Vorschlag, dessen Knopf danach verschwindet). Das Nachschlage-Fenster fängt Esc vorher ab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeCompanion();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    opener.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => setFocusSeq(1), 40);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      const back = opener.current;
      // Fokus zurück zum auslösenden Element, sonst zum Kopf-Knopf.
      const target = back instanceof HTMLElement && back.isConnected ? back : document.querySelector<HTMLElement>('[data-testid="open-companion"]');
      target?.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCompanion();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    // Fokusfalle (aria-modal): am Ende wieder vorn beginnen und umgekehrt.
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

  const areaLabel = seeing?.label ?? (route === 'overview' ? t('cmpSeeOverview') : onPreply ? t('cmpSeePreply') : t('cmpSeeToday'));
  const tabs: Array<{ id: CompanionTab; label: string }> = [
    { id: 'chat', label: t('cmpTabChat') },
    { id: 'translate', label: t('cmpTabTranslate') },
  ];

  const style = kb ? { height: kb.height, top: kb.top, bottom: 'auto' } : undefined;
  return (
    <div className="fixed inset-0 z-40">
      <motion.div
        className="absolute inset-0"
        style={{ background: 'var(--lx-scrim)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.base }}
        onClick={closeCompanion}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="companion"
        data-tab={tab}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        style={style}
        className="absolute inset-x-0 top-0 bottom-0 flex flex-col overflow-hidden bg-surface-solid pt-[env(safe-area-inset-top)] shadow-2xl outline-none md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(88vh,60rem)] md:w-[min(56rem,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[1.5rem] md:border md:border-line md:pt-0"
      >
        <header className="flex items-center gap-2 px-3 pt-2 pb-1 sm:px-4">
          <h2 id={titleId} className="flex flex-none items-center gap-2 px-2 text-lg font-semibold tracking-tight">
            <Icon name="sparkle" size={20} />
            <span className="sr-only sm:not-sr-only">{t('cmpTitle')}</span>
          </h2>
          <div role="tablist" aria-label={t('cmpTabsLabel')} className="mx-auto flex rounded-[var(--radius-control)] bg-track p-1">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => setCompanionTab(x.id)}
                className={`min-h-11 rounded-[calc(var(--radius-control)-4px)] px-4 text-sm transition-colors ${tab === x.id ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'font-medium text-muted hover:text-fg'}`}
                data-testid={`companion-tab-${x.id}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          {tab === 'chat' && <IconButton icon="plus" label={t('cmpNew')} onClick={() => void newConversation()} disabled={isTurnRunning()} className="flex-none" data-testid="chat-new" />}
          <IconButton icon="close" label={t('close')} onClick={closeCompanion} className="flex-none" data-testid="companion-close" />
        </header>
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
                  className={`min-h-8 rounded-full px-3 ${tier === v ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
                  data-testid={`chat-tier-${v}`}
                >
                  {v === 'quick' ? t('cmpTierQuick') : t('cmpTierDeep')}
                </button>
              ))}
            </div>
          )}
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
                className="ml-auto inline-flex size-9 flex-none items-center justify-center rounded-full hover:bg-surface"
                aria-label={t('cmpAttachRemove')}
                data-testid="chat-attach-remove"
              >
                <Icon name="close" size={16} />
              </button>
            </p>
          )}
        </div>
        {tab === 'chat' ? <ChatPane focusSeq={focusSeq} /> : <TranslatePane focusSeq={focusSeq} />}
      </motion.div>
    </div>
  );
}
