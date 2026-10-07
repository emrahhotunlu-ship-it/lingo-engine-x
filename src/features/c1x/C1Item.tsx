import { useRef } from 'react';
import { ExerciseShell } from '../../ui/exercise';
import { useSharedTarget } from '../../engine/shared';
import { useT } from '../../i18n';
import { kindEntry } from './registry';
import { useC1Item, type C1ItemProps } from './useC1Item';
import type { C1KindEntry } from './types';

// Eine c1x-Aufgabe im Übungsgerüst (Lernplattform 3.0 P14). Wird von `GrammarItem` aufgerufen, wenn `task.c1` gesetzt ist, und von der Fehler-Wiederholung.
// Die Art kommt aus der Registry; ist sie nicht eingeschaltet (z. B. Schalter nach einem Fehlersatz wieder aus), zeigt der Rahmen einen ruhigen Hinweis.

export type { C1ItemProps } from './useC1Item';

function C1ItemBody({ entry, ...props }: C1ItemProps & { entry: C1KindEntry }) {
  const root = useRef<HTMLDivElement | null>(null);
  const shell = useC1Item(props, entry, root);
  const { ref: sharedRef, shared } = useSharedTarget<HTMLDivElement>('lx-hero');
  const { task } = props;
  return (
    <div
      ref={(el) => {
        root.current = el;
        sharedRef.current = el;
      }}
      tabIndex={-1}
      className="outline-none"
      data-testid="gr-item"
      data-c1x={task.c1.kind}
      data-type={task.type}
      data-topic={task.topic}
      data-src={task.src}
      data-pat={task.pat ? '1' : undefined}
      data-shared={shared ? '' : undefined}
      data-review={task.errorT !== null ? '' : undefined}
    >
      <ExerciseShell {...shell} />
    </div>
  );
}

export function C1Item(props: C1ItemProps) {
  const { t } = useT();
  const entry = kindEntry(props.task.c1.kind);
  if (!entry) {
    return (
      <p className="text-muted" role="status" data-testid="c1x-unavailable">
        {t('cxNotAvailable')}
      </p>
    );
  }
  return <C1ItemBody key={props.task.key} entry={entry} {...props} />;
}
