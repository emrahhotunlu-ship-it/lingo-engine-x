import { useT } from '../../i18n';
import { Segmented } from '../../ui/Segmented';
import { useSettings, type Accent } from '../../app/settings';
import { changeAccent } from '../../app/actions';

/** Akzentfarbe (Relaunch P1 S1-TOK): Iris (Standard) oder Bernstein, gespeichert in `app/profile.theme.a` und lokal `lx:accent`. */
export function AccentPicker() {
  const { t } = useT();
  const accent = useSettings((s) => s.accent);
  const accents: ReadonlyArray<{ value: Accent; label: string }> = [
    { value: 'iris', label: t('themeAccentIris') },
    { value: 'amber', label: t('themeAccentAmber') },
  ];
  return (
    <>
      <p className="mt-2 text-sm font-medium">{t('themeAccent')}</p>
      <Segmented label={t('themeAccent')} value={accent} options={accents} testId="set-accent" onChange={(v) => void changeAccent(v)} />
    </>
  );
}
