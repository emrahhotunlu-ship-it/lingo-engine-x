import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';

// Musterkarte (§4.3): Name, Formel-Chip, ein Beispiel. `compact` = zwei Zeilen (Name + Formel, Beispiel).
// Keine eigene Fläche mit Rahmen: sitzt als `.lx-inset` in der Übung (nie Karte in Karte).

type Props = {
  name: string;
  formula: string | null;
  example?: string | null;
  signals?: readonly string[] | null;
  compact?: boolean;
  area?: WordTapArea;
};

export function PatternCard({ name, formula, example = null, signals = null, compact = false, area = 'trainer' }: Props) {
  const { t } = useT();
  return (
    <section className="lx-inset lx-t-support flex flex-col gap-1" data-testid="pattern-card" data-compact={compact || undefined} aria-label={`${t('exLinePattern')}: ${name}`}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{name}</span>
        {formula && (
          <span className="rounded-full bg-hint-soft px-2.5 py-0.5 font-semibold text-hint-text" lang="en" data-testid="pattern-formula">
            {formula}
          </span>
        )}
      </p>
      {example && <EnglishText as="p" text={example} area={area} className="text-muted" />}
      {!compact && signals && signals.length > 0 && (
        <p className="lx-t-meta text-muted" lang="en" data-testid="pattern-signals">
          {signals.join(' · ')}
        </p>
      )}
    </section>
  );
}
