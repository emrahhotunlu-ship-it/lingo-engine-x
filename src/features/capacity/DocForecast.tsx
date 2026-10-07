import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { countDocuments } from '../../data/reads';
import { collectionForecast, collectionRate, docForecast, earliest, WATCHED_COLLECTIONS, type CollectionForecast, type Months, type WatchedCollection } from '../../domain/capacity/forecast';
import { dayKey, isDayKey } from '../../domain/date';
import { useT, type MessageKey } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { docTotal } from '../../domain/capacity/docGuard';

// Einstellungen › Diagnose: „Dokumente 1.234 von 5.000 · Warnschwelle (3.500) in etwa 9–14 Monaten“ (Lernplattform 3.0 P29, §8.2). Dazu je Sammlung
// (Wörter, Wendungen, Protokolle) der Stand gegen die Vorwarnung bei 900 des harten 1.000er-Fensters. Liest nur; schreibt nichts; die tägliche
// Routine wird nicht angefasst. Der Hinweis auf die Gegenmaßnahmen (feed abschalten, Karten bündeln) ist reiner Text – entschieden wird nie von selbst.

const NAME: Record<WatchedCollection, MessageKey> = { vocab: 'pxCapColVocab', chunk: 'pxCapColChunk', log: 'pxCapColLog' };
/** Ab so vielen Monaten Vorlauf (oder wenn schon eine Schwelle erreicht ist) steht der Hinweis auf die Gegenmaßnahmen da. */
const HINT_MONTHS = 6;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Anlage-Tag eines Dokuments: Vokabeln `added` (Tagesschlüssel), Wendungen `created` (ms oder Text). */
function addedDay(doc: Readonly<Record<string, unknown>>): string | null {
  const a = doc.added;
  if (typeof a === 'string' && isDayKey(a.slice(0, 10))) return a.slice(0, 10);
  const c = doc.created;
  if (typeof c === 'number' && Number.isFinite(c)) return dayKey(c);
  return typeof c === 'string' && isDayKey(c.slice(0, 10)) ? c.slice(0, 10) : null;
}

export function DocForecast() {
  const { t, num } = useT();
  const db = useCapabilities((s) => s.db);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const vocab = useLive((s) => s.collections.vocab);
  const chunk = useLive((s) => s.collections.chunk);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (db !== 'ready') return;
    const handle = getDb();
    if (!handle) return;
    let alive = true;
    // Eine Zählung je Öffnen (wie die Diagnose); Lesen ohne Schreiben.
    countDocuments(handle).then(
      (c) => {
        if (alive) setCounts(c.byCollection);
      },
      (err: unknown) => {
        logWarn('capacity:forecast', err);
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [db]);

  const view = useMemo(() => {
    if (!counts) return null;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || docTotal();
    const doc = docForecast({ total, history: isObj(profile) ? profile.history : undefined, today });
    const days = isObj(profile) && isObj(profile.days) ? Object.entries(profile.days).filter(([k, v]) => isDayKey(k) && typeof v === 'number' && v > 0).map(([k]) => k) : [];
    const rateOf = (name: WatchedCollection): number | null => {
      if (name === 'log') return collectionRate(days, today);
      const col = name === 'vocab' ? vocab : chunk;
      if (!col) return null;
      return collectionRate([...col.values()].flatMap((d) => addedDay(d) ?? []), today);
    };
    const cols = WATCHED_COLLECTIONS.map((name) => collectionForecast({ name, count: counts[name] ?? 0, perDay: rateOf(name) }));
    return { doc, cols, first: earliest([{ label: 'doc', months: doc.months }, ...cols.map((c) => ({ label: c.name, months: c.months }))]) };
  }, [counts, profile, vocab, chunk, today]);

  if (db !== 'ready') return null;
  if (failed) {
    return (
      <section className="flex flex-col gap-2" data-testid="doc-forecast">
        <h3 className="lx-eyebrow">{t('pxCapTitle')}</h3>
        <p className="m-0 text-sm text-muted">{t('pxCapUnknown')}</p>
      </section>
    );
  }
  if (!view) return null;

  const suffix = (m: Months | 'reached' | null, markKey: MessageKey, at: number, full = false, limit = 0): string => {
    const mark = t(markKey);
    const vars = { mark, at: num(at) };
    if (full) return t('pxCapSufFull', { limit: num(limit) });
    if (m === 'reached') return t('pxCapSufReached', vars);
    if (m === null) return t('pxCapSufNone', vars);
    if (m.lo === m.hi) return t(m.lo === 1 ? 'pxCapSufMonthsSame_one' : 'pxCapSufMonthsSame_other', { ...vars, lo: num(m.lo) });
    return t('pxCapSufMonths', { ...vars, lo: num(m.lo), hi: num(m.hi) });
  };
  const colLine = (c: CollectionForecast): string =>
    `${t('pxCapCol', { name: t(NAME[c.name]), n: num(c.count), limit: num(c.limit) })} ${suffix(c.months, 'pxCapMarkPre', c.prewarnAt, c.state === 'full', c.limit)}`;
  const d = view.doc;
  const near = view.first !== null && (view.first.months === 'reached' || view.first.months.lo < HINT_MONTHS);
  return (
    <section className="flex flex-col gap-2" data-testid="doc-forecast">
      <h3 className="lx-eyebrow">{t('pxCapTitle')}</h3>
      <p className="m-0 text-sm" data-testid="doc-forecast-line" data-state={d.state}>
        {t('pxCapDocs', { n: num(d.total), limit: num(d.limit) })} {suffix(d.months, 'pxCapMarkWarn', d.warnAt)}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="doc-forecast-cols">
        {view.cols.map((c) => (
          <li key={c.name} className="text-sm text-muted" data-testid={`doc-forecast-${c.name}`} data-state={c.state}>
            {colLine(c)}
          </li>
        ))}
      </ul>
      {(near || d.state !== 'ok' || view.cols.some((c) => c.state !== 'ok')) && (
        <p className="m-0 text-xs text-subtle" data-testid="doc-forecast-hint">
          {t('pxCapHint')}
        </p>
      )}
    </section>
  );
}
