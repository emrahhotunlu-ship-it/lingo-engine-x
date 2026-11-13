import { Choices, ExerciseShell, SpeakButton, useT } from '../sharedUi';
import type { LearnRun, LearnView } from './learnRun';

// Großpaket WT (Emrah 10.11.2026): Wiedererkennen – die richtige Bedeutung aus vier wählen, zwei Karten nach der Einführung (echter Abruf,
// nicht Kurzzeitgedächtnis; learning-scientist WT1). Zählt nicht für den Plan (Form `choice`); danach folgen die getippten Abrufe (Schritt A, B).
// Pflichtfragen (Kap. 2 Nr. 4): Was tun (Aufgabe), wozu (ⓘ), was hatte ich / was ist richtig (Auswahl + Urteil), warum (Satz, „… heißt …“).
// Gleiche Übungsfläche wie alle Karten (ExerciseShell, UX-Prüfung WT1: Kartenrahmen, Rückmeldekarte, Hauptknopf in voller Größe).
// Politur P2 (Prüfbericht S6): Ablenker aus eingeführten, ähnlichen Wörtern (domain/pick.ts), auch für Wendungen; falsch gewählt → „Weiter“
// zeigt die Einführung kurz noch einmal (learnRun.ts `pickNext`).

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Satz mit der Wortform fett (Fundstelle wie auf der Einführungskarte, z. B. „achieved“ für „to achieve“). */
function Marked({ text, mark }: { text: string; mark: string | null }) {
  const i = mark ? text.toLowerCase().indexOf(mark.toLowerCase()) : -1;
  if (!mark || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, i + mark.length)}</b>
      {text.slice(i + mark.length)}
    </>
  );
}

export function PickCard({ view, run }: { view: Extract<LearnView, { k: 'pick' }>; run: LearnRun }) {
  const { t } = useT();
  const done = view.chosen !== null;
  const ok = done && view.chosen === view.right;
  const right = view.options[view.right] ?? '';
  const other = done && !ok && view.chosen !== null ? view.from[view.chosen] : null;
  const prompt = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="m-0 text-3xl font-semibold" lang="en" data-testid="vm-pick-word">
          {view.head}
        </p>
        <SpeakButton text={view.head} testId="vm-pick-speak" />
      </div>
      {view.sentence && (
        <p className="m-0 text-base" lang="en" data-testid="vm-pick-sentence">
          <Marked text={view.sentence} mark={view.mark} />
        </p>
      )}
    </div>
  );
  const answer = <Choices options={view.options} chosen={view.chosen} correct={done ? view.right : null} revealed={done} onPick={(i) => run.pickChoose(i)} lang="de" label={t('vmPickLabel', { w: view.head })} testId="vm-pick-choices" />;
  const sub = [ok ? t('vmPickOk', { w: view.head, de: right }) : t('vmPickWrong', { w: view.head, de: right }), other && view.chosen !== null ? t('vmPickOther', { de: view.options[view.chosen] ?? '', w: other }) : null, t(ok ? 'vmPickThen' : 'vmPickAgain')]
    .filter((x): x is string => !!x)
    .join(' ');
  return (
    <div data-testid="vm-pick" data-state={done ? (ok ? 'ok' : 'wrong') : 'open'}>
      <ExerciseShell
        meta={{ ex: 'vm:pick', id: `pick:${view.path}`, kind: 'word' }}
        status={{ area: 'words', state: null, kindLabel: t('vmPickKind') }}
        task={{ text: t('vmPickTask'), purpose: t('vmPickWhy'), open: false }}
        prompt={prompt}
        answer={answer}
        primary={{ label: t('vmPickNext'), onClick: () => run.pickNext(), testId: 'vm-pick-next', disabled: !done, arrow: true }}
        feedback={done ? { verdict: ok ? 'ok' : 'wrong', title: ok ? t('vmPickOkTitle') : t('vmPickWrongTitle'), sub, depth: 'min', choice: { you: view.chosen !== null ? (LETTERS[view.chosen] ?? null) : null, right: LETTERS[view.right] ?? 'A', text: right } } : null}
        keysHint={null}
        choiceCount={view.options.length}
      />
    </div>
  );
}
