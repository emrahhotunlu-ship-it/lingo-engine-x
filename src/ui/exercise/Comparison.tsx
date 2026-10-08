import type { ReactNode } from 'react';
import type { WordOp } from '../../domain/learn/types';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';

// Wort-für-Wort-Vergleich (§4.3) mit den Test-IDs der bisherigen `SentenceDiff`:
// `sub`: ~~gegeben~~ → **erwartet** · `del`: „+ fehlt“ (das „+ “ setzt das CSS) · `ins`: durchgestrichen ·
// `typo`: gold unterstrichen. Nie Farbe allein: durch-/unterstrichen bzw. gestrichelter Rahmen.

/** `compact`: die Lücke im Satz zeigt deine Antwort schon (durchgestrichen, Lösung darin) – hier steht nur noch „Richtig: …“ (Design-Lead, Vorschau ref-s5). */
export function Comparison({ given, ops, compact = false, label }: { given: string; ops: readonly WordOp[]; compact?: boolean; label?: string }) {
  const { t } = useT();
  const empty = !given.trim();
  const correct = ops
    .filter((o) => o.op === 'eq' || o.op === 'typo' || o.op === 'sub' || o.op === 'del')
    .map((o) => (o.op === 'eq' ? o.given : (o.expected ?? o.given)) ?? '')
    .filter(Boolean)
    .join(' ');
  const parts: ReactNode[] = ops.map((o, i) => {
    const sep = i > 0 ? ' ' : '';
    switch (o.op) {
      case 'eq':
        return <span key={i}>{sep + (o.given ?? '')}</span>;
      case 'typo':
        return (
          <span key={i}>
            {sep}
            <span className="lx-diff-near" data-op="typo">
              {o.given}
            </span>
          </span>
        );
      case 'sub':
        return (
          <span key={i}>
            {sep}
            <span className="lx-diff-off" data-op="sub">
              {o.given}
            </span>
            <span aria-hidden="true"> → </span>
            <span className="lx-diff-sub">{o.expected}</span>
          </span>
        );
      case 'ins':
        return (
          <span key={i}>
            {sep}
            <span className="lx-diff-off" data-op="ins">
              {o.given}
            </span>
          </span>
        );
      case 'del':
        return (
          <span key={i}>
            {sep}
            <span className="lx-diff-missing" data-op="del" aria-label={`${t('exCmpMissing')}: ${o.expected ?? ''}`}>
              {o.expected}
            </span>
          </span>
        );
      default:
        return null;
    }
  });
  return (
    <div className="lx-t-support flex flex-col gap-1.5" data-testid="sentence-diff" data-slot-inner="comparison">
      <p className={compact ? 'sr-only' : undefined}>
        <span className="text-muted">{label ?? t('exCmpYours')}: </span>
        <span lang="en" data-testid="diff-given">
          {empty ? <span className="text-muted">–</span> : ops.length ? parts : given}
        </span>
      </p>
      {correct && (
        <p>
          <span className="text-muted">{t('exCmpExpected')}: </span>
          <EnglishText as="span" text={correct} area="trainer" testId="diff-correct" className="font-semibold" />
        </p>
      )}
    </div>
  );
}
