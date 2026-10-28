import { useEffect, useRef, useState } from 'react';
import { useLive } from '../../data/live';
import { currentDevice, readDk, type DkOs } from '../../domain/dictation/dk';
import { useT, type MessageKey } from '../../i18n';
import { useSplitLayout } from '../../platform/input';
import { Button } from '../../ui/Button';
import { DictationProbe } from './DictationProbe';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.1; Nora G2 Soll 4): Zeile „Diktat am Laptop · Stand · Prüfen ›“ in
// Einstellungen › Diagnose, gestaltet wie die Diagnose-Zeilen. Nur am Laptop (mindestens 1024 px und Tastatur, `useSplitLayout`).
// Der Stand nennt das eigene Betriebssystem, das andere nur, wenn es dafür schon ein Ergebnis gibt. „Prüfen“ klappt die Probe an
// Ort und Stelle auf; geschlossen wird am Ende des Probe-Kastens.

const LABEL: Record<DkOs, MessageKey> = {
  mac: 'dkStatusMac',
  win: 'dkStatusWin',
};

export function DictationEntry() {
  const { t } = useT();
  const split = useSplitLayout();
  const raw = useLive((s) => s.docs['app/profile']?.dk);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closed = useRef(false);
  // Nach dem Schließen am Ende des Kastens geht der Fokus zurück auf „Prüfen“ (nie ins Leere).
  useEffect(() => {
    if (!open && closed.current) opener.current?.focus();
  }, [open]);
  if (!split) return null;
  const dk = readDk(raw);
  const own = currentDevice()?.os ?? null;
  const shown = (['mac', 'win'] as const).filter((os) => os === own || dk?.[os]);
  const word = (os: DkOs) => {
    const e = dk?.[os];
    return t(!e ? 'dkStatusNone' : e.ok ? 'dkStatusOk' : 'dkStatusFail');
  };
  return (
    <section className="flex flex-col gap-2" data-testid="dk-entry">
      <div className="flex items-center justify-between gap-4 border-b border-line py-1.5">
        <span className="text-sm text-muted">{t('dkEntryTitle')}</span>
        <span className="flex items-center gap-2">
          <span className="text-right text-sm font-medium" data-testid="dk-status">
            {shown.length === 0
              ? t('dkStatusNone')
              : shown.map((os, i) => (
                  <span key={os} data-testid={`dk-status-${os}`} data-ok={dk?.[os] ? String(dk[os].ok) : ''}>
                    {i > 0 ? ' · ' : ''}
                    {shown.length === 1 && os === own ? word(os) : t('dkStatusOs', { os: t(LABEL[os]), state: word(os) })}
                  </span>
                ))}
          </span>
          {!open && (
            <Button ref={opener} variant="ghost" iconAfter="chevronRight" onClick={() => setOpen(true)} aria-expanded={false} data-testid="dk-open">
              {t('dkEntryOpen')}
            </Button>
          )}
        </span>
      </div>
      {open && (
        <DictationProbe
          onClose={() => {
            closed.current = true;
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}
