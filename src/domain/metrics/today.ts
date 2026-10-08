import atlasMeta from '../../content/atlas/meta.json';
import { dayKey } from '../date';
import { dueFehlersaetze, grammarFehlersaetzeDue } from '../repair/fehlersaetze';
import { AGAIN_OLD } from '../repair/unit';
import { entryCardKey } from '../progress/logPatch';
import { isDue, isOverdue } from './definitions';
import { festCount } from './vocab';
import { backlogBraked, expectedNewPerDay } from '../unit/backlog';
import { FIX_LIMIT, fixLimitFor } from '../unit/planFor';
import { newQuotaLeft, newCards, quizzable } from '../srs/queue';
import { estimateRoundMinutes } from '../srs/cost';
import { deckCounts } from '../srs/decks';
import { lemmaOf } from '../srs/context';
import { C1_MARK, vocabGoal } from '../vocab/goal';
import type { StoredPlan } from '../plan/types';
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
export function vocabEstimate(i: { profile: Doc | null | undefined; cards: readonly TrainCard[]; today: string }): { n: number; at: number; c1Reached: boolean } | null {
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
export const festNow = (cards: readonly TrainCard[]): number => festCount(cards.filter((c) => c.path.startsWith('vocab/')));

// ------------------------------------------------------------------ Tag

/** Was vom Tag noch offen ist: Zahl der offenen Schritte und ihre Restminuten. `done` = erledigte Blocknummern (1 bis 5). */
export function dayLeft(plan: StoredPlan | null, done: ReadonlySet<number>): { blocks: number; minutes: number } {
  if (!plan?.u) return { blocks: 0, minutes: 0 };
  let blocks = 0;
  let minutes = 0;
  for (const [block, , min] of plan.u.b) {
    if (done.has(block)) continue;
    blocks++;
    minutes += min;
  }
  return { blocks, minutes };
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
  const fresh = newCards(visible).slice(0, Math.max(0, plannedNew - introduced.length));
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

