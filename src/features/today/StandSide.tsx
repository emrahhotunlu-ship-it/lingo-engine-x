import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { FEST_GOAL } from '../../domain/metrics';
import { dueErrors } from '../../domain/grammar/errors';
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
  const { t, num, lang } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const { fest } = useVocabMetrics();
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const path = useMemo(() => {
    const due = new Map<string, number>();
    for (const d of dueErrors(docs, now)) due.set(d.topic, (due.get(d.topic) ?? 0) + 1);
    return chapterNodes({ docs, nowMs: now, today, dueByTopic: due });
  }, [docs, now, today]);
  const cur = path.chapters[path.current];
  return (
    <aside className="lx-card flex flex-col gap-5 p-6" aria-label={t('ovTitle')} data-testid="today-stand">
      <h2 className="lx-eyebrow m-0">{t('ovTitle')}</h2>
      <div className="flex flex-col gap-1.5">
        <span className="lx-t-meta text-muted">{t('hxStandWords')}</span>
        <span className="flex items-baseline gap-2">
          <span className="lx-tnum text-3xl leading-none font-semibold tracking-tight" style={{ color: 'var(--lx-ch-cards)' }}>
            <CountUp text={num(fest)} />
          </span>
          <span className="text-sm text-muted">{t(fest === 1 ? 'nbProfilFestUnit_one' : 'nbProfilFestUnit_other')}</span>
        </span>
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
