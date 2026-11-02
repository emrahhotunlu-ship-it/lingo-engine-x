import { motion } from 'framer-motion';
import { useAiAvailable } from '../../ai/scope';
import { useFxLevel } from '../../engine/fx/level';
import { openCompanion } from '../../features/companion/store';
import { useT } from '../../i18n';
import { Icon, type IconName } from '../../ui/Icon';
import { SPRINGS } from '../../ui/motion';
import { markNavStart } from '../perf';
import { useNav } from '../nav';
import { badgeOf, type BadgeDef } from '../registry';
import { openSettings } from '../sheets';
import { requestScrollTop } from './Layers';
import { TABS, type TabDef, type TabId } from './tabs';

// Navigation des Rahmens (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §6.2/§6.3, Vorschau `.tabbar`/`.side`):
// EIN Baustein für alle Breiten, die Darstellung macht `styles/parts/shell.css`:
// - Handy (< 600 px): Leiste unten, vier gleich breite Reiter (Symbol + Beschriftung), in Übungen ausgeblendet.
// - Schiene (600–1279 px): schmale Spalte links, nur Symbole (Beschriftung bleibt für Screenreader).
// - Seitenleiste (ab 1280 px): Wortmarke, vier Reiter, unten Claude, Übersetzer und Einstellungen.
// Seit UX-Neuanfang B (Emrah 02.11.2026) kein Reiter „Praxis“ mehr: die Seite ist über Heute › Freiwillig erreichbar.
// Abzeichen je Reiter liefert der Bereich, der es angemeldet hat. Tippen auf den aktiven Reiter führt zur Wurzel und nach oben (N01).

function BadgeCount({ badge }: { badge: BadgeDef }) {
  const { t } = useT();
  const useCount = badge.use;
  const n = useCount();
  if (n <= 0) return null;
  return (
    <span className="lx-nav-badge lx-tnum" data-testid="tab-badge" aria-label={t('tabOpen', { n })}>
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
      data-tab={tab.id}
      className="lx-nav-item"
      title={t(tab.label)}
    >
      {/* Aktiver Reiter: Pille (nie nur Farbe), gleitet als EIN Element zum neuen Reiter (P54, `layoutId`). Handy: hinter dem Symbol; Schiene/Seitenleiste: hinter dem Eintrag. */}
      {active && <TabPill id="tab-pill-d" className="lx-nav-pill lx-nav-pill-item" />}
      <span className="lx-nav-icon">
        {active && <TabPill id="tab-pill-m" className="lx-nav-pill lx-nav-pill-icon" />}
        <Icon name={tab.icon} size={22} />
        {badge && <BadgeCount badge={badge} />}
      </span>
      <span className="lx-nav-label">{t(tab.label)}</span>
    </button>
  );
}

function ToolButton({ icon, label, onClick, testId }: { icon: IconName; label: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" className="lx-nav-item lx-nav-tool" onClick={onClick} data-testid={testId} title={label}>
      <span className="lx-nav-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="lx-nav-label">{label}</span>
    </button>
  );
}

/** Die Navigation des Rahmens (Test-ID `tabbar` bleibt für alle Breiten). */
export function TabBar() {
  const { t } = useT();
  const tab = useNav((s) => s.tab);
  const ai = useAiAvailable();
  return (
    <nav aria-label={t('shNavLabel')} className="lx-nav dz-tabbar" data-testid="tabbar">
      <div className="lx-nav-mark" aria-hidden="true">
        {t('shWordmark')}
      </div>
      <div className="lx-nav-tabs">
        {TABS.map((d) => (
          <TabButton key={d.id} tab={d} active={tab === d.id} />
        ))}
      </div>
      <div className="lx-nav-tools">
        {ai && <ToolButton icon="sparkle" label={t('shClaude')} onClick={() => openCompanion({ tab: 'chat' })} testId="side-claude" />}
        {ai && <ToolButton icon="translate" label={t('shTranslator')} onClick={() => openCompanion({ tab: 'translate' })} testId="side-translate" />}
        <ToolButton icon="gear" label={t('shSettings')} onClick={openSettings} testId="side-settings" />
      </div>
    </nav>
  );
}

/** Die Pille des aktiven Reiters; bei Stufe „Aus“ ohne Bewegung (springt an den neuen Ort). */
function TabPill({ id, className }: { id: string; className: string }) {
  const fx = useFxLevel();
  if (fx === 'off') return <span aria-hidden="true" className={className} />;
  return <motion.span aria-hidden="true" className={className} layoutId={id} transition={SPRINGS.snap} />;
}
