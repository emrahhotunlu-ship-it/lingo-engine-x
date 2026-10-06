import { useRef, useState } from 'react';
import { useNav } from '../../app/nav';
import { maskOf } from '../../domain/answer/mask';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap } from '../../engine/KineticGap';
import { useT } from '../../i18n';
import { GAP } from '../../prompts/nb/p6/claudeDrill';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { ExerciseTop } from '../learn/ui';
import { useCompanionSee } from './seeing';
import { answerClaudeDrill, nextClaudeDrill, retryClaudeDrill, stopClaudeDrill, useClaudeDrill } from './drill';

// „Mach mir eine Übung dazu“ (N96): fünf Lückensätze aus dem Gespräch im Player. Die vier
// Pflichtfragen: Aufgabe (eine Zeile), Zweck (Titel = der geübte Punkt), was ich hatte / was richtig
// ist (Lücke + Lösung), warum (Satz von Claude, auch bei richtiger Antwort). Extra, ohne db.

export function ClaudeDrillScreen() {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const api = useHiddenInput();
  const s = useClaudeDrill();
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const item = s.phase === 'ready' ? s.items[s.pos] : undefined;
  const answered = item ? s.answers[s.pos] : undefined;
  const done = s.phase === 'ready' && s.pos >= s.items.length;
  const right = s.answers.filter((a) => a.ok).length;
  useCompanionSee({ area: 'drills', label: s.title || t('nbProfilDrillTitle'), phase: answered ? 'feedback' : 'question', detail: item ? `${item.sentence} (solution: ${answered ? item.answer : 'hidden'})` : undefined });

  const close = () => {
    stopClaudeDrill();
    back();
  };
  const check = () => {
    if (!item || answered) return;
    answerClaudeDrill(typedRef.current);
  };
  const next = () => {
    typedRef.current = '';
    setTyped('');
    nextClaudeDrill();
    if (s.pos + 1 < s.items.length) api.focusNow();
  };
  const [before, after] = item ? item.sentence.split(GAP) : ['', ''];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 sm:py-10" data-testid="claude-drill" data-phase={done ? 'done' : s.phase}>
      <ExerciseTop onClose={close} closeTestId="cd-close" progress={item ? { n: s.pos + 1, total: s.items.length } : null} ctx="extra" />
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('nbProfilDrillTitle')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{s.title || t('nbProfilDrillLoading')}</h1>
      </header>

      {s.phase === 'loading' && (
        <Card className="flex flex-col gap-3" role="status" aria-label={t('nbProfilDrillLoading')}>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </Card>
      )}

      {s.phase === 'error' && (
        <Card role="alert" className="flex flex-col gap-3" data-testid="cd-error">
          <p className="text-sm text-danger-text">{t(s.error ?? 'aiFailed')}</p>
          <div>
            <Button icon="refresh" onClick={retryClaudeDrill} data-testid="cd-retry" data-ai="">
              {t('aiRetry')}
            </Button>
          </div>
        </Card>
      )}

      {item && (
        <Card className="flex flex-col gap-5" data-testid="cd-item" data-n={s.pos + 1}>
          <p className="text-sm text-muted">{t('nbProfilDrillTask')}</p>
          <p className="lx-sentence" lang="en">
            {before}
            <KineticGap
              key={s.pos}
              label={t('nbProfilDrillGap')}
              maxLength={item.answer.length + 12}
              state={!answered ? 'input' : answered.ok ? 'correct' : 'wrong'}
              mask={answered ? undefined : maskOf(item.answer, { firstLetter: false })}
              shown={answered ? typed : null}
              onChange={(v) => {
                typedRef.current = v;
                setTyped(v);
              }}
              onEnter={() => (answered ? next() : check())}
            />
            {after}
          </p>
          {!answered && item.hint && (
            <p className="text-xs text-subtle" data-testid="cd-hint">
              {item.hint}
            </p>
          )}
          {answered && (
            <div className={`flex flex-col gap-1 border-l-4 pl-3 ${answered.ok ? 'border-ok' : 'border-[var(--lx-danger-text)]'}`} data-testid="cd-verdict" data-ok={answered.ok ? '1' : '0'}>
              <p className="text-sm font-semibold">{answered.ok ? t('nbProfilDrillRight') : t('nbProfilDrillWrong')}</p>
              <EnglishText text={`${before}${item.answer}${after}`} area="lookup" source="claude-drill" className="text-sm" />
              <p className="text-sm text-muted">{item.why}</p>
            </div>
          )}
          <div className="flex justify-end">
            {answered ? (
              <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="cd-next">
                {t('nbShNext')}
              </Button>
            ) : (
              <Button variant="primary" onClick={check} data-testid="cd-check">
                {t('vtCheck')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {done && (
        <Card className="flex flex-col gap-4" data-testid="cd-end">
          <p className="lx-tnum text-3xl font-semibold tracking-tight">{t('nbProfilDrillScore', { right, total: s.items.length })}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={close} data-testid="cd-done">
              {t('nbProfilDrillBack')}
            </Button>
            <Button onClick={retryClaudeDrill} data-testid="cd-again" data-ai="">
              {t('nbProfilDrillAgain')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
