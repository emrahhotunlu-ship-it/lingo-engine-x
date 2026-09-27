import { useT } from '../../i18n';
import { changeGoalMin, changeNewPerDay, changeSound, useOptimistic } from '../../app/actions';
import { useLive } from '../../data/live';
import { GOAL_MIN_OPTIONS, NEW_PER_DAY_OPTIONS, normGoalMin, normNewPerDay, normSound } from '../../domain/progress/settings';
import { useCapabilities } from '../../platform/capabilities';
import { playCue, setSoundEnabled, soundSupported, unlockSound } from '../../platform/sound';
import { Segmented } from '../../ui/Segmented';
import { Switch } from '../../ui/Switch';

// Einstellungen „Lernen" und „Ton" (Kap. 6.14, Plan §9): neue Wörter pro Tag (0/2/5/10),
// Tagesziel in Minuten (10–40), Töne an/aus (Standard aus). Optimistisch mit Rückrollen.

export function LearningSection() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const profile = useLive((s) => s.docs['app/profile']);
  const opt = useOptimistic();
  if (db !== 'ready') return null;
  const goal = normGoalMin(opt.goalMin ?? profile?.goalMin);
  const perDay = normNewPerDay(opt.newPerDay ?? profile?.newPerDay);
  return (
    <section className="flex flex-col gap-3" data-testid="learning-section">
      <h3 className="lx-eyebrow">{t('settingsLearning')}</h3>
      <p className="text-sm font-medium">{t('setNewPerDay')}</p>
      <Segmented
        label={t('setNewPerDay')}
        value={String(perDay)}
        columns={4}
        testId="set-newperday"
        options={NEW_PER_DAY_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        onChange={(v) => void changeNewPerDay(Number(v))}
      />
      <p className="mt-2 text-sm font-medium">{t('setGoalMin')}</p>
      <Segmented
        label={t('setGoalMin')}
        value={String(goal)}
        columns={6}
        testId="set-goalmin"
        options={GOAL_MIN_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        onChange={(v) => void changeGoalMin(Number(v))}
      />
      <p className="text-sm text-muted">{t('setGoalMinHint')}</p>
    </section>
  );
}

export function SoundSection() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const saved = useLive((s) => s.docs['app/profile']?.sound);
  const opt = useOptimistic((s) => s.sound);
  if (db !== 'ready') return null;
  const on = normSound(typeof opt === 'boolean' ? opt : saved);
  return (
    <section className="flex flex-col gap-3" data-testid="sound-section">
      <h3 className="lx-eyebrow">{t('setSoundTitle')}</h3>
      {soundSupported() ? (
        <Switch
          checked={on}
          label={t('setSound')}
          testId="set-sound"
          onChange={(v) => {
            void changeSound(v);
            // Sofort hörbar machen (Nutzergeste, iOS); die App übernimmt den Wert danach aus dem Profil.
            setSoundEnabled(v);
            if (v) {
              unlockSound();
              playCue('correct');
            }
          }}
        />
      ) : (
        <p className="text-sm text-muted">{t('setSoundNone')}</p>
      )}
    </section>
  );
}

export function SourcesSection() {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="lx-eyebrow">{t('sourcesTitle')}</h3>
      <p className="text-sm text-muted">{t('sourcesText')}</p>
    </section>
  );
}
