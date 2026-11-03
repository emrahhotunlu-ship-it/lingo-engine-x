import { useState } from 'react';
import { addVacation, cancelVacation, changeRestDow } from '../../app/actions';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { restDowOf, VACATION_MAX_DAYS } from '../../domain/streak';
import { Segmented } from '../../ui/Segmented';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { Button } from '../../ui/Button';
import { dateLabelOf } from '../today/dateLabel';

// Großpaket B10 „Urlaub ankündigen“ (Emrahs Wahl 03.11.2026): für gewählte Tage pausiert die Serie – die Tage zählen nicht und reißen sie
// nicht (Regel in domain/streak.ts, `pauseDays`). Höchstens 31 Tage am Stück, Beginn frühestens heute (angekündigt, nicht nachträglich).
// Gespeichert in `app/profile.vac` (nur ergänzend; Aufheben setzt `x`, nichts wird gelöscht).

type Vac = { from: string; to: string; t: number; x?: number };

export function VacationSection() {
  const { t, lang } = useT();
  const db = useCapabilities((s) => s.db);
  const today = useClock((s) => s.today);
  const raw = useLive((s) => s.docs['app/profile']?.vac);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  if (db !== 'ready') return null;
  const list = (Array.isArray(raw) ? (raw as Vac[]) : []).filter((e) => e && !e.x && typeof e.to === 'string' && e.to >= today);
  const span = from && to ? Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1 : 0;
  const problem = !from || !to ? null : from < today ? 'past' : to < from ? 'order' : span > VACATION_MAX_DAYS ? 'long' : null;
  const save = async (): Promise<void> => {
    if (!from || !to || problem) return;
    setBusy(true);
    try {
      if (await addVacation(from, to, today, useClock.getState().now)) {
        setFrom('');
        setTo('');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-3" data-testid="vacation-section">
      <h3 className="lx-eyebrow">{t('vacTitle')}</h3>
      <p className="text-sm text-muted">{t('vacHint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('vacFrom')}</span>
          <input
            type="date"
            className="lx-input min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3"
            min={today}
            max={addDays(today, 365)}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="vac-from"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('vacTo')}</span>
          <input
            type="date"
            className="lx-input min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3"
            min={from || today}
            max={addDays(today, 400)}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="vac-to"
          />
        </label>
        <Button variant="secondary" onClick={() => void save()} disabled={!from || !to || !!problem || busy} data-testid="vac-save">
          {t('vacSave')}
        </Button>
      </div>
      {problem && (
        <p className="text-sm text-wrong-text" role="alert" data-testid="vac-problem">
          {t(problem === 'past' ? 'vacPast' : problem === 'order' ? 'vacOrder' : 'vacLong', { n: VACATION_MAX_DAYS })}
        </p>
      )}
      {list.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="vac-list">
          {list.map((e) => (
            <li key={e.t} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm" data-testid="vac-item">
              <span>{t('vacRange', { from: dateLabelOf(e.from, lang), to: dateLabelOf(e.to, lang) })}</span>
              <Button variant="ghost" onClick={() => void cancelVacation(e.t, useClock.getState().now)} data-testid="vac-cancel">
                {t('vacCancel')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Großpaket B10 „Ruhetag selbst wählen“: Wochentag oder frei. Die Serienregel bleibt (ein Ruhetag je Woche); Heute sagt am Tag Bescheid. */
export function RestDaySection() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const dow = restDowOf(useLive((s) => s.docs['app/profile']?.restDow));
  if (db !== 'ready') return null;
  const options = [{ value: '0', label: t('restFree') }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: t(`restDow${n}` as MessageKey) }))];
  return (
    <section className="flex flex-col gap-3" data-testid="rest-section">
      <h3 className="lx-eyebrow">{t('restTitle')}</h3>
      <Segmented label={t('restTitle')} value={String(dow ?? 0)} columns={4} testId="set-restdow" options={options} onChange={(v) => void changeRestDow(v === '0' ? null : Number(v))} />
      <p className="text-sm text-muted">{t('restHint')}</p>
    </section>
  );
}
