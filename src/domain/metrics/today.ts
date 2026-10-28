import atlasMeta from '../../content/atlas/meta.json';
import { dayKey } from '../date';
import { dueFehlersaetze, grammarFehlersaetzeDue } from '../repair/fehlersaetze';
import { AGAIN_OLD } from '../repair/unit';
import { entryCardKey } from '../progress/logPatch';
import { dueCount, isDue, isOverdue } from './definitions';
import { festCount } from './vocab';
import { backlogBraked, expectedNewPerDay } from '../unit/backlog';
import { FIX_LIMIT, fixLimitFor } from '../unit/planFor';
import { newQuotaLeft, newCards, quizzable } from '../srs/queue';
import { estimateRoundMinutes } from '../srs/cost';
import { deckCounts } from '../srs/decks';
import { lemmaOf } from '../srs/context';
import { histOf } from '../srs/flip';
import { pickDissimilar } from '../srs/similar';
import { C1_MARK, vocabGoal } from '../vocab/goal';
import type { DutyState, StoredPlan } from '../plan/types';
import { dutyMinutes, legacyDutyMinutes } from '../plan/buildPlan';
import { minutesLeft, unitRows } from '../unit/rows';
import { ringFills, ringShare } from './ring';
import type { TrainCard } from '../srs/types';

// EINE Quelle je Zahl für Heute, Wörter, Grammatik und Fortschritt (Lernplattform 2.0 §4.9, Leitsatz 4). Jede sichtbare Zahl dieser Art kommt von hier;
// jeder Knopf nennt genau das, was er startet. Rein, nichts wird gespeichert. Eingaben wie bei den bestehenden Aufrufern (StoredPlan, TrainCard[], Dokumente).

type Doc = Readonly<Record<string, unknown>>;

/** Länge der freiwilligen Wiederholrunde („Alle fälligen“, `startAllDue`). */
export const EXTRA_ROUND_MAX = 20;

// ------------------------------------------------------------------ Wörter

/** Alle Karten, die „Wiederholen“ im Reiter Wörter zeigt: Neu (höchstens das Tageskontingent) + Lernen + Fällig. Eine Quelle für Knopf und Zahlzeile. */
export function reviewAll(cards: readonly TrainCard[], nowMs: number, quotaLeft = Infinity): number {
  const c = deckCounts(cards, nowMs);
  return Math.min(c.new, Math.max(0, quotaLeft)) + c.learning + c.due;
}

/**
 * Die Pflichtrunde „Wiederholen“ von heute: `total` = eingefrorener Umfang (`goal.review`), `left` = noch offen (`done` aus dem Tagesstand),
 * `minutes` = die Minuten des Schritts im Plan, anteilig nach Rest. Ohne Pflichtschritt gilt die freiwillige Runde (höchstens 20 Karten).
 */
export function reviewToday(i: { plan: StoredPlan | null; cards: readonly TrainCard[]; nowMs: number; done?: number; quotaLeft?: number }): { total: number; left: number; minutes: number } {
  const duty = !!i.plan && i.plan.duty.includes('review') && i.plan.goal.review > 0;
  if (!duty || !i.plan) {
    const total = Math.min(EXTRA_ROUND_MAX, reviewAll(i.cards, i.nowMs, i.quotaLeft));
    return { total, left: total, minutes: estimateRoundMinutes(i.cards, i.nowMs, i.quotaLeft ?? Infinity, false) };
  }
  const total = i.plan.goal.review;
  const left = Math.max(0, total - Math.max(0, Math.floor(i.done ?? 0)));
  const stored = i.plan.u?.b.find(([, kind]) => kind === 'review')?.[2] ?? 0;
  return { total, left, minutes: left === total ? stored : Math.ceil(stored * (left / total)) };
}

/**
 * Die Wiederhol-Zahlen für ALLE Stellen (UX-Audit U1: vorher 46 / 52 / 62 an drei Orten): `due` = alle heute fälligen Karten (Wortliste,
 * Wörter-Reiter), `planned` = davon heute in der Pflicht (Heute-Karte, Zwischenkarte, Wörter-Reiter, Wortliste; 0 ohne Pflichtschritt),
 * `left`/`minutes` = noch offen (Knopf). Wer eine dieser Zahlen zeigt, nimmt sie von hier.
 */
export function reviewFigures(i: { plan: StoredPlan | null; cards: readonly TrainCard[]; nowMs: number; done?: number; quotaLeft?: number }): { due: number; planned: number; left: number; minutes: number } {
  const visible = i.cards.filter((c) => !c.hidden);
  const duty = !!i.plan && i.plan.duty.includes('review') && i.plan.goal.review > 0;
  const rt = reviewToday({ ...i, cards: visible });
  return { due: dueCount(visible, i.nowMs), planned: duty ? rt.total : 0, left: rt.left, minutes: rt.minutes };
}

/** Die Zeile „62 fällig, davon 52 heute im Plan“ (bzw. „62 heute fällig“): welche Form gilt? Eine Regel für Wörter-Reiter und Wortliste. */
export const dueLineSplit = (f: { due: number; planned: number }): boolean => f.planned > 0 && f.planned < f.due;

/** Neue Wörter, die heute wirklich kommen: nach Plan (eingefroren), sonst nach Kontingent und Bremse. `cap` = Kontingent für heute. */
export function newToday(i: { plan: StoredPlan | null; cards: readonly TrainCard[]; nowMs: number; newPerDay: unknown; lang?: 'de' | 'en' }): { n: number; cap: number; braked: boolean; reason: 'backlog' | 'pack' | null } {
  const today = dayKey(i.nowMs);
  const visible = i.cards.filter((c) => !c.hidden);
  const act = i.lang ? visible.filter((c) => quizzable(c, i.lang!, visible.length - 1)) : visible;
  const introduced = visible.filter((c) => c.intro === today);
  const cap = newQuotaLeft(i.newPerDay, introduced.length, introduced.filter((c) => c.src === 'lesson').length);
  const overdue = act.filter((c) => isOverdue(c, i.nowMs)).length;
  const braked = backlogBraked(overdue);
  const stock = newCards(act).length;
  const planned = i.plan && i.plan.duty.includes('review') ? i.plan.goal.new : undefined;
  const n = Math.min(stock, planned ?? expectedNewPerDay(cap, braked));
  return { n, cap, braked, reason: n > 0 ? null : stock === 0 ? 'pack' : braked ? 'backlog' : null };
}

/** Geschätzter Wortschatz aus dem letzten Test: Zahl, Zeitpunkt der Messung, C1-Marke erreicht. `null`, wenn nie gemessen. */
export function vocabEstimate(i: { profile: Doc | null | undefined; cards: readonly TrainCard[]; today: string; nowMs?: number }): { n: number; at: number; c1Reached: boolean } | null {
  const g = vocabGoal(i);
  if (!g.measured || g.now === null) return null;
  const at = g.measuredOn ? new Date(`${g.measuredOn}T12:00:00`).getTime() : 0;
  return { n: g.now, at: Number.isFinite(at) ? at : 0, c1Reached: g.now >= C1_MARK };
}

/** Zahl der Einträge im Atlas (`content/atlas/meta.json`, von P3 mit dem Inhalt gepflegt). */
export const atlasSize = (): number => atlasMeta.atlas;

/**
 * Atlas-Zahlen für jede Anzeige (UX-Prüfung W3: eine Quelle): Einzelwörter des Atlas, Einträge des C1-Pakets und zusammen.
 * `meta.json` wird von `tests/unit/atlasContent.test.ts` gegen den Inhalt geprüft.
 */
export const atlasCounts = (): { words: number; pack: number; total: number } => ({ words: atlasMeta.atlas, pack: atlasMeta.pack, total: atlasMeta.atlas + atlasMeta.pack });

/** Feste Karten (Anzeige „Wörter fest 312“): dieselbe Definition wie überall. */
export const festNow = (cards: readonly TrainCard[], nowMs?: number): number => festCount(cards.filter((c) => c.path.startsWith('vocab/')), nowMs);

// ------------------------------------------------------------------ Tag

export type TodaySummary = {
  /** Restminuten, wie sie Heute zeigt (`today-min`, Wiedereinstiegskarte): Einheit anteilig nach Rest der Wiederholung, alter Plan je Schritt. */
  rest: number;
  /** Füllung je Pflichtschritt (Tagesring), Reihenfolge wie `items`. */
  fills: number[];
  /**
   * Ein Kurzwert für den ganzen Ring (0–1, `ringShare`), nur für Diagnose und Zusammenfassungen. Der Tagesring wird IMMER aus `fills`
   * gezeichnet (je Bogen, sonst springt er zwischen Startbild und geladenem Zustand); `app/today` speichert `fills`, `done`, `total`, `rest`.
   */
  ring: number;
  /** Erledigte und alle Pflichtschritte („x von 4“). */
  done: number;
  total: number;
};

/**
 * Die Zahlen von Heute aus Plan und Pflichtzustand (P5 S1-ZAHL): rein, ohne React und ohne Datenbank. Quelle für den Bildschirm Heute
 * und später für `app/today` (P6). `items` = `deriveToday(...).duties.items`.
 * Restminuten: ohne Plan 0. Einheit (`u`) = `minutesLeft(unitRows(...))`. Alter Plan = Minuten der offenen Schritte (Wiederholen 10,
 * Lektion 12, Kanal nach `dutyChannelMinutes`, alles über `legacyDutyMinutes`); ist das 0, die Planminuten (`dutyMinutes`), wie bisher auf dem Bildschirm.
 */
export function todaySummary(i: { plan: StoredPlan | null; items: readonly DutyState[] }): TodaySummary {
  const { plan, items } = i;
  let rest = 0;
  if (plan) {
    if (plan.u) rest = minutesLeft(unitRows(plan, items) ?? []);
    else {
      for (const d of items) if (d.state !== 'done') rest += legacyDutyMinutes(d.id);
      rest = rest || dutyMinutes(plan);
    }
  }
  return { rest, fills: ringFills(items), ring: ringShare(items), done: items.filter((d) => d.state === 'done').length, total: items.length };
}

// ------------------------------------------------------------------ Fehlersätze

/** Fällige Fehlersätze (Grammatik und Reparatur-Sätze) ohne die vom heutigen Lerntag: die Zahl `fixDue` aus der Planung. */
export function fehlersaetzeDue(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; nowMs: number; today: string }): number {
  return dueFehlersaetze(i).length;
}

/** Wie `fehlersaetzeDue`, nur Grammatik (Einführungsbremse „ab 10 fälligen Grammatikfehlern kein neues Thema“). */
export function grammarErrorsDue(i: { grammarDocs: ReadonlyMap<string, Doc>; nowMs: number; today?: string }): number {
  return grammarFehlersaetzeDue({ grammarDocs: i.grammarDocs, nowMs: i.nowMs, today: i.today ?? dayKey(i.nowMs) });
}

/** Grenze von Schritt 4 für diesen Plan: eingefroren (`u.b[…][3].limit`), alte Regel `AGAIN_OLD`, sonst die Formel für eine Extra-Runde. */
export function fixLimitOfPlan(plan: StoredPlan | null, fixDue: number): number {
  const again = plan?.u?.b.find(([block]) => block === 5);
  if (again?.[3]?.limit !== undefined) return again[3].limit;
  if (again) return AGAIN_OLD;
  // Kein Schritt 4 im Plan (nichts fällig am Morgen, oder ein Plan der alten Regel): Extra-Runde. Ab Regelversion 2 mit derselben Formel, sonst wie bisher 5.
  return plan?.u?.rv === 2 ? fixLimitFor(plan.u.shape === 'sun' ? 'sun' : plan.u.shape === 'short' ? 'short' : 'full', fixDue) : FIX_LIMIT.min;
}

/** Zahl auf jedem Knopf, der Schritt 4 oder die Extra-Fehlerrunde startet: `min(Grenze, fällig)`. */
export function fixToday(i: { plan: StoredPlan | null; fixDue: number }): number {
  return Math.max(0, Math.min(fixLimitOfPlan(i.plan, i.fixDue), Math.floor(i.fixDue)));
}

/** Alle fälligen Fehlersätze („21 fällig“). */
export const fixAll = (fixDue: number): number => Math.max(0, Math.floor(fixDue));

// ------------------------------------------------------------------ Wörter und Grammatik am selben Stoff

/**
 * Lemmata der heute fälligen und neuen Karten (für die Aufgabenwahl in der Grammatik, Kap. 2 Nr. 5): fällige Karten, heute schon eingeführte
 * und die nächsten neuen Karten bis zur geplanten Zahl. Kleingeschrieben, ohne Doppelte, in Kartenreihenfolge.
 */
export function wordsToday(i: { cards: readonly TrainCard[]; plan: StoredPlan | null; nowMs: number }): string[] {
  const today = dayKey(i.nowMs);
  const visible = i.cards.filter((c) => !c.hidden);
  const introduced = visible.filter((c) => c.intro === today);
  const plannedNew = i.plan?.goal.new ?? 0;
  // Wort-Lernen 2: dieselbe Ähnlichkeitssperre wie die Runde (`buildQueue` → `pickDissimilar`), sonst nennt „Heute“ andere neue Wörter als der Trainer.
  const fresh = pickDissimilar(newCards(visible), Math.max(0, plannedNew - introduced.length), introduced);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...visible.filter((x) => isDue(x, i.nowMs)), ...introduced, ...fresh]) {
    const l = lemmaOf(c.word).toLowerCase();
    if (l && !seen.has(l)) {
      seen.add(l);
      out.push(l);
    }
  }
  return out;
}

/** „Heute falsch“ (Extra-Blatt nach der Pflicht, P5 S1-ZAHL Nacharbeit): sichtbare Karten mit einer falschen Antwort (`g === 1`) an diesem Lerntag. */
export function wrongToday(cards: readonly TrainCard[], today: string): TrainCard[] {
  return cards.filter((c) => !c.hidden && histOf(c.doc).some((h) => h.g === 1 && dayKey(h.t) === today));
}

/** „Am Laptop vertiefen“: Wörter, die heute am Handy geübt wurden (`log/<tag>`, `dev: 't'`) und fest sitzen (Stufe ≥ 4) oder heute neu sind. Nie `localStorage`. */
export function laptopDeepen(i: { log: Doc | null | undefined; cards: readonly TrainCard[]; today: string; max?: number }): string[] {
  const entries = Array.isArray(i.log?.entries) ? (i.log.entries as unknown[]) : [];
  const byKey = new Map(i.cards.map((c) => [c.key, c]));
  const out: string[] = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Doc;
    if (e.dev !== 't') continue;
    const key = entryCardKey(e);
    const c = key ? byKey.get(key) : undefined;
    if (!c || c.hidden || (c.stage < 4 && c.intro !== i.today)) continue;
    const w = c.word.trim();
    if (w && !out.includes(w)) out.push(w);
    if (out.length >= (i.max ?? 8)) break;
  }
  return out;
}

