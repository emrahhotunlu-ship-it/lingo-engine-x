import { create } from 'zustand';
import { useClock } from '../../../app/clock';
import { useSettings } from '../../../app/settings';
import { unitDone } from '../../../app/unit/done';
import type { UnitBlockNo, UnitCtx } from '../../../app/unit/types';
import { useLive } from '../../../data/live';
import { droppedFehlersaetze, dueFehlersaetze } from '../../../domain/repair/fehlersaetze';
import { repairCards, repairDiag, type RepairCard } from '../../../domain/repair/variant';
import type { Lang } from '../../../domain/srs/types';
import { unitStepArgs } from '../../../domain/unit/plan';
import { logInfo } from '../../../platform/diagnostics';
import { inputProfile } from '../../../platform/input';
import type { InputProfile } from '../../../domain/grammar/tasks';
import { local } from '../../../platform/storage';
import { useTodayPlan } from '../../today/store';
import { holdGatedRepairs } from '../store';
import { learnerNow } from '../../tutor/learnerLive';

// Schritt 4 der Tageseinheit „Fehler korrigieren“ (Lernplattform 2.0 §5.7): die EINE Fehlerschlange, Satz für Satz. Die Karten
// (Grammatikfehler und Reparatur-Sätze aus `dueFehlersaetze`, höchstens `limit`) werden beim Start eingefroren; jede Antwort wird
// am Originaleintrag gebucht (`reviewError` bzw. `recordRepair`). Es gibt nie mehr drei Sätze in einem Feld. Das Ende meldet `unitDone(5)`.

export type AgainRow = { id: string; ok: boolean; near: boolean; wrong: string; right: string; why: string | null; topic: string | null; pat: string | null };

type State = {
  active: boolean;
  status: 'running' | 'summary';
  day: string;
  lang: Lang;
  block: UnitBlockNo | null;
  /** Eingabeprofil der Runde (einmal eingefroren, §4.1). */
  profile: InputProfile;
  cards: RepairCard[];
  pos: number;
  results: AgainRow[];
  /** Paket FK: so viele Sätze hat Emrah mit „Kann ich nicht nachvollziehen“ herausgenommen (zählt nicht als Antwort, nicht als falsch). */
  skipped: number;
  startedAt: number;
  endedAt: number;
};

const initial = (): State => ({ active: false, status: 'running', day: '', lang: 'de', block: null, profile: 'keys', cards: [], pos: 0, results: [], skipped: 0, startedAt: 0, endedAt: 0 });

export const useAgain = create<State>(initial);

/** Alte Grenze (Plan ohne Regelversion 2): drei Sätze. */
const OLD_LIMIT = 3;
const DIAG_KEY = 'lx:again-diag';
const SEEN_KEY = 'lx:fk-seen';
const SEEN_MAX = 200;

/** Schon gezeigte B1-/B2-Aufgaben (nur Bequemlichkeit im Browser: neue werden bevorzugt, fehlt der Speicher, kommen sie nach Zufall). */
function readSeen(): Set<string> {
  const v = local.getJson<unknown>(SEEN_KEY);
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
}

function rememberSeen(seen: Set<string>, cards: readonly RepairCard[]): void {
  for (const c of cards) {
    if (c.fk1) seen.add(c.fk1.id);
    if (c.fk2) seen.add(c.fk2.id);
  }
  local.set(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_MAX)));
}

/**
 * Einmal je Tag eine Zeile ins Diagnose-Protokoll: Fehlersätze n, davon ohne Bereich m, mit 2–3 Stellen k (§5.7 Nr. 8); dazu die neuen Formen und
 * die ganz ausgeblendeten Sätze (Ausschlussregeln, Paket FK) mit den Gründen. Die Einträge bleiben gespeichert, das Fehlerradar zählt sie weiter.
 */
function diagOnce(day: string, cards: readonly RepairCard[], dropped: ReadonlyArray<{ reason: string }>): void {
  if ((!cards.length && !dropped.length) || local.get(DIAG_KEY) === day) return;
  const d = repairDiag(cards);
  const why = new Map<string, number>();
  for (const x of dropped) why.set(x.reason, (why.get(x.reason) ?? 0) + 1);
  const hidden = cards.filter((c) => c.hidden).length;
  logInfo('repair:again', `Fehlersätze ${d.n}, davon ohne Bereich ${d.noSpan}, mit 2–3 Stellen ${d.multi}; Sag es richtig ${d.b1}, Fassung wählen ${d.b2}; ausgeblendet ${hidden} (als B1) + ${dropped.length} (nur Zähler: ${[...why].map(([k, n]) => `${k} ${n}`).join(', ') || '–'})`);
  local.set(DIAG_KEY, day);
}

/** Karten für Schritt 4 aus den Live-Daten (rein lesend). */
export function againCards(day: string, limit: number, lang: Lang): RepairCard[] {
  const live = useLive.getState();
  const grammarDocs = live.collections.grammar ?? new Map<string, Readonly<Record<string, unknown>>>();
  const repairDoc = live.docs['app/repair'] ?? null;
  // Ein Lernermodell (Tutor-Engine v3 S2): am selben Fälligkeitstag kommt das schwächere Muster zuerst; ohne fertiges Modell bleibt die Reihenfolge.
  const m = learnerNow();
  const items = dueFehlersaetze({ grammarDocs, repairDoc, nowMs: useClock.getState().now, today: day, limit, lang, ...(m ? { pOf: (pat: string) => m.patterns.get(pat.slice(pat.indexOf(':') + 1))?.p } : {}) });
  const seen = readSeen();
  const cards = repairCards({ items, grammarDocs, repairDoc, seen });
  rememberSeen(seen, cards);
  return cards;
}

/** Ganz ausgeblendete Fehlersätze (Ausschlussregel, keine passende Aufgabe) für die Diagnose. */
function droppedNow(day: string, lang: Lang): Array<{ reason: string }> {
  const live = useLive.getState();
  return droppedFehlersaetze({ grammarDocs: live.collections.grammar ?? new Map<string, Readonly<Record<string, unknown>>>(), repairDoc: live.docs['app/repair'] ?? null, nowMs: useClock.getState().now, today: day, lang });
}

/** Schritt 4 starten (synchron im Klick). Ohne `ctx` aus den Daten von heute (zweites Gerät, Wiederaufnahme). */
export function startAgain(ctx: Pick<UnitCtx, 'day' | 'block'> | null): boolean {
  const day = ctx?.day ?? useClock.getState().today;
  const lang = useSettings.getState().lang;
  const limit = unitStepArgs(useTodayPlan.getState().plan, 5).limit ?? OLD_LIMIT;
  const cards = againCards(day, limit, lang);
  useAgain.setState({ ...initial(), active: true, status: cards.length ? 'running' : 'summary', day, lang, block: ctx ? ctx.block : null, profile: inputProfile(), cards, startedAt: Date.now() });
  diagOnce(day, cards, droppedNow(day, lang));
  // Eintritts-Wächter: fragwürdige Einträge still ruhend stellen (vorgelegt werden sie ohnehin nicht, `dueRepairs`).
  void holdGatedRepairs(useLive.getState().docs['app/repair']);
  return true;
}

/** Antwort auf die aktuelle Karte festhalten (die Buchung am Originaleintrag macht der Aufrufer) und weiter. */
export function answerAgain(r: { ok: boolean; near: boolean; /** B1/B2: der gezeigte Satz bzw. die Musterlösung statt des Originalsatzes. */ wrong?: string; right?: string; why?: string }): void {
  const s = useAgain.getState();
  const c = s.cards[s.pos];
  if (!c) return;
  const row: AgainRow = { id: c.id, ok: r.ok, near: r.near, wrong: r.wrong ?? c.wrong, right: r.right ?? c.right, why: r.why ?? c.why ?? null, topic: c.topic ?? null, pat: c.pat };
  useAgain.setState({ results: [...s.results, row] });
}

/** „Kann ich nicht nachvollziehen“: die Karte zählt weder als richtig noch als falsch und es geht weiter (der Merker wird vom Aufrufer geschrieben). */
export function skipAgain(): void {
  useAgain.setState({ skipped: useAgain.getState().skipped + 1 });
  nextAgain();
}

export function nextAgain(): void {
  const s = useAgain.getState();
  const pos = s.pos + 1;
  useAgain.setState(pos >= s.cards.length ? { pos, status: 'summary', endedAt: Date.now() } : { pos });
}

export function reportAgainDone(): void {
  const s = useAgain.getState();
  if (s.block) unitDone(s.block);
}

export function leaveAgain(): void {
  if (!useAgain.getState().active) return;
  useAgain.setState({ active: false });
}

// ------------------------------------------------------------------ Fortsetzen (§3.2)

export type AgainSnap = Pick<State, 'status' | 'day' | 'lang' | 'block' | 'profile' | 'cards' | 'pos' | 'results'>;

export function againSnapshot(): AgainSnap | null {
  const s = useAgain.getState();
  if (!s.active) return null;
  const { status, day, lang, block, profile, cards, pos, results } = s;
  return { status, day, lang, block, profile, cards, pos, results };
}

export function restoreAgain(snap: AgainSnap): boolean {
  if (!snap || (snap.status !== 'running' && snap.status !== 'summary') || !Array.isArray(snap.cards) || !Array.isArray(snap.results) || typeof snap.pos !== 'number') return false;
  useAgain.setState({ ...initial(), ...snap, active: true, startedAt: Date.now() });
  return true;
}
