import type { ReactNode } from 'react';
import { Icon } from './Icon';

// Link auf eine Originalquelle (Kap. 6.9, Plan §0.2/R5): ein echter <a> mit neuem Tab, kein
// Laden durch die App. Nur http(s); alles andere wird als Text gezeigt. Die Adresse steht
// zusätzlich markierbar darunter – falls der Rahmen von claude.ai neue Tabs blockiert.

const SAFE = /^https?:\/\//i;

export function ExternalLink({ href, children, showUrl = true }: { href: string | null; children: ReactNode; showUrl?: boolean }) {
  if (!href || !SAFE.test(href)) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="source-link"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] px-1 text-sm font-semibold text-cyan-text underline decoration-1 underline-offset-4 hover:decoration-2"
      >
        {children}
        <Icon name="arrowRight" size={16} />
      </a>
      {showUrl && (
        <p className="text-xs break-all text-subtle select-all" data-testid="source-url">
          {href}
        </p>
      )}
    </div>
  );
}
