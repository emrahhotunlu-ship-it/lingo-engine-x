import { useT, type MessageKey } from '../../i18n';
import { Sheet } from '../../ui/Sheet';

// „Erinnerung im iPhone einrichten“ (Lernplattform 3.0 P53): die genauen Tipps in der App „Erinnerungen“, damit die tägliche Erinnerung direkt diese
// App öffnet. Nur eine Anleitung: die App stellt selbst keine Erinnerung und legt keinen Claude-Auftrag an. Dazu der Hinweis, dass „Zum Home-Bildschirm“
// ein Lesezeichen ist, keine Installation.

const STEPS: readonly MessageKey[] = ['moRgStep1', 'moRgStep2', 'moRgStep3', 'moRgStep4', 'moRgStep5', 'moRgStep6', 'moRgStep7'];

export function ReminderGuide({ open, onClose, time }: { open: boolean; onClose: () => void; time: string | null }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('moRgTitle')} closeLabel={t('moRgClose')}>
      <div className="flex flex-col gap-5 pt-1" data-testid="reminder-guide">
        <p className="m-0 text-sm text-muted">{t('moRgLead')}</p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0" data-testid="reminder-steps">
          {STEPS.map((key, i) => (
            <li key={key} className="flex items-start gap-3" data-testid="reminder-step">
              <span className="lx-tnum flex size-7 flex-none items-center justify-center rounded-full bg-surface-strong text-sm font-semibold text-fg" aria-hidden="true">
                {i + 1}
              </span>
              <span className="pt-0.5 text-base">{key === 'moRgStep5' && time ? t('moRgStep5Time', { time }) : t(key)}</span>
            </li>
          ))}
        </ol>
        <section className="lx-glass flex flex-col gap-1.5 rounded-[var(--radius-card)] p-4" data-testid="reminder-home">
          <h3 className="lx-eyebrow m-0">{t('moRgHomeTitle')}</h3>
          <p className="m-0 text-sm text-muted">{t('moRgHome')}</p>
        </section>
      </div>
    </Sheet>
  );
}
