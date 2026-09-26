import { useT } from '../../i18n';
import type { Domain } from '../../domain/input/types';

// Statuszeile (Plan F25): Kanal · Niveau · Beruf/Alltag · „etwa N Min." – keine Sekunden,
// keine Punktestände. Eine Zeile, Tabellenziffern.

type Props = { channel: 'read' | 'listen' | 'write' | 'discover'; level: string | null; domain: Domain | null; minutes?: number | null; extra?: string | null };

export function StatusLine({ channel, level, domain, minutes, extra }: Props) {
  const { t } = useT();
  const parts = [t(`ch_${channel}`)];
  if (level) parts.push(level);
  if (domain) parts.push(t(domain === 'work' ? 'domain_work' : 'domain_life'));
  if (minutes) parts.push(t('inAbout', { n: minutes }));
  if (extra) parts.push(extra);
  return (
    <p className="lx-tnum text-xs font-medium text-muted" data-testid="unit-status">
      {parts.join(' · ')}
    </p>
  );
}
