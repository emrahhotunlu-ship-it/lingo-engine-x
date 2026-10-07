import { useState } from 'react';
import { useAsk } from '../../ai/useAsk';
import { useAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { openCompanion } from '../../features/companion/store';
import { useT } from '../../i18n';
import { explainAnswer, type ExplainAnswerVars } from '../../prompts/explainAnswer';
import { AiRunPanel, isBusy } from '../AiRunPanel';
import { Button } from '../Button';

// „Erklär mir meine Antwort“ (KI-Tutor-MVP): nur auf Tipp, nie automatisch. 3–5 Sätze von Claude in der
// Erklär-Karte, gekennzeichnet, mit Lade- und Fehlerzustand. Das Ergebnis liegt nur im Speicher (je Aufgabe,
// bis zum Neuladen), nichts wird gespeichert. „Weiter fragen“ öffnet den Begleiter mit der Aufgabe vorbefüllt.
// Tagesbremse: höchstens 20 Aufrufe je Tag und Gerät (src/ai/tutorBudget.ts).

const memo = new Map<string, { de: string; en: string }>();

export type TutorButtonProps = {
  /** Eindeutig je Aufgabe und Antwort; unter diesem Schlüssel hält die Karte die Erklärung im Speicher. */
  taskKey: string;
  vars: Omit<ExplainAnswerVars, 'uiLang'>;
};

export function TutorButton({ taskKey, vars }: TutorButtonProps) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(explainAnswer);
  const [text, setText] = useState<{ de: string; en: string } | null>(() => memo.get(taskKey) ?? null);
  const [limited, setLimited] = useState(false);
  if (!ai) return null;

  const go = async () => {
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    const r = await ask.run({ ...vars, uiLang: lang });
    if (r) {
      memo.set(taskKey, r);
      setText(r);
    }
  };
  const more = () =>
    openCompanion({
      tab: 'chat',
      text: t('ttQuestion', { task: vars.prompt, given: vars.given || '–', solution: vars.answer, pattern: vars.topic || '–' }),
    });

  const busy = isBusy(ask.phase);
  return (
    <div className="flex flex-col gap-2" data-testid="tutor" data-ai="">
      {text ? (
        <div className="lx-card flex flex-col gap-2 p-3" data-testid="tutor-text">
          <p className="lx-eyebrow m-0 text-subtle">{t('ttLabel')}</p>
          <p className="lx-t-body m-0" lang={lang}>
            {lang === 'de' ? text.de : text.en}
          </p>
          <p className="m-0 text-xs text-subtle" data-testid="tutor-mark">
            {t('ttMark')}
          </p>
          <div>
            <Button variant="ghost" icon="sparkle" onClick={more} data-testid="tutor-more">
              {t('ttMore')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!busy && !ask.error && (
            <Button variant="secondary" icon="sparkle" onClick={() => void go()} data-testid="tutor-ask">
              {t('ttAsk')}
            </Button>
          )}
          <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void go()} />
        </div>
      )}
      {limited && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="tutor-limit">
          {t('ttLimit')}
        </p>
      )}
    </div>
  );
}
