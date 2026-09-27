import { changeHaptic, useOptimistic } from '../../app/actions';
import { useLive } from '../../data/live';
import { normHaptic } from '../../domain/progress/settings';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { canVibrate, haptic, setHapticsEnabled } from '../../platform/haptics';
import { Switch } from '../../ui/Switch';

// Vibration beim Prüfen (Kap. 4.3): Standard an, abschaltbar. Geräte ohne `navigator.vibrate`
// (iPhone/Safari) bekommen einen Hinweis statt eines Schalters, der nichts bewirken würde.

export function HapticSection() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const saved = useLive((s) => s.docs['app/profile']?.haptic);
  const opt = useOptimistic((s) => s.haptic);
  if (db !== 'ready') return null;
  const on = normHaptic(typeof opt === 'boolean' ? opt : saved);
  return (
    <section className="flex flex-col gap-3" data-testid="haptic-section">
      <h3 className="lx-eyebrow">{t('setHapticTitle')}</h3>
      {canVibrate() ? (
        <Switch
          checked={on}
          label={t('setHaptic')}
          testId="set-haptic"
          onChange={(v) => {
            void changeHaptic(v);
            setHapticsEnabled(v);
            if (v) haptic('tap');
          }}
        />
      ) : (
        <p className="text-sm text-muted" data-testid="haptic-none">
          {t('setHapticNone')}
        </p>
      )}
    </section>
  );
}
