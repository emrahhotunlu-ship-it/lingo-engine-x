import { useT } from '../../i18n';
import { Sheet } from '../../ui/Sheet';
import { ClinicFlow } from './SentenceClinic';
import { WorkProfile } from './WorkProfile';
import { useClinicSheet } from './clinicStore';

// Die Blätter der Satz-Klinik und des Berufsprofils (Lernplattform 3.0 P46), eingehängt in der Shell wie `CheckHost`: Anwenden-Kachel, Wochenkarte auf Heute
// und Einstellungen öffnen dasselbe Blatt über `useClinicSheet`. Geschlossen ist nichts im Speicher: jedes Öffnen beginnt von vorn.

export function ClinicHost() {
  const { t } = useT();
  const open = useClinicSheet((s) => s.open);
  const profileOpen = useClinicSheet((s) => s.profileOpen);
  const close = useClinicSheet((s) => s.close);
  const closeProfile = useClinicSheet((s) => s.closeProfile);
  return (
    <>
      <Sheet open={open} onClose={close} title={t('ttClTitle')} closeLabel={t('ttClClose')}>
        {open && <ClinicFlow onClose={close} />}
      </Sheet>
      <Sheet open={profileOpen} onClose={closeProfile} title={t('ttWpTitle')} closeLabel={t('ttClClose')}>
        {profileOpen && <WorkProfile />}
      </Sheet>
    </>
  );
}
