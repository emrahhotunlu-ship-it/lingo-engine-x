import { useState } from 'react';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { ipaOf } from '../../domain/lexicon/pron';
import { cardExamples } from '../../domain/srs/examples';
import type { StoredExample } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { useT, type MessageKey } from '../../i18n';
import { useExamples } from './examples';
import { ExampleTranslation } from './ExampleTranslation';
import { MnemonicBlock } from './mnemonic';
import { MoreInfo } from './MoreInfo';

// „Zum Wort ▸“ (Lernplattform 2.0 §5.6): nach dem Ergebnis alles, was das Wort noch bietet – ▶ Aussprache mit US-Lautschrift,
// weitere Beispiele (je mit „Deutsch“), Wortpartner, Merkhilfe, Mehr Infos. Am Handy zu, am Laptop offen. Nur Daten der Karte, nichts doppelt
// zur Erklär-Karte: Die Bedeutung steht schon in „Merke“, die Beispiele hier sind die weiteren.

/** `part`: 'all' (Kopf + „Zum Wort“), 'head' (nur Wort, Vorlesen, Lautschrift), 'more' (nur „Zum Wort“) – so steht der Kopf oben und „Zum Wort“ unten in der Ergebnis-Karte (Design-Lead). */
/** `other` (R5, Kontrast-Schritt): das richtige andere Wort – der Kopf heißt dann „avoid ≠ convince“, beide mit Vorlesen und Lautschrift. */
export function WordExtras({
  card,
  open: forced,
  lang,
  extras,
  part = 'all',
  other = null,
  phrase = null,
  meaning = null,
  pos = null,
}: {
  card: TrainCard;
  open: boolean;
  lang: 'de' | 'en';
  extras: readonly StoredExample[];
  part?: 'all' | 'head' | 'more';
  other?: string | null;
  /** Rückmeldung 3 („Wortpartner“): die geübte Verbindung („overcome objections“) steht groß mit Vorlesen; das Kartenwort klein als Zusatz. */
  phrase?: string | null;
  /** Emrahs Meldung 25.10.2026: deutsche Bedeutung groß und fett direkt unter dem Wort (nur im Kopf, nach der Antwort). */
  meaning?: string | null;
  /** i18n-Schlüssel der Wortart (`posKey`), klein neben der Bedeutung. */
  pos?: string | null;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ipa = ipaOf(card.word);
  const otherIpa = other ? ipaOf(other) : null;
  // Die Beispiele selbst stehen in der Erklär-Karte; hier nur ihre deutsche Übersetzung (auf Antippen, einmal von Claude).
  const more = cardExamples(card, null, extras);
  const fresh = useExamples((s) => s.byCard[card.id]?.col);
  // Eigene Wortpartner der Karte; fehlen sie, zeigt „Zum Wort“ sofort, was Claude eben ergänzt hat (gespeichert, `ai`).
  const col = (card.col.length ? card.col.map((c) => ({ p: c.p, de: c.de, ai: !!c.ai })) : (fresh ?? []).map((c) => ({ p: c.p, de: c.de, ai: true }))).filter((c) => c.p).slice(0, 3);
  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const shown = open || forced;
  return (
    <div className="flex flex-col gap-2" data-testid="word-extras" data-open={shown ? '' : undefined}>
      {part !== 'more' && (
      <div className="flex flex-wrap items-center gap-2" data-testid="word-head" data-contrast={other ? '' : undefined}>
        {other && (
          <span className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5" data-testid="contrast-group">
            <span className="inline-flex min-w-0 max-w-full items-center gap-2">
              <span className="lx-t-answer min-w-0 break-words" lang="en" data-testid="contrast-word">
                {other}
              </span>
              <SpeakButton text={other} testId="contrast-listen" />
            </span>
            {otherIpa && (
              <span className="lx-t-meta basis-full text-muted" lang="en" data-testid="contrast-ipa">
                {otherIpa}
              </span>
            )}
          </span>
        )}
        {phrase && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-2" data-testid="phrase-group">
            <span className="lx-t-answer min-w-0 break-words" lang="en" data-testid="phrase-text">
              {phrase}
            </span>
            <SpeakButton text={phrase} testId="phrase-listen" />
          </span>
        )}
        {/* Das „≠“ gehört zur Gruppe des Kartenworts: Bricht die Zeile um, steht es vorn in der zweiten Zeile, nie allein am Zeilenende.
            UX-Prüfung M2: Lange Wendungen brechen innerhalb der Gruppe um (nie abgeschnitten), die Lautschrift steht in einer eigenen Zeile. */}
        <span className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5" data-testid="word-group">
          <span className="inline-flex min-w-0 max-w-full items-center gap-2">
            {other && (
              <span className="lx-t-answer flex-none pr-1 text-subtle" data-testid="contrast-ne">
                <span aria-hidden="true">≠</span>
                <span className="sr-only">{t('wxNotSame')}</span>
              </span>
            )}
            <span className={`min-w-0 break-words ${phrase ? 'lx-t-meta font-medium text-muted' : 'lx-t-answer'}`} lang="en" data-testid="word-text">
              {card.word}
            </span>
            <SpeakButton text={card.word} testId="word-listen" />
          </span>
          {meaning && !other && !phrase && (
            <span className="flex basis-full flex-wrap items-baseline gap-x-2" data-testid="word-meaning-row">
              <span className="lx-t-task font-bold text-fg" lang={lang} data-testid="word-meaning">
                {meaning}
              </span>
              {pos && (
                <span className="lx-t-meta text-muted" lang={lang} data-testid="word-pos">
                  {t(pos as MessageKey)}
                </span>
              )}
            </span>
          )}
          {ipa && (
            <span className="lx-t-meta basis-full text-muted" lang="en" data-testid="word-ipa">
              {ipa}
            </span>
          )}
        </span>
      </div>
      )}
      {part !== 'head' && (
      <button
        type="button"
        className="lx-t-support -mx-1 flex min-h-11 items-center justify-between gap-2 self-stretch rounded-[var(--radius-inline)] px-1 font-semibold text-muted hover:text-fg"
        aria-expanded={shown}
        onClick={() => setOpen((v) => !v)}
        data-testid="word-more"
      >
        <span>{t('wxToWord')}</span>
        <span aria-hidden="true" className="inline-block transition-transform" style={{ transform: shown ? 'rotate(90deg)' : undefined }}>
          ▸
        </span>
      </button>
      )}
      {part !== 'head' && shown && (
        <div className="lx-inset flex flex-col gap-3" data-testid="word-more-body">
          {more.length > 0 && (
            <ul className="flex flex-col gap-1.5" data-testid="extras-examples">
              {more.map((x) => (
                <li key={x.en} className="lx-t-support" data-testid="extras-example" data-src={x.src}>
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
          {col.some((c) => c.ai) && (
            <p className="lx-t-meta text-subtle" data-testid="word-col-ai">
              {t('nbWsColAiNote')}
            </p>
          )}
          <MoreInfo card={card} />
          <MnemonicBlock card={card} />
        </div>
      )}
    </div>
  );
}
