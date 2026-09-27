import type { ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav } from '../../app/nav';
import { openSettings } from '../../app/sheets';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { openCompanion } from '../companion/store';

// Rahmen-Bausteine der neuen Grundstruktur (UX-Beratung Nr. 2, 4, 7): keine globale App-Kopfzeile
// mehr. Jeder Reiter hat eine eigene Titelzeile (großer Titel links, rechts das Claude-Symbol und
// auf „Stand" das Zahnrad); jede Übung hat die gemeinsame Übungsleiste mit demselben Claude-Symbol.

/** Claude-Symbol: öffnet den Begleiter (Claude fragen / Übersetzen). Ohne KI unsichtbar. */
export function ClaudeButton() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return (
    <IconButton
      icon="sparkle"
      label={t('openCompanion')}
      onClick={() => openCompanion()}
      className="text-accent-text hover:text-accent-text"
      data-testid="open-companion"
      data-ai=""
    />
  );
}

/** Zahnrad: öffnet die Einstellungen (nur auf „Stand"). */
export function SettingsButton() {
  const { t } = useT();
  return <IconButton icon="gear" label={t('openSettings')} onClick={openSettings} data-testid="open-settings" />;
}

/** Rechte Seite einer Titelzeile: eigene Knöpfe, dann Claude; auf „Stand" zusätzlich das Zahnrad. */
export function TitleActions({ children }: { children?: ReactNode }) {
  const onStand = useNav((s) => s.route.name === 'overview');
  return (
    <div className="flex flex-none items-center gap-1">
      {children}
      <ClaudeButton />
      {onStand && <SettingsButton />}
    </div>
  );
}

/** Titelzeile einer Reiter-Startseite: großer Titel links, nie ein Zurück-Pfeil. */
export function TabTitle({ title, sub, actions, testId }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl" data-testid={testId}>
          {title}
        </h1>
        <TitleActions>{actions}</TitleActions>
      </div>
      {sub}
    </header>
  );
}
