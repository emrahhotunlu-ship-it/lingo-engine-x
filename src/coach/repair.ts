import { dayKey, learningDayStart } from '../domain/date';
import { checkTyped } from '../domain/answer/check';
import { normalize } from '../domain/answer/normalize';
import { toUS } from '../domain/answer/spelling';
import { hash32 } from '../domain/random';
import { taskKey } from './grammarModel';
import { GRAMMAR_TASKS, type GrammarTask } from './grammar';
import type { WriteError } from './writing';
import type { RepairRec, RepairDoc } from './repairDoc';

export type { RepairBox, RepairRec, RepairDoc } from './repairDoc';
export { parseRepairDoc, repairSchema } from './repairDoc';

// Reparatur (docs/neustart.md §5 Nr. 11, Swain): Jeder Fehler aus einer Korrektur und jede falsch
// beantwortete Grammatik-Aufgabe kommt als Aufgabe zurück, bis er sitzt: Box 1 → 3 → 9 Tage, dann
// erledigt. Ein Dokument `coach/repair` mit festen Plätzen (s0 … s299): Der Schreibweg kennt kein
// Löschen, deshalb überschreibt ein neuer Fehler den ältesten erledigten (sonst den ältesten) Platz.

export const REPAIR_CAP = 300;
/** So viele fällige Reparatur-Aufgaben kommen höchstens in eine Einheit. */
export const REPAIR_PER_SESSION = 3;
/** 04:00 Uhr des Lerntags, `days` Tage nach dem Lerntag von `nowMs` (Fälligkeit zählt ab Tagesbeginn). */
export function dueAfter(nowMs: number, days: number): number {
  const d = new Date(learningDayStart(nowMs));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const plain = (s: string): string => normalize(s).replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

export const writeKey = (orig: string, fix: string): string => `w-${hash32(`${plain(orig)}|${plain(fix)}`).toString(36)}`;
export const grammarKey = (task: Pick<GrammarTask, 'prompt' | 'topic'>): string => `g-${taskKey(task)}`;

function fresh(base: Omit<RepairRec, 'box' | 'due' | 'add' | 'done'>, nowMs: number): RepairRec {
  return { ...base, box: 1, due: dueAfter(nowMs, 1), add: nowMs, done: 0 };
}

/** Eintrag aus einem Fehler der Korrektur. */
export function repairFromError(e: WriteError, lang: 'de' | 'en', nowMs: number): RepairRec {
  return fresh({ k: writeKey(e.orig, e.fix), orig: e.orig, fix: e.fix, why: e.why, wl: lang, cat: e.cat, src: 'write', topic: '' }, nowMs);
}

/** Aufgabentypen, die als Reparatur wiederkommen (getippte Antworten; Auswahlaufgaben nicht). */
export const REPAIR_TYPES: ReadonlySet<GrammarTask['type']> = new Set(['gap', 'transform', 'correct']);

/** Eintrag aus einer falsch beantworteten Grammatik-Aufgabe (`null` bei Auswahlaufgaben). */
export function repairFromGrammar(task: GrammarTask, nowMs: number): RepairRec | null {
  if (!REPAIR_TYPES.has(task.type)) return null;
  return fresh({ k: grammarKey(task), orig: task.prompt, fix: task.answer, why: task.expl, wl: 'de', cat: 'grammar', src: 'grammar', topic: task.topic }, nowMs);
}

let taskIndex: Map<string, GrammarTask> | null = null;
/** Die Aufgabe zu einem Grammatik-Eintrag (Aufgabe zeigen, nicht erfinden). */
export function taskOfRepair(rec: Pick<RepairRec, 'k' | 'src'>): GrammarTask | undefined {
  if (rec.src !== 'grammar') return undefined;
  if (!taskIndex) taskIndex = new Map(GRAMMAR_TASKS.map((t) => [grammarKey(t), t]));
  return taskIndex.get(rec.k);
}

/**
 * Plätze für neue Einträge. Gleicher Schlüssel = derselbe Fehler noch einmal: Der Platz wird
 * zurückgesetzt (Box 1). Sonst der erste freie Platz, sonst der älteste erledigte, sonst der älteste.
 * Liefert genau die zu schreibenden Plätze (jeder vollständig, damit nichts Altes stehen bleibt).
 */
export function planAdd(doc: RepairDoc, recs: readonly RepairRec[]): Record<string, RepairRec> {
  const work = new Map(Object.entries(doc));
  const patch: Record<string, RepairRec> = {};
  for (const rec of recs) {
    let slot = [...work].find(([, r]) => r.k === rec.k)?.[0];
    if (!slot) {
      for (let i = 0; i < REPAIR_CAP; i++) {
        if (!work.has(`s${i}`)) {
          slot = `s${i}`;
          break;
        }
      }
    }
    if (!slot) {
      const byAge = [...work].sort((a, b) => Number(b[1].done) - Number(a[1].done) || a[1].add - b[1].add);
      slot = byAge[0]?.[0] ?? 's0';
    }
    work.set(slot, rec);
    patch[slot] = rec;
  }
  return patch;
}

/** Fällige, noch nicht erledigte Einträge, die am längsten wartenden zuerst. */
export function dueRepairs(doc: RepairDoc, nowMs: number, max = REPAIR_PER_SESSION): Array<[string, RepairRec]> {
  return Object.entries(doc)
    .filter(([, r]) => r.done === 0 && r.due <= nowMs)
    .sort((a, b) => a[1].due - b[1].due || a[0].localeCompare(b[0], 'en', { numeric: true }))
    .slice(0, max);
}

/** Richtig: nächste Box (1 → 3 → 9 → erledigt). Falsch: zurück in Box 1. */
export function answerRepair(rec: RepairRec, ok: boolean, nowMs: number): RepairRec {
  if (!ok) return { ...rec, box: 1, due: dueAfter(nowMs, 1), done: 0 };
  if (rec.box === 1) return { ...rec, box: 3, due: dueAfter(nowMs, 3) };
  if (rec.box === 3) return { ...rec, box: 9, due: dueAfter(nowMs, 9) };
  return { ...rec, done: 1, due: dueAfter(nowMs, 9) };
}

/** Wann der Eintrag nach der Antwort wieder dran ist (in Tagen, 0 = erledigt). */
export function boxDays(rec: RepairRec): number {
  return rec.done ? 0 : rec.box;
}

const tokens = (s: string): string[] => plain(s).split(' ').filter(Boolean).map(toUS);

/**
 * Prüfung der getippten Reparatur. Richtig = gleich (britische Schreibweise gilt). Ein Tippfehler
 * (`near`) gilt nur, wenn die Wörter der Korrektur da sind und kein Wort des Fehlers übrig ist:
 * Sonst wäre „He work here“ (unverändert) nur „ein Buchstabe daneben“ von „He works here“.
 */
export function checkRepair(given: string, rec: Pick<RepairRec, 'orig' | 'fix'>, extraAccepted: readonly string[] = []): 'correct' | 'near' | 'wrong' {
  if (!plain(given)) return 'wrong';
  if (plain(given) === plain(rec.orig) && plain(rec.orig) !== plain(rec.fix)) return 'wrong';
  const r = checkTyped(given, [rec.fix, ...extraAccepted], { lemma: '' });
  if (r.verdict === 'correct') return 'correct';
  if (r.verdict === 'near' && r.kind === 'typo') {
    const origT = new Set(tokens(rec.orig));
    const fixT = new Set(tokens(rec.fix));
    const givenT = new Set(tokens(given));
    const added = [...fixT].filter((t) => !origT.has(t));
    const gone = [...origT].filter((t) => !fixT.has(t));
    if (added.every((t) => givenT.has(t)) && gone.every((t) => !givenT.has(t))) return 'near';
  }
  return 'wrong';
}

/** Lerntag, an dem der Eintrag angelegt wurde. */
export const addedDay = (rec: Pick<RepairRec, 'add'>): string => dayKey(rec.add);
