import type { ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useLayer } from '../../app/shell/layer';
import { openSettings } from '../../app/sheets';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { TopMenu, type MenuEntry } from '../../ui/exercise/ExerciseMenu';
import { useBand } from '../../ui/exercise/bandStore';
import { useMediaQuery } from '../../platform/input';
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
        <h1 className="lx-tabtitle min-w-0" data-testid={testId}>
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

/**
 * Rechte Seite der Übungsleiste (plan.md §1.2, A7 Paket 2; seit dem Band Relaunch Stufe 1 P3, stufe1-plan §6.4): Menü „…“.
 * Handy (< 768 px): oben nur ✕ und Balken – Übersetzer, Claude und „Pause, später weiter“ stehen hinter „…“ (gleiche Kennungen).
 * Ab 768 px stehen Übersetzer und Claude daneben (seit dem UX-Neuanfang B auch am Laptop, Übungen ohne Seitenleiste). Das Zahnrad steht nie in der Übungsleiste (Hauptsitzung 28.10.2026);
 * die Einstellungen bleiben als Punkt im Menü erreichbar (Emrahs Vorgabe „überall“). `onPause` = dasselbe wie ✕.
 */
export function ExerciseActions({ onPause }: { onPause: () => void }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const wide = useMediaQuery('(min-width: 768px)');
  // Kern (Emrah 03.11.2026, Vorschau 9pdpf…): oben rechts EIN beschrifteter Knopf „Frag Claude“. In einer Aufgabe fragt er Claude zu genau
  // dieser Aufgabe (vorher ohne Lösung, danach mit Antwort), sonst öffnet er den Begleiter. Der freie Chat bleibt im Menü „…“ erreichbar.
  const noAi = useBand((s) => s.noAi === true);
  const explain = useBand((s) => (s.noAi ? null : s.explain));
  const ask = noAi ? null : (explain ?? (ai ? () => openCompanion() : null));
  const lead: MenuEntry[] = noAi ? [] : [
    ...(ai && explain ? [{ id: 'companion', label: t('openCompanion'), onClick: () => openCompanion(), testId: 'open-companion' }] : []),
    ...(ai && !wide ? [{ id: 'translate', label: t('cmpTabTranslate'), onClick: () => openCompanion({ tab: 'translate' }), testId: 'open-translate' }] : []),
  ];
  const tail: MenuEntry[] = [{ id: 'settings', label: t('openSettings'), onClick: openSettings, testId: 'open-settings' }];
  return (
    <div className="flex flex-none items-center gap-1" data-testid="exercise-actions">
      {wide && !noAi && <TranslateButton />}
      {ask && (
        // Politur P1 (13.11.2026): Claude-Symbol statt der großen Kapsel „Frag Claude“ – am Handy nahm sie dem Titel den Platz (er wurde
        // abgeschnitten oder zweizeilig). Die Beschriftung bleibt für Vorleseprogramme und steht ab 768 px sichtbar neben dem Symbol (`kern.css`).
        <button type="button" className="lx-kask" onClick={ask} title={t('kernAsk')} data-testid={explain ? 'claude-explain' : 'open-companion'} data-ai="">
          <Icon name="sparkle" size={20} />
          <span className="lx-kask-label">{t('kernAsk')}</span>
        </button>
      )}
      <TopMenu lead={lead} tail={tail} onPause={onPause} />
    </div>
  );
}
