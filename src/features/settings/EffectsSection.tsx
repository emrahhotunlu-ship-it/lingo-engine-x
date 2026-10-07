import { effectiveLevel, FX_DEFAULT, FX_LEVELS, setFxPref, useFxState, type FxLevel } from '../../engine/fx/level';
import { useT, type MessageKey } from '../../i18n';
import { Segmented } from '../../ui/Segmented';

// Einstellungen: „Effekte“ (Lernplattform 3.0 P30). Qualitätsstufe je Gerät (Voll · Ruhig · Aus, `localStorage` `lx:fx`) und zwei Diagnosezeilen:
// welche Stufe gerade wirkt (und warum, falls sie von der Wahl abweicht) und die gemessene Bildrate. Reduzierte Bewegung am Gerät erzwingt „Aus“.

export function EffectsSection() {
  const { t, num } = useT();
  const st = useFxState();
  const level = effectiveLevel(st);
  const chosen: FxLevel = st.pref ?? FX_DEFAULT;
  const name = (l: FxLevel): string => t(`eeLevel_${l}` as MessageKey);
  const why = st.reduced ? t('eeReduced') : st.lowPower && chosen === 'full' ? t('eeSlow') : null;
  return (
    <section className="flex flex-col gap-3" data-testid="fx-section" data-level={level}>
      <h3 className="lx-eyebrow">{t('eeTitle')}</h3>
      <p className="m-0 text-sm text-muted">{t('eeHelp')}</p>
      <Segmented<FxLevel> label={t('eeLabel')} value={chosen} options={FX_LEVELS.map((l) => ({ value: l, label: name(l), testId: `fx-${l}` }))} onChange={(v) => setFxPref(v)} testId="fx-level" />
      <p className="m-0 text-xs text-subtle" data-testid="fx-now">
        {t('eeNow', { level: name(level) })}
      </p>
      {why && (
        <p className="m-0 text-xs text-subtle" data-testid="fx-why">
          {why}
        </p>
      )}
      <p className="m-0 text-xs text-subtle" data-testid="fx-frames">
        {st.frames ? t('eeFps', { fps: num(st.frames.fps), max: num(st.frames.maxMs) }) : t('eeFpsNone')}
      </p>
    </section>
  );
}
