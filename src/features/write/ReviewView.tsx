import { useMemo, useState } from 'react';
import { topicById } from '../../domain/content';
import { locateAll } from '../../domain/input/errorSpans';
import { feedbackFits } from '../../domain/input/feedbackLang';
import type { WritingResView } from '../../domain/input/writingRecord';
import { EnglishText } from '../../engine/EnglishText';
import { MarkedText } from '../../engine/MarkedText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';

// Rückmeldung zu einem eigenen Text (Plan §4.3 Nr. 4, F11, F19, F25): Urteil in Worten
// („Dieser Text: etwa B2"), fünf Kriterien als Punktreihe mit Wort (Zahlen nur unter
// „Messwerte dahinter"), markierte Stellen im eigenen Text (Tippen zeigt Was hatte ich → richtig
// → warum), Liste aller Stellen, US-Hinweise, Stärken, verbesserte Fassung, Aufwertungen.

const KEYS = ['task', 'grammar', 'vocabulary', 'coherence', 'register'] as const;
const WORD: Record<number, MessageKey> = { 1: 'wrScoreWord_1', 2: 'wrScoreWord_2', 3: 'wrScoreWord_3', 4: 'wrScoreWord_4', 5: 'wrScoreWord_5' };

type Props = {
  res: WritingResView;
  text: string;
  area: WordTapArea;
  sourceRef: string;
  title: string;
  /** Rückmeldung gehört zu einer früheren Fassung. */
  stale?: boolean;
  onRecheck?: (() => void) | null;
};

export function ReviewView({ res, text, area, sourceRef, title, stale, onRecheck }: Props) {
  const { t, lang } = useT();
  const [active, setActive] = useState<number | null>(null);
  const spans = useMemo(() => (stale ? res.errors.map(() => null) : locateAll(res.errors.map((e) => e.orig), text)), [res.errors, text, stale]);
  const fits = feedbackFits(res.lang, [res.summary, res.next, ...res.strengths, ...res.errors.map((e) => e.why)], lang);
  const other = lang === 'de' ? 'en' : 'de';
  const act = active !== null ? res.errors[active] : undefined;
  const topicName = (id: string | null) => {
    const tp = id ? topicById(id) : undefined;
    return tp ? (lang === 'de' ? tp.name : (tp.name_en ?? tp.name)) : null;
  };

  return (
    <section className="flex flex-col gap-5" data-testid="review" data-cefr={res.cefr ?? ''}>
      {stale && <p className="text-xs text-subtle">{t('wrPrevFeedback')}</p>}
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('wrReviewTitle')}</p>
        {res.cefr && <p className="text-xl font-semibold tracking-tight">{t('wrLevel', { cefr: res.cefr })}</p>}
        {fits && res.summary && <p className="text-base text-muted">{res.summary}</p>}
      </header>

      {Object.keys(res.scores).length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="scores">
          {KEYS.filter((k) => res.scores[k] !== undefined).map((k) => {
            const v = res.scores[k] ?? 0;
            return (
              <li key={k} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="font-medium">{t(`wrScore_${k}`)}</span>
                <span className="inline-flex items-center gap-2" role="img" aria-label={t('inDots', { n: v })}>
                  <span className="lx-dots" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="lx-dot" data-on={i < v || undefined} />
                    ))}
                  </span>
                  <span className="text-xs text-muted" aria-hidden="true">
                    {t(WORD[v] ?? 'wrScoreWord_3')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('wrDraftLabel')}</p>
        <MarkedText
          text={text}
          marks={spans.flatMap((s, i) => (s ? [{ i, span: s, sev: res.errors[i]?.sev ?? 'minor' }] : []))}
          active={active}
          onMark={(i) => setActive(active === i ? null : i)}
          area={area}
          source={sourceRef}
          title={title}
          label={(i) => `${res.errors[i]?.orig ?? ''} → ${res.errors[i]?.fix ?? ''}`}
          className="text-base"
        />
        {act && <ErrorDetail e={act} topic={topicName(act.topic)} showWhy={fits} />}
      </div>

      {fits ? (
        <>
          <div className="flex flex-col gap-2">
            <p className="lx-eyebrow">{t('wrErrors')}</p>
            {res.errors.length === 0 ? (
              <p className="text-sm text-muted">{t('wrNoErrors')}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {res.errors.map((e, i) => (
                  <li key={`${e.orig}-${i}`} data-testid="error-item" data-sev={e.sev}>
                    <button type="button" className="w-full text-left" onClick={() => setActive(active === i ? null : i)} aria-expanded={active === i}>
                      <ErrorDetail e={e} topic={topicName(e.topic)} showWhy compact />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {res.usHints.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {res.usHints.map((h) => (
                <li key={h.orig} data-testid="us-hint">
                  <span lang="en">{h.orig}</span> → {t('wrUsHint', { us: h.us })}
                </li>
              ))}
            </ul>
          )}
          {res.strengths.length > 0 && (
            <div>
              <p className="lx-eyebrow">{t('wrStrengths')}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {res.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted" data-testid="recheck-lang">
          <span>{t('inRecheckLang', { lang: t(`inLangName_${other}`), ui: t(`inLangName_${lang}`) })}</span>
          {onRecheck && (
            <Button variant="ghost" onClick={onRecheck} data-ai="">
              {t('inCheck')}
            </Button>
          )}
        </div>
      )}

      {res.improved && (
        <div className="flex flex-col gap-1" data-testid="improved">
          <p className="lx-eyebrow">{t('wrImproved')}</p>
          <EnglishText text={res.improved} area={area} source={sourceRef} title={title} className="text-base leading-relaxed" />
        </div>
      )}
      {res.upgrades.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="upgrades">
          <p className="lx-eyebrow">{t('wrUpgrades')}</p>
          <ul className="flex flex-col gap-1">
            {res.upgrades.map((u) => (
              <li key={u} className="rounded-xl bg-surface px-3 py-2">
                <EnglishText text={u} area={area} source={sourceRef} title={title} as="span" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {res.phrases.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('wrPhrases')}</p>
          <ul className="flex flex-wrap gap-2">
            {res.phrases.map((u) => (
              <li key={u} className="rounded-full bg-surface px-3 py-1 text-sm">
                <EnglishText text={u} area={area} source={sourceRef} title={title} as="span" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {fits && res.next && (
        <div>
          <p className="lx-eyebrow">{t('wrNext')}</p>
          <p className="text-sm">{res.next}</p>
        </div>
      )}
      {Object.keys(res.scores).length > 0 && (
        <Disclosure label={t('inMeasures')}>
          <p className="lx-tnum text-xs text-muted">{KEYS.filter((k) => res.scores[k] !== undefined).map((k) => `${t(`wrScore_${k}`)} ${res.scores[k] ?? 0}/5`).join(' · ')}</p>
        </Disclosure>
      )}
    </section>
  );
}

function ErrorDetail({ e, topic, showWhy, compact }: { e: WritingResView['errors'][number]; topic: string | null; showWhy: boolean; compact?: boolean }) {
  const { t } = useT();
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl ${compact ? 'bg-surface' : 'bg-surface-strong'} px-3 py-2 text-sm`} data-testid={compact ? undefined : 'error-detail'}>
      <p>
        <span className="text-muted">{t('wrYouWrote')}: </span>
        <span lang="en" className="lx-diff-off">
          {e.orig}
        </span>
      </p>
      <p>
        <span className="text-muted">{t('wrBetter')}: </span>
        <span lang="en" className="font-medium text-accent-text">
          {e.fix}
        </span>
      </p>
      {showWhy && e.why && (
        <p className="text-muted">
          {t('wrWhy')}: {e.why}
          {topic ? ` · ${topic}` : ''}
        </p>
      )}
    </div>
  );
}
