import { useMemo } from 'react';
import { runningTabs, useAiTasks } from '../../features/input/aiTasks';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { useNav } from '../nav';
import { badgeOf, type BadgeDef } from '../registry';
import { TABS, type TabDef, type TabId } from './tabs';

// Reiterleiste aus den Daten in `tabs.ts` (docs/neubau/architektur.md §2.4). Abzeichen je Reiter
// liefert der Bereich, der es angemeldet hat. Tippen auf den aktiven Reiter führt zur Wurzel.

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

function TabButton({ tab, active, busy }: { tab: TabDef; active: boolean; busy: boolean }) {
  const { t } = useT();
  const switchTab = useNav((s) => s.switchTab);
  const badge = tab.badge ? badgeOf(tab.badge) : null;
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        switchTab(tab.id as TabId);
        if (active) window.scrollTo({ top: 0 });
      }}
      data-testid={`tab-${tab.id}`}
      className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 text-2xs transition-colors md:min-h-10 md:flex-none md:flex-row md:gap-1.5 md:rounded-full md:px-4 md:text-sm ${active ? 'font-semibold text-fg md:bg-surface-strong' : 'font-medium text-muted hover:text-fg'}`}
    >
      {/* Aktiver Reiter: Symbol auf heller Pille + fette Schrift (nicht nur Farbe). */}
      <span className={`relative inline-flex rounded-full px-4 py-1 transition-colors duration-200 md:py-0 md:pr-2 md:pl-0 ${active ? 'bg-accent-soft text-accent-text md:bg-transparent md:text-fg' : ''}`}>
        <Icon name={tab.icon} size={22} />
        {badge && <BadgeCount badge={badge} />}
      </span>
      <span className="whitespace-nowrap">{t(tab.label)}</span>
      {/* M13: Ladepunkt, solange eine KI-Korrektur im Hintergrund läuft (Text für Vorleseprogramme). */}
      {busy && (
        <span className="absolute top-1 right-1" data-testid="tab-busy">
          <span className="lx-busy-dot block" aria-hidden="true" />
          <span className="sr-only">{t('tabBusy')}</span>
        </span>
      )}
    </button>
  );
}

export function TabBar() {
  const { t } = useT();
  const tab = useNav((s) => s.tab);
  const tasks = useAiTasks((s) => s.tasks);
  const busy = useMemo(() => runningTabs(tasks), [tasks]);
  return (
    <nav
      aria-label={t('navLabel')}
      className="lx-glass fixed inset-x-0 bottom-0 z-40 flex justify-center gap-1 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] md:sticky md:top-0 md:bottom-auto md:mx-auto md:mt-3 md:w-fit md:gap-1 md:rounded-full md:px-1.5 md:py-1.5"
      data-testid="tabbar"
    >
      {TABS.map((d) => (
        <TabButton key={d.id} tab={d} active={tab === d.id} busy={busy.has(d.id)} />
      ))}
    </nav>
  );
}
