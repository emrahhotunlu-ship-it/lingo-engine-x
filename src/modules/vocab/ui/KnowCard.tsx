import { ExerciseShell, ipaOf, useHiddenInput, useHotkeys, useT, type MessageKey } from '../sharedUi';
import { baseAnswer } from '../domain/flow';
import type { LearnRun, LearnView } from './learnRun';
import { HearButton, speakNewOn, useAutoSpeak } from './hear';

// Politur P2 (Emrah 13.11.2026, E3; Prüfbericht S5): Vorkarte „Kennst du es schon?“ vor der Einführung eines neuen Einzelworts. Sie zeigt nur
// das Wort (mit Ton, Lautschrift und Wortart), nie die Bedeutung. „Ja, prüf mich“ → die Probe (Bedeutung ohne Hilfe; richtig → Stufe 3,
// Kontrolle in 7 Tagen), „Nein, neu“ → die Einführungskarte. Ein Weg statt des alten Knopfs „Kenne ich schon“ auf der Einführung.
// Pflichtfragen an fester Stelle (Kap. 2 Nr. 4): Was tun (Aufgabe), wozu (offen darüber), was richtig ist und warum zeigt die Probe danach.

type CardView = Extract<LearnView, { k: 'card' }>;

export function KnowCard({ view, run }: { view: CardView; run: LearnRun }) {
  const { t } = useT();
  const api = useHiddenInput();
  const card = view.card;
  const word = baseAnswer(card.head);
  const ipa = ipaOf(card.head);
  const pos = card.pos ? t(`pos_${card.pos}` as MessageKey) : null;
  const line = [ipa ? `/${ipa.replace(/^\/|\/$/g, '')}/` : null, pos].filter((x): x is string => !!x).join(' · ');
  const auto = run.autoAudio() && speakNewOn();
  // Derselbe Schlüssel wie die Einführung: liest die Vorkarte das Wort, liest die Einführung danach Wort und Satz (anderer Text, eigener Schlüssel).
  useAutoSpeak(word, auto, `know|${card.path}|${run.dayOf()}`);
  const no = () => {
    run.knowNo();
    api.blur();
  };
  const yes = () => {
    run.probe();
    api.focusNow();
  };
  useHotkeys({ enter: no }, api.isInput);
  const prompt = (
    <div className="lx-kintro" data-testid="vm-know">
      <div className="lx-kintro-head">
        <h2 className="lx-kword" lang="en" data-testid="vm-know-word">
          {card.head}
        </h2>
        <HearButton text={word} testId="vm-know-listen" label={t('vmHearWordLabel')} heard={auto} />
      </div>
      {line ? (
        <p className="lx-kintro-ipa" data-testid="vm-know-ipa">
          {line}
        </p>
      ) : null}
    </div>
  );
  return (
    <ExerciseShell
      meta={{ ex: 'vm:know', id: `know:${card.path}`, kind: 'word' }}
      status={{ area: 'words', state: null, kindLabel: t('vmKnowKind') }}
      task={{ text: t('vmKnowTask'), purpose: t('vmKnowWozu'), open: true }}
      prompt={prompt}
      answer={null}
      secondary={[{ id: 'skip', label: t('vmKnowYes'), onClick: yes, testId: 'vm-know-yes', variant: 'secondary' }]}
      primary={{ label: t('vmKnowNo'), onClick: no, testId: 'vm-know-no', arrow: true }}
      keysHint={null}
    />
  );
}
