import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import type { SceneView } from '../../domain/speak/types';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { speak, unlockSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { clearResume, readResume } from './resume';
import { autoplayOn } from './autoplay';
import { AsPreplyLesson } from '../preply/AsPreplyLesson';

// Einweisung (Plan §5.2): Lage, Ziel, Gegenüber, hilfreiche Wendungen (antippbar, 🔊), großer
// Knopf „Gespräch starten“ – er schaltet die Sprachausgabe synchron in der Geste frei (iPhone)
// und liest die Eröffnung vor, wenn automatisches Vorlesen an ist (D10).

export function SceneBriefing({ scene, onClose }: { scene: SceneView | null; onClose: () => void }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  const today = useClock((s) => s.today);
  const copy = scene ? readResume(scene.id, today) : null;

  const start = (resume: boolean) => {
    if (!scene) return;
    unlockSpeech();
    if (!resume) {
      clearResume(scene.id);
      if (autoplayOn()) void speak(scene.opening);
    }
    onClose();
    go({ name: 'roleplay', sceneId: scene.id, resume });
  };

  return (
    <Sheet open={!!scene} onClose={onClose} title={scene?.title ?? ''} closeLabel={t('close')}>
      {scene && (
        <div data-testid="briefing" className="flex flex-col gap-5 pt-1 pb-4">
          {scene.persona && (
            <p className="text-sm text-muted">
              {t('spWith')} <span className="font-medium text-fg">{scene.persona.name}</span> · {scene.persona.role}
              {scene.persona.org ? `, ${scene.persona.org}` : ''} · {scene.level}
            </p>
          )}
          <section className="flex flex-col gap-1">
            <p className="lx-eyebrow">{t('spSituation')}</p>
            <p className="text-base leading-relaxed">{scene.situation}</p>
          </section>
          <section className="flex flex-col gap-1">
            <p className="lx-eyebrow">{t('spGoal')}</p>
            <p className="text-base font-medium leading-relaxed">{scene.goal}</p>
          </section>
          {scene.persona?.traits && (
            <section className="flex flex-col gap-1">
              <p className="lx-eyebrow">{t('spCounterpart')}</p>
              <p className="text-sm text-muted" lang="en">
                {scene.persona.traits}
              </p>
            </section>
          )}
          {scene.useful.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="lx-eyebrow">{t('spUseful')}</p>
              <ul className="flex flex-col gap-1">
                {scene.useful.map((u) => (
                  <li key={u.en} data-testid="useful-phrase" className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <EnglishText as="span" text={u.en} area="speak" source={`scene/${scene.id}`} title={scene.titleEn} className="font-medium" />
                      {lang === 'de' && u.de && <span className="block text-xs text-muted">{u.de}</span>}
                    </span>
                    <SpeakButton text={u.en} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!scene.valid ? (
            <p className="text-sm text-muted">{t('spIncompleteHint')}</p>
          ) : !ai ? (
            <p className="text-sm text-muted" data-testid="speak-noai">
              {t('spNoAi')}
            </p>
          ) : copy ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="primary" size="lg" icon="chat" onClick={() => start(true)} data-testid="rp-resume" data-ai="">
                {t('spResume')}
              </Button>
              <Button onClick={() => start(false)} data-testid="rp-restart" data-ai="">
                {t('spRestart')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => start(false)} data-testid="briefing-start" data-ai="">
              {t('spStart')}
            </Button>
          )}
          {/* M18: aus der Szene eine Preply-Stunde machen. */}
          <div>
            <AsPreplyLesson title={scene.title} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
