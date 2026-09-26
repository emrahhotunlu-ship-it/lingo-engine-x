// Statuszeile einer Karte (CLAUDE.md A7): Sicherheit als fünf Punkte mit Wort und die
// Abfrageart als kurzer Name. Ersetzt Stufen-Leiter, Quelle und Erklärtexte.

type Props = { dots: number; word: string; label: string; kind: string; kindLabel: string; level: number; again?: string | null };

export function CardStatus({ dots, word, label, kind, kindLabel, level, again = null }: Props) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted" data-testid="status" data-confidence={level}>
      <span className="inline-flex items-center gap-2" role="img" aria-label={label}>
        <span className="lx-dots" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="lx-dot" data-on={i < dots || undefined} />
          ))}
        </span>
        <span aria-hidden="true" data-testid="confidence">
          {word}
        </span>
      </span>
      <span aria-hidden="true" className="text-subtle">
        ·
      </span>
      <span data-testid="ex-kind">
        <span className="sr-only">{kindLabel}</span>
        <span aria-hidden="true">{kind}</span>
      </span>
      {again && (
        <>
          <span aria-hidden="true" className="text-subtle">
            ·
          </span>
          <span className="text-gold-text" data-testid="again-badge">
            {again}
          </span>
        </>
      )}
    </p>
  );
}
