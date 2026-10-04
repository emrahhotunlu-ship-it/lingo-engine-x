import { useState } from 'react';
import { useNav } from '../../app/nav';
import { entriesFor, type EntryDef } from '../../app/registry';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import type { SceneView } from '../../domain/speak/types';
import { Row, RowList } from '../../ui/RowList';
import { Skeleton } from '../../ui/Skeleton';
import { TabTitle } from '../system/Chrome';
import { SceneBriefing } from './SceneBriefing';
import { SceneCard } from './SceneCard';
import { useSceneLibrary } from './useSceneLibrary';
import { useCompanionSee } from '../companion/seeing';

// Freiwilliges Extra „Sprechen“ (Umbau „Fokus Wörter und Grammatik“, 04.10.2026): nur Rollenspiel mit den
// festen Szenen und das Einwand-Training. Kein Reiter, zählt nie zu Pflicht, Serie oder Fortschritt.

/** Einstiege anderer Bereiche als Zeilen (synchroner Start im Klick, iPhone-Tastatur). */
function useEntryRows(entries: readonly EntryDef[]) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  return entries.map((e) => ({
    id: e.id,
    icon: e.icon,
    title: t(e.label),
    ...(e.sub ? { sub: t(e.sub) } : {}),
    run: () => {
      if (e.start) e.start(api);
      else if (e.route) go(e.route);
    },
  }));
}

export function SpeakHub() {
  const { t } = useT();
  const ai = useAiAvailable();
  const { scenes } = useSceneLibrary();
  const [openId, setOpenId] = useState<string | null>(null);
  useCompanionSee({ area: 'speak', label: t('spTitle'), phase: 'idle' });
  const open = scenes?.find((s: SceneView) => s.id === openId) ?? null;
  const ready = scenes?.filter((s) => s.valid && s.raw.src !== 'biz' && s.src !== 'ai') ?? [];
  const training = useEntryRows(entriesFor('speak', 'nb-speak'));

  return (
    <div data-testid="speak-hub" className="flex flex-col gap-5 py-6 sm:py-8">
      <TabTitle title={t('spTitle')} />
      {!ai && (
        <p data-testid="speak-noai" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {t('spNoAi')}
        </p>
      )}
      <section aria-labelledby="sp-scenes" className="flex flex-col gap-3" data-testid="speak-scenes">
        <h2 id="sp-scenes" className="lx-eyebrow">
          {t('spScenes')}
        </h2>
        {!scenes ? (
          <div className="grid gap-3 md:grid-cols-2" role="status" aria-label={t('loadingData')}>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ready.map((s) => (
              <SceneCard key={s.id} scene={s} onOpen={() => setOpenId(s.id)} />
            ))}
          </div>
        )}
      </section>
      {training.length > 0 && (
        <RowList title={t('spTraining')} testId="speak-training">
          {training.map((r) => (
            <Row key={r.id} testId={r.id} icon={r.icon} title={r.title} sub={r.sub} onClick={r.run} />
          ))}
        </RowList>
      )}
      <SceneBriefing scene={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
