import { Button, Choices, SpeakButton, useHotkeys, useT } from '../sharedUi';
import type { LearnRun, LearnView } from './learnRun';

// Großpaket WT (Emrah 10.11.2026): Wiedererkennen – die richtige Bedeutung aus vier wählen, zwei Karten nach der Einführung (echter Abruf,
// nicht Kurzzeitgedächtnis; learning-scientist WT1). Zählt nicht für den Plan (Form `choice`); danach folgen die getippten Abrufe (Schritt A, B).
// Pflichtfragen (Kap. 2 Nr. 4): Was tun (Aufgabe), wozu (Zeile „Wozu“), was hatte ich / was ist richtig (Auswahl + Urteil), warum (Satz, „… heißt …“).

/** Satz mit dem Wort fett (erste Fundstelle, Groß-/Kleinschreibung egal). */
function Marked({ text, word }: { text: string; word: string }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, i + word.length)}</b>
      {text.slice(i + word.length)}
    </>
  );
}

export function PickCard({ view, run }: { view: Extract<LearnView, { k: 'pick' }>; run: LearnRun }) {
  const { t } = useT();
  const done = view.chosen !== null;
  const ok = done && view.chosen === view.right;
  const wrongFrom = done && !ok && view.chosen !== null ? view.from[view.chosen] : null;
  useHotkeys({ enter: () => done && run.pickNext() }, () => false);
  return (
    <section className="lx-vm-pick flex flex-col gap-4" data-testid="vm-pick" data-state={done ? (ok ? 'ok' : 'wrong') : 'open'}>
      <div className="flex flex-col gap-1">
        <p className="lx-eyebrow m-0">{t('vmPickTask')}</p>
        <p className="m-0 text-sm text-muted">{t('vmPickWhy')}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className="m-0 text-3xl font-semibold" lang="en" data-testid="vm-pick-word">
          {view.head}
        </p>
        <SpeakButton text={view.head} testId="vm-pick-speak" />
      </div>
      {view.sentence && (
        <p className="m-0 text-base" lang="en" data-testid="vm-pick-sentence">
          <Marked text={view.sentence} word={view.head} />
        </p>
      )}
      <Choices options={view.options} chosen={view.chosen} correct={done ? view.right : null} revealed={done} onPick={(i) => run.pickChoose(i)} lang="de" label={t('vmPickLabel', { w: view.head })} testId="vm-pick-choices" />
      {done && (
        <div className="flex flex-col gap-1" role="status" data-testid="vm-pick-verdict">
          <p className="m-0 text-sm">{ok ? t('vmPickOk', { w: view.head, de: view.options[view.right] ?? '' }) : t('vmPickWrong', { w: view.head, de: view.options[view.right] ?? '' })}</p>
          {wrongFrom && view.chosen !== null && (
            <p className="m-0 text-sm text-muted" data-testid="vm-pick-other">
              {t('vmPickOther', { de: view.options[view.chosen] ?? '', w: wrongFrom })}
            </p>
          )}
          <p className="m-0 text-sm text-muted">{t('vmPickThen')}</p>
        </div>
      )}
      {done && (
        <Button variant="primary" onClick={() => run.pickNext()} data-testid="vm-pick-next">
          {t('vmPickNext')}
        </Button>
      )}
    </section>
  );
}
