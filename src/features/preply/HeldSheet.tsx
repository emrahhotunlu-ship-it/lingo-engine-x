import { useState } from 'react';
import { useClock } from '../../app/clock';
import { addDays } from '../../domain/date';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { markHeld, retryActivity } from './actions';

// „Stunde gehalten" bestätigen (Phase 5 §8.3, E5-17): Wann (Heute/Gestern) und wie lange
// (25/50/60 Min.). Danach ist die Karte Zustand, kein Knopf. Kein Rückgängig.

type Props = { open: boolean; ppId: string | null; defaultMinutes: number; onClose: () => void };

export function HeldSheet({ open, ppId, defaultMinutes, onClose }: Props) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const [minutes, setMinutes] = useState<'25' | '50' | '60'>(defaultMinutes === 25 ? '25' : defaultMinutes === 60 ? '60' : '50');
  const [busy, setBusy] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const day = when === 'today' ? today : addDays(today, -1);
    const r = await markHeld(ppId, { day, minutes: Number(minutes) });
    setBusy(false);
    if (r === 'ok' || r === 'already') {
      onClose();
      return;
    }
    if (r === 'profile_failed') {
      setProfileFailed(true);
      return;
    }
    toast(t('ppHeldFailed'), 'error');
  };

  const retry = async () => {
    setBusy(true);
    const ok = await retryActivity();
    setBusy(false);
    if (ok) {
      setProfileFailed(false);
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('ppHeld')} closeLabel={t('close')}>
      <div className="flex flex-col gap-5 pt-2" data-testid="pp-held-sheet">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t('ppWhen')}</p>
          <Segmented
            label={t('ppWhen')}
            value={when}
            onChange={setWhen}
            options={[
              { value: 'today', label: t('ppToday') },
              { value: 'yesterday', label: t('ppYesterday') },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t('ppHowLong')}</p>
          <Segmented
            label={t('ppHowLong')}
            value={minutes}
            onChange={setMinutes}
            options={[
              { value: '25', label: t('ppMin', { n: 25 }) },
              { value: '50', label: t('ppMin', { n: 50 }) },
              { value: '60', label: t('ppMin', { n: 60 }) },
            ]}
          />
        </div>
        {profileFailed ? (
          <div className="flex flex-col gap-2" role="alert">
            <p className="text-sm text-danger-text">{t('ppHeldProfileFailed')}</p>
            <Button variant="primary" onClick={() => void retry()} busy={busy} data-testid="pp-held-retry">
              {t('cmpSaveRetry')}
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="lg" onClick={() => void confirm()} busy={busy} data-testid="pp-held-confirm">
            {t('ppHeldConfirm')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
