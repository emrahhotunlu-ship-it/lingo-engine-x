import { useT } from '../../i18n';
import { Sheet } from '../../ui/Sheet';
import { ClinicFlow } from './SentenceClinic';
import { WorkProfile } from './WorkProfile';
import { WritingStudio } from './WritingStudio';
import { useClinicSheet } from './clinicStore';

// Die Blätter der Satz-Klinik (P46), des Berufsprofils (P46) und der Schreibwerkstatt (P47), eingehängt in der Shell wie `CheckHost`: Anwenden-Kachel, Wochenkarten
// auf Heute und Einstellungen öffnen dasselbe Blatt über `useClinicSheet`. Geschlossen ist nichts im Speicher: jedes Öffnen beginnt von vorn.

export function ClinicHost() {
  const { t } = useT();
  const open = useClinicSheet((s) => s.open);
  const profileOpen = useClinicSheet((s) => s.profileOpen);
  const writeOpen = useClinicSheet((s) => s.writeOpen);
  const close = useClinicSheet((s) => s.close);
  const closeProfile = useClinicSheet((s) => s.closeProfile);
  const closeWrite = useClinicSheet((s) => s.closeWrite);
  return (
    <>
      <Sheet open={open} onClose={close} title={t('ttClTitle')} closeLabel={t('ttClClose')}>
        {open && <ClinicFlow onClose={close} />}
      </Sheet>
      <Sheet open={profileOpen} onClose={closeProfile} title={t('ttWpTitle')} closeLabel={t('ttClClose')}>
        {profileOpen && <WorkProfile />}
      </Sheet>
      <Sheet open={writeOpen} onClose={closeWrite} title={t('ttWsTitle')} closeLabel={t('ttWsClose')} wide>
        {writeOpen && <WritingStudio onClose={closeWrite} />}
      </Sheet>
    </>
  );
}
