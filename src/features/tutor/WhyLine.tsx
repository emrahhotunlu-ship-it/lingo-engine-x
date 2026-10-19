import { useState } from 'react';
import type { GrammarTask } from '../../domain/learn/types';
import { whyOf, type WhyFact } from '../../domain/tutor/policy';
import { useT } from '../../i18n';
import { computeLearnerNow, learnerNow } from './learnerLive';
import { taskMarkKey, useTutorSession } from './sessionStore';
import { whyText } from './whyText';

// „Warum diese Aufgabe?“ (Tutor-Engine v3 S2): ein ruhiger Knopf unter der Aufgabe; der Grund (ein Satz aus echten Belegen) wird erst beim Tippen
// gerechnet, nie vor dem Zeichnen. Hat die Runde die Aufgabe nach drei Fehlern gegen etwas Bekanntes getauscht (Rang 2), steht der Grund
// sichtbar als Statuszeile darüber („Kurz etwas Bekanntes, dann weiter.“) – dann ohne Knopf, damit nichts doppelt dasteht.

/** Statuszeile über der Aufgabe, nur nach dem Tausch (Rang 2). */
export function WinLine({ task }: { task: GrammarTask }) {
  const { t } = useT();
  const mark = useTutorSession((x) => x.marks[taskMarkKey(task)] ?? null);
  if (mark !== 'known') return null;
  return (
    <p className="m-0 text-sm text-muted" role="status" data-testid="tutor-win">
      {t('ttWin')}
    </p>
  );
}

/** Knopf „Warum diese Aufgabe?“ mit dem Grund (aufklappbar). */
export function WhyLine({ task }: { task: GrammarTask }) {
  const { t, lang } = useT();
  const mark = useTutorSession((x) => x.marks[taskMarkKey(task)] ?? null);
  const [fact, setFact] = useState<WhyFact | null>(null);
  if (mark === 'known') return null;
  const toggle = () => {
    if (fact) {
      setFact(null);
      return;
    }
    // Erst beim Tippen: das zuletzt fertige Modell, sonst einmal sofort rechnen (die Seite ist längst gezeichnet).
    const m = learnerNow() ?? computeLearnerNow();
    setFact(whyOf(task, m, mark));
  };
  return (
    <div className="flex flex-col gap-1" data-testid="why">
      <div>
        <button type="button" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline" aria-expanded={!!fact} data-testid="why-toggle" onClick={toggle}>
          {t(fact ? 'ttWhyHide' : 'ttWhyToggle')}
        </button>
      </div>
      {fact && (
        <p className="m-0 text-sm text-muted" data-testid="why-line" data-code={fact.code}>
          {whyText(fact, lang)}
        </p>
      )}
    </div>
  );
}
