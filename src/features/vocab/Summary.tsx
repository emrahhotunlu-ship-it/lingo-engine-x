import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { leaveBack, useNav } from '../../app/nav';
import { isDue, unitState } from '../../domain/metrics';
import { calibration, CONTROL } from '../../domain/srs/flip';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { local } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { STATE_DOTS } from '../../ui/exercise';
import { SessionEnd } from '../../ui/SessionEnd';
import { dutyLabel } from '../learn/ui';
import { startDuty } from '../learn/flow';
import { firstOpenDuty, useToday } from '../today/state';
import { WordSheet } from './list/WordSheet';
import { retryFailed, usePending } from './persist';
import { useSession } from './session';
import { startExtra } from './start';
import type { TrainCard } from '../../domain/srs/types';

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
    <p className="lx-t-support text-muted" data-testid="calib-hint">
      {t('nbWsCalib', { hits: show.hits, pairs: show.pairs })}
    </p>
  );
}

// Rundenende Wörter (Lernplattform 2.0 §5.6): `SessionEnd mode="growth"` mit echtem Zuwachs („+3 Wörter sicher“), Fehlwörter als antippbare
// Chips (öffnen das Wortblatt) und dem Extra „Fehlwörter nochmal · 2 Min.“. Nichts davon ist eine Antwortzahl als Erfolg.

/** Eine weitere freie Runde über alle Fälligen (wie „Wiederholen“ im Wortschatz, nach der Pflicht). */
const MORE_ROUND = 20;
const STATE_MAX = 4;

export function Summary({ onBack }: { onBack: () => void }) {
  const { t, tn } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  void back;
  const results = useSession((s) => s.results);
  const round = useSession((s) => s.round);
  const deck = useSession((s) => s.deck);
  const cards = useSession((s) => s.cards);
  const pool = useSession((s) => s.pool);
  const answered = useSession((s) => s.answered);
  const activeMs = useSession((s) => s.activeMs);
  const now = useClock((s) => s.now);
  const ready = useToday((s) => s.ready);
  const all = useToday((s) => s);
  const [sheet, setSheet] = useState<TrainCard | null>(null);
  // Noch Fälliges nach dieser Runde (Emrah 02.10.2026: „Alle fälligen 60 Karten“, aber eine Runde hat weniger): nicht
  // beantwortete, fällige Karten dieser Sitzung. Nur nach der Pflicht-Runde und nach freien Runden über alle Fälligen.
  const left = useMemo(() => {
    if (round !== 'pflicht' && deck !== 'all') return 0;
    const done = new Set(answered);
    return pool.filter((c) => !c.isNew && !done.has(c.key) && isDue(c, now)).length;
  }, [round, deck, pool, answered, now]);
  const failedCards = usePending((s) => s.failedCards);
  const failed = usePending((s) => s.failed);
  useHotkeys({ enter: onBack }, api.isInput);
  const n = results.length;
  const right = results.filter((r) => r.ok).length;
  // Je Wort einmal, falsch, sobald ein Versuch falsch war.
  const byKey = results.reduce((m, r) => m.set(r.key, { key: r.key, word: r.word, ok: (m.get(r.key)?.ok ?? true) && r.ok }), new Map<string, { key: string; word: string; ok: boolean }>());
  const wrong = [...byKey.values()].filter((r) => !r.ok);
  // Zuwachs: Zustand zu Beginn der Runde (`pool`) gegen jetzt (`cards`), nur Wörter, die sich verändert haben.
  const before = new Map(pool.map((c) => [c.key, unitState(c)]));
  const growth = [...byKey.keys()].flatMap((key) => {
    const card = cards.get(key);
    const from = before.get(key);
    if (!card || !from) return [];
    const to = unitState(card);
    return STATE_DOTS[to] > STATE_DOTS[from] ? [{ card, from, to }] : [];
  });
  const safeNow = growth.filter((g) => (g.from === 'new' || g.from === 'learning') && (g.to === 'safe' || g.to === 'firm')).length;
  const items = growth.slice(0, 5).map((g) => ({ label: g.card.word, from: STATE_DOTS[g.from], to: STATE_DOTS[g.to], max: STATE_MAX, state: g.to }));
  const facts = n > 0 ? [safeNow > 0 ? tn('wxEndSafe', safeNow) : t('wxEndNone')] : [];
  const seeds = new Map<string, Record<string, unknown>>();
  for (const c of cards.values()) if (!c.inDb) seeds.set(c.id, { ...c.doc });

  const duties = ready ? all : null;
  const nextDuty = duties ? firstOpenDuty(duties) : null;
  const origin = useNav.getState().stack[useNav.getState().stack.length - 1] ?? null;
  const goBack = () => leaveBack(onBack);
  const main = nextDuty
    ? {
        label: t('lrNextDuty', { step: dutyLabel(nextDuty, t) }),
        run: () => {
          onBack();
          startDuty(nextDuty, api);
        },
      }
    : { label: origin ? t('lrBack') : t('sumBack'), run: goBack };

  const takeaways =
    wrong.length > 0 ? (
      <div className="flex flex-col gap-2" data-testid="summary-wrong">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" lang="en">
          {wrong.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-wrong-text hover:bg-surface"
                data-testid="summary-chip"
                data-ok=""
                onClick={() => setSheet(cards.get(r.key) ?? null)}
              >
                {r.word}
              </button>
            </li>
          ))}
        </ul>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              onBack();
              startExtra(api, { only: wrong.map((r) => r.key), label: t('wxEndWrongTitle') });
            }}
            data-testid="summary-redo"
          >
            {t('wxEndRedo')}
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div data-testid="summary" data-n={n}>
      <SessionEnd
        mode="growth"
        title={n ? t('sumTitle') : t('sumEmpty')}
        right={right}
        total={n}
        ms={activeMs}
        items={items}
        facts={facts}
        takeaways={takeaways}
        warning={failedCards.length > 0 || failed ? { text: failedCards.length ? tn('sumNotSaved', failedCards.length) : t('tdNotSaved'), retry: () => void retryFailed(seeds) } : null}
        more={
          n > 0 && left > 0
            ? {
                label: t('wxEndMore', { n: left }),
                run: () => {
                  onBack();
                  startExtra(api, { deck: 'all', size: MORE_ROUND });
                },
              }
            : null
        }
        next={main}
        {...(nextDuty ? { secondary: { label: origin ? t('lrBack') : t('sumBack'), run: goBack } } : {})}
      />
      <CalibHint />
      <WordSheet card={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
