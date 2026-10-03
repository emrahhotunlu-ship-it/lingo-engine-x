import { motion } from 'framer-motion';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { dayKey, daysBetween } from '../../domain/date';
import type { SceneView } from '../../domain/speak/types';
import { Icon } from '../../ui/Icon';
import { DURATION } from '../../ui/motion';

// Szenenkarte (Plan §5.1): Titel in UI-Sprache, Gegenüber, Stufe, „noch nie“ / „zuletzt vor n
// Tagen“, Kante in Kanalfarbe Sprechen. Ein Tipp öffnet die Einweisung. Neubau (Leistung §3.2.8):
// keine Layout-Animation in Listen, nur die Tipp-Rückmeldung (Skalierung).

export function SceneCard({ scene, onOpen }: { scene: SceneView; onOpen: () => void }) {
  const { t, tn } = useT();
  const today = useClock((s) => s.today);
  const ago = scene.lastRun ? Math.max(0, daysBetween(dayKey(scene.lastRun), today)) : null;
  return (
    <motion.button
      type="button"
      data-testid="scene-card"
      data-scene={scene.id}
      data-src={scene.src}
      data-valid={scene.valid || undefined}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: DURATION.fast }}
      onClick={onOpen}
      className={`lx-glass flex w-full flex-col gap-2 rounded-[var(--radius-card)] p-5 text-left ${scene.valid ? '' : 'opacity-60'}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold leading-snug">{scene.title}</span>
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{scene.level}</span>
      </span>
      {scene.persona && (
        <span className="text-sm text-muted">
          {scene.persona.name} · {scene.persona.role}
          {scene.persona.org ? `, ${scene.persona.org}` : ''}
        </span>
      )}
      <span className="flex items-center gap-2 text-xs text-subtle">
        {scene.src === 'ai' && <Icon name="sparkle" size={14} />}
        {!scene.valid ? t('spIncomplete') : ago === null ? t('spNeverPlayed') : ago === 0 ? t('spPlayedToday') : tn('spLastPlayed', ago)}
      </span>
    </motion.button>
  );
}
