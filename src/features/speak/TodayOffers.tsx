import { motion } from 'framer-motion';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useSpeakToday } from './useTodayEntries';

// „Heute“: Sprechen und Business als Angebote (Plan §1 Nr. 6). Bis das Kanalregister aus Phase 2
// Sprechen als Pflicht einplant, zählen beide als Extra – sichtbar getrennt vom großen Knopf
// (Kap. 2.1, 2.6). Ein erledigtes Gespräch (≥ 4 Züge) ist Zustand, kein Knopf (Kap. 2.2); ein
// weiteres Gespräch ist ausdrücklich „Extra“.

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } } };

export function TodayOffers() {
  const { t, tn } = useT();
  const go = useNav((s) => s.go);
  const s = useSpeakToday();
  if (!s.loaded) return null;
  const row = 'lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left';
  return (
    <motion.section variants={item} aria-labelledby="td-offers" className="flex flex-col gap-2" data-testid="today-offers">
      <p id="td-offers" className="lx-eyebrow">
        {t('tdOffersTitle')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {s.done ? (
          <div className={row} data-testid="today-speak" data-state="done">
            <ChannelIcon channel="speak">
              <Icon name="check" />
            </ChannelIcon>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{t('spStatusDone')}</span>
              <span className="text-xs text-muted">{tn('tdTalks', s.talks)}</span>
            </span>
            <button type="button" onClick={() => go({ name: 'speak' })} className="min-h-11 rounded-full px-3 text-xs font-medium text-muted hover:bg-surface hover:text-fg" data-testid="today-speak-extra">
              {t('tdSpeakExtra')}
            </button>
          </div>
        ) : (
          <button type="button" className={row} onClick={() => go({ name: 'speak' })} data-testid="today-speak" data-state="open">
            <ChannelIcon channel="speak">
              <Icon name="chat" />
            </ChannelIcon>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{t('spTitle')}</span>
              <span className="text-xs text-muted">{s.talks > 0 ? tn('tdTalks', s.talks) : t('tdSpeakHint')}</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </button>
        )}
        <button type="button" className={row} onClick={() => go({ name: 'business' })} data-testid="today-business">
          <ChannelIcon channel="business">
            <Icon name="briefcase" />
          </ChannelIcon>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{t('bizTitle')}</span>
            <span className="text-xs text-muted">{s.biz > 0 ? tn('tdBizCount', s.biz) : t('tdBizHint')}</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </button>
      </div>
    </motion.section>
  );
}
