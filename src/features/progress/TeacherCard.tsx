import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { CopyBox } from '../../ui/CopyBox';

// „Für deinen Lehrer“ (Lernplattform 3.0 P50, K-15): EINE Karte. Erste Zeile die Kapitel-Notiz („This month I'm working on …“), darunter der Wochentext aus
// einer festen Vorlage (ohne Claude, reiner Englischtext). Zum Kopieren; die Oberfläche selbst bleibt in der Sprache der App.

export function TeacherCard({ text }: { text: string }) {
  const { t } = useT();
  if (!text.trim()) return null;
  return (
    <Card channel="speak" className="flex flex-col gap-3" aria-labelledby="wk-teach-title" data-testid="wk-teacher">
      <div className="flex flex-col gap-1">
        <h2 id="wk-teach-title" className="m-0 text-lg font-semibold">
          {t('moWkTeachTitle')}
        </h2>
        <p className="m-0 text-sm text-muted">{t('moWkTeachLead')}</p>
      </div>
      <CopyBox text={text} label={t('moWkTeachLabel')} testId="wk-copy" copiedTestId="wk-copied" />
    </Card>
  );
}
