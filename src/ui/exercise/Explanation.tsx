import type { ReactNode } from 'react';
import type { ExplainDepth, ExplainLine, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { lineLabel } from './lineLabel';
import { FoldToggle } from './FoldToggle';
import { liftLines, visibleLines } from './explainDepth';
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
  /** 'open': nur die offenen Zeilen (das Gerüst sammelt „Mehr“ unten in EINER Fußzeile); 'folded': nur die eingeklappten Zeilen; Standard: beides. */
  only?: 'open' | 'folded' | 'yours';
  /** UX-Prüfung W2: diese Zeilenarten stehen immer unter „Mehr“ (Typischer Fehler, Nicht verwechseln, Hinweise). */
  fold?: ReadonlyArray<ExplainLine['k']>;
  /** R5 (Kontrast-Schritt): diese Zeilenarten stehen immer offen, auch wenn die Tiefe sie sonst einklappt (z. B. „Nicht verwechseln“). */
  unfold?: ReadonlyArray<ExplainLine['k']>;
  /** UX-Prüfung W2: „Deine Antwort“ steht oben in der Karte (eigener Aufruf mit `only="yours"`), hier nicht noch einmal. */
  skipYours?: boolean;
  /** Urteil der Rückmeldung: „Richtig, weil“ steht nur bei richtiger Antwort, sonst „Warum ist das so?“ (Emrahs Rückmeldung 7, Kap. 2 Nr. 2). */
  verdict?: ResultVerdict;
};

const SYMBOL: Record<ExplainLine['k'], string> = { pattern: '◇', yours: '›', why: '✓', mistake: '✕', contrast: '⇄', note: 'i' };

export function Explanation({ model, depth, learning = true, area = 'trainer', onFoldChange, hideWord = false, only, fold, unfold, skipYours = false, verdict }: Props) {
  const { t, lang } = useT();
  const v0 = liftLines(visibleLines(model, depth, { learning }), model, unfold);
  const moved = fold ? v0.open.filter((l) => fold.includes(l.k)) : [];
  const keep = (l: ExplainLine): boolean => !moved.includes(l) && !(skipYours && l.k === 'yours');
  const v = { ...v0, open: v0.open.filter(keep), folded: [...moved, ...v0.folded] };
  const en = (text: string): ReactNode => <EnglishText as="span" text={text} area={area} />;

  const body = (l: ExplainLine): ReactNode => {
    switch (l.k) {
      case 'pattern':
        return (
          <span className="flex flex-col items-start gap-1.5">
            <span className="font-semibold">{l.name}</span>
            {l.formula && (
              <span className="inline-block rounded-full bg-hint-soft px-3 py-1 text-hint-text" lang="en">
                {l.formula}
              </span>
            )}
          </span>
        );
      case 'yours': {
        // UX-Prüfung B1: die eigene Wahl steht genau einmal („am“), die Begründung beginnt oft schon mit ihr („am passt nicht …“) – dann nicht doppelt.
        const g = l.given.trim();
        // UX-Prüfung W2/R7: ein ganzer Satz steht schon im Antwortfeld darüber – dann nennt die Zeile nur die Begründung (kein doppelter Text).
        const short = !!g && g.split(/\s+/).length <= 3;
        const dup = !!g && l.text.trim().toLowerCase().startsWith(g.toLowerCase());
        return (
          <>
            {g && short && (
              <span className="mr-1.5 font-semibold text-wrong-text line-through decoration-1" lang="en">
                {g}
              </span>
            )}
            <span lang={lang}>{dup && short ? l.text.trim().slice(g.length).trimStart() : l.text}</span>
          </>
        );
      }
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
        if (l.meaningOnly)
          return (
            <span className="text-muted" lang={lang}>
              {l.diff}
            </span>
          );
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
          <span className="lx-eyebrow text-subtle">{w.label ?? t(lineLabel('why', verdict))}</span>
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
        {t(lineLabel(l.k, verdict))}
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

  if (only === 'yours') {
    const ys = v0.open.filter((l) => l.k === 'yours');
    if (!ys.length) return null;
    return <ul className="-mx-4 m-0 flex list-none flex-col p-0" data-testid="explanation-yours">{ys.map(card ? cardRow : row)}</ul>;
  }
  if (only === 'folded') {
    if (!v.folded.length) return null;
    return (
      <ul className="-mx-4 m-0 flex list-none flex-col p-0" data-testid="explanation-folded">
        {v.folded.map(card ? cardRow : row)}
      </ul>
    );
  }
  if (!main && (only === 'open' || !v.folded.length) && !model.ai) return null;
  return (
    <div className="-mx-4 flex flex-col" data-testid="explanation" data-depth={depth} data-source={model.source}>
      {main}
      {only !== 'open' && v.folded.length > 0 && (
        <div className="border-t border-line px-4 py-1">
          <FoldToggle label={t('exMore')} {...(onFoldChange ? { onOpenChange: onFoldChange } : {})} testId="explanation-more">
            <ul className="-mx-4 m-0 flex list-none flex-col p-0">{v.folded.map(card ? cardRow : row)}</ul>
          </FoldToggle>
        </div>
      )}
      {model.ai && (
        // Rückmeldung 1: die Karte zieht sich mit -mx-4 an den Rand, deshalb braucht auch diese Zeile den Innenabstand der übrigen Zeilen.
        <p className="lx-t-meta border-t border-line px-4 py-2.5 text-muted" data-testid="ai-note">
          {t('exAiNote')}
        </p>
      )}
      <Slot name="explain.after" />
    </div>
  );
}

