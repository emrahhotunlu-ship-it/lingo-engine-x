import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { openPreplyPrep } from './store';

// „Als Preply-Stunde" von überall (Funktionsabgleich M18): kleiner Knopf für die Menüs von Artikel,
// Text, Grammatikthema, Szene und Bericht (Phase 2–4, beim Zusammenführen einsetzen):
//   <AsPreplyLesson title={article.title} />
// Öffnet „Vorbereiten" mit dem Anlass-Chip „Zu: {Titel}"; erstellt wird erst auf „Plan erstellen".

export function AsPreplyLesson({ title }: { title: string }) {
  const { t } = useT();
  if (!title.trim()) return null;
  return (
    <Button variant="ghost" icon="book" onClick={() => openPreplyPrep({ title })} data-testid="as-preply">
      {t('cmpActPreply')}
    </Button>
  );
}
