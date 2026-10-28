import type { ReactNode } from 'react';
import type { WordOp } from '../../domain/learn/types';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';

// Wort-für-Wort-Vergleich (§4.3) mit den Test-IDs der bisherigen `SentenceDiff`:
// `sub`: ~~gegeben~~ → **erwartet** · `del`: „+ fehlt“ (das „+ “ setzt das CSS) · `ins`: durchgestrichen ·
// `typo`: gold unterstrichen. Nie Farbe allein: durch-/unterstrichen bzw. gestrichelter Rahmen.

/** `compact`: die Lücke im Satz zeigt deine Antwort schon (durchgestrichen, Lösung darin) – hier steht nur noch „Richtig: …“ (Design-Lead, Vorschau ref-s5). */
/** `hideCorrect`: die richtige Fassung steht schon als Satz über dem Ergebnis (z. B. `repair-right` in „Fehler korrigieren“) – keine zweite „Richtig:“-Zeile. */
/** `inline` (Band am Handy, Korrekturrunde P3 Punkt 1b): EINE Lösungszeile „Du: … → Richtig: …“ statt zweier Zeilen. */
export function Comparison({ given, ops, compact = false, label, correct: solution, hideCorrect = false, inline = false }: { given: string; ops: readonly WordOp[]; compact?: boolean; label?: string; /** Musterlösung direkt (statt aus dem Vergleich rekonstruiert). */ correct?: string; hideCorrect?: boolean; inline?: boolean }) {
  const { t } = useT();
  const empty = !given.trim();
  const correct = solution?.trim() ? solution.trim() : ops
    .filter((o) => o.op === 'eq' || o.op === 'typo' || o.op === 'sub' || o.op === 'del')
    .map((o) => (o.op === 'eq' ? o.given : (o.expected ?? o.given)) ?? '')
    .filter(Boolean)
    .join(' ');
  // Eine Lösungszeile: steht „Richtig: …“ dahinter, zeigt „Du: …“ nur deine Wörter (falsche durchgestrichen) – kein „→ Lösung“ doppelt.
  const brief = inline && !!correct && !hideCorrect;
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
            {!brief && (
              <>
                <span aria-hidden="true"> → </span>
                <span className="lx-diff-sub">{o.expected}</span>
              </>
            )}
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
        if (brief) return null;
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
  if (inline) {
    const showGiven = !empty && !compact;
    const showCorrect = !!correct && !hideCorrect;
    return (
      <p className="lx-t-support m-0" data-testid="sentence-diff" data-slot-inner="comparison" data-inline="">
        {showGiven && (
          <>
            <span className="text-muted">{t('bandYou')}: </span>
            <span lang="en" data-testid="diff-given">
              {ops.length ? parts : given}
            </span>
          </>
        )}
        {showGiven && showCorrect && <span aria-hidden="true" className="text-muted"> → </span>}
        {showCorrect && (
          <>
            <span className="text-muted">{t('exCmpExpected')}: </span>
            <EnglishText as="span" text={correct} area="trainer" testId="diff-correct" className="font-semibold" />
          </>
        )}
      </p>
    );
  }
  return (
    <div className="lx-t-support flex flex-col gap-1.5" data-testid="sentence-diff" data-slot-inner="comparison">
      {/* Übersprungen (nichts getippt, „Weiß ich nicht“): keine Zeile „Deine Antwort: Nicht beantwortet“ – das Urteil sagt es schon (UX-Audit U1). */}
      {!empty && (
        <p className={compact ? 'sr-only' : undefined}>
          <span className="text-muted">{label ?? t('exCmpYours')}: </span>
          <span lang="en" data-testid="diff-given">
            {ops.length ? parts : given}
          </span>
        </p>
      )}
      {correct && !hideCorrect && (
        <p>
          <span className="text-muted">{t('exCmpExpected')}: </span>
          <EnglishText as="span" text={correct} area="trainer" testId="diff-correct" className="font-semibold" />
        </p>
      )}
    </div>
  );
}
