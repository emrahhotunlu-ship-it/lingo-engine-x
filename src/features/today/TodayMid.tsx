import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { errorsDueByTopic } from '../../domain/metrics';
import { useT } from '../../i18n';
import { chapterNodes } from '../grammar/chapters';
import { useVocabMetrics } from '../progress/WordsSegment';

// Großpaket G7 (M11): keine zwei Kennzahl-Karten mehr unter dem Hauptknopf (Kap. 2 Nr. 1: keine konkurrierenden Karten), sondern eine ruhige
// Zeile „Dein Stand“ ganz unten, ohne Kartenfläche. Zahlen und Quellen unverändert.
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
    <section className="lx-vh-mid" aria-labelledby="td-stand" data-testid="today-stand">
      <h2 id="td-stand" className="lx-vh-lbl">
        {t('gmStandHead')}
      </h2>
      <p className="lx-vh-mid-item lx-v-num" data-testid="today-stand-words" data-fest={fest}>
        {fest === 0 ? (
          // UX-Audit U1: keine nackte Null als Kopfzahl, sondern ein ruhiges Urteil (wie auf „Fortschritt“).
          onWay > 0 ? (
            tn('gmStandOnWay', onWay)
          ) : (
            t('nbProfilFestZeroTitle')
          )
        ) : (
          <>
            {num(fest)} {t(fest === 1 ? 'nbProfilFestUnit_one' : 'nbProfilFestUnit_other')}
          </>
        )}
      </p>
      {cur && (
        <p className="lx-vh-mid-item lx-vh-mid-first lx-v-num" data-testid="today-stand-chapter">
          {t('hxPathChapter', { n: path.current + 1, name: lang === 'en' ? cur.name.en : cur.name.de })} · {t('hxPathSafe', { a: cur.safe, b: cur.topics.length })}
        </p>
      )}
    </section>
  );
}
