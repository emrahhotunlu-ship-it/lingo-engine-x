import { useState } from 'react';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { ipaOf } from '../../domain/lexicon/pron';
import { cardExamples } from '../../domain/srs/examples';
import type { StoredExample } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { useT } from '../../i18n';
import { ExampleTranslation } from './ExampleTranslation';
import { MnemonicBlock } from './mnemonic';
import { MoreInfo } from './MoreInfo';

// „Zum Wort ▸“ (Lernplattform 2.0 §5.6): nach dem Ergebnis alles, was das Wort noch bietet – ▶ Aussprache mit US-Lautschrift,
// weitere Beispiele (je mit „Deutsch“), Wortpartner, Merkhilfe, Mehr Infos. Am Handy zu, am Laptop offen. Nur Daten der Karte, nichts doppelt
// zur Erklär-Karte: Die Bedeutung steht schon in „Merke“, die Beispiele hier sind die weiteren.

export function WordExtras({ card, open: forced, lang, extras }: { card: TrainCard; open: boolean; lang: 'de' | 'en'; extras: readonly StoredExample[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ipa = ipaOf(card.word);
  const more = cardExamples(card, null, extras).slice(1);
  const col = card.col.filter((c) => c.p).slice(0, 3);
  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const shown = open || forced;
  return (
    <div className="flex flex-col gap-2" data-testid="word-extras" data-open={shown ? '' : undefined}>
      <div className="flex flex-wrap items-center gap-2" data-testid="word-head">
        <span className="lx-t-answer" lang="en" data-testid="word-text">
          {card.word}
        </span>
        <SpeakButton text={card.word} testId="word-listen" />
        {ipa && (
          <span className="lx-t-meta text-muted" lang="en" data-testid="word-ipa">
            {ipa}
          </span>
        )}
      </div>
      <button
        type="button"
        className="lx-t-meta -mx-1 inline-flex min-h-11 items-center gap-1 self-start rounded-[var(--radius-inline)] px-1 font-medium text-muted hover:text-fg"
        aria-expanded={shown}
        onClick={() => setOpen((v) => !v)}
        data-testid="word-more"
      >
        <span>{t('wxToWord')}</span>
        <span aria-hidden="true" className="inline-block transition-transform" style={{ transform: shown ? 'rotate(90deg)' : undefined }}>
          ▸
        </span>
      </button>
      {shown && (
        <div className="lx-inset flex flex-col gap-3" data-testid="word-more-body">
          {more.length > 0 && (
            <ul className="flex flex-col gap-1.5" data-testid="examples">
              {more.map((x) => (
                <li key={x.en} className="lx-t-support" data-testid="example" data-src={x.src}>
                  <EnglishText as="span" text={x.en} {...src} />
                  <ExampleTranslation card={card} en={x.en} />
                </li>
              ))}
            </ul>
          )}
          {col.length > 0 && (
            <ul className="flex flex-col gap-0.5 lx-t-support" data-testid="word-col">
              {col.map((c) => (
                <li key={c.p}>
                  <span lang="en" className="font-medium">
                    {c.p}
                  </span>
                  {lang === 'de' && c.de ? <span className="text-muted"> – {c.de}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <MoreInfo card={card} />
          <MnemonicBlock card={card} />
        </div>
      )}
    </div>
  );
}
