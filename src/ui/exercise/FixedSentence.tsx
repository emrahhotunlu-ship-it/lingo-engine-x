import type { ReactNode } from 'react';
import { alignWords } from '../../domain/answer/align';
import { useT } from '../../i18n';

// Der korrigierte Satz bei „Fehler finden“ (Emrahs Rückmeldung 7): „Richtig: ~~Used~~ Using the new scanner, …“.
// Das alte Wort steht durchgestrichen davor, das neue fett in Erfolgsfarbe (nie Farbe allein: Strich bzw. Fettdruck).

export function FixedSentence({ from, to, testId }: { from: string; to: string; testId: string }) {
  const { t } = useT();
  const ops = alignWords(from, to);
  const old = (w: string | undefined): ReactNode => (
    <span className="lx-diff-off" data-testid="fix-old">
      {w}
    </span>
  );
  const neu = (w: string | undefined): ReactNode => (
    <span className="lx-diff-sub" data-testid="fix-new">
      {w}
    </span>
  );
  const parts: ReactNode[] = ops.map((o, i) => {
    const sep = i > 0 ? ' ' : '';
    if (o.op === 'eq') return <span key={i}>{sep + (o.given ?? '')}</span>;
    if (o.op === 'ins')
      return (
        <span key={i}>
          {sep}
          {old(o.given)}
        </span>
      );
    if (o.op === 'del')
      return (
        <span key={i}>
          {sep}
          {neu(o.expected)}
        </span>
      );
    return (
      <span key={i}>
        {sep}
        {old(o.given)} {neu(o.expected)}
      </span>
    );
  });
  return (
    <p className="lx-t-support m-0" data-testid={testId}>
      <span className="text-muted">{t('exCmpExpected')}: </span>
      <span lang="en" aria-hidden="true">
        {parts}
      </span>
      <span className="sr-only" lang="en">
        {to}
      </span>
    </p>
  );
}
