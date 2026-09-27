import { motion } from 'framer-motion';
import { useNav, type Route } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { IconButton } from '../../ui/Button';
import { ChannelIcon } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';

// Business-Suite (Plan §5.5): drei Karten in Kanalfarbe Business. Ohne KI sind Refiner und
// Coach mit Hinweis ausgegraut; der Baukasten bleibt voll nutzbar.

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } } };

type Entry = { id: string; route: Route; icon: IconName; title: MessageKey; lead: MessageKey; ai: boolean };

const ENTRIES: Entry[] = [
  { id: 'mail', route: { name: 'mail' }, icon: 'copy', title: 'bizMail', lead: 'bizMailLead', ai: true },
  { id: 'playbook', route: { name: 'playbook' }, icon: 'cards', title: 'bizPlay', lead: 'bizPlayLead', ai: false },
  { id: 'pitch', route: { name: 'pitch' }, icon: 'chat', title: 'bizPitch', lead: 'bizPitchLead', ai: true },
];

export function BusinessHub() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  useCompanionSee({ area: 'business', label: t('bizTitle'), phase: 'idle' });
  return (
    <motion.div data-testid="biz-hub" className="flex flex-col gap-6 py-6 sm:py-8" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item} className="flex items-start gap-2">
        <IconButton icon="arrowLeft" label={t('spBack')} onClick={() => go({ name: 'today' })} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('bizTitle')}</h1>
          <p className="text-sm text-muted">{t('bizLead')}</p>
        </div>
      </motion.header>
      <div className="grid gap-3 md:grid-cols-3">
        {ENTRIES.map((e) => {
          const off = e.ai && !ai;
          return (
            <motion.button
              key={e.id}
              type="button"
              variants={item}
              data-testid={`biz-${e.id}`}
              disabled={off}
              onClick={() => go(e.route)}
              className="lx-glass flex flex-col items-start gap-3 rounded-[var(--radius-card)] p-5 text-left disabled:cursor-not-allowed disabled:opacity-60"
              style={{ boxShadow: 'inset 3px 0 0 0 var(--lx-ch-business), var(--lx-shadow)' }}
            >
              <ChannelIcon channel="business">
                <Icon name={e.icon} />
              </ChannelIcon>
              <span className="text-base font-semibold">{t(e.title)}</span>
              <span className="text-sm text-muted">{off ? t('bizNoAi') : t(e.lead)}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
