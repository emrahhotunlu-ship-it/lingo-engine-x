import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { ipaOf } from '../../domain/lexicon/pron';
import { Ladder } from '../../engine/Ladder';
import { useHotkeys } from '../../engine/useHotkeys';
import { useHiddenInput } from '../../engine/HiddenInput';
import { meaningOf } from '../../domain/srs/cards';
import { posKey } from '../../domain/srs/explain';
import type { TrainCard } from '../../domain/srs/types';
import type { MessageKey } from '../../i18n';
import { continueIntro, skipCurrent, type FirstKind } from './session';
import { markKnown } from './list/actions';
import { useClock } from '../../app/clock';
import { toast } from '../../ui/Toast';

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
  const day = useClock((s) => s.today);
  // Soll N32 („Kenne ich“, Memrise): wie „Kann ich sicher“ – Stufe 4, in 30 Tagen wieder; die Karte
  // fällt aus der Runde (keine Abfrage heute).
  const known = () => {
    const kind = skipCurrent();
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
    void markKnown(card, day).then((ok) => toast(ok ? t('vcKnownSaved') : t('saveFailed'), ok ? 'info' : 'error'));
  };
  const ipa = ipaOf(card.word);
  // Mehrere Bedeutungen („Schlussfolgerung; Abzug“) einzeln zeigen; welche gemeint ist, zeigt der Satz.
  const meanings = (meaning ?? '').split(/\s*;\s*/).filter(Boolean);
  const def = card.def && card.def.trim() && card.def.trim() !== meaning ? card.def.trim() : null;
  const row = (label: string, body: React.ReactNode, testId?: string) => (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 border-t border-line py-2.5 first:border-t-0 sm:grid-cols-[8rem_1fr]" {...(testId ? { 'data-testid': testId } : {})}>
      <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="min-w-0">{body}</dd>
    </div>
  );
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="intro">
      <header className="flex flex-col gap-2">
        <Ladder stage={0} label={t('stage0')} />
        <h2 className="text-base font-medium text-muted">{t('introTask')}</h2>
      </header>
      <div className="flex items-center gap-2">
        <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="intro-word">
          {card.word}
        </p>
        <SpeakButton text={card.word} testId="intro-listen" />
      </div>
      {ipa && (
        <p className="-mt-4 text-sm text-muted" lang="en" data-testid="intro-ipa">
          {ipa}
        </p>
      )}
      <dl className="flex flex-col">
        {meanings.length > 0 &&
          row(
            t('introLblMeaning'),
            <span lang={lang} className="text-base">
              {meanings.join(' · ')}
              {meanings.length > 1 && <span className="block text-xs text-muted">{t('introManyMeanings')}</span>}
            </span>,
            'intro-meaning',
          )}
        {pk && row(t('introLblPos'), <span className="text-base">{t(pk as MessageKey)}</span>)}
        {def && lang === 'de' && row(t('introLblDef'), <span lang="en" className="text-base">{def}</span>)}
        {card.context &&
          row(
            t('introLblSentence'),
            <EnglishText
              as="p"
              className="lx-sentence"
              testId="origin-sentence"
              text={card.context.sentence}
              area="intro"
              source={card.path}
              title={card.word}
              highlight={[card.context.start, card.context.end]}
            />,
          )}
        {col && row(t('introLblColloc'), <span className="text-base"><span lang="en">{col.p}</span>{lang === 'de' && col.de ? <span className="text-muted"> – {col.de}</span> : null}</span>)}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={go} data-testid="intro-continue">
          {t('introContinue')}
        </Button>
        {card.kind === 'vocab' && (
          <Button variant="ghost" icon="check" onClick={known} data-testid="intro-known">
            {t('vcKnown')}
          </Button>
        )}
        <span className="text-sm text-muted">{t('introPurpose')}</span>
      </div>
    </article>
  );
}
