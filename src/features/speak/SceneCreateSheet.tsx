import { useState } from 'react';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { useAsk } from '../../ai/useAsk';
import { aiSceneId } from '../../domain/speak/sceneDoc';
import type { SceneView } from '../../domain/speak/types';
import { sceneGen, SG_WISH_MAX } from '../../prompts/sceneGen';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { createSceneDoc } from './persist';
import { dueWords, weakestTopic, workContext } from './useSceneLibrary';

// „Neue Szene“ (Plan §5.1, Kap. 2.5 kombinierte Aufgaben): Wunsch (≤ 200 Zeichen), optional
// Grammatik-Fokus (schwächstes Thema) und fällige Wörter. Während der Anfrage: Skelett,
// „Denkt nach …“ und Stopp. Erfolg → `scene/sc-ai<ms36>` (nur anlegen, wenn frei).

export function SceneCreateSheet({ open, onClose, scenes, onCreated }: { open: boolean; onClose: () => void; scenes: readonly SceneView[]; onCreated: (id: string) => void }) {
  const { t, lang } = useT();
  const ask = useAsk(sceneGen);
  const [wish, setWish] = useState('');
  const [useFocus, setUseFocus] = useState(true);
  const [useWords, setUseWords] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const running = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';

  const submit = async () => {
    setSaveFailed(false);
    const now = useClock.getState().now;
    const topic = useFocus ? weakestTopic(lang) : null;
    const words = useWords ? dueWords(now) : [];
    const out = await ask.run({ ctx: workContext(), level: 'C1', wish, grammar: topic?.titleEn ?? null, words, existingTitles: scenes.map((s) => s.titleEn) });
    if (!out) return;
    const t0 = Date.now();
    const id = aiSceneId(t0);
    const ok = await createSceneDoc(id, { ...out, id, ts: t0, src: 'ai', pv: `${sceneGen.id}@${sceneGen.version}`, ...(topic ? { gram: topic.id } : {}), ...(words.length ? { words } : {}) });
    if (!ok) {
      setSaveFailed(true);
      return;
    }
    setWish('');
    onCreated(id);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('spCreate')} closeLabel={t('close')}>
      <div className="flex flex-col gap-4 pt-1 pb-4" data-testid="scene-create-sheet">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{t('spCreateWish')}</span>
          <textarea
            value={wish}
            maxLength={SG_WISH_MAX}
            rows={3}
            onChange={(e) => setWish(e.target.value)}
            disabled={running}
            data-testid="scene-create-wish"
            className="resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
          />
        </label>
        <Switch checked={useFocus} onChange={setUseFocus} disabled={running} label={t('spCreateFocus')} />
        <Switch checked={useWords} onChange={setUseWords} disabled={running} label={t('spCreateWords')} />
        {running && (
          <div role="status" className="flex flex-col gap-2" data-testid="scene-create-running">
            <p className="text-sm text-muted">{ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}</p>
            <Skeleton className="h-20 w-full" />
            <div>
              <Button icon="stop" onClick={ask.stop}>
                {t('aiStop')}
              </Button>
            </div>
          </div>
        )}
        {ask.error && !running && (
          <p role="alert" className="text-sm text-danger-text">
            {t(ask.error)}
          </p>
        )}
        {saveFailed && (
          <p role="alert" className="text-sm text-danger-text">
            {t('saveFailed')}
          </p>
        )}
        {!running && (
          <Button variant="primary" size="lg" icon="sparkle" onClick={() => void submit()} data-testid="scene-create-submit" data-ai="">
            {ask.error ? t('aiRetry') : t('spCreateSubmit')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
