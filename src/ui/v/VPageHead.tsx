import type { ReactNode } from 'react';

// D1 V-BAU: Seitenkopf der Reiter (`.phead`; Vorschau style.css:148–150, app.js:194): Titel 30/36 fett, rechts höchstens Symbolknöpfe
// (Fragen; Zahnrad nur auf Fortschritt, stufe1-plan.md §6.6).

/** `meta`: ruhige Zeile neben dem Titel (Glas-Kopfleiste, z. B. das Datum auf Heute); am Handy ausgeblendet. */
type Props = { title: ReactNode; right?: ReactNode; className?: string; meta?: ReactNode };

export function VPageHead({ title, right, className, meta }: Props) {
  return (
    <header className={`lx-v-phead lx-v-gx${className ? ` ${className}` : ''}`}>
      <h1 className="lx-v-disp">{title}</h1>
      {meta && (
        <span className="lx-v-phead-meta" aria-hidden="true">
          {meta}
        </span>
      )}
      {right && <div className="lx-v-phead-right">{right}</div>}
    </header>
  );
}
