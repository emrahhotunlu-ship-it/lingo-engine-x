import { useState } from 'react';
import { useT } from '../../i18n';
import { getInputPref, setInputPref, type InputPref } from '../../platform/input';
import { Segmented } from '../../ui/Segmented';

// „Eingabe an diesem Gerät“ (Lernplattform 2.0 §4.1): Automatisch · Touch · Tastatur. Die Wahl liegt nur im
// Browser dieses Geräts (`lx:input`), nie in der Datenbank, und ändert nur die Form der Aufgaben, nie den Plan.

export function InputProfileSection() {
  const { t } = useT();
  const [pref, setPref] = useState<InputPref>(() => getInputPref());
  return (
    <section className="flex flex-col gap-3" data-testid="input-profile-section">
      <p className="text-sm font-medium">{t('exInputTitle')}</p>
      <Segmented<InputPref>
        label={t('exInputTitle')}
        value={pref}
        testId="set-input"
        options={[
          { value: 'auto', label: t('exInputAuto'), testId: 'set-input-auto' },
          { value: 'touch', label: t('exInputTouch'), testId: 'set-input-touch' },
          { value: 'keys', label: t('exInputKeys'), testId: 'set-input-keys' },
        ]}
        onChange={(v) => {
          setInputPref(v);
          setPref(v);
        }}
      />
      <p className="text-sm text-muted">{t('exInputHint')}</p>
    </section>
  );
}
