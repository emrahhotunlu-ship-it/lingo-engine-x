import { useT } from '../i18n';

// Wortzahl live (Lernplattform 3.0 §3.1, P14): „3–6 Wörter · jetzt 2“ mit Tabellenziffern. Das Zeichen ✓ erscheint, wenn die Zahl im
// erlaubten Bereich liegt (Farbe nie allein); ein ruhiges `aria-live` meldet Änderungen.

export function WordCounter({ n, min, max, testId = 'word-counter' }: { n: number; min: number; max: number; testId?: string }) {
  const { t } = useT();
  const ok = n >= min && n <= max;
  return (
    <p className="lx-t-meta lx-tnum flex items-center gap-2 text-muted" data-testid={testId} data-ok={ok ? 'true' : 'false'} data-n={n} aria-live="polite">
      <span>{t('cxWordsRange', { min, max, n })}</span>
      {ok && (
        <span aria-hidden="true" className="text-ok-text">
          ✓
        </span>
      )}
    </p>
  );
}
