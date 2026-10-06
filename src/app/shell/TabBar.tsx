import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { markNavStart } from '../perf';
import { useNav } from '../nav';
import { badgeOf, type BadgeDef } from '../registry';
import { requestScrollTop } from './Layers';
import { TABS, type TabDef, type TabId } from './tabs';

// Reiterleiste aus den Daten in `tabs.ts` (docs/neubau/architektur.md §2.4, Prototyp v1 `.tabbar`):
// am Handy unten fest, halbdurchsichtig mit Unschärfe; aktiver Reiter in Akzentfarbe, fett und mit
// Pille (nie nur Farbe). Abzeichen je Reiter liefert der Bereich, der es angemeldet hat. Tippen auf
// den aktiven Reiter führt zur Wurzel und nach oben (N01).
// Sechs Reiter am Handy: Breite nach Inhalt (`flex-auto`) statt gleich breit, sonst passt „Fortschritt“
// (längste Beschriftung) bei 390 px nicht einzeilig neben „Wortschatz“.

function BadgeCount({ badge }: { badge: BadgeDef }) {
  const { t } = useT();
  const useCount = badge.use;
  const n = useCount();
  if (n <= 0) return null;
  return (
    <span className="lx-tnum absolute -top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs leading-4 font-semibold text-accent-fg md:-top-2 md:-right-1.5" data-testid="tab-badge" aria-label={t('tabOpen', { n })}>
      {n}
    </span>
  );
}

function TabButton({ tab, active }: { tab: TabDef; active: boolean }) {
  const { t } = useT();
  const switchTab = useNav((s) => s.switchTab);
  const badge = tab.badge ? badgeOf(tab.badge) : null;
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        markNavStart();
        if (active) {
          const s = useNav.getState();
          if (s.stacks[tab.id as TabId].length > 1) requestScrollTop();
        }
        switchTab(tab.id as TabId);
        if (active) window.scrollTo({ top: 0 });
      }}
      data-testid={`tab-${tab.id}`}
      className={`relative flex min-h-12 min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-0.5 pt-1.5 pb-1 text-2xs transition-colors md:min-h-11 md:flex-none md:flex-row md:gap-1.5 md:rounded-full md:px-4 md:text-sm ${active ? 'font-semibold text-accent-text md:bg-surface-strong md:text-fg' : 'font-medium text-subtle hover:text-fg'}`}
    >
      {/* Aktiver Reiter: Symbol auf heller Pille + fette Schrift (nicht nur Farbe). */}
      <span className={`relative inline-flex rounded-full px-3.5 py-0.5 transition-colors duration-150 md:py-0 md:pr-2 md:pl-0 ${active ? 'bg-accent-soft md:bg-transparent' : ''}`}>
        <Icon name={tab.icon} size={24} />
        {badge && <BadgeCount badge={badge} />}
      </span>
      <span className="whitespace-nowrap">{t(tab.label)}</span>
    </button>
  );
}

export function TabBar() {
  const { t } = useT();
  const tab = useNav((s) => s.tab);
  return (
    <nav
      aria-label={t('navLabel')}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-0.5 border-t border-line bg-bg px-1.5 pt-0.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] md:sticky md:top-0 md:bottom-auto md:mx-auto md:mt-3 md:w-fit md:gap-1 md:rounded-full md:border md:px-1.5 md:py-1.5"
      data-testid="tabbar"
    >
      {TABS.map((d) => (
        <TabButton key={d.id} tab={d} active={tab === d.id} />
      ))}
    </nav>
  );
}
