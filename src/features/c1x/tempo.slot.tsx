import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { startTempo, useTempoAvailable, useTempoStats } from './TempoRound';

// Anwenden: Kachel „Tempo“ (Lernplattform 3.0 P24). Freiwillig, nie Pflicht. Sie erscheint nur, wenn genug sichere Muster mit passenden Aufgaben da sind
// (kein toter Knopf). Die Runde wird im Tipp-Ereignis gebaut, damit am iPhone die Tastatur gleich aufgeht.

function TempoTile() {
  const { t } = useT();
  const api = useHiddenInput();
  const available = useTempoAvailable();
  const stats = useTempoStats();
  if (!available) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="ap-tempo" data-testid="apply-tempo">
      <h2 id="ap-tempo" className="lx-eyebrow">
        {t('cxTempoTitle')}
      </h2>
      <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => startTempo(api, stats?.slow)}
          data-testid="hub-tempo"
          className="lx-glass flex h-full min-h-36 w-full flex-col items-start gap-1.5 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong"
        >
          <ChannelIcon channel="grammar">
            <Icon name="bolt" />
          </ChannelIcon>
          <span className="font-medium">{t('cxTempoTitle')}</span>
          <span className="text-xs text-muted">{t('cxTempoTileSub')}</span>
          <span className="lx-tnum mt-auto text-xs font-medium text-subtle">{t('cxTempoTileMeta')}</span>
        </button>
      </div>
    </section>
  );
}

registerSlot({ slot: 'apply.tiles', order: 40, enabled: () => flags.tempo, render: () => <TempoTile /> });
