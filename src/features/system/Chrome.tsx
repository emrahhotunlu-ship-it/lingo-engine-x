import type { ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useLayer } from '../../app/shell/layer';
import { openSettings } from '../../app/sheets';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { openCompanion } from '../companion/store';

// Rahmen-Bausteine (Neubau WP0b, docs/neubau/architektur.md §2.5, Prototyp v1):
// - Reiter-Wurzel: Kopf des Rahmens (`app/shell/TopBar`) mit Profil links, Übersetzen und Claude
//   rechts. Die Titelzeile der Seite zeigt nur noch den Titel (und eigene Knöpfe) – `TitleActions`
//   zeichnet in der Ebene `tab` kein zweites Übersetzen/Claude.
// - Seite: rechts nur „Fragen“ (Relaunch P2 S1-SHELL; Übersetzer und Einstellungen in der Navigation bzw. auf „Fortschritt“).
// - Übung: die gemeinsame Übungsleiste mit Übersetzen, Claude und Zahnrad.
// Emrahs feste Vorgabe (CLAUDE.md A7, Paket 2; Fehlermeldung am iPhone 28.09.): Übersetzer, Claude
// und Einstellungen auf jeder Seite und in jeder Übung mit einem Tipp. Die Einstellungen sind ein
// Blatt über der Ebene: die laufende Übung bleibt darunter stehen und läuft danach weiter.

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

/** Zahnrad: öffnet die Einstellungen als Blatt (Kopf, Seiten, Übungen und System-Bildschirme). */
export function SettingsButton() {
  const { t } = useT();
  return <IconButton icon="gear" label={t('openSettings')} onClick={openSettings} data-testid="open-settings" />;
}

/**
 * „Fragen“: das eine Claude-Symbol in Kopf und Seitenköpfen (Relaunch P2 S1-SHELL, stufe1-plan.md §6.3; Test-ID `open-companion`
 * bleibt). Sprechblase mit Fragezeichen (Vorschau `ic('ask')`). Ohne KI unsichtbar. Liegt hier, damit `app/shell/TopBar` und die
 * Seiten es ohne Kreis-Import teilen.
 */
export function AskButton() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return <IconButton icon="ask" label={t('shAsk')} onClick={() => openCompanion()} className="text-accent-text hover:text-accent-text" data-testid="open-companion" data-ai="" />;
}

/**
 * Rechte Seite einer Titelzeile: eigene Knöpfe, dann EIN „Fragen“ (Relaunch P2: Seitenköpfe ohne Übersetzer und Zahnrad –
 * die stehen auf „Fortschritt“, in der Übungsleiste und ab 600 px in der Navigation). Auf einer Reiter-Wurzel steht „Fragen“
 * schon im Kopf des Rahmens – dort nur die eigenen Knöpfe.
 */
export function TitleActions({ children }: { children?: ReactNode }) {
  const { kind } = useLayer();
  if (kind === 'tab') return children ? <div className="flex flex-none items-center gap-1">{children}</div> : null;
  return (
    <div className="flex flex-none items-center gap-1">
      {children}
      <AskButton />
    </div>
  );
}

/** Titelzeile einer Reiter-Startseite: großer Titel links (wie v1), nie ein Zurück-Pfeil. */
export function TabTitle({ title, sub, actions, testId }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-3xl" data-testid={testId}>
          {title}
        </h1>
        {/* Nur eigene Knöpfe: Übersetzer, Claude und Zahnrad zeigt schon der Kopf (Reiter-Wurzel) bzw. die Seitenleiste
            (`speak`/`library` sind seit 04.10.2026 Seiten mit Rahmen-Kopf) – sonst stünden sie doppelt da. */}
        {actions ? <div className="flex flex-none items-center gap-1">{actions}</div> : null}
      </div>
      {sub}
    </header>
  );
}

/** Rechte Seite der Übungsleiste: Übersetzer, Claude und Zahnrad (plan.md §1.2, A7 Paket 2). */
export function ExerciseActions() {
  return (
    <div className="flex flex-none items-center gap-0.5" data-testid="exercise-actions">
      <TranslateButton />
      <ClaudeButton />
      <SettingsButton />
    </div>
  );
}
