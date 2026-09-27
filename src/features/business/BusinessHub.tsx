import { useNav, type Route } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { ChannelIcon } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { useCompanionSee } from '../companion/seeing';

// Business-Suite (Plan §5.5) als Abschnitt von „Sprechen" (UX-Beratung Nr. 7): drei kompakte
// Zeilen statt eines eigenen Zwischen-Hubs. Ohne KI sind Refiner und Coach mit Hinweis
// ausgegraut; der Baukasten bleibt voll nutzbar.

type Entry = { id: string; route: Route; icon: IconName; title: MessageKey; lead: MessageKey; ai: boolean };

const ENTRIES: Entry[] = [
  { id: 'mail', route: { name: 'mail' }, icon: 'copy', title: 'bizMail', lead: 'bizMailLead', ai: true },
  { id: 'playbook', route: { name: 'playbook' }, icon: 'cards', title: 'bizPlay', lead: 'bizPlayLead', ai: false },
  { id: 'pitch', route: { name: 'pitch' }, icon: 'chat', title: 'bizPitch', lead: 'bizPitchLead', ai: true },
];

export function BusinessSection() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  useCompanionSee({ area: 'business', label: t('bizTitle'), phase: 'idle' });
  return (
    <ul data-testid="biz-hub" className="flex flex-col divide-y divide-line" aria-label={t('bizTitle')}>
      {ENTRIES.map((e) => {
        const off = e.ai && !ai;
        return (
          <li key={e.id}>
            <button
              type="button"
              data-testid={`biz-${e.id}`}
              disabled={off}
              onClick={() => go(e.route)}
              className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ChannelIcon channel="business">
                <Icon name={e.icon} />
              </ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold">{t(e.title)}</span>
                <span className="text-sm text-muted">{off ? t('bizNoAi') : t(e.lead)}</span>
              </span>
              {!off && <Icon name="arrowRight" size={18} className="flex-none text-subtle" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
