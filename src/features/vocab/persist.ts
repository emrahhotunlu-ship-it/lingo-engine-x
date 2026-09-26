import { create } from 'zustand';
import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { applyUpdate, reviewWrite, type SkipReason } from '../../domain/srs/applyReview';
import { logEntry, mergeLogEntries, type LogEntry } from '../../domain/progress/logPatch';
import { minimalProfile, profilePatch, roundMinutes, type RoundEnd } from '../../domain/progress/profilePatch';
import { unitsPatch, unitMinutes, type UnitEnd } from '../../domain/progress/unitPatch';
import type { ChannelLogEntry } from '../../domain/progress/channelLog';
import type { AnswerEvent } from '../../domain/srs/types';
import { logError, logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';

// Schreibwege des Trainers (Daten-Entwurf §0, §1, §3.3, §4), nur über den einen Writer:
// - die Karte sofort nach jeder bewerteten Antwort (`transform`, frischer Stand),
// - Profil-Zähler und Tagesprotokoll gesammelt: nach 4 Antworten, 8 s Ruhe, Rundenende,
//   Verlassen der Seite und sofort bei der ersten Antwort einer Runde.
// Der Puffer liegt nur im Speicher; „Heute" zeigt ihn sofort mit an (live ⊕ Puffer).

type Doc = Record<string, unknown>;
export type PendingEntry = (LogEntry | ChannelLogEntry) & { day: string };

type PendingState = {
  /** Protokolleinträge, die noch nicht bestätigt gespeichert sind. */
  entries: PendingEntry[];
  /** Minuten beendeter Runden, deren Zähler noch nicht gespeichert sind (Lerntag → Minuten). */
  minutes: Record<string, number>;
  /** Abgeschlossene Einheiten (Phase 4), deren Zähler noch nicht gespeichert sind: Lerntag → act-Schlüssel → Anzahl. */
  units: Record<string, Record<string, number>>;
  /** Karten, deren Speichern gescheitert ist (erneut anwendbar, ohne Schaden). */
  failedCards: AnswerEvent[];
  /** Letzter Sammel-Schreibvorgang gescheitert – Hinweis und „Erneut speichern". */
  failed: boolean;
};

export const usePending = create<PendingState>(() => ({ entries: [], minutes: {}, units: {}, failedCards: [], failed: false }));

const FLUSH_EVERY = 4;
const FLUSH_IDLE_MS = 8000;
const T_KEY = `${KEY_PREFIX}lastT`;
const DEVICE_KEY = `${KEY_PREFIX}device`;

let lastT = 0;
let answersToSend: AnswerEvent[] = [];
let roundsToSend: RoundEnd[] = [];
let unitsToSend: UnitEnd[] = [];
let idle: number | null = null;
let running: Promise<boolean> | null = null;
let again = false;

/** Zeitstempel je Antwort, je Gerät streng steigend – auch über ein Neuladen hinweg. */
export function nextT(): number {
  if (!lastT) lastT = Number(local.get(T_KEY)) || 0;
  lastT = Math.max(Date.now(), lastT + 1);
  local.set(T_KEY, String(lastT));
  return lastT;
}

let device: string | null | undefined;
function deviceId(): string | null {
  if (device !== undefined) return device;
  const saved = local.get(DEVICE_KEY);
  if (saved && /^[a-z0-9]{4,16}$/.test(saved)) return (device = saved);
  const id = Math.random().toString(36).slice(2, 10);
  device = local.set(DEVICE_KEY, id) ? id : null;
  return device;
}

const IGNORABLE: ReadonlySet<SkipReason> = new Set(['already_applied']);

/** Karte speichern. `seedDefault` = Startvokabel ohne Dokument (wird dann vollständig angelegt). */
export async function saveCard(a: AnswerEvent, seedDefault: Doc | null): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `vocab/${a.id}`;
  let skipped: SkipReason | null = null;
  try {
    await writer.transform(path, (cur) => {
      const w = reviewWrite(path, cur, a, seedDefault);
      if (w.kind === 'skip') {
        skipped = w.reason;
        return null;
      }
      return w.kind === 'create' ? { set: w.doc } : { update: w.patch };
    });
    if (skipped && !IGNORABLE.has(skipped)) logWarn('trainer:card', { code: skipped, message: `${path} nicht geschrieben` }, path);
    usePending.setState((s) => ({ failedCards: s.failedCards.filter((f) => f.t !== a.t) }));
    return true;
  } catch (err) {
    logError('trainer:card', err, path);
    usePending.setState((s) => ({ failedCards: s.failedCards.some((f) => f.t === a.t) ? s.failedCards : [...s.failedCards, a] }));
    return false;
  }
}

function schedule(): void {
  if (idle !== null) window.clearTimeout(idle);
  idle = window.setTimeout(() => {
    idle = null;
    void flush();
  }, FLUSH_IDLE_MS);
}

/** Antwort für Zähler und Protokoll vormerken. */
export function recordAnswer(a: AnswerEvent, immediate: boolean): void {
  answersToSend.push(a);
  usePending.setState((s) => ({ entries: [...s.entries, { ...logEntry(a), day: a.day }] }));
  if (immediate || answersToSend.length >= FLUSH_EVERY) void flush();
  else schedule();
}

/** Rundenende vormerken und sofort speichern. */
export function recordRoundEnd(r: RoundEnd): Promise<boolean> {
  if (r.n >= 1) {
    roundsToSend.push(r);
    usePending.setState((s) => ({ minutes: { ...s.minutes, [r.day]: (s.minutes[r.day] ?? 0) + roundMinutes(r) } }));
  }
  return flush();
}

/** Protokolleinträge von Lesen, Hören, Entdecken vormerken (derselbe Sammelweg, Plan §3.2). */
export function recordChannelEntries(entries: ReadonlyArray<ChannelLogEntry & { day: string }>): void {
  if (!entries.length) return;
  usePending.setState((s) => ({ entries: [...s.entries, ...entries] }));
  schedule();
}

const addUnit = (units: PendingState['units'], u: UnitEnd, sign: 1 | -1): PendingState['units'] => {
  const day = { ...(units[u.day] ?? {}) };
  day[u.act] = Math.max(0, (day[u.act] ?? 0) + sign);
  return { ...units, [u.day]: day };
};

/** Abschluss einer Einheit vormerken und sofort speichern (optimistisch sichtbar, Plan F5). */
export function recordUnitEnd(u: UnitEnd): Promise<boolean> {
  unitsToSend.push(u);
  usePending.setState((s) => ({ units: addUnit(s.units, u, 1), minutes: { ...s.minutes, [u.day]: (s.minutes[u.day] ?? 0) + unitMinutes(u) } }));
  return flush();
}

async function flushOnce(): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let ok = true;

  // 1. app/profile (serienrelevant) – ein Schreibvorgang mit Folgenummer gegen Doppelzählung.
  const answers = answersToSend;
  const rounds = roundsToSend;
  const units = unitsToSend;
  answersToSend = [];
  roundsToSend = [];
  unitsToSend = [];
  if (answers.length || rounds.length || units.length) {
    const seq = nextT();
    const dev = deviceId();
    const day = answers[0]?.day ?? rounds[0]?.day ?? units[0]?.day ?? '';
    try {
      await writer.transform('app/profile', (cur) => {
        if (!cur) {
          const base = minimalProfile(day);
          const patch = unitsPatch(base, profilePatch(base, answers, rounds, { deviceId: dev, seq }), units, { deviceId: dev, seq });
          return patch ? { set: applyUpdate(base, patch) } : null;
        }
        const patch = unitsPatch(cur, profilePatch(cur, answers, rounds, { deviceId: dev, seq }), units, { deviceId: dev, seq });
        if (!patch && !validateDoc('app/profile', cur).ok) logWarn('trainer:profile', { code: 'invalid_document', message: 'Profil ungültig – Zähler nicht geschrieben' }, 'app/profile');
        return patch ? { update: patch } : null;
      });
      usePending.setState((s) => {
        const minutes = { ...s.minutes };
        for (const r of rounds) minutes[r.day] = Math.max(0, (minutes[r.day] ?? 0) - roundMinutes(r));
        let pendingUnits = s.units;
        for (const u of units) {
          minutes[u.day] = Math.max(0, (minutes[u.day] ?? 0) - unitMinutes(u));
          pendingUnits = addUnit(pendingUnits, u, -1);
        }
        return { minutes, units: pendingUnits };
      });
    } catch (err) {
      logError('trainer:profile', err, 'app/profile');
      answersToSend = [...answers, ...answersToSend];
      roundsToSend = [...rounds, ...roundsToSend];
      unitsToSend = [...units, ...unitsToSend];
      ok = false;
    }
  }

  // 2. log/<tag> – je Lerntag ein Dokument.
  const pending = usePending.getState().entries;
  const byDay = new Map<string, PendingEntry[]>();
  for (const e of pending) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  for (const [day, list] of byDay) {
    const path = `log/${day}`;
    const entries: LogEntry[] = list.map((e) => {
      const out: Partial<PendingEntry> = { ...e };
      delete out.day;
      return out as LogEntry;
    });
    try {
      let invalid = false;
      await writer.transform(path, (cur) => {
        if (!cur) return { set: { date: day, entries: mergeLogEntries([], entries) } };
        if (!validateDoc(path, cur).ok || (cur.entries != null && !Array.isArray(cur.entries))) {
          invalid = true;
          return null;
        }
        return { update: { entries: mergeLogEntries(Array.isArray(cur.entries) ? cur.entries : [], entries) } };
      });
      if (invalid) {
        logError('trainer:log', { code: 'invalid_document', message: 'Tagesprotokoll ungültig – nicht überschrieben' }, path);
        ok = false;
        continue;
      }
      const sent = new Set(list.map((e) => `${e.t}|${e.id}`));
      usePending.setState((s) => ({ entries: s.entries.filter((e) => !sent.has(`${e.t}|${e.id}`)) }));
    } catch (err) {
      logError('trainer:log', err, path);
      ok = false;
    }
  }
  usePending.setState({ failed: !ok });
  return ok;
}

/** Gesammelt speichern (nie zwei Durchläufe gleichzeitig; ein weiterer Auslöser läuft danach). */
export function flush(): Promise<boolean> {
  if (idle !== null) {
    window.clearTimeout(idle);
    idle = null;
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let ok = await flushOnce();
    while (again) {
      again = false;
      ok = await flushOnce();
    }
    running = null;
    return ok;
  })();
  return running;
}

/** Gescheiterte Karten erneut anwenden (derselbe Zeitstempel: nie doppelt). */
export async function retryFailed(seedDefaults: ReadonlyMap<string, Doc>): Promise<void> {
  for (const a of usePending.getState().failedCards) await saveCard(a, seedDefaults.get(a.id) ?? null);
  await flush();
}

let listening = false;
/** Beim Verlassen der Seite gesammelt speichern (einmal registriert). */
export function installFlushOnHide(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => void flush());
}
