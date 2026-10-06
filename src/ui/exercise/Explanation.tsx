import type { ReactNode } from 'react';
import type { ExplainDepth, ExplainLine, ExplanationModel } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { FoldToggle } from './FoldToggle';
import { visibleLines } from './explainDepth';

// Erklär-Karte (§4.3/§4.6): EINE Innenfläche, feste Zeilen mit Symbol und kurzem Label (keine Großbuchstaben-
// Überschriften), offen nach Tiefe, der Rest unter „Mehr ▸“. `min` ist eine einzige Zeile „✓ Muster · Richtig, weil …“.

type Props = {
  model: ExplanationModel;
  depth: ExplainDepth;
  /** Lernphase: „Typischer Fehler“ steht bei `full` offen (Standard: ja). */
  learning?: boolean;
  area?: WordTapArea;
  onFoldChange?: (open: boolean) => void;
};

const LABEL: Record<ExplainLine['k'], MessageKey> = {
  pattern: 'exLinePattern',
  yours: 'exLineYours',
  why: 'exLineWhy',
  mistake: 'exLineMistake',
  contrast: 'exLineContrast',
  note: 'exLineNote',
};
const SYMBOL: Record<ExplainLine['k'], string> = { pattern: '◇', yours: '›', why: '✓', mistake: '✕', contrast: '⇄', note: 'i' };

export function Explanation({ model, depth, learning = true, area = 'trainer', onFoldChange }: Props) {
  const { t, lang } = useT();
  const v = visibleLines(model, depth, { learning });
  const en = (text: string): ReactNode => <EnglishText as="span" text={text} area={area} />;

  const body = (l: ExplainLine): ReactNode => {
    switch (l.k) {
      case 'pattern':
        return (
          <>
            <span className="font-semibold">{l.name}</span>
            {l.formula && (
              <span className="ml-2 inline-block rounded-[var(--radius-inline)] bg-hint-soft px-1.5 text-hint-text" lang="en">
                {l.formula}
              </span>
            )}
          </>
        );
      case 'yours':
        return (
          <>
            {l.given && <span className="mr-1">{en(l.given)}</span>}
            <span lang={lang}>{l.text}</span>
          </>
        );
      case 'why':
      case 'note':
        return <span lang={lang}>{l.text}</span>;
      case 'mistake':
        return (
          <>
            <span>{t('exLineMistakeArrow', { bad: l.bad, good: l.good })}</span>
            {l.cause && (
              <span className="ml-1 text-muted" lang={lang}>
                {l.cause}
              </span>
            )}
          </>
        );
      case 'contrast':
        return (
          <>
            {en(l.a)} <span aria-hidden="true">≠</span> {en(l.b)}
            <span className="ml-1 text-muted" lang={lang}>
              {l.diff}
            </span>
          </>
        );
    }
  };

  const row = (l: ExplainLine, i: number): ReactNode => (
    <li key={`${l.k}-${i}`} className="flex gap-2" data-line={l.k}>
      <span aria-hidden="true" className="lx-t-meta mt-0.5 w-4 flex-none text-center font-semibold text-muted">
        {SYMBOL[l.k]}
      </span>
      <span className="min-w-0">
        <span className="lx-t-meta mr-2 font-medium text-muted">{t(LABEL[l.k])}</span>
        {body(l)}
      </span>
    </li>
  );

  let main: ReactNode;
  if (v.oneLine) {
    const p = v.open.find((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern');
    const w = v.open.find((l): l is Extract<ExplainLine, { k: 'why' }> => l.k === 'why');
    const text = [p?.name, w?.text].filter((x): x is string => !!x).join(' · ');
    main = text ? (
      <p className="flex gap-2" data-line="one">
        <span aria-hidden="true" className="font-semibold text-ok-text">
          ✓
        </span>
        <span lang={lang}>{text}</span>
      </p>
    ) : null;
  } else {
    main = v.open.length ? <ul className="flex flex-col gap-2">{v.open.map(row)}</ul> : null;
  }

  if (!main && !v.folded.length && !model.ai) return null;
  return (
    <div className="lx-inset lx-t-support flex flex-col gap-2" data-testid="explanation" data-depth={depth} data-source={model.source}>
      {main}
      {v.folded.length > 0 && (
        <FoldToggle label={t('exMore')} {...(onFoldChange ? { onOpenChange: onFoldChange } : {})} testId="explanation-more">
          <ul className="flex flex-col gap-2">{v.folded.map(row)}</ul>
        </FoldToggle>
      )}
      {model.ai && (
        <p className="lx-t-meta text-muted" data-testid="ai-note">
          {t('exAiNote')}
        </p>
      )}
    </div>
  );
}
