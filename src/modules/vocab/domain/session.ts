import { dayKey, learningDayEnd } from '../shared';
import { type Catalog, danger, dueOn, isNewLex } from './catalog';
import type { DayPlan } from './day';
import { mayPlan, RETRY_GAP, STEP_A_GAP, STEP_B_GAP, STEP_B_MS } from './planner';
import { hash32 } from './rand';
import type { Form, Lex, VocabCfg } from './types';

// Wörter-Modul V1: Ablauf einer Runde (plan.md §2.2 `startSession`, §4.3 Lernschritte, §4.4; M9 Regel, M12, M72 Grundform, N2).
// Jede Art läuft durch dieselbe Tagesmarke (`lex.day`): Ein heute schon gebuchtes Lexem zählt in jeder weiteren Runde nur als Übung
// (`planned: false`, N2), außer es ist ein Lernschritt. So holt kein Weg der App ein Wort am Planer vorbei.

export type SessionKind = 'pflicht' | 'more5' | 'free' | 'evening' | 'week' | 'word' | 'mistakes';
export const SESSION_KINDS: readonly SessionKind[] = ['pflicht', 'more5', 'free', 'evening', 'week', 'word', 'mistakes'];
export const EVENING_MAX = 8;
export const WEEK_MAX = 10;
export const FREE_SIZE = 20;
export const FIRST_NEW_AFTER = 4; // erstes neues Lexem nach 3–5 Wiederholungen (fest 4)
export const TRANSFER_MIN = 3;
export const TRANSFER_MAX = 5;

/** `step`: 0 kein Lernschritt · 1 Schritt A · 2 Schritt B · 3 Wiederkehr nach Fehler. */
export type Task = { path: string; form: Form; step: 0 | 1 | 2 | 3; intro: boolean; planned: boolean; why: string; group?: string[] };

type Slot = { path: string; form: Form; step: 0 | 1 | 2 | 3; intro?: boolean; why: string; group?: string[]; afterCard?: number; afterMs?: number; evidence?: boolean };

export type SessionOpts = { cfg: VocabCfg; paths?: string[]; seenToday?: ReadonlySet<string> };

export class SessionRun {
  private queue: Slot[] = [];
  private pending: Slot[] = [];
  private cards = 0;
  private readonly day: string;
  private readonly seen = new Set<string>();
  constructor(
    readonly kind: SessionKind,
    private cat: Catalog,
    private plan: DayPlan | null,
    nowMs: number,
    private opts: SessionOpts,
  ) {
    this.day = dayKey(nowMs);
    for (const p of opts.seenToday ?? []) this.seen.add(p);
    this.build(nowMs);
  }

  private lex(path: string): Lex | undefined {
    return this.cat.get(path)?.lex;
  }

  private stepToday(l: Lex): boolean {
    return !!l.step && dayKey(l.step.at) === this.day;
  }

  private build(nowMs: number): void {
    const day = this.day;
    const items = this.cat.items();
    // Offene Lernschritte dieses Lerntags gehen in die nächste Runde (§4.3), in jeder Art außer „Dieses Wort“.
    if (this.kind !== 'word')
      for (const it of items) if (this.stepToday(it.lex) && it.lex.intro !== null) this.pending.push(this.stepSlot(it.path, it.lex, 0, nowMs, true));
    const carried = new Set(this.pending.map((s) => s.path));
    const notCarried = (p: string) => !carried.has(p);
    if (this.kind === 'pflicht') {
      const plan = this.plan?.d === day ? this.plan.plan : [];
      const reviews: Slot[] = [];
      const fresh: Slot[] = [];
      for (const [path, track, form] of plan) {
        const l = this.lex(path);
        if (!l || !notCarried(path)) continue;
        if (track === 'n') {
          if (l.intro === null) fresh.push({ path, form: 'intro', step: 0, intro: true, why: 'new' });
        } else if (l.day !== day) reviews.push({ path, form: dueOn(l, day)?.form ?? form, step: 0, why: 'due' });
      }
      this.queue = interleave(reviews, fresh);
      this.queue.push(...this.transferSlot(nowMs));
    } else if (this.kind === 'more5' || this.kind === 'free') {
      const n = this.kind === 'more5' ? 5 : FREE_SIZE;
      const due = items
        .filter((it) => notCarried(it.path) && !this.seen.has(it.path) && it.lex.day !== day && dueOn(it.lex, day))
        .sort((a, b) => danger(a.lex, nowMs) - danger(b.lex, nowMs) || a.path.localeCompare(b.path));
      const out: Slot[] = due.slice(0, n).map((it) => ({ path: it.path, form: dueOn(it.lex, day)!.form, step: 0, why: 'due' }));
      const introduced = items.filter((it) => it.lex.intro === day).length;
      const quota = Math.max(0, this.opts.cfg.newPerDay - introduced);
      const fresh = items.filter((it) => isNewLex(it.lex)).sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
      for (const it of fresh) {
        if (out.length >= n || out.filter((s) => s.intro).length >= quota) break;
        out.push({ path: it.path, form: 'intro', step: 0, intro: true, why: 'new' });
      }
      this.queue = out;
    } else {
      let paths: string[];
      if (this.kind === 'evening') paths = items.filter((it) => it.lex.intro === day).sort((a, b) => a.order - b.order).slice(0, EVENING_MAX).map((it) => it.path);
      else if (this.kind === 'week')
        paths = items
          .filter((it) => !isNewLex(it.lex) && it.lex.lv >= 3)
          .sort((a, b) => hash32(`${a.path}|${day}|week`) - hash32(`${b.path}|${day}|week`))
          .slice(0, WEEK_MAX)
          .map((it) => it.path);
      else paths = (this.opts.paths ?? []).filter((p) => this.cat.get(p) && !isNewLex(this.cat.get(p)!.lex));
      this.queue = paths.filter(notCarried).map((path) => ({ path, form: 'gap', step: 0, why: this.kind }));
    }
  }

  /**
   * Anwenden (V4 baut Textsorten und Prüfung): 3 Lexeme der Stufen 4–6 ohne heutige Tagesmarke, bevorzugt mit Benutzen-Termin in 1–3 Tagen
   * (die Buchung zählt als deren Wiederholung); bis 5, wenn ≥ 6 in Frage kommen. Gibt es keine solchen, ist die Aufgabe „nur Beleg“
   * (ohne Planwirkung) mit den Lexemen der Stufen 4–6, deren Termin am nächsten liegt (plan.md §7).
   */
  private transferSlot(nowMs: number): Slot[] {
    const end = learningDayEnd(nowMs);
    const inPlan = new Set((this.plan?.plan ?? []).map((e) => e[0]));
    const band = this.cat.items().filter((it) => it.lex.lv >= 4 && it.lex.lv <= 6 && it.lex.b);
    const cands = band
      .filter((it) => it.lex.day !== this.day && !inPlan.has(it.path) && it.lex.b!.due >= end && it.lex.b!.due < end + 3 * 86_400_000)
      .sort((a, b) => a.lex.b!.due - b.lex.b!.due || a.path.localeCompare(b.path));
    if (cands.length) {
      const n = cands.length >= 6 ? TRANSFER_MAX : Math.min(TRANSFER_MIN, cands.length);
      const group = cands.slice(0, n).map((it) => it.path);
      return [{ path: group[0] as string, form: 'transfer', step: 0, why: 'transfer', group }];
    }
    const rest = band.filter((it) => !inPlan.has(it.path) && it.lex.day !== this.day);
    if (!rest.length) return [];
    const group = [...rest]
      .sort((a, b) => a.lex.b!.due - b.lex.b!.due || a.path.localeCompare(b.path))
      .slice(0, TRANSFER_MIN)
      .map((it) => it.path);
    return [{ path: group[0] as string, form: 'transfer', step: 0, why: 'evidence', evidence: true, group }];
  }

  private stepSlot(path: string, l: Lex, base: number, nowMs: number, carried = false): Slot {
    const st = l.step!;
    if (st.n === 1) return { path, form: 'gap_hint', step: 1, why: 'step', afterCard: carried ? 0 : base + STEP_A_GAP };
    if (st.n === 2) return { path, form: 'gap', step: 2, why: 'step', afterCard: carried ? 0 : base + STEP_B_GAP, afterMs: carried ? 0 : nowMs + STEP_B_MS };
    // Wiederkehr nach Fehler: frei, abwechselnd im Satz und ohne Satz (M49, M53).
    return { path, form: st.n % 2 === 0 ? 'nosent' : 'gap', step: 3, why: 'retry', afterCard: carried ? 0 : base + RETRY_GAP };
  }

  private toTask(s: Slot, nowMs: number): Task {
    const l = this.lex(s.path);
    // Pflicht, „Noch 5“ und freie Runde nehmen nur Fälliges/Geplantes; die anderen Wege buchen nur Fälliges oder Gefährdetes (mayPlan).
    const sideRoute = this.kind === 'week' || this.kind === 'word' || this.kind === 'mistakes';
    const planned = !!l && !s.evidence && (s.intro || s.step > 0 || (sideRoute ? mayPlan(l, nowMs) : l.day !== this.day));
    return { path: s.path, form: s.form, step: s.step, intro: !!s.intro, planned, why: planned ? s.why : 'practice', ...(s.group ? { group: s.group } : {}) };
  }

  /** Nächste Aufgabe oder `null` (Runde zu Ende; offene Lernschritte bleiben in `lex.step` für die nächste Runde des Lerntags). */
  next(nowMs: number): Task | null {
    const ready = this.pending.findIndex((s) => (s.afterCard ?? 0) <= this.cards && (s.afterMs ?? 0) <= nowMs);
    if (ready >= 0) {
      const [s] = this.pending.splice(ready, 1);
      return this.toTask(s as Slot, nowMs);
    }
    const s = this.queue.shift();
    if (s) return this.toTask(s, nowMs);
    // Schlange leer: ein Schritt, dessen Kartenzahl erreicht ist, kommt noch, wenn nur die Zeit fehlt (Schritt B am Einführungstag nicht verlieren).
    // Bewusste Ausnahme von plan.md §4.3 („≥ 8 Karten UND ≥ 3 Min.“): ein etwas früherer zweiter Abruf ist besser als keiner (learning-scientist V1).
    const late = this.pending.findIndex((p) => (p.afterCard ?? 0) <= this.cards);
    if (late >= 0) return this.toTask(this.pending.splice(late, 1)[0] as Slot, nowMs);
    return null;
  }

  /** Nach der Antwort (der Aufrufer hat `applyAnswer` bzw. `introduce` angewandt und den Bestand aktualisiert). */
  done(task: Task, nowMs: number): void {
    this.cards += 1;
    const paths = task.group ?? [task.path];
    for (const p of paths) {
      this.seen.add(p);
      const l = this.lex(p);
      if (l && this.stepToday(l) && !this.pending.some((s) => s.path === p) && task.form !== 'transfer') this.pending.push(this.stepSlot(p, l, this.cards, nowMs));
    }
  }

  /** Noch ausstehende Aufgaben (für Anzeige „noch X“). */
  remaining(): number {
    return this.queue.length + this.pending.length;
  }
}

/** Neue Lexeme eingestreut: das erste nach 4 Wiederholungen, das letzte spätestens bei der Hälfte der Wiederholungen (M72). */
export function interleave(reviews: Slot[], fresh: Slot[]): Slot[] {
  if (!fresh.length) return [...reviews];
  const out: Slot[] = [];
  const first = Math.min(FIRST_NEW_AFTER, Math.floor(reviews.length / 2));
  const lastAt = Math.max(first, Math.floor(reviews.length / 2));
  const gap = fresh.length > 1 ? (lastAt - first) / (fresh.length - 1) : 0;
  const at = fresh.map((_, i) => Math.round(first + i * gap));
  let f = 0;
  for (let i = 0; i <= reviews.length; i++) {
    while (f < fresh.length && at[f] === i) out.push(fresh[f++] as Slot);
    if (i < reviews.length) out.push(reviews[i] as Slot);
  }
  while (f < fresh.length) out.push(fresh[f++] as Slot);
  return out;
}
