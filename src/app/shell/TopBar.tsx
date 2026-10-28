import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { AskButton, SettingsButton } from '../../features/system/Chrome';
import { useNav } from '../nav';
import { screenOf } from '../registry';
import { openSheet } from '../sheets';
import { useInitial } from './useStreak';

// Kopf des Rahmens (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §6.3, Vorschau `phead`):
// - Reiter-Wurzel: rechts EIN Symbol „Fragen“ (öffnet Claude; ohne KI unsichtbar). Den großen Titel zeichnet die Seite selbst.
// - Fortschritt: links der Profil-Knopf (nur die Initiale) → Profil-Blatt, rechts das Zahnrad – nur hier (Plan §6.3).
// - Seite: links „‹ Herkunft“, rechts „Fragen“ (`PageTop`). Einstellungen, Übersetzer und Claude stehen am Laptop
//   zusätzlich in der Seitenleiste.

/** Profil-Knopf oben links (öffnet das Profil-Blatt). */
export function ProfileButton() {
  const { t } = useT();
  const initial = useInitial();
  return (
    <button
      type="button"
      onClick={() => openSheet('profile')}
      aria-label={t('nbShProfile')}
      className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-full pr-2 pl-1 transition-colors hover:bg-surface"
      data-testid="open-profile"
    >
      <span className="inline-flex size-[2.125rem] items-center justify-center rounded-full bg-surface-strong text-sm font-semibold" aria-hidden="true">
        {initial ?? <Icon name="user" size={18} />}
      </span>
    </button>
  );
}

/** Kopf auf jeder Reiter-Wurzel (einmal im Rahmen, nicht je Bildschirm – eindeutige Test-IDs). */
export function TopBar() {
  const tab = useNav((s) => s.tab);
  if (tab === 'progress') {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 pt-3" data-testid="topbar">
        <ProfileButton />
        <SettingsButton />
      </div>
    );
  }
  return (
    <div className="flex min-h-11 items-center justify-end gap-3 pt-3" data-testid="topbar">
      <AskButton />
    </div>
  );
}

/** Titel der Herkunft („Heute“, „Üben“ …) für „‹ Herkunft“; `null` = keine Herkunft bekannt. */
export function useOriginTitle(): string | null {
  const { t } = useT();
  const origin = useNav((s) => s.stack[s.stack.length - 1] ?? null);
  if (!origin) return null;
  const key = screenOf(origin.name)?.title;
  return key ? t(key) : null;
}

/** „‹ Herkunft“ (v1): Chevron + Titel der Herkunft; ohne bekannten Titel „‹ Zurück“. */
export function BackLink({ onClick, testId = 'page-back' }: { onClick: () => void; testId?: string }) {
  const { t } = useT();
  const title = useOriginTitle();
  const label = title ?? t('nbShBack');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title ? t('nbShBackTo', { title }) : t('nbShBack')}
      className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-0.5 rounded-full pr-3 pl-1 text-sm font-medium text-accent-text transition-colors hover:bg-surface"
      data-testid={testId}
    >
      <Icon name="chevronLeft" size={22} />
      <span className="max-w-[12rem] truncate">{label}</span>
    </button>
  );
}

/** Kopfzeile einer Seite ohne eigene Titelzeile (`chrome: 'shell'`): ‹ Herkunft · Aktionen. */
export function PageTop() {
  const back = useNav((s) => s.back);
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pt-3" data-testid="page-bar">
      <BackLink onClick={back} />
      <div className="flex flex-none items-center gap-1" data-testid="stand-actions">
        <AskButton />
      </div>
    </div>
  );
}
