import { useLive } from '../../data/live';
import { repairStats } from '../../domain/repair/daily';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';

// „Dein Stand" (Lernberatung V2): eine Zeile „Reparatur-Sätze: X offen, Y sicher". Ohne Einträge nichts.

export function RepairStandLine() {
  const { t } = useT();
  const doc = useLive((s) => s.docs['app/repair']);
  const { open, safe } = repairStats(doc);
  if (!open && !safe) return null;
  return (
    <p className="flex items-center gap-2 px-1 text-sm text-muted" data-testid="repair-stand">
      <Icon name="refresh" size={14} />
      <span className="lx-tnum">{t('rxStand', { open, safe })}</span>
    </p>
  );
}
