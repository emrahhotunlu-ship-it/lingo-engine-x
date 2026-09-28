import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { useNav } from '../nav';
import { entriesFor, sectionsFor, type EntryDef } from '../registry';
import type { Place } from './tabs';

// Hub-Bausteine des Rahmens (docs/neubau/architektur.md §2.4, §2.8): Reiter-Wurzeln zeigen ihre
// eigenen Inhalte und dazu die Abschnitte aller Bereiche, die an ihren Plätzen hängen.
// Einstiege sind Zeilen; ihre `id` ist die Test-ID (`hub-course`, `hub-grammar` …).

/** Alle Abschnitte der Plätze eines Reiters, in Platz- und dann `order`-Reihenfolge. */
export function HubSections({ places }: { places: readonly Place[] }) {
  const sections = places.flatMap((p) => sectionsFor(p));
  if (!sections.length) return null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6" data-testid="hub-sections">
      {sections.map((s) => {
        const Section = s.component;
        return (
          <div key={s.id} data-section={s.id}>
            <Section />
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ entry }: { entry: EntryDef }) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const open = () => {
    if (entry.start) entry.start(api);
    else if (entry.route) go(entry.route);
  };
  return (
    <li>
      <button type="button" onClick={open} data-testid={entry.id} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface text-muted">
          <Icon name={entry.icon} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{t(entry.label)}</span>
          {entry.sub && <span className="text-sm text-muted">{t(entry.sub)}</span>}
        </span>
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}

/** Einstiege eines Platzes (optional einer Gruppe) als eine Liste mit Überschrift. */
export function EntryList({ place, group, title }: { place: Place; group?: string; title?: MessageKey }) {
  const { t } = useT();
  const entries = entriesFor(place, group);
  if (!entries.length) return null;
  const label = title ? t(title) : undefined;
  return (
    <section className="flex flex-col gap-3" aria-label={label} data-testid={`entries-${place}`}>
      {label && <h2 className="lx-eyebrow">{label}</h2>}
      <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </ul>
    </section>
  );
}
