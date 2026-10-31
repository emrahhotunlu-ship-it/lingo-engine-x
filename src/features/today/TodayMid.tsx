import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { errorsDueByTopic } from '../../domain/metrics';
import { useT } from '../../i18n';
import { VCard } from '../../ui/v';
import { chapterNodes } from '../grammar/chapters';
import { useVocabMetrics } from '../progress/WordsSegment';

// Ruhige Mitte unter der Tageskarte am Laptop (Relaunch Teil 1c, D2 V-HEUTE; Vorschau L1 `l1Mid`, desk.js:126–131; ersetzt `StandSide.tsx`):
// zwei Karten nebeneinander – **Kapitelstand** (`chapterNodes` wie im Lernweg, „Thema x von y“) und an der Stelle von „Dein nächster Termin“
// (gibt es erst mit F4) die echte Karte **Wörter fest** (`useVocabMetrics` → `festCount`, wie auf „Fortschritt“; stufe1c-plan §2).
// Kein toter Knopf, keine Platzhalter-Zahl, nichts wird geschrieben. Im Dokument steht „Wörter fest“ zuerst (Reihenfolge der Zahlen wie bisher,
// Golden-Test P5), sichtbar steht der Kapitelstand links wie in der Vorschau (`order`). Am Handy steht sie nicht (der Aufrufer zeichnet sie nur breit).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

export function TodayMid() {
  const { t, tn, num, lang } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const { fest, onWay } = useVocabMetrics();
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const path = useMemo(() => chapterNodes({ docs, nowMs: now, today, dueByTopic: errorsDueByTopic(docs, now) }), [docs, now, today]);
  const cur = path.chapters[path.current];
  return (
    <section className="lx-vh-mid" aria-label={t('ovTitle')} data-testid="today-stand">
      <VCard className="lx-vh-mid-card" data-testid="today-stand-words" data-fest={fest}>
        <span className="lx-vh-lbl">{t('stWords')}</span>
        {fest === 0 ? (
          // UX-Audit U1: keine nackte Null als Kopfzahl, sondern ein ruhiges Urteil (wie auf „Fortschritt“).
          <>
            <b>{t('nbProfilFestZeroTitle')}</b>
            <span className="lx-vh-p2">{onWay > 0 ? tn('nbProfilFestZeroSub', onWay) : t('nbProfilFestZeroNone')}</span>
          </>
        ) : (
          <>
            <b className="lx-v-num">
              {num(fest)} {t(fest === 1 ? 'nbProfilFestUnit_one' : 'nbProfilFestUnit_other')}
            </b>
          </>
        )}
      </VCard>
      {cur && (
        <VCard className="lx-vh-mid-card lx-vh-mid-first" data-testid="today-stand-chapter">
          <span className="lx-vh-lbl">{t('stChapter')}</span>
          <b>{t('hxPathChapter', { n: path.current + 1, name: lang === 'en' ? cur.name.en : cur.name.de })}</b>
          <span className="lx-vh-p2 lx-v-num">{t('hxPathSafe', { a: cur.safe, b: cur.topics.length })}</span>
        </VCard>
      )}
    </section>
  );
}
