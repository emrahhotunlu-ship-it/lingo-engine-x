import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { FEST_GOAL, errorsDueByTopic } from '../../domain/metrics';
import { useT } from '../../i18n';
import { CountUp } from '../../ui/CountUp';
import { chapterNodes } from '../grammar/chapters';
import { useVocabMetrics } from '../progress/WordsSegment';

// Laptop-Spalte neben Heute (Design-Lead 07.10.2026, Vorschau „Dein Stand“): nur aus vorhandenen Selektoren zusammengesetzt –
// Wörter fest (`useVocabMetrics` → `festCount`, Ziel `FEST_GOAL` wie auf „Fortschritt“), Grammatik-Kapitel (`chapterNodes` wie im Lernweg).
// Keine neue Zahlenquelle, nichts wird geschrieben. Am Handy wird sie nicht gezeigt (der Aufrufer rendert sie nur breit).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

function Mini({ value, tone }: { value: number; tone: 'words' | 'grammar' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
      <div className={`dz-grow h-full rounded-full ${tone === 'words' ? 'dz-fill-words' : 'dz-fill-grammar'}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function StandSide() {
  const { t, tn, num, lang } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const { fest, onWay } = useVocabMetrics();
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const path = useMemo(() => chapterNodes({ docs, nowMs: now, today, dueByTopic: errorsDueByTopic(docs, now) }), [docs, now, today]);
  const cur = path.chapters[path.current];
  return (
    <aside className="lx-card flex flex-col gap-5 p-6" aria-label={t('ovTitle')} data-testid="today-stand">
      <h2 className="lx-eyebrow m-0">{t('ovTitle')}</h2>
      <div className="flex flex-col gap-1.5">
        <span className="lx-t-meta text-muted">{t('hxStandWords')}</span>
        {fest === 0 ? (
          // UX-Audit U1: keine nackte Null als Kopfzahl, sondern ein ruhiges Urteil (wie auf „Fortschritt“).
          <span className="flex flex-col gap-0.5" data-fest="0">
            <span className="text-xl leading-tight font-semibold tracking-tight">{t('nbProfilFestZeroTitle')}</span>
            <span className="text-sm text-muted">{onWay > 0 ? tn('nbProfilFestZeroSub', onWay) : t('nbProfilFestZeroNone')}</span>
          </span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="lx-tnum text-3xl leading-none font-semibold tracking-tight" style={{ color: 'var(--lx-ch-cards)' }}>
              <CountUp text={num(fest)} />
            </span>
            <span className="text-sm text-muted">{t(fest === 1 ? 'nbProfilFestUnit_one' : 'nbProfilFestUnit_other')}</span>
          </span>
        )}
        <Mini value={fest / FEST_GOAL} tone="words" />
      </div>
      {cur && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-5">
          <span className="lx-t-meta text-muted">{t('hxStandGrammar')}</span>
          <span className="lx-t-answer">{t('hxPathChapter', { n: path.current + 1, name: lang === 'en' ? cur.name.en : cur.name.de })}</span>
          <span className="lx-tnum text-sm text-muted">{t('hxPathSafe', { a: cur.safe, b: cur.topics.length })}</span>
          <Mini value={cur.topics.length ? cur.safe / cur.topics.length : 0} tone="grammar" />
        </div>
      )}
    </aside>
  );
}
