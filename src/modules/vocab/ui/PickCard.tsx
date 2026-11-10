import { Button, Choices, SpeakButton, useHotkeys, useT } from '../sharedUi';
import type { LearnRun, LearnView } from './learnRun';

// Großpaket WT (Emrah 10.11.2026): Wiedererkennen gleich nach der Einführung – die richtige Bedeutung aus vier wählen.
// Zählt nicht für den Plan (Form `choice`); danach folgen wie bisher die getippten Abrufe (Schritt A und B).

export function PickCard({ view, run }: { view: Extract<LearnView, { k: 'pick' }>; run: LearnRun }) {
  const { t } = useT();
  const done = view.chosen !== null;
  const ok = done && view.chosen === view.right;
  useHotkeys({ enter: () => done && run.pickNext() }, () => false);
  return (
    <section className="lx-vm-pick flex flex-col gap-4" data-testid="vm-pick" data-state={done ? (ok ? 'ok' : 'wrong') : 'open'}>
      <p className="lx-eyebrow m-0">{t('vmPickTask')}</p>
      <div className="flex items-center gap-2">
        <p className="m-0 text-3xl font-semibold" lang="en" data-testid="vm-pick-word">
          {view.head}
        </p>
        <SpeakButton text={view.head} testId="vm-pick-speak" />
      </div>
      <Choices options={view.options} chosen={view.chosen} correct={done ? view.right : null} revealed={done} onPick={(i) => run.pickChoose(i)} lang="de" label={t('vmPickLabel', { w: view.head })} testId="vm-pick-choices" />
      {done && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="vm-pick-verdict">
          {ok ? t('vmPickOk') : t('vmPickWrong', { de: view.options[view.right] ?? '' })}
        </p>
      )}
      {done && (
        <Button variant="primary" onClick={() => run.pickNext()} data-testid="vm-pick-next">
          {t('vmPickNext')}
        </Button>
      )}
    </section>
  );
}
