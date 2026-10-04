import { useSettings } from '../../app/settings';
import { useT } from '../../i18n';
import { isPhoneDevice } from '../../platform/device';
import { Switch } from '../../ui/Switch';

// Handy-Modus (Emrah 01.10.2026): je Gerät, nur sichtbar, wo er wirkt (erkanntes Handy). Am Laptop
// gibt es nichts umzuschalten, dort gilt immer die volle Pflichtliste.

export function PhoneModeSection() {
  const { t } = useT();
  const on = useSettings((s) => s.phoneMode);
  if (!isPhoneDevice()) return null;
  return (
    <section className="flex flex-col gap-3" data-testid="phone-mode-section">
      <h3 className="lx-eyebrow">{t('nbHeutePhoneSetTitle')}</h3>
      <Switch checked={on} label={t('nbHeutePhoneSet')} testId="set-phone-mode" onChange={(v) => useSettings.getState().setPhoneModeLocal(v)} />
      <p className="text-xs text-subtle">{t('nbHeutePhoneSetNote')}</p>
    </section>
  );
}
