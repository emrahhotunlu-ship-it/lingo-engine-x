import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { EnglishText } from '../../engine/EnglishText';
import { Ladder } from '../../engine/Ladder';
import { useHotkeys } from '../../engine/useHotkeys';
import { useHiddenInput } from '../../engine/HiddenInput';
import { meaningOf } from '../../domain/srs/cards';
import { posKey } from '../../domain/srs/explain';
import type { TrainCard } from '../../domain/srs/types';
import type { MessageKey } from '../../i18n';
import { continueIntro, type FirstKind } from './session';

// Einführung einer neuen Karte (Stufe 0): Bedeutung, Ursprungssatz, Verbindung. Schreibt nichts.

export function IntroCard({ card, onDone }: { card: TrainCard; onDone: (kind: FirstKind) => void }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const meaning = meaningOf(card, lang);
  const pk = posKey(card.pos);
  const col = card.col.find((c) => c.p);
  const go = () => {
    const kind = continueIntro();
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };
  useHotkeys({ enter: go }, api.isInput);
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="intro">
      <header className="flex flex-col gap-3">
        <Ladder stage={0} label={t('stage0')} />
        <p className="lx-eyebrow">{t('introEyebrow')}</p>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{t('introTask')}</h2>
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{t('trPurposeLabel')}</span> {t('introPurpose')}
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="intro-word">
          {card.word}
        </p>
        {(meaning || pk) && (
          <p className="text-base text-muted">
            {meaning && <span lang={lang}>{meaning}</span>}
            {meaning && pk && ' · '}
            {pk && t(pk as MessageKey)}
          </p>
        )}
        {card.context && (
          <EnglishText
            as="p"
            className="lx-sentence mt-2"
            testId="origin-sentence"
            text={card.context.sentence}
            area="intro"
            source={card.path}
            title={card.word}
            highlight={[card.context.start, card.context.end]}
          />
        )}
        {col && <p className="text-sm text-muted">{lang === 'de' && col.de ? t('whyCollocDe', { p: col.p, de: col.de }) : t('whyColloc', { p: col.p })}</p>}
      </div>
      <div>
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={go} data-testid="intro-continue">
          {t('introContinue')}
        </Button>
      </div>
    </article>
  );
}
