import type { ReactNode } from 'react';
import type { Channel } from './Card';
import { Eyebrow } from './Eyebrow';
import { Icon, type IconName } from './Icon';

// Zeilenlisten (Prototyp v1 `.card.list` + `.row`): eine Fläche, Zeilen mit feiner Trennlinie,
// Symbol in Kanalfarbe links, Titel fett, Unterzeile grau, rechts Zahl oder Chevron.
// Kein `layout`/`layoutId` (G7), lange Listen mit `content-visibility:auto` je Zeile.

type RowListProps = {
  children: ReactNode;
  /** Überschrift über der Liste (Eyebrow). */
  title?: ReactNode;
  titleMeta?: ReactNode;
  testId?: string;
  className?: string;
  /** Beschriftung der Liste für Vorleseprogramme (sonst der Titel, wenn Text). */
  label?: string;
};

export function RowList({ children, title, titleMeta, testId, className, label }: RowListProps) {
  const aria = label ?? (typeof title === 'string' ? title : undefined);
  return (
    <section className={`flex flex-col gap-2.5 ${className ?? ''}`} aria-label={aria} data-testid={testId}>
      {title !== undefined && <Eyebrow meta={titleMeta}>{title}</Eyebrow>}
      <ul className="lx-card m-0 flex list-none flex-col px-3.5 py-1">{children}</ul>
    </section>
  );
}

type RowProps = {
  title: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  /** Kanalfarbe des Symbols (Kap. 8: Farbe auf Symbolen, nicht als Fläche). */
  channel?: Channel;
  /** Rechts: Zahl oder kurzer Zustand („neu“, „morgen“); ohne Angabe bei Tipp-Zeilen ein Chevron. */
  value?: ReactNode;
  onClick?: () => void;
  testId?: string;
  /** Zusätzliche Daten-Attribute für Tests (z. B. `{ 'data-deck': 'job' }`). */
  data?: Record<`data-${string}`, string | number | undefined>;
  /** Zeile ist erledigt/deaktiviert (Zustand, kein Knopf; Kap. 2.2). */
  disabled?: boolean;
  /** Chevron auch neben einem Wert zeigen. */
  chevron?: boolean;
};

export function Row({ title, sub, icon, channel, value, onClick, testId, data, disabled, chevron }: RowProps) {
  const inner = (
    <>
      {icon && (
        <span className="inline-flex size-[2.375rem] flex-none items-center justify-center rounded-[0.6875rem] bg-surface-strong" style={channel ? { color: `var(--lx-ch-${channel})` } : undefined}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        {sub && <span className="text-[0.84375rem] leading-snug text-muted">{sub}</span>}
      </span>
      {value !== undefined && value !== null && <span className="lx-tnum flex-none text-sm text-muted">{value}</span>}
      {onClick && (chevron ?? (value === undefined || value === null)) && <Icon name="chevronRight" size={18} className="flex-none text-subtle" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-1 py-3.5 text-left';
  return (
    <li className="border-t border-line [content-visibility:auto] [contain-intrinsic-size:auto_3.5rem] first:border-t-0">
      {onClick ? (
        <button type="button" onClick={onClick} disabled={disabled} className={`${cls} rounded-[var(--radius-control)] transition-colors hover:bg-surface disabled:opacity-60`} data-testid={testId} {...data}>
          {inner}
        </button>
      ) : (
        <div className={cls} data-testid={testId} {...data}>
          {inner}
        </div>
      )}
    </li>
  );
}
