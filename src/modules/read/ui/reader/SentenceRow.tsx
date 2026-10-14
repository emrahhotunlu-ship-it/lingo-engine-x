import { memo, useState } from 'react';
import type { ReadView } from '../../schemas';
import type { ReaderSentence } from '../../domain/readerModel';
import { sentenceState } from '../../domain/readerModel';
import { rdrText, type RdrLang } from '../../domain/readerText';
import { EnglishText, SpeakButton } from '../../sharedUi';

// Ein Satz des Lesers (docs/umbau/lesen-plan.md §2.2). Zustand je Satz kommt als einzelnes `revealed` von außen: Das Aufdecken eines
// Satzes zeichnet nur diese Zeile neu (React.memo, stabile Eigenschaften). Die Wörter sind über `EnglishText` antippbar
// (ein Knopf je Wort, ein Nachschlage-Fenster für die ganze Seite), das Deutsche ist nur Text.

export type SentenceRowProps = {
  sentence: ReaderSentence;
  view: ReadView;
  revealed: boolean;
  /** Stelle eines Schlüsselworts in diesem Satz (dezente Markierung) oder `null`. */
  hl: readonly [number, number] | null;
  articleId: string;
  title: string;
  lang: RdrLang;
  onToggle: (n: number) => void;
};

function SentenceRowImpl({ sentence, view, revealed, hl, articleId, title, lang, onToggle }: SentenceRowProps) {
  const { n, e, d } = sentence;
  const st = sentenceState(view, revealed);
  // Aufdecken blendet in 200 ms ein (Kap. 4); der erste Aufbau und das Zudecken bleiben ohne Bewegung.
  const [seen, setSeen] = useState(revealed);
  const [fresh, setFresh] = useState(false);
  if (seen !== revealed) {
    setSeen(revealed);
    setFresh(revealed);
  }
  const pop = fresh ? ' lx-reveal-in' : '';
  const labelKey = view === 'c' ? (revealed ? 'rdrHideEnN' : 'rdrShowEnN') : revealed ? 'rdrHideDeN' : 'rdrShowDeN';
  const en = st.showEn ? (
    <div className={`flex items-start gap-1 ${st.deFirst ? 'mt-1.5 border-l-2 border-line-strong pl-3' : ''}${st.deFirst ? pop : ''}`} data-testid="rdr-en-block">
      <EnglishText
        as="p"
        text={e}
        area="read"
        source={articleId}
        title={title}
        highlight={hl ? [hl[0], hl[1]] : null}
        className="m-0 min-w-0 flex-1 text-base leading-7 text-fg 2xl:text-lg 2xl:leading-8"
        testId="rdr-en"
      />
      <SpeakButton text={e} label={rdrText(lang, 'rdrListen')} testId="rdr-speak" />
    </div>
  ) : null;
  const de = st.showDe ? (
    <div className={`flex items-start gap-1 ${st.deFirst ? '' : `mt-0.5${pop}`}`} data-testid="rdr-de-block">
      <p lang="de" className={`m-0 min-w-0 flex-1 ${st.deFirst ? 'text-base leading-7 text-fg 2xl:text-lg 2xl:leading-8' : 'text-sm text-muted'}`} data-testid="rdr-de">
        {d}
      </p>
    </div>
  ) : null;
  return (
    <li id={`rdr-s-${n}`} data-n={n} data-testid="rdr-sentence" data-revealed={revealed || undefined} className="flex scroll-mt-20 md:scroll-mt-40 items-start gap-1 py-1">
      <button
        type="button"
        onClick={() => onToggle(n)}
        aria-expanded={revealed}
        aria-label={rdrText(lang, labelKey, { n })}
        data-testid="rdr-marker"
        className={`-ml-3 flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-start gap-0.5 pt-1 text-2xs tabular-nums transition-colors ${revealed ? 'font-semibold text-accent-text' : 'text-muted hover:text-fg'}`}
      >
        <span aria-hidden="true">{n}</span>
        <span
          aria-hidden="true"
          className={`rounded-full border px-1.5 text-2xs leading-4 font-semibold tracking-wide ${revealed ? 'border-accent bg-accent-soft text-fg' : 'border-line-strong bg-surface text-fg'}`}
        >
          {rdrText(lang, view === 'c' ? 'rdrEnShort' : 'rdrDeShort')}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {st.deFirst ? de : en}
        <div aria-live="polite">{st.deFirst ? en : de}</div>
      </div>
    </li>
  );
}

export const SentenceRow = memo(SentenceRowImpl);
