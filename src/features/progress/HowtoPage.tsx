import { useCompanionSee } from '../companion/seeing';
import { useT, type MessageKey } from '../../i18n';

// Großpaket B10 „So funktioniert’s“ (Emrahs Wahl 03.11.2026, docs/umbau/design/grosspaket-b.md §7): die Regeln der App in einfachen Worten –
// Tagesweg, Wiederholen, Bewertung, Serie. Nur Text, keine Daten; jede Aussage entspricht der echten Regel (Serie: domain/streak.ts,
// Tageswechsel 04:00, Ruhetag je ISO-Woche; Bewertung ohne Selbstbewertung, entscheidungen.md A7).

const PARTS: ReadonlyArray<{ id: string; head: MessageKey; lines: readonly MessageKey[] }> = [
  { id: 'day', head: 'hwDayH', lines: ['hwDay1', 'hwDay2', 'hwDay3'] },
  { id: 'review', head: 'hwReviewH', lines: ['hwReview1', 'hwReview2', 'hwReview3'] },
  { id: 'grade', head: 'hwGradeH', lines: ['hwGrade1', 'hwGrade2', 'hwGrade3'] },
  { id: 'streak', head: 'hwStreakH', lines: ['hwStreak1', 'hwStreak2', 'hwStreak4', 'hwStreak3'] },
];

export function HowtoPage() {
  const { t } = useT();
  useCompanionSee({ area: 'overview', label: t('hwTitle'), phase: 'idle' });
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 sm:py-10" data-testid="howto-page">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('hwTitle')}</h1>
      <p className="text-muted">{t('hwLead')}</p>
      {PARTS.map((p) => (
        <section key={p.id} className="lx-card flex flex-col gap-2 p-[1.125rem]" aria-labelledby={`hw-${p.id}`} data-testid="howto-part" data-part={p.id}>
          <h2 id={`hw-${p.id}`} className="text-lg font-semibold">
            {t(p.head)}
          </h2>
          {p.lines.map((k) => (
            <p key={k} className="leading-relaxed">
              {t(k)}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
