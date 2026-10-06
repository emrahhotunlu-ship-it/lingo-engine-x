import { useState } from 'react';
import type { ExplainExample } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { FoldToggle } from './FoldToggle';

// Beispiele (§4.3): `open` (0 oder 1) sichtbar, der Rest unter „Weitere Beispiele ▸“. Rechts ein kleines „DE“,
// das die Übersetzung zeigt (Beschriftung für Screenreader aus i18n).

function Item({ ex, area }: { ex: ExplainExample; area: WordTapArea }) {
  const { t, lang } = useT();
  const [de, setDe] = useState(false);
  return (
    <li className="flex flex-col gap-0.5" data-testid="example">
      <div className="flex items-start justify-between gap-2">
        <EnglishText as="span" text={ex.en} area={area} className="min-w-0" />
        {ex.de && (
          <button
            type="button"
            className="lx-t-meta -my-2 inline-flex min-h-11 min-w-11 flex-none items-center justify-center rounded-[var(--radius-inline)] font-semibold text-muted hover:text-fg"
            aria-expanded={de}
            aria-label={`${t('exExampleDeLabel')}: ${ex.de}`}
            onClick={() => setDe((v) => !v)}
            data-testid="example-de"
          >
            {t('exExampleDe')}
          </button>
        )}
      </div>
      {de && ex.de && (
        <p className="lx-t-meta text-muted" lang="de" data-lang-ui={lang}>
          {ex.de}
        </p>
      )}
    </li>
  );
}

export function Examples({ items, open, area = 'trainer', onFoldChange }: { items: readonly ExplainExample[]; open: number; area?: WordTapArea; onFoldChange?: (open: boolean) => void }) {
  const { t } = useT();
  if (!items.length) return null;
  const shown = items.slice(0, open);
  const rest = items.slice(open);
  return (
    <div className="lx-t-support flex flex-col gap-1" data-testid="examples">
      {shown.length > 0 && (
        <>
          <p className="lx-t-label">{t('exExampleLabel')}</p>
          <ul className="flex flex-col gap-1.5">
            {shown.map((ex) => (
              <Item key={ex.en} ex={ex} area={area} />
            ))}
          </ul>
        </>
      )}
      {rest.length > 0 && (
        <FoldToggle label={t('exMoreExamples')} {...(onFoldChange ? { onOpenChange: onFoldChange } : {})} testId="examples-more">
          <ul className="flex flex-col gap-1.5">
            {rest.map((ex) => (
              <Item key={ex.en} ex={ex} area={area} />
            ))}
          </ul>
        </FoldToggle>
      )}
    </div>
  );
}
