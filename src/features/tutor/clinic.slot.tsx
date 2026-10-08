import { flags } from '../../app/flags';
import { useClock } from '../../app/clock';
import { registerSlot } from '../../app/slots';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { readC1 } from '../../domain/c1/c1doc';
import { clinicOffered } from '../../domain/tutor/clinic';
import { readCtx2 } from '../../domain/tutor/ctx2';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { useInputProfile } from '../../platform/input';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { markClinicWeek, markCtx2Card, useClinicMarkers, useClinicSheet } from './clinicStore';
import { WorkProfile } from './WorkProfile';

// Einhängepunkte der Satz-Klinik und des Berufsprofils (Lernplattform 3.0 P46), alle hinter `flags.tutor.clinic` und nur mit Claude:
// - Anwenden: die Zeile „Satz-Klinik“ (freiwillig, Handy und Laptop),
// - Heute (nach der Pflicht, unter „Extra“): einmal eine Karte „Damit Claude Sätze aus deinem Alltag baut“, danach einmal je Woche am Handy EIN Klinik-Satz als Vorschlag,
// - Einstellungen: der Abschnitt „Mein Arbeitsalltag“.
// Die Blätter selbst hängen in der Shell (`ClinicHost`).

function ClinicRow() {
  const { t } = useT();
  const ai = useAiAvailable();
  const show = useClinicSheet((s) => s.show);
  if (!ai) return null;
  return (
    <section className="lx-glass dz-list flex flex-col overflow-hidden rounded-[var(--radius-card)]" aria-label={t('ttClTileTitle')} data-testid="cl-tile-list">
      <button type="button" onClick={() => show()} data-testid="hub-clinic" data-channel="write" className="dz-row flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-strong text-muted" aria-hidden="true">
          <Icon name="sparkle" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{t('ttClTileTitle')}</span>
          <span className="text-sm text-muted">{t('ttClTileSub')}</span>
          <span className="lx-tnum text-xs text-subtle">{t('ttClTileMeta')}</span>
        </span>
        <Icon name="chevronRight" size={18} className="flex-none text-subtle" />
      </button>
    </section>
  );
}

function ProfileCard() {
  const { t } = useT();
  const showProfile = useClinicSheet((s) => s.showProfile);
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="tt-wp-card" data-testid="wp-card">
      <p className="lx-eyebrow">{t('ttWpTitle')}</p>
      <h2 id="tt-wp-card" className="lx-t-answer tracking-tight">
        {t('ttWpCardTitle')}
      </h2>
      <p className="text-sm text-muted">{t('ttWpCardText')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            markCtx2Card();
            showProfile();
          }}
          data-testid="wp-card-start"
        >
          {t('ttWpCardStart')}
        </Button>
        <Button variant="ghost" onClick={markCtx2Card} data-testid="wp-card-later">
          {t('ttWpCardLater')}
        </Button>
      </div>
    </section>
  );
}

function WeekCard() {
  const { t } = useT();
  const show = useClinicSheet((s) => s.show);
  const today = useClock((s) => s.today);
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="tt-cl-card" data-testid="cl-card">
      <p className="lx-eyebrow">{t('ttClCardEyebrow')}</p>
      <h2 id="tt-cl-card" className="lx-t-answer tracking-tight">
        {t('ttClCardTitle')}
      </h2>
      <p className="text-sm text-muted">{t('ttClCardText')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => show()} data-testid="cl-card-start">
          {t('ttClCardStart')}
        </Button>
        <Button variant="ghost" onClick={() => markClinicWeek(today)} data-testid="cl-card-later">
          {t('ttClCardLater')}
        </Button>
      </div>
    </section>
  );
}

/** Heute, unter „Extra“: erst die Einrichtungskarte (einmal), dann am Handy der Wochenvorschlag. */
function TodayCards() {
  const ai = useAiAvailable();
  const db = useCapabilities((s) => s.db);
  const profile = useInputProfile();
  const today = useClock((s) => s.today);
  const live = useLive((s) => s.docs['app/profile']);
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const marks = useClinicMarkers();
  if (!ai || db !== 'ready' || !live) return null;
  if (!readCtx2(live) && !marks.ctx2Card) return <ProfileCard />;
  if (profile !== 'touch') return null;
  if (!clinicOffered({ today, prod: readC1(c1Raw).prod, done: marks.week })) return null;
  return <WeekCard />;
}

function ProfileSection() {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai) return null;
  return (
    <section className="flex flex-col gap-3" data-testid="settings-work-profile">
      <h3 className="lx-eyebrow">{t('ttWpTitle')}</h3>
      <WorkProfile />
    </section>
  );
}

const on = (): boolean => flags.tutor.clinic;
registerSlot({ slot: 'apply.tiles', order: 40, enabled: on, render: () => <ClinicRow /> });
registerSlot({ slot: 'today.extra', order: 20, enabled: on, render: () => <TodayCards /> });
registerSlot({ slot: 'settings.sections', order: 60, enabled: on, render: () => <ProfileSection /> });
