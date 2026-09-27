import { useEffect } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { topPatterns } from '../../domain/patterns/patterns';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TrendLine } from './parts';
import { isRunning, maybeAutoPatterns, PATTERNS_MIN_MISTAKES, usePatternsRun } from './store';
import { usePatternData } from './usePatternData';

// „Dein Stand“ (Lernberatung 27.09., V3 + V8): eine Karte „Deine Deutsch-Fallen“ mit den drei
// wichtigsten Mustern und ihrem Verlauf, darunter der Wochenfokus in einer Zeile. Höchstens einmal
// je ISO-Woche werden die Muster hier automatisch neu erkannt (nur wenn es schon welche gibt).
// Ohne Muster und mit zu wenigen eigenen Fehlern: nichts.

export function PatternsStandCard() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const data = usePatternData();
  const phase = usePatternsRun((s) => s.phase);
  const doc = data.doc;

  useEffect(() => {
    if (data.status === 'ready') maybeAutoPatterns(doc, today);
  }, [data.status, doc, today]);

  const top = topPatterns(doc, today, 3);
  if (data.status !== 'ready' || (!top.length && data.mistakes.length < PATTERNS_MIN_MISTAKES)) return null;

  return (
    <Card channel="grammar" className="flex flex-col gap-3" data-testid="patterns-stand">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t('ptTitle')}</h2>
        {isRunning(phase) && (
          <span className="text-xs text-muted" role="status">
            {t('aiThinking')}
          </span>
        )}
      </div>
      {doc && top.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {top.map((p) => (
            <li key={p.id} className="flex flex-col" data-testid="patterns-stand-item" data-id={p.id}>
              <span className="text-sm font-medium">{lang === 'en' ? p.title_en : p.title_de}</span>
              <TrendLine doc={doc} id={p.id} today={today} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('ptLead')}</p>
      )}
      {data.focus.length > 0 && (
        <p className="text-sm" data-testid="patterns-stand-focus">
          <span className="font-medium">{t('ptStandLine', { list: data.focus.map((f) => (lang === 'en' ? f.en : f.de)).join(' · ') })}</span>
        </p>
      )}
      <div>
        <Button variant="secondary" icon={top.length ? 'arrowRight' : 'sparkle'} onClick={() => go({ name: 'patterns' })} data-testid="patterns-open">
          {top.length ? t('ptOpen') : t('ptRecognize')}
        </Button>
      </div>
    </Card>
  );
}
