import { useState } from 'react';
import { useLive } from '../../data/live';
import { readDk, type DkOs } from '../../domain/dictation/dk';
import { useT, type MessageKey } from '../../i18n';
import { useSplitLayout } from '../../platform/input';
import { Button } from '../../ui/Button';
import { DictationProbe } from './DictationProbe';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.1): Eintrag „Diktat am Laptop prüfen“ in Einstellungen › Diagnose.
// Nur am Laptop (mindestens 1024 px und Tastatur, `useSplitLayout`). Zeigt den gespeicherten Stand je Betriebssystem
// und klappt die Probe an Ort und Stelle auf (keine Kontextspalte nötig).

const OS: Array<[DkOs, MessageKey]> = [
  ['mac', 'dkStatusMac'],
  ['win', 'dkStatusWin'],
];

export function DictationEntry() {
  const { t } = useT();
  const split = useSplitLayout();
  const raw = useLive((s) => s.docs['app/profile']?.dk);
  const [open, setOpen] = useState(false);
  if (!split) return null;
  const dk = readDk(raw);
  return (
    <section className="flex flex-col gap-2 border-b border-line pb-3" data-testid="dk-entry">
      <h4 className="text-sm font-semibold">{t('dkEntryTitle')}</h4>
      <dl className="flex flex-col">
        {OS.map(([os, label]) => {
          const e = dk?.[os];
          return (
            <div key={os} className="flex items-baseline justify-between gap-4 py-1" data-testid={`dk-status-${os}`} data-ok={e ? String(e.ok) : ''}>
              <dt className="text-sm text-muted">{t(label)}</dt>
              <dd className="text-right text-sm font-medium">{t(!e ? 'dkStatusNone' : e.ok ? 'dkStatusOk' : 'dkStatusFail')}</dd>
            </div>
          );
        })}
      </dl>
      <div>
        <Button variant="quiet" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="dk-open">
          {t(open ? 'dkEntryClose' : 'dkEntryOpen')}
        </Button>
      </div>
      {open && <DictationProbe />}
    </section>
  );
}
