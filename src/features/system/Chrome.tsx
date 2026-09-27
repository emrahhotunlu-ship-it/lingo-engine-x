import type { ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
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

/** Übersetzer direkt (Emrahs Wunsch 27.09.: überall erreichbar). Ohne KI unsichtbar. */
export function TranslateButton() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return <IconButton icon="translate" label={t('cmpTabTranslate')} onClick={() => openCompanion({ tab: 'translate' })} data-testid="open-translate" data-ai="" />;
}

/** Zahnrad: öffnet die Einstellungen – auf jeder Seite und in jeder Übung (Emrahs Wunsch 27.09.). */
export function SettingsButton() {
  const { t } = useT();
  return <IconButton icon="gear" label={t('openSettings')} onClick={openSettings} data-testid="open-settings" />;
}

/** Rechte Seite einer Titelzeile: eigene Knöpfe, dann Übersetzer, Claude und Zahnrad – überall gleich. */
export function TitleActions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-1">
      {children}
      <TranslateButton />
      <ClaudeButton />
      <SettingsButton />
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

/** Rechte Seite der Übungsleiste: Übersetzer, Claude, Zahnrad (Emrahs Wunsch 27.09.). */
export function ExerciseActions() {
  return (
    <div className="flex flex-none items-center gap-0.5">
      <TranslateButton />
      <ClaudeButton />
      <SettingsButton />
    </div>
  );
}
