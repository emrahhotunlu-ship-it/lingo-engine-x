import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { logWarn } from '../../platform/diagnostics';
import { useClock } from '../clock';
import { useNav } from '../nav';
import { restorePending, useResume, RESUME_ROW_MS } from '../resume';
import type { Route } from '../router/types';
import type { Place } from './tabs';

// Zeile „Weitermachen: …“ (plan.md §0 + §1.3 Heute Nr. 3, Prototyp v1 `.resume`): erscheint auf
// Heute und am Herkunftsplatz der unterbrochenen Übung, am gleichen Lerntag bis zu 6 Std.
// Ein Tipp stellt SYNCHRON her (iPhone-Tastatur) und öffnet die Übung über dem aktuellen Reiter –
// ✕ führt also dorthin zurück, wo die Zeile stand.

function openHere(route: Route): void {
  useNav.getState().go(route);
}

export function ResumeRow({ place }: { place: Place }) {
  const { t } = useT();
  const pending = useResume((s) => s.pending);
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const open = useNav((s) => s.overlay?.route.name ?? null);
  if (!pending) return null;
  const { env, resumable, otherTab } = pending;
  if (place !== 'today' && resumable.origin !== place) return null;
  if (env.day !== today || now - env.savedAt > RESUME_ROW_MS || open === env.route.name) return null;
  let label = '';
  try {
    label = resumable.label(env.data, t);
  } catch (err) {
    logWarn('resume:label', err, env.id);
  }
  return (
    <button
      type="button"
      onClick={() => restorePending(pending, openHere)}
      className="flex w-full items-center justify-between gap-2.5 rounded-[var(--radius-control)] bg-gold-soft px-3.5 py-3 text-left text-sm text-fg transition-[filter] hover:brightness-110"
      data-testid="resume-row"
      data-resume={env.id}
      data-other-tab={otherTab ? '' : undefined}
    >
      <span className="flex min-w-0 items-start gap-2">
        <Icon name="refresh" size={16} className="mt-0.5 flex-none text-gold-text" />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{t('nbShResume', { label: label || resumable.id })}</span>
          {otherTab && <span className="text-xs text-muted">{t('nbShResumeOther')}</span>}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="flex-none text-subtle" />
    </button>
  );
}

/** Abschnitte je Platz (Registrierung im Bereich `system`). */
export const resumeRowFor = (place: Place) =>
  function ResumeRowAt() {
    return <ResumeRow place={place} />;
  };
