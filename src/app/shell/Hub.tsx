import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Row, RowList } from '../../ui/RowList';
import { markNavStart } from '../perf';
import { useNav } from '../nav';
import { entriesFor, sectionsFor, type EntryDef } from '../registry';
import type { Place } from './tabs';

// Hub-Bausteine des Rahmens (docs/neubau/architektur.md §2.4, §2.8): Reiter-Wurzeln zeigen ihre
// eigenen Inhalte und dazu die Abschnitte aller Bereiche, die an ihren Plätzen hängen.
// Einstiege sind Zeilen im Stil von v1 (`RowList`/`Row`); ihre `id` ist die Test-ID
// (`hub-course`, `hub-grammar` …).

/** Alle Abschnitte der Plätze eines Reiters, in Platz- und dann `order`-Reihenfolge. */
export function HubSections({ places }: { places: readonly Place[] }) {
  const sections = places.flatMap((p) => sectionsFor(p));
  if (!sections.length) return null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6 empty:hidden" data-testid="hub-sections">
      {sections.map((s) => {
        const Section = s.component;
        // Abschnitte, die gerade nichts zeigen, nehmen keinen Abstand ein (`:empty`).
        return (
          <div key={s.id} data-section={s.id} className="empty:hidden">
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
    markNavStart();
    if (entry.start) entry.start(api);
    else if (entry.route) go(entry.route);
  };
  return <Row icon={entry.icon} title={t(entry.label)} sub={entry.sub ? t(entry.sub) : undefined} onClick={open} testId={entry.id} />;
}

/** Einstiege eines Platzes (optional einer Gruppe) als eine Liste mit Überschrift. */
export function EntryList({ place, group, title }: { place: Place; group?: string; title?: MessageKey }) {
  const { t } = useT();
  const entries = entriesFor(place, group);
  if (!entries.length) return null;
  return (
    <RowList title={title ? t(title) : undefined} testId={`entries-${place}`}>
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} />
      ))}
    </RowList>
  );
}
