import { effectiveLevel, FX_DEFAULT, FX_LEVELS, setFxPref, useFxState, type FxLevel } from '../../engine/fx/level';
import { useT, type MessageKey } from '../../i18n';
import { Segmented } from '../../ui/Segmented';
import { setSoundVolume, soundSupported, soundVolume, type SoundVol } from '../../platform/sound';
import { useEffect, useRef, useState } from 'react';
import { MomentsDemo } from './MomentsDemo';

// Einstellungen: „Effekte“ (Lernplattform 3.0 P30). Qualitätsstufe je Gerät (Voll · Ruhig · Aus, `localStorage` `lx:fx`) und welche Stufe gerade
// wirkt (und warum, falls sie von der Wahl abweicht). Reduzierte Bewegung am Gerät erzwingt „Aus“. Die gemessene Bildrate steht seit der UX-Prüfung
// W7 in der Diagnose (`FxFramesLine`), nicht mehr zwischen den Wahlknöpfen.

export function FxFramesLine() {
  const { t, num } = useT();
  const st = useFxState();
  return (
    <p className="m-0 text-sm text-muted" data-testid="fx-frames">
      {st.frames ? t('eeFps', { fps: num(st.frames.fps), max: num(st.frames.maxMs) }) : t('eeFpsNone')}
    </p>
  );
}

export function EffectsSection() {
  const { t } = useT();
  const st = useFxState();
  const level = effectiveLevel(st);
  const chosen: FxLevel = st.pref ?? FX_DEFAULT;
  const name = (l: FxLevel): string => t(`eeLevel_${l}` as MessageKey);
  const [vol, setVol] = useState<SoundVol>(soundVolume);
  const [demo, setDemo] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  // UX-Prüfung W7: nach dem Öffnen die Bühne ins Bild holen, statt sie unter dem Knopf außerhalb der Sicht aufgehen zu lassen.
  useEffect(() => {
    if (demo) demoRef.current?.scrollIntoView({ block: 'start', behavior: level === 'off' ? 'auto' : 'smooth' });
  }, [demo, level]);
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
      {soundSupported() && (
        <div className="flex flex-col gap-2" data-testid="sound-volume-block">
          <Segmented<SoundVol>
            label={t('eeR6VolLabel')}
            value={vol}
            options={(['low', 'normal'] as const).map((v) => ({ value: v, label: t(`eeR6Vol_${v}` as MessageKey), testId: `sound-vol-${v}` }))}
            onChange={(v) => {
              setVol(v);
              setSoundVolume(v);
            }}
            testId="sound-volume"
          />
          <p className="m-0 text-xs text-subtle">{t('eeR6VolHelp')}</p>
        </div>
      )}
      <button
        type="button"
        className="inline-flex min-h-11 items-center self-start rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface"
        aria-expanded={demo}
        onClick={() => setDemo((d) => !d)}
        data-testid="moments-open"
      >
        {t('eeR6MomentsBtn')}
      </button>
      {demo && (
        <div ref={demoRef} className="scroll-mt-4">
          <MomentsDemo />
        </div>
      )}
    </section>
  );
}
