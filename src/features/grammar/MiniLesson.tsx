import { examplesFor, ruleOf } from '../../domain/grammar/rules';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { topicName } from './topicUi';

// Mini-Lektion (Gesamtkonzept 3.4, Lernweg ① „Erklären“): eine kurze Seite vor der ersten Runde eines
// neuen Themas, in etwa einer Minute lesbar – Regel in einem Satz, Kontrast zum Deutschen, zwei bis drei
// Beispiele und der typische Fehler. Ein Knopf: „Los“. Sie schreibt nichts; der Lernweg ① gilt ab der
// ersten Antwort.

const WEG = ['nbLernenWeg1', 'nbLernenWeg2', 'nbLernenWeg3', 'nbLernenWeg4', 'nbLernenWeg5'] as const;

export function MiniLesson({ topic, onGo }: { topic: string; onGo: () => void }) {
  const { t, lang } = useT();
  const rule = ruleOf(topic, lang);
  const trap = rule?.traps[0] ?? null;
  const examples = examplesFor(topic, { max: 3 });
  const src = { area: 'trainer' as const, source: `grammar/${topic}` };
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="mini-lesson" data-topic={topic}>
      <header className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbLernenMiniEyebrow')}</p>
        <h2 className="text-xl font-semibold tracking-tight">{topicName(topic, lang)}</h2>
        {/* Lernweg: wir stehen bei ① */}
        <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label={t('nbLernenWegLabel')}>
          {WEG.map((k, i) => (
            <li key={k} className={i === 0 ? 'font-medium text-accent-text' : ''} aria-current={i === 0 ? 'step' : undefined}>
              {t(k)}
            </li>
          ))}
        </ol>
      </header>
      {rule?.core && (
        <section className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('grRule')}</h3>
          <p className="text-base font-medium" lang={lang}>
            {rule.core}
          </p>
        </section>
      )}
      {rule?.contrast && (
        <section className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('grContrast')}</h3>
          <p className="text-sm" lang={lang}>
            {rule.contrast}
          </p>
        </section>
      )}
      {examples.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('nbLernenMiniExamples')}</h3>
          <ul className="flex flex-col gap-1.5">
            {examples.map((ex) => (
              <li key={ex}>
                <EnglishText as="span" className="text-sm" text={ex} {...src} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {trap && (
        <section className="flex flex-col gap-1" data-testid="mini-trap">
          <h3 className="lx-eyebrow">{t('nbLernenMiniTrap')}</h3>
          <span className="lx-diff-off text-sm" lang="en">
            {trap.bad}
          </span>
          <EnglishText as="span" className="text-sm font-medium" text={trap.good} {...src} />
          {trap.why && (
            <span className="text-sm text-muted" lang={lang}>
              {trap.why}
            </span>
          )}
        </section>
      )}
      <div>
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onGo} data-testid="mini-go">
          {t('nbLernenMiniGo')}
        </Button>
      </div>
    </article>
  );
}
