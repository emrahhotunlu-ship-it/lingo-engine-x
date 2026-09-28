import { TRAPS, trapById, type Trap } from '../../content/nb/traps';
import { dayKey } from '../date';
import type { DueError } from '../grammar/errors';
import type { GrammarTask } from '../learn/types';
import { hash32 } from '../random';
import type { Lang } from '../srs/types';
import { matchTraps } from '../week/traps';
import { checkRepairLocal } from './check';
import { readRepairs, repairNorm, type NewRepair, type RepairItem, type RepairSrc } from './repair';

// Tageseinheit, Blöcke 4 „Fokus“ und 5 „Nochmal, aber besser“ (plan.md §1.5, N41/N42;
// Prüfung Tageseinheit M4b/c, M6, M9, S4). Rein und getestet: Die Bildschirme bekommen hier
// ihre Aufgaben, Prüfungen und Reparatur-Karten.
//
// Block 4: immer 3 Hauptaufgaben – erst die Korrekturen aus Block 3 (`task.fixes`, ersatzweise
// die Reparatur-Sätze von heute), dann fällige Fehlersätze (`dueErrors`, gleiche Falle zuerst),
// dann offene Tagesauftrags-Aufgaben, dann Fallensätze der Woche. Ohne Korrekturen (ohne KI)
// sucht `matchTraps` im eigenen Text. Ist eine Korrektur eine Deutsch-Falle, folgt EIN Mini-Drill
// mit den 3 Sätzen dieser Falle aus dem Startsatz.
// Block 5: Neufassung ↔ bessere Fassung; je Korrektur lokal „jetzt richtig?“ (enthält `right`,
// nicht `mine`). Reparatur-Karten nur aus belegten Korrekturen – nie aus ungeprüftem Text.

/** Wie `Fix` (ui/feedback/types.ts), strukturgleich – die Domäne hängt nicht an der Oberfläche. */
export type FixLike = { kind: 'meaning' | 'trap' | 'goal' | 'form'; mine: string; right: string; why: string; trapId?: string };

/** Was von Block 3 kommt (`UnitTaskResult` ohne Art/Verweis). */
export type TaskLike = { text: string; better?: string; fixes: readonly FixLike[] };

export type FocusTask =
  /** Korrektur aus Block 3 (oder Reparatur-Satz von heute): neu schreiben. */
  | { kind: 'fix'; id: string; mine: string; right: string; why: string; trapId: string | null; fixKind: FixLike['kind'] }
  /** Ohne KI: eine Deutsch-Falle im eigenen Text (Treffer von `matchTraps`). */
  | { kind: 'own'; id: string; sentence: string; match: string; trapId: string }
  /** Satz einer Falle aus dem Startsatz (Mini-Drill oder Fallensatz der Woche). */
  | { kind: 'trap'; id: string; trapId: string; wrong: string; right: readonly string[]; n: number; of: number; drill: boolean }
  /** Fälliger Fehlersatz oder offene Tagesauftrags-Aufgabe (Grammatik-Aufgabe). */
  | { kind: 'grammar'; id: string; task: GrammarTask; reason: 'due' | 'daily' };

export type FocusInput = {
  day: string;
  task: TaskLike | null;
  /** `app/repair` (roh) – Ersatz für `task.fixes` auf einem zweiten Gerät. */
  repairDoc?: Readonly<Record<string, unknown>> | null;
  due: readonly DueError[];
  daily?: readonly GrammarTask[];
  /** Fallen der Woche (`WeekTargets.traps`, Startsatz-IDs `f01`…; fremde IDs werden übergangen). */
  weekTraps?: readonly string[];
  traps?: readonly Trap[];
};

/** Hauptaufgaben in Block 4 (Prüfung M6). */
export const FOCUS_MAIN = 3;
/** Sätze im Mini-Drill einer Falle (lehrer.md §2.1). */
export const MINI_DRILL = 3;

const FIX_ORDER: Record<FixLike['kind'], number> = { meaning: 0, trap: 1, goal: 2, form: 3 };

const trapIn = (list: readonly Trap[], id: string | null | undefined): Trap | null => (id ? (list.find((t) => t.id === id) ?? null) : null);

/** Falle einer Korrektur: angegeben (`trapId`) oder im falschen Text erkannt. */
function trapOfFix(f: FixLike, traps: readonly Trap[]): string | null {
  if (f.trapId && trapIn(traps, f.trapId)) return f.trapId;
  return matchTraps(f.mine, traps)[0]?.id ?? null;
}

/** Reparatur-Sätze, die heute (Lerntag) angelegt wurden – die Korrekturen von Block 3 auf jedem Gerät. */
export function todaysRepairs(repairDoc: Readonly<Record<string, unknown>> | null | undefined, day: string): RepairItem[] {
  return readRepairs(repairDoc ?? undefined).filter((e) => e.t > 0 && dayKey(e.t) === day);
}

/** Die Korrekturen des Tages: aus Block 3, sonst aus den Reparatur-Sätzen von heute (sortiert, ≤ 3). */
export function corrections(i: Pick<FocusInput, 'task' | 'repairDoc' | 'day'>): FixLike[] {
  const fromTask = (i.task?.fixes ?? []).filter((f) => f.mine.trim() && f.right.trim() && repairNorm(f.mine) !== repairNorm(f.right));
  const list: FixLike[] = fromTask.length
    ? [...fromTask]
    : todaysRepairs(i.repairDoc, i.day).map((r) => ({ kind: 'form' as const, mine: r.wrong, right: r.right, why: r.why ?? '' }));
  const seen = new Set<string>();
  return list
    .sort((a, b) => FIX_ORDER[a.kind] - FIX_ORDER[b.kind])
    .filter((f) => {
      const k = repairNorm(f.mine);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, FOCUS_MAIN);
}

/** Der Satz um eine Stelle im Text (bis zum nächsten Satzzeichen). */
export function sentenceAt(text: string, at: number): string {
  const before = text.slice(0, at);
  const start = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1;
  const rest = text.slice(at);
  const m = /[.!?\n]/.exec(rest);
  const end = m ? at + m.index + (m[0] === '\n' ? 0 : 1) : text.length;
  return text.slice(start, end).trim();
}

function drillOf(trap: Trap, drill: boolean, from = 0): FocusTask[] {
  const out: FocusTask[] = [];
  const n = Math.min(MINI_DRILL, trap.drills.length);
  for (let k = 0; k < n; k++) {
    const d = trap.drills[(from + k) % trap.drills.length]!;
    out.push({ kind: 'trap', id: `trap:${trap.id}:${(from + k) % trap.drills.length}`, trapId: trap.id, wrong: d.wrong, right: d.right, n: k + 1, of: n, drill });
  }
  return out;
}

/** Aufgaben für Block 4: 3 Hauptaufgaben, dazu höchstens ein Mini-Drill (3 Sätze) direkt nach der ersten Fallen-Korrektur. */
export function buildFocus(i: FocusInput): FocusTask[] {
  const traps = i.traps ?? TRAPS;
  const main: FocusTask[] = [];
  const trapIds: string[] = [];
  for (const f of corrections(i)) {
    const trapId = trapOfFix(f, traps);
    if (trapId) trapIds.push(trapId);
    main.push({ kind: 'fix', id: `fix:${hash32(repairNorm(f.mine)).toString(36)}`, mine: f.mine.trim(), right: f.right.trim(), why: f.why, trapId, fixKind: f.kind });
  }
  // Ohne Korrekturen (Block 3 ungeprüft gespeichert, M4b): Fallen im eigenen Text.
  if (!main.length && i.task?.text.trim()) {
    for (const hit of matchTraps(i.task.text, traps)) {
      if (main.length >= FOCUS_MAIN || trapIds.includes(hit.id)) continue;
      trapIds.push(hit.id);
      main.push({ kind: 'own', id: `own:${hit.id}`, sentence: sentenceAt(i.task.text, hit.at) || hit.match, match: hit.match, trapId: hit.id });
    }
  }
  // Auffüllen mit fälligen Fehlersätzen (M6): dieselbe Falle zuerst, sonst älteste Fälligkeit.
  const sameTrap = (d: DueError): number => {
    if (!trapIds.length) return 1;
    const given = typeof d.e.given === 'string' ? d.e.given : '';
    return matchTraps(`${given} ${d.task.prompt}`, traps).some((h) => trapIds.includes(h.id)) ? 0 : 1;
  };
  const due = [...i.due].sort((a, b) => sameTrap(a) - sameTrap(b) || a.due - b.due);
  for (const d of due) {
    if (main.length >= FOCUS_MAIN) break;
    main.push({ kind: 'grammar', id: `due:${d.task.key}`, task: d.task, reason: 'due' });
  }
  for (const t of i.daily ?? []) {
    if (main.length >= FOCUS_MAIN) break;
    if (main.some((m) => m.kind === 'grammar' && m.task.key === t.key)) continue;
    main.push({ kind: 'grammar', id: `daily:${t.key}`, task: t, reason: 'daily' });
  }
  // Dann Fallensätze der Woche (ohne KI immer vorhanden); fehlen sie, rotiert der Startsatz je Tag.
  if (main.length < FOCUS_MAIN) {
    const week = (i.weekTraps ?? []).map((id) => trapIn(traps, id)).filter((t): t is Trap => !!t);
    const start = traps.length ? hash32(i.day) % traps.length : 0;
    const pool = week.length ? week : [...traps.slice(start), ...traps.slice(0, start)];
    let k = 0;
    const used = new Set<string>();
    while (main.length < FOCUS_MAIN && pool.length && k < pool.length * MINI_DRILL) {
      const trap = pool[k % pool.length]!;
      const idx = (Math.floor(k / pool.length) + hash32(`${i.day}|${trap.id}`)) % Math.max(1, trap.drills.length);
      const d = trap.drills[idx];
      const id = `trap:${trap.id}:${idx}`;
      if (d && !used.has(id)) {
        used.add(id);
        main.push({ kind: 'trap', id, trapId: trap.id, wrong: d.wrong, right: d.right, n: 0, of: 0, drill: false });
      }
      k++;
    }
  }
  // Mini-Drill nach der ersten Fallen-Korrektur (Korrektur aus Block 3 oder Falle im eigenen Text).
  const firstTrap = main.findIndex((m) => (m.kind === 'fix' && m.trapId) || m.kind === 'own');
  if (firstTrap >= 0) {
    const m = main[firstTrap]!;
    const trap = trapIn(traps, m.kind === 'fix' ? m.trapId : m.kind === 'own' ? m.trapId : null);
    if (trap) {
      const drill = drillOf(trap, true).filter((d) => !main.some((x) => x.id === d.id));
      return [...main.slice(0, firstTrap + 1), ...drill, ...main.slice(firstTrap + 1)];
    }
  }
  return main;
}

// ------------------------------------------------------------------ Prüfen (lokal, ohne KI)

export type FocusVerdict = 'ok' | 'close' | 'wrong' | 'unchecked';

/** Lösung, die nach dem Versuch gezeigt wird (erste erlaubte Fassung). */
export function focusSolution(t: FocusTask, traps: readonly Trap[] = TRAPS): string {
  if (t.kind === 'fix') return t.right;
  if (t.kind === 'trap') return t.right[0] ?? '';
  if (t.kind === 'own') return trapIn(traps, t.trapId)?.right ?? '';
  return t.task.answer;
}

/**
 * Lokale Prüfung eines Versuchs. `own` (eigener Satz, ohne KI): Ist die Falle weg, gilt der Satz
 * als „ungeprüft gespeichert“ (nie als richtig und nie als Fehler), steckt sie noch drin, als falsch.
 */
export function checkFocus(t: Exclude<FocusTask, { kind: 'grammar' }>, given: string, traps: readonly Trap[] = TRAPS): FocusVerdict {
  const g = given.trim();
  if (!g) return 'wrong';
  if (t.kind === 'own') {
    const still = matchTraps(g, traps).some((h) => h.id === t.trapId);
    return still || repairNorm(g) === repairNorm(t.sentence) ? 'wrong' : 'unchecked';
  }
  const wrong = t.kind === 'fix' ? t.mine : t.wrong;
  const rights = t.kind === 'fix' ? [t.right] : t.right;
  let best: FocusVerdict = 'wrong';
  for (const right of rights) {
    const v = checkRepairLocal(g, { wrong, right });
    if (v === 'exact') return 'ok';
    if (v === 'close') best = 'close';
  }
  if (best === 'wrong' && t.kind === 'fix' && fixedNow(g, { mine: t.mine, right: t.right })) return 'close';
  return best;
}

/** S4: Ist eine Korrektur jetzt eingebaut? Enthält die richtige Stelle, nicht mehr die falsche. */
export function fixedNow(text: string, f: Pick<FixLike, 'mine' | 'right'>): boolean {
  const t = ` ${repairNorm(text)} `;
  const right = repairNorm(f.right);
  const mine = repairNorm(f.mine);
  if (!right) return false;
  const hasRight = t.includes(` ${right} `);
  // Steckt die richtige Fassung in der falschen (z. B. nur ein Wort ergänzt), zählt nur die richtige.
  const hasMine = mine && !right.includes(mine) ? t.includes(` ${mine} `) : false;
  return hasRight && !hasMine;
}

// ------------------------------------------------------------------ Block 5

export type AgainSource = {
  /** Was Emrah in Block 3 geschrieben hat (oder seine Sätze von heute). */
  before: string;
  /** Bessere Fassung (KI), ohne KI das Muster bzw. die Startsatz-Lösung, sonst `null`. */
  better: string | null;
  betterFrom: 'task' | 'trap' | null;
  fixes: FixLike[];
};

export function againSource(i: Pick<FocusInput, 'task' | 'repairDoc' | 'day' | 'traps'>): AgainSource {
  const traps = i.traps ?? TRAPS;
  const fixes = corrections(i);
  const today = todaysRepairs(i.repairDoc, i.day);
  const before = i.task?.text.trim() || today.map((r) => r.wrong).join(' ');
  if (i.task?.better?.trim()) return { before, better: i.task.better.trim(), betterFrom: 'task', fixes };
  if (!i.task && today.length) return { before, better: today.map((r) => r.right).join(' '), betterFrom: 'task', fixes };
  // Ohne KI: die Startsatz-Lösung der ersten Falle im Text.
  const hit = before ? matchTraps(before, traps)[0] : undefined;
  const trap = trapIn(traps, hit?.id);
  return { before, better: trap ? trap.right : null, betterFrom: trap ? 'trap' : null, fixes };
}

export type AgainCheck = { fix: FixLike; ok: boolean };

/** Je Korrektur: jetzt richtig eingebaut? (S4) */
export function againChecks(text: string, fixes: readonly FixLike[]): AgainCheck[] {
  return fixes.map((fix) => ({ fix, ok: fixedNow(text, fix) }));
}

const SRC_OF: Record<string, RepairSrc> = {
  'task.say': 'say',
  'task.fluency': 'fluency',
  'task.tones': 'tone',
  'task.inbox': 'write',
  'task.objection': 'talk',
  'task.meeting': 'talk',
  'task.roleplay': 'talk',
  'task.check': 'lesson',
};

/** Quelle eines Reparatur-Satzes aus der Art des Aufgaben-Blocks. */
export const repairSrcOf = (kind: string | null | undefined): RepairSrc => SRC_OF[kind ?? ''] ?? 'say';

/**
 * Reparatur-Karten aus BELEGTEN Korrekturen (M4c): die geprüften Korrekturen aus Block 3 und die
 * verpassten Startsatz-Sätze aus Block 4 (Lösung aus dem Startsatz). Nie aus Emrahs ungeprüftem
 * Text und nie aus seiner Neufassung.
 */
export function unitRepairs(
  i: { fixes: readonly FixLike[]; src: RepairSrc; missedTraps?: ReadonlyArray<{ trapId: string; wrong: string; right: readonly string[] }>; lang: Lang; ctx?: string | null },
  traps: readonly Trap[] = TRAPS,
): NewRepair[] {
  const out: NewRepair[] = [];
  for (const f of i.fixes) {
    if (!f.mine.trim() || !f.right.trim() || repairNorm(f.mine) === repairNorm(f.right)) continue;
    out.push({ wrong: f.mine, right: f.right, why: f.why || null, src: i.src, ...(i.ctx ? { ctx: i.ctx } : {}) });
  }
  for (const m of i.missedTraps ?? []) {
    const trap = trapById(m.trapId) ?? trapIn(traps, m.trapId);
    const right = m.right[0];
    if (!right) continue;
    out.push({ wrong: m.wrong, right, why: trap ? trap.why[i.lang] : null, src: 'pattern', ctx: trap ? trap.title.en : null });
  }
  return out;
}
