import type { Resumable } from '../../app/resume';
import { loadResume } from '../../app/resume';
import { useClock } from '../../app/clock';
import { invalidIdsOf, useLive } from '../../data/live';
import type { CheckRecord, ResultItem } from '../../domain/check/record';
import type { CheckItem } from '../../domain/check/select';
import { buildTrainCards } from '../../domain/metrics';
import { buildExercise } from '../../domain/srs/exercise';
import { useSettings } from '../../app/settings';
import { useCheck } from './session';

// Fortsetzen des Wochen-Checks nach Neuladen (plan.md §4.0 G3, architektur.md §3.2): Aufgaben,
// Position und bisherige Ergebnisse. Lokal liegen nur Kennungen und Aufgaben (keine Karteninhalte);
// Karten und Übung werden aus den Live-Daten neu gebaut. `restore` schreibt nie in die db.

export type CheckSnap = { day: string; unit: boolean; items: CheckItem[]; pos: number; results: ResultItem[]; prev: CheckRecord | null };

export const CHECK_RESUME_VERSION = 1;

function snapshot(): CheckSnap | null {
  const s = useCheck.getState();
  if (!s.active || s.status !== 'running' || !s.items.length) return null;
  return { day: s.day, unit: s.unit, items: s.items, pos: s.pos, results: s.results, prev: s.prev };
}

/** Stellt den Check SYNCHRON her (Klick-Handler). `false` = verwerfen (anderer Tag, nichts mehr offen). */
export function restoreCheck(snap: CheckSnap): boolean {
  if (!snap || !Array.isArray(snap.items) || snap.pos >= snap.items.length || snap.day !== useClock.getState().today) return false;
  const live = useLive.getState();
  const now = useClock.getState().now;
  const lang = useSettings.getState().lang;
  const all = buildTrainCards(live.collections.vocab ?? new Map(), now, invalidIdsOf(live.invalid, 'vocab'));
  const cards = new Map(all.map((c) => [c.key, c]));
  const pool = all.filter((c) => !c.hidden);
  // Aufgaben ohne Karte (inzwischen gelöscht) werden übersprungen.
  const items = snap.items.filter((it, k) => k < snap.pos || it.kind === 'g' || cards.has(it.key));
  let pos = Math.min(snap.pos, items.length);
  const exerciseAt = (p: number) => {
    const it = items[p];
    if (!it || it.kind !== 'v') return null;
    const card = cards.get(it.key);
    return card ? buildExercise(card, it.ex, lang, pool, `check|resume|${p}`) : null;
  };
  let exercise = exerciseAt(pos);
  while (pos < items.length && items[pos]?.kind === 'v' && !exercise) exercise = exerciseAt(++pos);
  if (pos >= items.length) return false;
  useCheck.setState({
    active: true,
    status: 'running',
    unit: !!snap.unit,
    day: snap.day,
    lang,
    items,
    cards,
    pool,
    pos,
    step: useCheck.getState().step + 1,
    exercise,
    results: snap.results.slice(0, pos),
    startedAt: performance.now(),
    record: null,
    prev: snap.prev,
    saved: 'idle',
  });
  return true;
}

export const checkResumable: Resumable<CheckSnap> = {
  id: 'check',
  version: CHECK_RESUME_VERSION,
  origin: 'today',
  snapshot,
  subscribe: (cb) => useCheck.subscribe(cb),
  restore: restoreCheck,
  route: () => ({ name: 'check' }),
  label: (s, t) => t('nbHeuteResumeCheck', { n: Math.min(s.items.length, s.pos + 1), total: s.items.length }),
};

/** Player (§2.3): Sitzung aktiv? Sonst aus dem Fortsetz-Speicher herstellen, sonst zurück. */
export function ensureCheck(): boolean {
  if (useCheck.getState().active) return true;
  const env = loadResume('check');
  if (!env || env.v !== CHECK_RESUME_VERSION) return false;
  return restoreCheck(env.data as CheckSnap);
}
