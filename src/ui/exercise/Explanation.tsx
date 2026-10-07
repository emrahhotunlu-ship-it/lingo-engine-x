import type { ReactNode } from 'react';
import type { ExplainDepth, ExplainLine, ExplanationModel } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { FoldToggle } from './FoldToggle';
import { visibleLines } from './explainDepth';
import { Slot } from '../../app/slots';

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
              <span className="ml-1 inline-block rounded-full bg-hint-soft px-3 py-1 text-hint-text" lang="en">
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
    <li key={`${l.k}-${i}`} className="flex flex-col gap-1 border-t border-line px-4 py-3.5" data-line={l.k}>
      <span className="lx-eyebrow text-subtle">
        <span aria-hidden="true" className="sr-only">
          {SYMBOL[l.k]}
        </span>
        {t(LABEL[l.k])}
      </span>
      <span className="lx-t-support min-w-0 text-fg">{body(l)}</span>
    </li>
  );

  let main: ReactNode;
  if (v.oneLine) {
    const p = v.open.find((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern');
    const w = v.open.find((l): l is Extract<ExplainLine, { k: 'why' }> => l.k === 'why');
    const text = [p?.name, w?.text].filter((x): x is string => !!x).join(' · ');
    main = text ? (
      <p className="flex gap-2 border-t border-line px-4 py-3.5" data-line="one">
        <span aria-hidden="true" className="font-semibold text-ok-text">
          ✓
        </span>
        <span lang={lang}>{text}</span>
      </p>
    ) : null;
  } else {
    main = v.open.length ? <ul className="m-0 flex list-none flex-col p-0">{v.open.map(row)}</ul> : null;
  }

  if (!main && !v.folded.length && !model.ai) return null;
  return (
    <div className="-mx-4 flex flex-col" data-testid="explanation" data-depth={depth} data-source={model.source}>
      {main}
      {v.folded.length > 0 && (
        <div className="border-t border-line px-4 py-1">
          <FoldToggle label={t('exMore')} {...(onFoldChange ? { onOpenChange: onFoldChange } : {})} testId="explanation-more">
            <ul className="-mx-4 m-0 flex list-none flex-col p-0">{v.folded.map(row)}</ul>
          </FoldToggle>
        </div>
      )}
      {model.ai && (
        <p className="lx-t-meta text-muted" data-testid="ai-note">
          {t('exAiNote')}
        </p>
      )}
      <Slot name="explain.after" />
    </div>
  );
}
