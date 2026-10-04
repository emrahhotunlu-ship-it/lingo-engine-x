import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useHotkeys } from '../../engine/useHotkeys';
import { useHiddenInput } from '../../engine/HiddenInput';
import { usePending, retryFailed } from './persist';
import { useSession } from './session';
import { SummaryActions } from '../learn/ui';
import { useClock } from '../../app/clock';
import { learningDayEnd } from '../../domain/date';
import { calibration, CONTROL } from '../../domain/srs/flip';
import { local } from '../../platform/storage';
import { useMemo, useState } from 'react';
import { startExtra } from './start';

const CALIB_KEY = 'lx:calib-hint';

/**
 * Kalibrierung (anki-regeln §4): ruhiger Satz, wenn „Leicht“ zuletzt zu oft danebenlag – höchstens
 * alle 14 Tage (Merker lokal, reine Bequemlichkeit). Kein Zwang, keine Sperre.
 */
function CalibHint() {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const strict = useSession((s) => s.strict);
  const pool = useSession((s) => s.pool);
  const [show] = useState(() => {
    if (!strict) return null;
    const last = Number(local.get(CALIB_KEY)) || 0;
    if (now - last < CONTROL.hintEveryDays * 86_400_000) return null;
    const c = calibration(pool.map((x) => x.doc), now);
    if (!c.strict) return null;
    local.set(CALIB_KEY, String(now));
    return c;
  });
  if (!show) return null;
  return (
    <p className="text-sm text-muted" data-testid="calib-hint">
      {t('nbWsCalib', { hits: show.hits, pairs: show.pairs })}
    </p>
  );
}

// Zusammenfassung am Rundenende: Anzahl, Trefferquote, nicht Gespeichertes mit „Erneut speichern".

/** Eine weitere freie Runde über alle Fälligen (wie „Wiederholen“ im Wortschatz, nach der Pflicht). */
const MORE_ROUND = 20;

export function Summary({ onBack }: { onBack: () => void }) {
  const { t, tn } = useT();
  const api = useHiddenInput();
  const results = useSession((s) => s.results);
  const round = useSession((s) => s.round);
  const deck = useSession((s) => s.deck);
  const cards = useSession((s) => s.cards);
  const pool = useSession((s) => s.pool);
  const answered = useSession((s) => s.answered);
  const now = useClock((s) => s.now);
  // Noch Fälliges nach dieser Runde (Emrah 02.10.2026: „Alle fälligen 60 Karten“, aber eine Runde hat weniger): nicht
  // beantwortete, fällige Karten dieser Sitzung. Nur nach der Pflicht-Runde und nach freien Runden über alle Fälligen.
  const left = useMemo(() => {
    if (round !== 'pflicht' && deck !== 'all') return 0;
    const end = learningDayEnd(now);
    const done = new Set(answered);
    return pool.filter((c) => !c.isNew && !done.has(c.key) && c.fsrs.due < end).length;
  }, [round, deck, pool, answered, now]);
  const failedCards = usePending((s) => s.failedCards);
  const failed = usePending((s) => s.failed);
  useHotkeys({ enter: onBack }, api.isInput);
  const n = results.length;
  const right = results.filter((r) => r.ok).length;
  const pct = n ? Math.round((right / n) * 100) : 0;
  // Je Wort ein Chip (auch wenn es in der Runde mehrfach kam); rot, sobald ein Versuch falsch war.
  const chips = [...results.reduce((m, r) => m.set(r.key, { key: r.key, word: r.word, ok: (m.get(r.key)?.ok ?? true) && r.ok }), new Map<string, { key: string; word: string; ok: boolean }>()).values()];
  const seeds = new Map<string, Record<string, unknown>>();
  for (const c of cards.values()) if (!c.inDb) seeds.set(c.id, { ...c.doc });
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="summary">
      <header className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Icon name="check" size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{n ? t('sumTitle') : t('sumEmpty')}</h2>
          {n > 0 && (
            <p className="lx-tnum text-base text-muted" data-testid="summary-stats">
              {t('sumStats', { n, pct })}
            </p>
          )}
          {round === 'pflicht' && n > 0 && <p className="text-sm text-accent-text">{t('sumDoneToday')}</p>}
        </div>
      </header>
      {n > 0 && (
        <ul className="flex flex-wrap gap-2" lang="en">
          {chips.map((r) => (
            <li key={r.key} className={`rounded-full border px-3 py-1 text-sm ${r.ok ? 'border-line text-fg' : 'border-line text-danger-text'}`} data-testid="summary-chip" data-ok={r.ok ? '' : undefined}>
              {r.word}
            </li>
          ))}
        </ul>
      )}
      <CalibHint />
      {n > 0 && left > 0 && (
        <div className="flex flex-wrap items-center gap-3" data-testid="summary-more-row">
          <p className="lx-tnum m-0 text-sm text-muted" data-testid="summary-left" data-n={left}>
            {tn('nbWsSumMoreDue', left)}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              onBack();
              startExtra(api, { deck: 'all', size: MORE_ROUND });
            }}
            data-testid="summary-more"
          >
            {t('nbWsSumMoreRound')}
          </Button>
        </div>
      )}
      {(failedCards.length > 0 || failed) && (
        <div className="flex flex-col gap-2 rounded-xl bg-danger-soft p-3" role="alert">
          <p className="text-sm">{failedCards.length ? tn('sumNotSaved', failedCards.length) : t('tdNotSaved')}</p>
          <div>
            <Button onClick={() => void retryFailed(seeds)} icon="refresh">
              {t('tdRetrySave')}
            </Button>
          </div>
        </div>
      )}
      {/* M11: „Weiter: nächster Pflichtschritt" – sonst „Zurück zu Heute". */}
      <SummaryActions onBack={onBack} />
    </article>
  );
}
