import { useEffect } from 'react';
import { useNav, type InputRoute } from '../../app/nav';
import { useLive } from '../../data/live';
import { feedbackFits } from '../../domain/input/feedbackLang';
import { normalizeWriting } from '../../domain/input/writingRecord';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { loadFeedOnce, useFeedItems } from '../discover/feedStore';
import { ReviewView } from '../write/ReviewView';
import { dbArticles, dbListening, findArticle, findListening, listenRows, readingRows } from './derive';
import { HistoryList, type HistoryEntry } from './HistoryList';
import { ensureLibrary, useInputLibrary } from './library';

// Verlauf je Kanal (Plan §4.3 Nr. 7, Kap. 14): alle bisherigen Daten sichtbar – Lesen
// (`reading/*`), Hören (`profile.listen[]`), Schreiben (beide Formen von `writing/*`) und
// Entdecken (`profile.disc`). Nur lesen; frühere Ergebnisse sind Zustand, keine Knöpfe.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export function HistoryScreen({ kind }: { kind: Extract<InputRoute, { name: 'history' }>['kind'] }) {
  const { t, date, lang } = useT();
  const go = useNav((s) => s.go);
  const status = useInputLibrary((s) => s.status);
  const docs = useInputLibrary((s) => s.docs);
  const profile = useLive((s) => s.docs['app/profile']);
  const { items: feedItems } = useFeedItems();

  useEffect(() => {
    void ensureLibrary();
    if (kind === 'discover') void loadFeedOnce();
  }, [kind]);

  const fmt = (dayOrMs: string | number): string => {
    if (typeof dayOrMs === 'number') return dayOrMs > 0 ? date(dayOrMs) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(dayOrMs) ? date(Date.parse(`${dayOrMs}T12:00:00`)) : dayOrMs;
  };

  const entries = ((): HistoryEntry[] => {
    if (kind === 'read') {
      const arts = dbArticles(docs.articles);
      return readingRows(docs.reading).map(({ id, doc }) => {
        const art = findArticle(str(doc.articleId), arts);
        const quiz = obj(doc.quiz);
        const res = obj(doc.res);
        const feedback = str(res.feedback);
        const fits = feedbackFits(res.lang, [feedback], lang);
        return {
          id,
          title: str(doc.title) || art?.title || str(doc.articleId),
          meta: [fmt(str(doc.date) || num(doc.t)), str(doc.level), num(quiz.n) ? t('rdQuiz', { ok: num(quiz.ok), n: num(quiz.n) }) : ''].filter(Boolean).join(' · '),
          body: () => (
            <>
              {str(doc.summary) ? <EnglishText text={str(doc.summary)} area="read" source={`reading/${id}`} title={str(doc.title)} className="text-sm" /> : <p className="text-sm text-muted">{t('rdSummaryHint')}</p>}
              {feedback && fits && <p className="text-sm text-muted">{feedback}</p>}
              {str(res.model_summary) && <EnglishText text={str(res.model_summary)} area="read" source={`reading/${id}`} title={str(doc.title)} className="text-sm text-muted" />}
            </>
          ),
        };
      });
    }
    if (kind === 'listen') {
      const pool = dbListening(docs.lpool);
      return listenRows(profile).map((r, i) => {
        const item = findListening(r.id, pool);
        return {
          id: `${r.id}-${r.t}-${i}`,
          title: item?.title ?? r.id,
          meta: [fmt(r.t), r.level, r.n ? t('rdQuiz', { ok: r.ok, n: r.n }) : '', r.plays ? t('lsPlays_other', { n: r.plays }) : ''].filter(Boolean).join(' · '),
          body: () => (item ? <EnglishText text={item.text} area="listen" source={item.ref} title={item.title} className="text-sm" /> : <p className="text-sm text-muted">{r.id}</p>),
        };
      });
    }
    if (kind === 'write') {
      return [...docs.writing.entries()]
        .map(([id, d]) => normalizeWriting(id, d))
        .sort((a, b) => b.t - a.t)
        .map((w) => ({
          id: w.id,
          title: w.title || (w.lesson ? t('wrLesson', { id: w.lesson }) : w.id),
          meta: [fmt(w.date || w.t), t('inDraftWords', { n: w.words })].filter(Boolean).join(' · '),
          badge: w.res?.cefr ?? null,
          body: () =>
            w.res ? (
              <ReviewView res={w.res} text={w.text} area="write" sourceRef={`writing/${w.id}`} title={w.title} />
            ) : (
              <EnglishText text={w.text} area="write" source={`writing/${w.id}`} title={w.title} className="text-sm" />
            ),
        }));
    }
    const disc = obj(obj(profile).disc);
    return Object.entries(disc)
      .map(([itemId, raw]) => {
        const rec = obj(raw);
        const days = ['prep', 'take', 'check', 'use'].map((s) => str(rec[s])).filter(Boolean).sort();
        const item = feedItems.find((f) => f.itemId === itemId);
        const last = days[days.length - 1] ?? '';
        return { itemId, item, last, steps: days.length };
      })
      .sort((a, b) => (a.last < b.last ? 1 : -1))
      .map(({ itemId, item, last, steps }) => ({
        id: itemId,
        title: item?.title ?? itemId,
        meta: [fmt(last), t('dcSteps_other', { n: steps })].filter(Boolean).join(' · '),
        body: () => (item ? <EnglishText text={item.gist} area="discover" source={`feed/${item.feedId}#${item.itemId}`} title={item.title} className="text-sm" /> : <p className="text-sm text-muted">{itemId}</p>),
      }));
  })();

  const back = () => go(kind === 'discover' ? { name: 'discover' } : { name: kind, ctx: 'extra' });

  return (
    <section className="flex flex-col gap-5 py-6 sm:py-10" data-testid="history-screen" data-kind={kind}>
      <header className="flex items-center gap-2">
        <IconButton icon="close" label={t('inBack')} onClick={back} data-testid="unit-close" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('inHistoryOf', { channel: t(`ch_${kind}`) })}</h1>
      </header>
      {status !== 'ready' && kind !== 'listen' && kind !== 'discover' ? (
        <div className="flex flex-col gap-2" role="status" aria-label={t('inSkeleton')}>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <HistoryList entries={entries} label={t('inHistoryOf', { channel: t(`ch_${kind}`) })} />
      )}
    </section>
  );
}
