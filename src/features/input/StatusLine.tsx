import { useT } from '../../i18n';
import type { Domain } from '../../domain/input/types';

// Statuszeile (Plan F25): Niveau · Beruf/Alltag · „etwa N Min." – keine Sekunden,
// keine Punktestände. Eine Zeile, Tabellenziffern.

type Props = { channel: 'read' | 'listen' | 'write' | 'discover'; level: string | null; domain: Domain | null; minutes?: number | null; extra?: string | null };

export function StatusLine({ channel, level, domain, minutes, extra }: Props) {
  const { t } = useT();
  // Der Kanal steht schon im Titel darüber – nicht doppelt (UX-Beratung Nr. 12).
  const parts: string[] = [];
  if (level) parts.push(level);
  if (domain) parts.push(t(domain === 'work' ? 'domain_work' : 'domain_life'));
  if (minutes) parts.push(t('inAbout', { n: minutes }));
  if (extra) parts.push(extra);
  if (!parts.length) return null;
  return (
    <p className="lx-tnum text-xs font-medium text-muted" data-testid="unit-status" data-channel={channel}>
      {parts.join(' · ')}
    </p>
  );
}
