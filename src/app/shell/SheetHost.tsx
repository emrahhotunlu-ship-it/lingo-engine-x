import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { Row, RowList } from '../../ui/RowList';
import { Sheet } from '../../ui/Sheet';
import { SettingsSheet } from '../../features/settings/SettingsSheet';
import { useNav } from '../nav';
import { sheetOf } from '../registry';
import { closeSettings, closeSheet, isSheetOpen, openSheet, useSheets, type SheetId } from '../sheets';
import { EntryList, HubSections } from './Hub';
import { useInitial, useStreakCount } from './useStreak';

// Blatt-Host (docs/neubau/architektur.md §2.6, plan.md §1.2): Blätter aus dem Register, dazu das
// Einstellungsblatt und das Gerüst des Profil-Blatts. Den Inhalt des Profil-Blatts liefert P6 über
// den Platz `profile` (Abschnitte und Einstiege); der Rahmen hält Kopf (Initiale + Serie) und die
// beiden festen Zeilen „Dein Stand ›“ und „Einstellungen ›“ bereit. Registriert ein Bereich selbst
// ein Blatt `profile`, gilt dessen Fassung.

/** Das Profil-Blatt (Gerüst). */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tn } = useT();
  const initial = useInitial();
  const streak = useStreakCount();
  const go = useNav((s) => s.go);
  return (
    <Sheet open={open} onClose={onClose} title={t('nbShProfileTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-5 pt-1" data-testid="profile-sheet">
        <div className="flex items-center gap-3" data-testid="profile-head">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-strong text-lg font-semibold" aria-hidden="true">
            {initial ?? <Icon name="user" size={22} />}
          </span>
          {streak !== null && (
            <span className="lx-tnum text-base font-semibold" data-testid="profile-sheet-streak">
              {tn('tdStreak', streak)}
            </span>
          )}
        </div>
        <HubSections places={['profile']} />
        <EntryList place="profile" />
        <RowList testId="profile-rows">
          <Row
            icon="chart"
            title={t('nbShOverview')}
            sub={t('nbShOverviewSub')}
            onClick={() => {
              closeSheet('profile');
              go({ name: 'overview' });
            }}
            testId="profile-overview"
          />
          <Row
            icon="gear"
            title={t('nbShSettings')}
            sub={t('nbShSettingsSub')}
            onClick={() => {
              closeSheet('profile');
              openSheet('settings');
            }}
            testId="profile-settings"
          />
        </RowList>
      </div>
    </Sheet>
  );
}

const FRAME_SHEETS: ReadonlySet<SheetId> = new Set(['settings']);

/** Blätter aus dem Register (Stapel in `sheets.ts`); das Einstellungsblatt und das Profil-Gerüst hält der Rahmen. */
export function SheetHost() {
  const stack = useSheets((s) => s.stack);
  const profileOwn = sheetOf('profile');
  return (
    <>
      <SettingsSheet open={isSheetOpen(stack, 'settings')} onClose={closeSettings} />
      {!profileOwn && <ProfileSheet open={isSheetOpen(stack, 'profile')} onClose={() => closeSheet('profile')} />}
      {stack
        .filter((e) => !FRAME_SHEETS.has(e.id))
        .map((e) => {
          const def = sheetOf(e.id);
          if (!def) return null;
          const Comp = def.component;
          return <Comp key={e.id} params={e.params} onClose={() => closeSheet(e.id)} />;
        })}
    </>
  );
}
