import { useClock } from '../../app/clock';
import { addDays, isoWeek } from '../../domain/date';
import { topPatterns, trendOf, type Pattern } from '../../domain/patterns/patterns';
import { useT } from '../../i18n';
import { TREND_KEY, TREND_TONE } from './parts';
import { usePatternData } from './usePatternData';

// Wochenbericht (Lernberatung 27.09., V8/Nr. 9): Sind die Fokus-Punkte bzw. die wichtigsten
// Deutsch-Fallen in der berichteten Woche seltener geworden, gleich geblieben oder häufiger?
// Lokal gezählt (ohne KI). Ohne Muster: nichts.

export function PatternsWeekly({ firstDay }: { firstDay: string }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const data = usePatternData();
  const doc = data.doc;
  if (data.status !== 'ready' || !doc || !doc.items.length) return null;
  const curW = isoWeek(firstDay);
  const prevW = isoWeek(addDays(firstDay, -7));
  const byId = new Map(doc.items.map((p) => [p.id, p]));
  const fromFocus = data.focus.map((f) => (f.patternId ? byId.get(f.patternId) : undefined)).filter((p): p is Pattern => !!p);
  const list = fromFocus.length ? fromFocus : topPatterns(doc, today, 3);
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3" data-testid="weekly-patterns" data-week={curW}>
      <h3 className="text-sm font-semibold">{t('ptWeeklyTitle')}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {list.map((p) => {
          const tr = trendOf(doc.history, p.id, prevW, curW);
          return (
            <li key={p.id} className="lx-tnum" data-testid="weekly-pattern" data-id={p.id} data-trend={tr.trend}>
              {t('ptWeeklyRow', { title: lang === 'en' ? p.title_en : p.title_de, prev: tr.prev, cur: tr.cur })}
              {' · '}
              <span className={TREND_TONE[tr.trend]}>{t(TREND_KEY[tr.trend])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
