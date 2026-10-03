import { useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Segmented';
import { useSettings, type Lang } from '../app/settings';
import { useClock } from '../app/clock';
import { saveProfile, useCoach } from '../coach/store';
import { bank } from '../bank/words';
import { getLog, subscribeLog } from '../platform/diagnostics';
import { DEFAULT_NEW_PER_DAY } from '../coach/types';

// Einstellungen: Sprache, Hell/Dunkel, neue Wörter pro Tag, KI-Anfragen heute, Quellen, Version.

type ThemeChoice = 'dark' | 'light' | 'auto';
const NEW_OPTIONS = ['5', '10', '15', '20'] as const;

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const today = useClock((s) => s.today);
  const newPerDay = useCoach((s) => s.profile?.newPerDay ?? DEFAULT_NEW_PER_DAY);
  const aiToday = useCoach((s) => s.days[today]?.ai ?? 0);
  const log = useSyncExternalStore(subscribeLog, getLog);
  const errors = log.filter((e) => e.level === 'error');

  const setLang = (l: Lang) => {
    useSettings.getState().setLangLocal(l);
    void saveProfile({ ui: { lang: l, theme: theme === 'dim' ? 'dark' : theme } });
  };
  const setTheme = (m: ThemeChoice) => {
    useSettings.getState().setThemeLocal(m);
    void saveProfile({ ui: { lang, theme: m } });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('cSettings')} closeLabel={t('cClose')}>
      <div className="space-y-6" data-testid="settings">
        <Segmented<Lang>
          label={t('cSetLang')}
          value={lang}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
          onChange={setLang}
          testId="set-lang"
        />
        <Segmented<ThemeChoice>
          label={t('cSetTheme')}
          value={theme === 'dim' ? 'dark' : theme}
          options={[
            { value: 'light', label: t('cThemeLight') },
            { value: 'dark', label: t('cThemeDark') },
            { value: 'auto', label: t('cThemeAuto') },
          ]}
          onChange={setTheme}
          testId="set-theme"
        />
        <Segmented<(typeof NEW_OPTIONS)[number]>
          label={t('cSetNew')}
          value={(NEW_OPTIONS as readonly string[]).includes(String(newPerDay)) ? (String(newPerDay) as (typeof NEW_OPTIONS)[number]) : '10'}
          options={NEW_OPTIONS.map((v) => ({ value: v, label: v }))}
          onChange={(v) => void saveProfile({ newPerDay: Number(v) })}
          testId="set-new"
        />
        <p className="text-sm text-muted" data-testid="ai-today">
          {t('cSetAi', { n: aiToday })}
        </p>
        <div>
          <h3 className="lx-eyebrow text-muted">{t('cSetSources')}</h3>
          <p className="mt-1 text-xs text-muted">{bank().source}</p>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-muted">
            {t('cSetLog')} ({errors.length})
          </summary>
          {errors.length === 0 ? (
            <p className="mt-2 text-xs text-muted">{t('cSetLogEmpty')}</p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-2xs text-muted">
              {errors.slice(-20).map((e, i) => (
                <li key={i}>
                  {new Date(e.t).toLocaleTimeString()} {e.scope}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </details>
        <p className="text-2xs text-subtle">{t('cSetVersion', { v: typeof __LX_BUILD__ === 'string' ? __LX_BUILD__ : 'dev' })}</p>
      </div>
    </Sheet>
  );
}
