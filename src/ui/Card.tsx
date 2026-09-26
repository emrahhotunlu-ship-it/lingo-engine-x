import type { HTMLAttributes, ReactNode } from 'react';

export type Channel = 'cards' | 'grammar' | 'read' | 'listen' | 'write' | 'speak' | 'business' | 'discover';

type Props = HTMLAttributes<HTMLElement> & {
  /** Kanalfarbe als feine Kante links (Kap. 8: Farbe auf Kanten und Symbolen, nicht als Fläche). */
  channel?: Channel;
  as?: 'section' | 'div' | 'article';
  children: ReactNode;
};

export function Card({ channel, as: Tag = 'section', className, children, style, ...rest }: Props) {
  const edge = channel ? { boxShadow: `inset 3px 0 0 0 var(--lx-ch-${channel}), var(--lx-shadow)` } : undefined;
  return (
    <Tag className={`lx-glass rounded-[var(--radius-card)] p-5 sm:p-6 ${className ?? ''}`} style={{ ...edge, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export function ChannelIcon({ channel, children }: { channel: Channel; children: ReactNode }) {
  return (
    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-surface" style={{ color: `var(--lx-ch-${channel})` }}>
      {children}
    </span>
  );
}
