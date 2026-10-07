import type { ReactNode } from 'react';
import type { ExplainDepth, ExplainLine, ExplanationModel } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { FoldToggle } from './FoldToggle';
import { visibleLines } from './explainDepth';
import { splitHead, splitWhy } from './wordParts';
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
  /** Wort-Rückmeldung: der Kopf darüber zeigt das Wort schon (Anki-Rückseite) – hier nur für Vorleseprogramme. */
  hideWord?: boolean;
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

export function Explanation({ model, depth, learning = true, area = 'trainer', onFoldChange, hideWord = false }: Props) {
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

  // Wort-Rückmeldung (Design-Lead 07.10.2026): Kopf als Chips, Merke als eigener Block, Gegenstück als eigene Zeile – dieselben Texte, nur getrennt.
  const card = model.source === 'card';
  const head = card ? model.lines.find((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern') : undefined;
  const headWord = head ? splitHead(head.name).word : '';
  const cardRow = (l: ExplainLine, i: number): ReactNode => {
    if (l.k === 'pattern') {
      const h = splitHead(l.name);
      const w = splitWhy(model.lines.find((x): x is Extract<ExplainLine, { k: 'why' }> => x.k === 'why')?.text ?? '', h.word);
      const showFormula = !!l.formula && l.formula !== w.main;
      if (hideWord && !h.chips.length && !showFormula) return (
          <li key={`${l.k}-${i}`} className="sr-only" data-line="pattern">
            {h.word}
          </li>
        );
      return (
        <li key={`${l.k}-${i}`} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3" data-line="pattern">
          {hideWord ? (
            <span className="sr-only">{h.word}</span>
          ) : (
            <span className="lx-t-answer mr-1 text-fg" lang="en">
              {en(h.word)}
            </span>
          )}
          {h.chips.map((c) => (
            <span key={c} className="lx-t-meta inline-flex min-h-7 items-center rounded-full bg-surface-strong px-2.5 font-medium text-muted">
              {c}
            </span>
          ))}
          {showFormula && (
            <span className="lx-t-meta inline-flex min-h-7 items-center rounded-full bg-hint-soft px-2.5 font-semibold text-hint-text" lang="en">
              {l.formula}
            </span>
          )}
        </li>
      );
    }
    if (l.k === 'why') {
      const w = splitWhy(l.text, headWord);
      // Nichts außer dem Wort selbst: keine leere Überschrift (das Wort steht schon im Kopf).
      if (!w.main && !w.rest.length)
        return (
          <li key={`${l.k}-${i}`} className="sr-only" data-line="why">
            {l.text}
          </li>
        );
      return (
        <li key={`${l.k}-${i}`} className="flex flex-col gap-2 border-t border-line px-4 py-3.5" data-line="why">
          <span className="lx-eyebrow text-subtle">{w.label ?? t(LABEL.why)}</span>
          {w.main && (
            <span className="lx-t-answer min-w-0 text-fg" lang={w.main.includes(' = ') ? lang : 'en'}>
              {w.main.includes(' = ') ? w.main : en(w.main)}
            </span>
          )}
          {w.rest.map((r, k) =>
            r.label ? (
              <span key={k} className="lx-t-support flex min-w-0 items-baseline gap-2">
                <span className="lx-t-meta flex-none font-medium text-subtle">{r.label}</span>
                <span className="min-w-0 font-semibold text-fg" lang="en">
                  {en(r.text)}
                </span>
              </span>
            ) : (
              <span key={k} className="lx-t-support min-w-0 text-muted" lang={lang}>
                {r.text}
              </span>
            ),
          )}
        </li>
      );
    }
    return row(l, i);
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
  if (card) {
    main = v.open.length ? <ul className="m-0 flex list-none flex-col p-0">{v.open.map(cardRow)}</ul> : null;
  } else if (v.oneLine) {
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
            <ul className="-mx-4 m-0 flex list-none flex-col p-0">{v.folded.map(card ? cardRow : row)}</ul>
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
