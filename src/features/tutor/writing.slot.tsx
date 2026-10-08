import { flags } from '../../app/flags';
import { useClock } from '../../app/clock';
import { registerSlot } from '../../app/slots';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { readC1 } from '../../domain/c1/c1doc';
import { readCtx2 } from '../../domain/tutor/ctx2';
import { mailOffered, mailSituations } from '../../domain/tutor/mail';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { useInputProfile } from '../../platform/input';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { markMailWeek, useClinicMarkers, useClinicSheet } from './clinicStore';

// Einhängepunkte der Schreibwerkstatt (Lernplattform 3.0 P47), alle hinter `flags.tutor.write` und nur mit Claude:
// - Anwenden: am Laptop die Zeile „Schreibwerkstatt“, am Handy NUR die Karte „Am Laptop schreiben“ (kein Editor, T-R10),
// - Heute (nach der Pflicht, unter „Extra“): am Laptop einmal je Woche EIN Vorschlag „Wochen-Mail schreiben“.
// Das Blatt selbst hängt in der Shell (`ClinicHost`).

function WriteRow() {
  const { t } = useT();
  const ai = useAiAvailable();
  const profile = useInputProfile();
  const show = useClinicSheet((s) => s.showWrite);
  if (!ai || !mailSituations().length) return null;
  if (profile === 'touch') {
    return (
      <section className="lx-glass flex items-start gap-3 rounded-[var(--radius-card)] px-4 py-3" aria-label={t('ttWsPhoneTitle')} data-testid="ws-phone-card">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-strong text-muted" aria-hidden="true">
          <Icon name="grammar" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{t('ttWsPhoneTitle')}</span>
          <span className="text-sm text-muted">{t('ttWsPhoneText')}</span>
        </span>
      </section>
    );
  }
  return (
    <section className="lx-glass dz-list flex flex-col overflow-hidden rounded-[var(--radius-card)]" aria-label={t('ttWsTileTitle')} data-testid="ws-tile-list">
      <button type="button" onClick={show} data-testid="hub-write" data-channel="write" className="dz-row flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-strong text-muted" aria-hidden="true">
          <Icon name="grammar" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{t('ttWsTileTitle')}</span>
          <span className="text-sm text-muted">{t('ttWsTileSub')}</span>
          <span className="lx-tnum text-xs text-subtle">{t('ttWsTileMeta')}</span>
        </span>
        <Icon name="chevronRight" size={18} className="flex-none text-subtle" />
      </button>
    </section>
  );
}

function WeekCard() {
  const { t } = useT();
  const ai = useAiAvailable();
  const db = useCapabilities((s) => s.db);
  const profile = useInputProfile();
  const today = useClock((s) => s.today);
  const live = useLive((s) => s.docs['app/profile']);
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const marks = useClinicMarkers();
  const show = useClinicSheet((s) => s.showWrite);
  if (!ai || db !== 'ready' || !live || profile === 'touch' || !mailSituations().length) return null;
  // Erst die Einrichtungskarte „Mein Arbeitsalltag“ (P46), nie zwei Karten auf einmal.
  if (!readCtx2(live) && !marks.ctx2Card) return null;
  if (!mailOffered({ today, prod: readC1(c1Raw).prod, done: marks.mailWeek })) return null;
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="tt-ws-card" data-testid="ws-card">
      <p className="lx-eyebrow">{t('ttWsCardEyebrow')}</p>
      <h2 id="tt-ws-card" className="lx-t-answer tracking-tight">
        {t('ttWsCardTitle')}
      </h2>
      <p className="text-sm text-muted">{t('ttWsCardText')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={show} data-testid="ws-card-start">
          {t('ttWsCardStart')}
        </Button>
        <Button variant="ghost" onClick={() => markMailWeek(today)} data-testid="ws-card-later">
          {t('ttWsCardLater')}
        </Button>
      </div>
    </section>
  );
}

const on = (): boolean => flags.tutor.write;
registerSlot({ slot: 'apply.tiles', order: 50, enabled: on, render: () => <WriteRow /> });
registerSlot({ slot: 'today.extra', order: 30, enabled: on, render: () => <WeekCard /> });
