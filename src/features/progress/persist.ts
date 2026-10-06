import { create } from 'zustand';
import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { courseDone } from '../../domain/course/courseDone';
import { mergeRadar, radarEvent, topicCat } from '../../domain/grammar/radar';
import { grammarWrite } from '../../domain/grammar/write';
import type { NewRepair } from '../../domain/repair/repair';
import { saveRepairs } from '../repair/store';
import type { DrillAnswer, GrammarAnswer, LearnRecorder, LearnRoundEnd, LessonDone, RadarEvent, SprintEntry } from '../../domain/learn/types';
import { activityEntry, drillLogEntry, grammarLogEntry, logEntry, mergeLogEntries, type ActivityLogEntry, type AnyLogEntry, type RepairLogEntry } from '../../domain/progress/logPatch';
import { minimalProfile, profilePatch, roundMinutes, SEQ_KEEP_MS, type CountEvent, type RoundEnd } from '../../domain/progress/profilePatch';
import { unitMinutes, unitsPatch, type UnitEnd } from '../../domain/progress/unitPatch';
import { applyUpdate } from '../../domain/srs/applyReview';
import type { AnswerEvent } from '../../domain/srs/types';
import type { Writer } from '../../data/writer';
import type { ChannelLogEntry } from '../../domain/progress/channelLog';
import { logError, logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local, session } from '../../platform/storage';

// Die EINE Sammel-Schreibwarteschlange (phase2-plan D5, §4.1): `app/profile`, `log/<tag>`,
// `app/radar` und der Lektionsabschluss in `app/course` gehen nur hier hindurch. Grund:
// `lxSeq[tab] >= seq` verwirft Stapel; zwei Warteschlangen mit verschränkten Folgenummern
// würden Antworten verlieren.
//
// - D6 (W1): Ein gescheiterter Stapel behält seine Folgenummer und wird unverändert und ZUERST
//   erneut gesendet. Neue Antworten sammeln sich im Folgestapel. War das scheinbar gescheiterte
//   `update` doch angekommen, wirkt es so nie doppelt, und es geht nichts verloren.
// - D7: Die Kennung gilt je Tab (`sessionStorage` `lx:tab`); zwei Tabs verwerfen sich nie
//   gegenseitig Stapel. `lxSeq`-Einträge älter als 14 Tage setzt derselbe Schreibvorgang auf `null`.
// - Gesammelt wird nach 4 Antworten, 8 s Ruhe, sofort bei Rundenende, Lektionsabschluss und beim
//   Verlassen der Seite. Der Puffer liegt nur im Speicher; „Heute" zeigt ihn mit an (live ⊕ Puffer).
// - `grammar/<topic>` und `vocab/*` werden sofort je Antwort geschrieben (nicht hier gesammelt).

type Doc = Record<string, unknown>;
export type PendingEntry = AnyLogEntry & { day: string };

type PendingState = {
  /** Protokolleinträge, die noch nicht bestätigt gespeichert sind. */
  entries: PendingEntry[];
  /** Minuten beendeter Runden, deren Zähler noch nicht gespeichert sind (Lerntag → Minuten). */
  minutes: Record<string, number>;
  /** Beendete Runden, deren Zähler noch nicht gespeichert sind (für Pflicht „Kanal", D9). */
  rounds: Array<{ day: string; act: string; partial: boolean }>;
  /** Lerntage mit abgeschlossener, noch nicht gespeicherter Lektion (D10). */
  lessonDays: string[];
  /** Phase 4 (F5): abgeschlossene Einheiten, noch nicht gespeichert – Lerntag → act-Schlüssel → Anzahl. */
  units: Record<string, Record<string, number>>;
  /** Karten, deren Speichern gescheitert ist (erneut anwendbar, ohne Schaden). */
  failedCards: AnswerEvent[];
  /** Grammatik-Antworten, deren Thema nicht gespeichert werden konnte. */
  failedGrammar: GrammarAnswer[];
  /** Letzter Sammel-Schreibvorgang gescheitert – Hinweis und „Erneut speichern". */
  failed: boolean;
};

const empty = (): PendingState => ({ entries: [], minutes: {}, rounds: [], lessonDays: [], units: {}, failedCards: [], failedGrammar: [], failed: false });
export const usePending = create<PendingState>(empty);

const FLUSH_EVERY = 4;
const FLUSH_IDLE_MS = 8000;
const T_KEY = `${KEY_PREFIX}lastT`;
const TAB_KEY = `${KEY_PREFIX}tab`;

type Batch = { seq: number; answers: AnswerEvent[]; counts: CountEvent[]; rounds: RoundEnd[]; sprints: SprintEntry[]; units: UnitEnd[] };
type Open = Omit<Batch, 'seq'>;
const emptyOpen = (): Open => ({ answers: [], counts: [], rounds: [], sprints: [], units: [] });
const isEmpty = (o: Open) => !o.answers.length && !o.counts.length && !o.rounds.length && !o.sprints.length && !o.units.length;
/** Phase 4: Profilfelder ohne Zähler (`disc`, `gen`) – idempotent, nur bei echter Änderung. */
type FieldPatch = { scope: string; compute: (cur: Readonly<Doc>) => Doc | null; done: (ok: boolean) => void };

let lastT = 0;
let open: Open = emptyOpen();
/** D6: gescheiterter Stapel mit seiner Folgenummer. */
let failedBatch: Batch | null = null;
let radarQueue: RadarEvent[] = [];
let lessonQueue: LessonDone[] = [];
let fieldQueue: FieldPatch[] = [];
let idle: number | null = null;
let running: Promise<boolean> | null = null;
let again = false;
let bufferedAnswers = 0;

/** Zeitstempel je Antwort, je Gerät streng steigend – auch über ein Neuladen hinweg. */
export function nextT(): number {
  if (!lastT) lastT = Number(local.get(T_KEY)) || 0;
  lastT = Math.max(Date.now(), lastT + 1);
  local.set(T_KEY, String(lastT));
  return lastT;
}

let tab: string | undefined;
/** Kennung dieses Tabs (D7). Ohne Tab-Speicher gilt eine Kennung je Laden der Seite. */
export function tabId(): string {
  if (tab) return tab;
  const saved = session.get(TAB_KEY);
  if (saved && /^[a-z0-9]{4,16}$/.test(saved)) return (tab = saved);
  const id = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  session.set(TAB_KEY, id);
  return (tab = id);
}

// ------------------------------------------------------------------ Pflicht (Regel 1)

/**
 * Entscheidet im Profil-`transform`, ob heute die Pflicht erfüllt ist (`pflichtFor`). Standard:
 * keiner – dann wird `pflicht` nicht geschrieben. Die Heute-Anzeige meldet sich hier an, sobald
 * der Phase-2-Tagesplan aktiv ist.
 */
export type PflichtResolver = (i: { profile: Readonly<Doc>; batch: Readonly<Open> }) => string | readonly string[] | null;
let pflichtResolver: PflichtResolver | null = null;
export function setPflichtResolver(fn: PflichtResolver | null): void {
  pflichtResolver = fn;
}

// ------------------------------------------------------------------ Aufzeichnen

function schedule(): void {
  if (typeof window === 'undefined') return;
  if (idle !== null) window.clearTimeout(idle);
  idle = window.setTimeout(() => {
    idle = null;
    void flush();
  }, FLUSH_IDLE_MS);
}

function pushEntry(e: AnyLogEntry, day: string): void {
  usePending.setState((s) => ({ entries: [...s.entries, { ...e, day }] }));
}

function afterAnswer(immediate: boolean): void {
  bufferedAnswers++;
  if (immediate || bufferedAnswers >= FLUSH_EVERY) void flush();
  else schedule();
}

/** Vokabel-Antwort für Zähler und Protokoll vormerken. */
export function recordAnswer(a: AnswerEvent, immediate: boolean): void {
  open.answers.push(a);
  pushEntry(logEntry(a), a.day);
  afterAnswer(immediate);
}

function addRound(r: RoundEnd, sprint?: SprintEntry): void {
  if (r.n < 1) return;
  open.rounds.push(r);
  if (sprint) open.sprints.push(sprint);
  usePending.setState((s) => ({
    minutes: { ...s.minutes, [r.day]: (s.minutes[r.day] ?? 0) + roundMinutes(r) },
    rounds: [...s.rounds, { day: r.day, act: r.act, partial: r.partial }],
  }));
}

/** Rundenende vormerken und sofort speichern. */
export function recordRoundEnd(r: RoundEnd): Promise<boolean> {
  addRound(r);
  return flush();
}

/**
 * Phase 3 (Plan §3.6): beendetes Gespräch bzw. Business-Einheit – ein Log-Eintrag, ein
 * Rundenende (`act: speak|biz`, `countAs`) und die Radar-Ereignisse im SELBEN Puffer, sofort
 * gespeichert. So bleiben Profil, Log, Radar und `lxSeq` eine Quelle (D5, B6). `day` = Lerntag des Beginns.
 */
export function recordActivity(e: ActivityLogEntry, round: RoundEnd & { day: string }, radar: readonly RadarEvent[] = []): Promise<boolean> {
  pushEntry(activityEntry(e), round.day);
  if (radar.length) radarQueue.push(...radar);
  addRound(round);
  return flush();
}

const addUnit = (units: PendingState['units'], u: UnitEnd, sign: 1 | -1): PendingState['units'] => {
  const day = { ...(units[u.day] ?? {}) };
  day[u.act] = Math.max(0, (day[u.act] ?? 0) + sign);
  return { ...units, [u.day]: day };
};

/**
 * Phase 4 (Plan §3.2, F5–F9): Abschluss einer Einheit aus Lesen, Hören, Schreiben oder Entdecken –
 * im SELBEN Stapel wie alle Zähler (Folgenummer), optimistisch sichtbar, sofort gespeichert.
 */
export function recordUnitEnd(u: UnitEnd): Promise<boolean> {
  open.units.push(u);
  usePending.setState((s) => ({ units: addUnit(s.units, u, 1), minutes: { ...s.minutes, [u.day]: (s.minutes[u.day] ?? 0) + unitMinutes(u) } }));
  return flush();
}

/** Lernberatung 27.09., V2: Antwort auf einen Reparatur-Satz ins Tagesprotokoll (zählt zu „Wiederholen“). */
export function recordRepairAnswer(e: RepairLogEntry, day: string, immediate: boolean): void {
  pushEntry(e, day);
  afterAnswer(immediate);
}

/** Phase 4: Protokolleinträge der Verständnisfragen (Lesen, Hören, Entdecken). */
export function recordChannelEntries(entries: ReadonlyArray<ChannelLogEntry & { day: string }>): void {
  if (!entries.length) return;
  for (const e of entries) {
    const out: Partial<ChannelLogEntry & { day: string }> = { ...e };
    delete out.day;
    pushEntry(out as ChannelLogEntry, e.day);
  }
  schedule();
}

/** Phase 4 (F10): Fehler aus einer KI-Korrektur ins Radar, sofort gespeichert. */
export function recordRadar(events: readonly RadarEvent[]): Promise<boolean> {
  if (!events.length) return Promise.resolve(true);
  radarQueue.push(...events);
  return flush();
}

/**
 * Phase 4: Profilfelder ohne Zähler (`disc`, `gen`). `compute` läuft auf dem frischen Stand und
 * liefert nur echte Änderungen (sonst `null`). Löst mit `true` auf, sobald der Schreibvorgang
 * gelungen ist; bei einem Fehler bleibt der Eintrag für den nächsten Durchlauf vorgemerkt.
 */
export function recordProfileFields(scope: string, compute: (cur: Readonly<Doc>) => Doc | null): Promise<boolean> {
  if (!getWriter()) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    fieldQueue.push({ scope, compute, done: resolve });
    void flush();
  });
}

const grammarChannel = (a: GrammarAnswer): CountEvent['channel'] => (a.task.type === 'mc' || a.task.type === 'meaning' ? null : 'write');
const DRILL_COUNT: Partial<Record<DrillAnswer['type'], { kind: 'v' | 'g'; channel: CountEvent['channel'] }>> = {
  dictate: { kind: 'g', channel: 'listen' },
  cloze: { kind: 'v', channel: 'colloc' },
  order: { kind: 'g', channel: null },
};

async function saveGrammar(a: GrammarAnswer): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `grammar/${a.task.topic}`;
  let skipped: string | null = null;
  let overflow: NewRepair | undefined;
  try {
    await writer.transform(path, (cur) => {
      const w = grammarWrite(cur, a);
      if (w.kind === 'skip') {
        skipped = w.reason;
        return null;
      }
      overflow = w.overflow;
      return w.kind === 'create' ? { set: w.doc } : { update: w.patch };
    });
    if (skipped && skipped !== 'already_applied') logWarn('learn:grammar', { code: skipped, message: `${path} nicht geschrieben` }, path);
    usePending.setState((s) => ({ failedGrammar: s.failedGrammar.filter((f) => f.t !== a.t) }));
    // Thema voll (10 offene Fehlersätze): der neue Fehler geht nie verloren, er wird als Reparatur-Satz abgelegt.
    if (overflow) {
      logWarn('learn:grammar', { code: 'errors_full', message: `${path} hat 10 offene Fehlersätze – neuer Fehler als Reparatur-Satz abgelegt` }, path);
      void saveRepairs([overflow]);
    }
    return true;
  } catch (err) {
    logError('learn:grammar', err, path);
    usePending.setState((s) => ({ failedGrammar: s.failedGrammar.some((f) => f.t === a.t) ? s.failedGrammar : [...s.failedGrammar, a] }));
    return false;
  }
}

/** Aufzeichnung für Kurs, Grammatik und Übungen (genutzt von den Phase-2-Bildschirmen). */
export const learnRecorder: LearnRecorder = {
  async grammar(a) {
    const ok = await saveGrammar(a);
    const right = !a.dontKnow && a.verdict !== 'wrong';
    open.counts.push({ day: a.day, kind: 'g', channel: grammarChannel(a), ok: right });
    pushEntry(grammarLogEntry(a), a.day);
    if (!right && !a.dontKnow) radarQueue.push(radarEvent(topicCat(a.task.topic), 'g', a.t, { q: a.task.prompt, g: a.given, a: a.task.answer }));
    afterAnswer(false);
    return ok;
  },
  drill(a) {
    const c = DRILL_COUNT[a.type];
    if (c) open.counts.push({ day: a.day, kind: c.kind, channel: c.channel, ok: a.verdict !== 'wrong' });
    pushEntry(drillLogEntry(a), a.day);
    if (a.radar) radarQueue.push(a.radar);
    afterAnswer(false);
  },
  radar(events) {
    radarQueue.push(...events);
    schedule();
  },
  roundEnd(r: LearnRoundEnd) {
    addRound({ day: r.day, act: r.act, partial: r.partial, n: r.n, right: r.right, activeMs: r.activeMs, lessonAi: r.lessonAi, sprintScore: r.sprint?.score }, r.sprint);
    return flush();
  },
  lessonDone(d: LessonDone) {
    lessonQueue.push(d);
    usePending.setState((s) => ({ lessonDays: s.lessonDays.includes(d.day) ? s.lessonDays : [...s.lessonDays, d.day] }));
    return flush();
  },
};

// ------------------------------------------------------------------ Schreiben

async function sendCourse(writer: Writer): Promise<boolean> {
  let ok = true;
  for (const d of [...lessonQueue]) {
    try {
      let invalid = false;
      await writer.transform('app/course', (cur) => {
        if (cur && !validateDoc('app/course', cur).ok) invalid = true;
        return courseDone(cur, d);
      });
      if (invalid) logError('learn:course', { code: 'invalid_document', message: 'Kursstand ungültig – Abschluss nicht geschrieben' }, 'app/course');
      lessonQueue = lessonQueue.filter((x) => x !== d);
      usePending.setState((s) => ({ lessonDays: lessonQueue.some((x) => x.day === d.day) ? s.lessonDays : s.lessonDays.filter((x) => x !== d.day) }));
    } catch (err) {
      logError('learn:course', err, 'app/course');
      ok = false;
    }
  }
  return ok;
}

async function sendProfile(writer: Writer, b: Batch): Promise<void> {
  const dev = tabId();
  const day = b.answers[0]?.day ?? b.counts[0]?.day ?? b.rounds[0]?.day ?? b.units[0]?.day ?? '';
  const ctx = { deviceId: dev, seq: b.seq, counts: b.counts, sprints: b.sprints, pruneSeqBefore: b.seq - SEQ_KEEP_MS };
  const counters = (cur: Doc, c: typeof ctx & { pflichtDay?: string | readonly string[] | null }): Doc | null =>
    unitsPatch(cur, profilePatch(cur, b.answers, b.rounds, c), b.units, { deviceId: dev, seq: b.seq });
  const compute = (cur: Doc): Doc | null => {
    const patch = counters(cur, ctx);
    if (!pflichtResolver || !validateDoc('app/profile', cur).ok) return patch;
    const next = applyUpdate(cur, patch ?? {});
    let pflichtDay: string | readonly string[] | null = null;
    try {
      pflichtDay = pflichtResolver({ profile: next, batch: b });
    } catch (err) {
      logError('learn:pflicht', err, 'Pflicht prüfen');
    }
    if (!pflichtDay || !pflichtDay.length) return patch;
    return counters(cur, { ...ctx, pflichtDay });
  };
  await writer.transform('app/profile', (cur) => {
    if (!cur) {
      const base = minimalProfile(day);
      const patch = compute(base);
      return patch ? { set: applyUpdate(base, patch) } : null;
    }
    const patch = compute(cur);
    if (!patch && !validateDoc('app/profile', cur).ok) logWarn('learn:profile', { code: 'invalid_document', message: 'Profil ungültig – Zähler nicht geschrieben' }, 'app/profile');
    return patch ? { update: patch } : null;
  });
  usePending.setState((s) => {
    const minutes = { ...s.minutes };
    const rounds = [...s.rounds];
    for (const r of b.rounds) {
      minutes[r.day] = Math.max(0, (minutes[r.day] ?? 0) - roundMinutes(r));
      const i = rounds.findIndex((x) => x.day === r.day && x.act === r.act && x.partial === r.partial);
      if (i >= 0) rounds.splice(i, 1);
    }
    let units = s.units;
    for (const u of b.units) {
      minutes[u.day] = Math.max(0, (minutes[u.day] ?? 0) - unitMinutes(u));
      units = addUnit(units, u, -1);
    }
    return { minutes, rounds, units };
  });
}

async function sendLogs(writer: Writer, force: boolean): Promise<boolean> {
  let ok = true;
  const pending = usePending.getState().entries;
  const byDay = new Map<string, PendingEntry[]>();
  for (const e of pending) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  for (const [day, list] of byDay) {
    const path = `log/${day}`;
    const l = await lease(writer, path, force);
    if (l !== 'ok') {
      // Belegt oder Fehler: Einträge bleiben vorgemerkt (W3).
      if (l === 'busy') busy = true;
      else ok = false;
      continue;
    }
    const entries: AnyLogEntry[] = list.map((e) => {
      const out: Partial<PendingEntry> = { ...e };
      delete out.day;
      return out as AnyLogEntry;
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
        logError('learn:log', { code: 'invalid_document', message: 'Tagesprotokoll ungültig – nicht überschrieben' }, path);
        ok = false;
        continue;
      }
      const key = (e: PendingEntry) => `${e.t}|${'id' in e ? e.id : e.q}`;
      const sent = new Set(list.map(key));
      usePending.setState((s) => ({ entries: s.entries.filter((e) => !sent.has(key(e))) }));
    } catch (err) {
      logError('learn:log', err, path);
      ok = false;
    }
  }
  return ok;
}

async function sendRadar(writer: Writer): Promise<boolean> {
  if (!radarQueue.length) return true;
  const batch = radarQueue;
  try {
    let invalid = false;
    await writer.transform('app/radar', (cur) => {
      if (!cur) return { set: { events: mergeRadar([], batch) } };
      if (!validateDoc('app/radar', cur).ok) {
        invalid = true;
        return null;
      }
      return { update: { events: mergeRadar(Array.isArray(cur.events) ? cur.events : [], batch) } };
    });
    // Ungültiges Radar wird nie überschrieben; die Ereignisse sind dann verloren (gemeldet).
    if (invalid) logError('learn:radar', { code: 'invalid_document', message: `Radar ungültig – ${batch.length} Ereignisse nicht geschrieben` }, 'app/radar');
    radarQueue = radarQueue.filter((e) => !batch.includes(e));
    return !invalid;
  } catch (err) {
    logError('learn:radar', err, 'app/radar');
    return false;
  }
}

async function sendFields(writer: Writer): Promise<boolean> {
  if (!fieldQueue.length) return true;
  const batch = fieldQueue;
  fieldQueue = [];
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur || !validateDoc('app/profile', cur).ok) return null;
      let next: Doc = cur;
      let patch: Doc = {};
      for (const f of batch) {
        try {
          const p = f.compute(next);
          if (!p) continue;
          // Tief zusammenführen wie `update`: Patches verschiedener Tage (z. B. `act`) bleiben erhalten.
          patch = applyUpdate(patch, p);
          next = applyUpdate(next, p);
        } catch (err) {
          logError(f.scope, err, 'app/profile');
        }
      }
      return Object.keys(patch).length ? { update: patch } : null;
    });
    for (const f of batch) f.done(true);
    return true;
  } catch (err) {
    logError(batch[0]?.scope ?? 'input:profile', err, 'app/profile');
    for (const f of batch) f.done(false);
    // Bleibt vorgemerkt: `compute` ist idempotent (nur fehlende Werte), ein späterer Durchlauf holt es nach.
    fieldQueue = [...batch, ...fieldQueue];
    return false;
  }
}

/**
 * W3: Kurze, kooperative Sperre vor dem Sammel-Schreibvorgang auf `app/profile` bzw. `log/<tag>`.
 * Alle Tabs und Geräte dieser App sperren so, bevor sie frisch lesen und zusammenführen
 * (`transform`) – zwei Tabs überschreiben einander keine Zähler mehr. Belegt: Der Stapel bleibt
 * vorgemerkt und geht beim nächsten Anlass (Antwort, Ruhe-Zeitgeber, Rundenende) hinaus – nie in
 * einer Warteschleife. Beim Verlassen der Seite (`force`) wird trotzdem geschrieben, sonst ginge der
 * Puffer (nur im Speicher) verloren.
 */
const LEASE_MS = 5000;
type LeaseResult = 'ok' | 'busy' | 'error';
async function lease(writer: Writer, path: string, force: boolean): Promise<LeaseResult> {
  try {
    const r = await writer.acquire(path, { holder: tabId(), ttlMs: LEASE_MS });
    if (r.acquired || force) return 'ok';
    return 'busy';
  } catch (err) {
    logWarn('learn:lease', err, path);
    return force ? 'ok' : 'error';
  }
}

let busy = false;
let forceNext = false;

async function flushOnce(): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const force = forceNext;
  forceNext = false;
  busy = false;
  let ok = await sendCourse(writer);

  // Profil: erst ein gescheiterter Stapel (unverändert, dieselbe Folgenummer), dann der neue.
  let profileBlocked = false;
  if (failedBatch || !isEmpty(open)) {
    const l = await lease(writer, 'app/profile', force);
    if (l !== 'ok') {
      profileBlocked = true;
      if (l === 'busy') busy = true;
      else ok = false;
    }
  }
  if (failedBatch && !profileBlocked) {
    try {
      await sendProfile(writer, failedBatch);
      failedBatch = null;
    } catch (err) {
      logError('learn:profile', err, 'app/profile (Wiederholung)');
      ok = false;
      profileBlocked = true;
    }
  }
  if (!profileBlocked && !isEmpty(open)) {
    const b: Batch = { ...open, seq: nextT() };
    open = emptyOpen();
    bufferedAnswers = 0;
    try {
      await sendProfile(writer, b);
    } catch (err) {
      logError('learn:profile', err, 'app/profile');
      failedBatch = b;
      ok = false;
    }
  }

  ok = (await sendLogs(writer, force)) && ok;
  ok = (await sendRadar(writer)) && ok;
  ok = (await sendFields(writer)) && ok;
  usePending.setState({ failed: !ok });
  // W3: belegt – ein späterer Versuch nach der Ruhezeit (länger als die Sperre), kein Warten.
  if (busy) schedule();
  return ok;
}

/** Gesammelt speichern (nie zwei Durchläufe gleichzeitig; ein weiterer Auslöser läuft danach). */
export function flush(): Promise<boolean> {
  if (idle !== null && typeof window !== 'undefined') {
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

/** Gescheiterte Grammatik-Antworten erneut anwenden (derselbe Zeitstempel: nie doppelt). */
export async function retryFailedGrammar(): Promise<void> {
  for (const a of usePending.getState().failedGrammar) await saveGrammar(a);
  await flush();
}

let listening = false;
/** Beim Verlassen der Seite gesammelt speichern (einmal registriert). */
export function installFlushOnHide(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushOnHide();
  });
  window.addEventListener('pagehide', () => void flushOnHide());
}

/** W3: Beim Verlassen der Seite auch bei belegter Sperre schreiben (der Puffer liegt nur im Speicher). */
export function flushOnHide(): Promise<boolean> {
  forceNext = true;
  if (running) again = true;
  return flush();
}

/** Nur für Tests: Warteschlange leeren. */
export function resetPersistForTests(): void {
  open = emptyOpen();
  failedBatch = null;
  radarQueue = [];
  lessonQueue = [];
  for (const f of fieldQueue) f.done(false);
  fieldQueue = [];
  bufferedAnswers = 0;
  running = null;
  again = false;
  tab = undefined;
  lastT = 0;
  pflichtResolver = null;
  busy = false;
  forceNext = false;
  usePending.setState(empty());
}
