import { addDays, dayKey, dayStartOf, learningDayEnd } from '../shared';
import { type Catalog, danger, dueOn, formFor, isNewLex } from './catalog';
import type { DayPlan } from './day';
import { mayPlan, RETRY_GAP, STEP_A_GAP, STEP_B_GAP, STEP_B_MS } from './planner';
import { hash32 } from './rand';
import { CUE_MAX_LV } from './forms';
import { type DayMark, doneToday, planCount } from './dayCount';
import { FORM_SPEC } from './grade';
import { FREE_KINDS, type Form, type Lex, type VocabCfg } from './types';
export { FREE_KINDS } from './types';

// Wörter-Modul V1: Ablauf einer Runde (plan.md §2.2 `startSession`, §4.3 Lernschritte, §4.4; M9 Regel, M12, M72 Grundform, N2).
// Jede Art läuft durch dieselbe Tagesmarke (`lex.day`): Ein heute schon gebuchtes Lexem zählt in jeder weiteren Runde nur als Übung
// (`planned: false`, N2), außer es ist ein Lernschritt. So holt kein Weg der App ein Wort am Planer vorbei.

// Großpaket B3 (03.11.2026): `use` = Anwenden frei gestartet (Wörter-Reiter „Anwenden“): dieselbe Anwenden-Aufgabe wie am Ende der Pflicht.
export type SessionKind = 'pflicht' | 'more5' | 'new5' | 'free' | 'free10' | 'free20' | 'free30' | 'evening' | 'week' | 'word' | 'mistakes' | 'use';
export const SESSION_KINDS: readonly SessionKind[] = ['pflicht', 'more5', 'new5', 'free', 'free10', 'free20', 'free30', 'evening', 'week', 'word', 'mistakes', 'use'];
/** „Noch 5 neue Wörter“ (Emrah 08.11.2026, Wörter-Tempo „A“): Extra-Runde nur mit neuen Wörtern, über das Tageskontingent hinaus. */
export const NEW5_SIZE = 5;
export const EVENING_MAX = 8;
export const WEEK_MAX = 10;
export const FREE_SIZE = 20;
export const FIRST_NEW_AFTER = 4; // erstes neues Lexem nach 3–5 Wiederholungen (fest 4)
export const TRANSFER_MIN = 3;
export const TRANSFER_MAX = 5;
/** Höchstens so viele offene Kontrastkarten je Runde (M14). */
export const CONTRAST_MAX = 2;
/**
 * Höchstens so viele Abfragen je Wort in EINER Runde (ohne Einführung; Emrah 05.11.2026: „diese Karte kommt zum 4. oder 5. Mal“).
 * Weitere offene Lernschritte bleiben im Wort und kommen in der nächsten Runde des Lerntags oder am nächsten Tag.
 */
export const MAX_PER_ROUND = 3;

/** `step`: 0 kein Lernschritt · 1 Schritt A · 2 Schritt B · 3 Wiederkehr nach Fehler. */
/** V2: `sent` mit/ohne englischen Satz, `cue` „Gesucht: …“ an der Lücke (M25, bis Stufe 4). */
export type Task = { path: string; form: Form; step: 0 | 1 | 2 | 3; intro: boolean; planned: boolean; why: string; group?: string[]; sent: 's' | 'n' | '-'; cue: boolean };

type Slot = { path: string; form: Form; step: 0 | 1 | 2 | 3; intro?: boolean; why: string; group?: string[]; afterCard?: number; afterMs?: number; evidence?: boolean; /** Großpaket WT: freies Üben eines nicht fälligen Wortes – zählt als Übung, verschiebt den Plan nicht. */ practice?: boolean };

export type SessionOpts = { cfg: VocabCfg; paths?: string[]; seenToday?: ReadonlySet<string> };

export class SessionRun {
  private queue: Slot[] = [];
  private pending: Slot[] = [];
  private cards = 0;
  private last: string | null = null;
  /** Abfragen je Wort in dieser Runde (ohne Einführung). */
  private readonly shown = new Map<string, number>();
  /** In dieser Runde als unfair gemeldet: kommt in dieser Runde nicht mehr. */
  private readonly blocked = new Set<string>();
  private readonly day: string;
  private readonly seen = new Set<string>();
  /** Wörter dieser Runde und die davon schon beantworteten (Zähler außerhalb der Pflicht, K11: einzelne Wörter, nicht Karten). */
  private readonly words = new Set<string>();
  private readonly answered = new Set<string>();
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
    for (const sl of [...this.pending, ...this.queue]) this.words.add(sl.path);
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
    if (this.kind !== 'word' && this.kind !== 'use')
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
        } else if (!doneToday(l, day)) reviews.push({ path, form: dueOn(l, day, this.cat.get(path)?.av)?.form ?? form, step: 0, why: 'due' });
      }
      this.queue = interleave(reviews, fresh);
      // Emrah 07.11.2026 („Text“ A): die Schreibaufgabe mit mehreren Wörtern gehört nicht mehr in die Wörter-Pflicht (sie allein kostete
      // 3–5 Minuten), sondern zu Schritt 3 „Anwenden“ (Runde `use`, Anwenden › „Text mit deinen Wörtern“).
    } else if (this.kind === 'more5' || this.kind === 'free' || FREE_KINDS[this.kind] !== undefined) {
      const n = this.kind === 'more5' ? 5 : (FREE_KINDS[this.kind] ?? FREE_SIZE);
      const open = (it: (typeof items)[number]) => notCarried(it.path) && !this.seen.has(it.path) && !doneToday(it.lex, day) && !this.cat.rests(it.path);
      const due = items.filter((it) => open(it) && dueOn(it.lex, day, it.av)).sort((a, b) => danger(a.lex, nowMs) - danger(b.lex, nowMs) || a.path.localeCompare(b.path));
      const out: Slot[] = due.slice(0, n).map((it) => ({ path: it.path, form: dueOn(it.lex, day, it.av)!.form, step: 0, why: 'due' }));
      // Großpaket WT: reicht das Fällige nicht, kommen die wackeligsten schon gelernten Wörter (niedrigste Abrufwahrscheinlichkeit) vor neuen dran.
      if (FREE_KINDS[this.kind] !== undefined && out.length < n) {
        // Nie ein Wort aus dem heutigen Plan (das kommt noch geplant dran).
        const calm = dayStartOf(addDays(day, 4));
        const taken = new Set([...out.map((s) => s.path), ...(this.plan?.d === day ? this.plan.plan.map((e) => e[0]) : [])]);
        const shaky = items
          // Nur Wörter, die nicht in den nächsten Tagen ohnehin geplant drankommen (sonst zweimal am Tag bzw. vorgezogen).
          .filter((it) => open(it) && !taken.has(it.path) && !isNewLex(it.lex) && !(it.lex.step && dayKey(it.lex.step.at) === day) && Math.min(it.lex.u.due, it.lex.b?.due ?? Infinity) >= calm)
          .sort((a, b) => danger(a.lex, nowMs) - danger(b.lex, nowMs) || a.path.localeCompare(b.path));
        for (const it of shaky) {
          if (out.length >= n) break;
          out.push({ path: it.path, form: formFor(it.lex, it.av), step: 0, why: 'practice', practice: true });
        }
      }
      const introduced = items.filter((it) => it.lex.intro === day).length;
      const quota = Math.max(0, this.opts.cfg.newPerDay - introduced);
      const fresh = items.filter((it) => isNewLex(it.lex)).sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
      // Großpaket WT (learning-scientist Befund 8): im Schnellstart nie zwei verwechselbare neue am selben Tag und nie die neuen des heutigen Plans.
      const quick = FREE_KINDS[this.kind] !== undefined;
      const blocked = new Set<string>(quick && this.plan?.d === day ? this.plan.plan.map((e) => e[0]) : []);
      if (quick) for (const it of items) if (it.lex.intro === day) for (const sib of this.cat.siblingsOf(it.path)) blocked.add(sib);
      for (const it of fresh) {
        if (out.length >= n || out.filter((s) => s.intro).length >= quota) break;
        if (blocked.has(it.path)) continue;
        out.push({ path: it.path, form: 'intro', step: 0, intro: true, why: 'new' });
        if (quick) for (const sib of this.cat.siblingsOf(it.path)) blocked.add(sib);
      }
      this.queue = out;
    } else if (this.kind === 'new5') {
      // Nur neue Wörter (Reihenfolge wie im Bestand), nie zwei verwechselbare am selben Tag (Geschwister heute eingeführter Wörter gesperrt).
      const blocked = new Set<string>();
      for (const it of items) if (it.lex.intro === day) for (const sib of this.cat.siblingsOf(it.path)) blocked.add(sib);
      const out: Slot[] = [];
      for (const it of items.filter((x) => isNewLex(x.lex) && notCarried(x.path)).sort((a, b) => a.order - b.order || a.path.localeCompare(b.path))) {
        if (out.length >= NEW5_SIZE) break;
        if (blocked.has(it.path)) continue;
        out.push({ path: it.path, form: 'intro', step: 0, intro: true, why: 'new' });
        for (const sib of this.cat.siblingsOf(it.path)) blocked.add(sib);
      }
      this.queue = out;
    } else if (this.kind === 'use') {
      // Nur die Anwenden-Aufgabe (dieselbe Auswahl wie in der Pflicht; ohne passende Lexeme „nur Beleg“, ohne Stufe 4–6 leer).
      this.queue = this.transferSlot(nowMs);
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
      // Nebenwege nehmen dieselbe Formwahl wie die Pflicht (Leiter, jeder 3. ohne Satz ab Stufe 4); Lexeme ohne Benutzen-Spur: Lücke.
      this.queue = paths.filter(notCarried).map((path) => {
        const it = this.cat.get(path);
        return { path, form: it?.lex.b ? formFor(it.lex, it.av) : 'gap', step: 0, why: this.kind };
      });
    }
    // Offene Kontrastkarten (M14) kommen in der nächsten Runde zuerst, höchstens zwei, die jüngste Verwechslung vorn; ohne Planwirkung.
    // Nicht in „Dieses Wort“ (dort übt man genau ein Wort) und nie für ausgeblendete oder ruhende Lexeme.
    // Steht das Wort in dieser Runde als fällige Abfrage an, entfällt die Kontrastkarte: erst ehrlich messen (die Abfrage zeigt den Kontrast im
    // Band, richtig beantwortet schließt sie ihn), sonst gäbe die Kontrastkarte die Antwort kurz vorher vor (learning-scientist V3 S3, B1).
    if (this.kind !== 'word' && this.kind !== 'use') {
      const asked = new Set(this.queue.filter((s) => s.why === 'due').map((s) => s.path));
      const open = items
        .filter((it) => it.lex.ct && !asked.has(it.path) && !it.hidden && !this.cat.rests(it.path))
        .sort((a, b) => b.lex.ct!.at - a.lex.ct!.at || a.path.localeCompare(b.path))
        .slice(0, CONTRAST_MAX)
        .map((it): Slot => ({ path: it.path, form: 'contrast', step: 0, why: 'contrast' }));
      this.queue.unshift(...open);
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
    // V3: Wiederkehr nach Einspruch (20/21) in einem neuen Satz (die Karte wählt einen anderen als den gezeigten).
    if (st.n >= 20) return { path, form: 'gap', step: 3, why: 'again', afterCard: carried ? 0 : base + RETRY_GAP };
    // Wiederkehr nach Fehler: frei, abwechselnd im Satz und ohne Satz (M49, M53).
    return { path, form: st.n % 2 === 0 ? 'nosent' : 'gap', step: 3, why: 'retry', afterCard: carried ? 0 : base + RETRY_GAP };
  }

  private toTask(s: Slot, nowMs: number): Task {
    const l = this.lex(s.path);
    // Pflicht, „Noch 5“ und freie Runde nehmen nur Fälliges/Geplantes; die anderen Wege buchen nur Fälliges oder Gefährdetes (mayPlan).
    const sideRoute = this.kind === 'week' || this.kind === 'word' || this.kind === 'mistakes';
    const planned = !!l && !s.evidence && !s.practice && s.form !== 'contrast' && (s.intro || s.step > 0 || (sideRoute ? mayPlan(l, nowMs) : !doneToday(l, this.day)));
    const sent = FORM_SPEC[s.form].sent;
    const cue = sent === 's' && FORM_SPEC[s.form].track === 'b' && (l?.lv ?? 1) <= CUE_MAX_LV;
    return { path: s.path, form: s.form, step: s.step, intro: !!s.intro, planned, why: planned || s.form === 'contrast' || s.evidence ? s.why : 'practice', ...(s.group ? { group: s.group } : {}), sent, cue };
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
    // Kurze Runde (z. B. nur drei neue Wörter): Schritt A und die Wiederkehr nach Fehler kommen noch in DIESER Runde, auch wenn weniger Karten
    // dazwischen lagen – das Band hat „gleich noch einmal“ versprochen (Kap. 2 Nr. 2, UX-Prüfung V3 Nr. 3). Zuerst ein anderes Wort als das
    // gerade gezeigte. Schritt B (Abstand ≥ 3 Min.) bleibt für die nächste Runde des Lerntags; das Band sagt dort „heute später“.
    const soon = this.pending
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.step !== 2)
      .sort((a, b) => Number(a.p.path === this.last) - Number(b.p.path === this.last) || (a.p.afterCard ?? 0) - (b.p.afterCard ?? 0));
    if (soon.length) return this.toTask(this.pending.splice(soon[0]!.i, 1)[0] as Slot, nowMs);
    return null;
  }

  /** Nach der Antwort (der Aufrufer hat `applyAnswer` bzw. `introduce` angewandt und den Bestand aktualisiert). */
  done(task: Task, nowMs: number): void {
    this.cards += 1;
    this.last = task.path;
    this.words.add(task.path);
    this.answered.add(task.path);
    const paths = task.group ?? [task.path];
    for (const p of paths) {
      this.seen.add(p);
      if (!task.intro) this.shown.set(p, (this.shown.get(p) ?? 0) + 1);
      const l = this.lex(p);
      if (l && !this.blocked.has(p) && (this.shown.get(p) ?? 0) < MAX_PER_ROUND && this.stepToday(l) && !this.pending.some((s) => s.path === p) && task.form !== 'transfer') {
        const slot = this.stepSlot(p, l, this.cards, nowMs);
        // Wiederkehr nach Fehler nur mit anderen Karten dazwischen; sonst dasselbe Wort direkt hintereinander (Emrah 05.11.2026) – dann in der nächsten Runde.
        const others = this.othersComing(p);
        if (slot.step !== 3 || others) this.pending.push(slot);
      }
    }
  }

  /**
   * Kommen in dieser Runde noch andere Karten als `p`? Ein Schritt B eines anderen Worts zählt nur, wenn seine Kartenzahl bis zum Ende der
   * Runde erreicht wird (sonst kommt er erst in der nächsten Runde – learning-scientist W7 SOLL 1).
   */
  private othersComing(p: string): boolean {
    return this.queue.some((s) => s.path !== p) || this.pending.some((s) => s.path !== p && (s.step !== 2 || (s.afterCard ?? 0) <= this.cards + this.queue.length));
  }

  /** Vor dem Band (die Antwort ist noch nicht `done`): holt die Runde dieses Wort nach der Antwort noch einmal zurück? */
  returnsThisRound(task: Task): boolean {
    if (task.intro) return true;
    const p = task.path;
    return !this.blocked.has(p) && (this.shown.get(p) ?? 0) + 1 < MAX_PER_ROUND && this.othersComing(p);
  }

  /** „Aufgabe war unfair“: dieses Wort kommt in dieser Runde nicht mehr, auch nicht als Wiederkehr; offene Lernschritte bleiben im Wort. */
  block(path: string): void {
    this.blocked.add(path);
    this.pending = this.pending.filter((s) => s.path !== path);
    this.queue = this.queue.filter((s) => s.path !== path);
  }

  /**
   * Was in dieser Runde noch ansteht, in der Reihenfolge der Schlange, danach die offenen Lernschritte (Politur P2: Zeit-Vorschau der Runde
   * und Ton vorab rechnen). Nur zum Lesen.
   */
  ahead(): { path: string; form: Form; intro: boolean; step: 0 | 1 | 2 | 3 }[] {
    return [...this.queue, ...this.pending].map((s) => ({ path: s.path, form: s.form, intro: !!s.intro, step: s.step }));
  }

  /**
   * Politur P2 (E3 „Wiederholungen zuerst“): Wird die Zeit knapp, rücken die noch nicht eingeführten neuen Wörter hinter die Wiederholungen
   * (Reihenfolge untereinander bleibt). So nimmt der Zeitdeckel am Ende neue Wörter weg, nie fällige Wiederholungen. Liefert, ob sich etwas
   * geändert hat.
   */
  holdFresh(): boolean {
    const lastReview = this.queue.reduce((at, s, i) => (s.intro ? at : i), -1);
    const firstFresh = this.queue.findIndex((s) => s.intro);
    if (firstFresh < 0 || firstFresh > lastReview) return false;
    this.queue = [...this.queue.filter((s) => !s.intro), ...this.queue.filter((s) => s.intro)];
    return true;
  }

  /**
   * Zähler „x von y erledigt“ außerhalb der Pflicht (K11): einzelne Wörter der Runde, je Wort einmal. Lernschritte, Wiederkehr nach einem
   * Fehler und Kontrastkarten desselben Worts erhöhen die Gesamtzahl nicht; ein Wort zählt als erledigt, sobald es einmal beantwortet ist.
   */
  wordCount(): { done: number; total: number } {
    for (const sl of this.pending) this.words.add(sl.path);
    let done = 0;
    for (const p of this.words) if (this.answered.has(p)) done++;
    return { done, total: this.words.size };
  }

  /**
   * Karten, die in DIESER Runde noch kommen (Fortschritt „x von y“, Kap. 2 Nr. 2): die Schlange, je neues Wort darin sein Schritt A
   * (kommt immer noch in dieser Runde), offene Schritte A und Wiederkehr nach Fehler. Schritt B zählt nur, wenn seine Kartenzahl bis zum
   * Ende der Runde erreicht wird – sonst kommt er „heute später“ in der nächsten Runde und gehört nicht in diesen Zähler (UX-Nachprüfung V3).
   */
  remaining(): number {
    const intros = this.queue.filter((s) => s.intro).length;
    const soon = this.pending.filter((s) => s.step !== 2).length;
    const base = this.queue.length + intros + soon;
    const lateB = this.pending.filter((s) => s.step === 2 && (s.afterCard ?? 0) <= this.cards + base).length;
    return base + lateB;
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

/**
 * Rundenende für Heute und die Serie (V3 Schritt 4b): einmal je Runde, beim Abschluss oder beim Verlassen (`partial`).
 * `day` = Lerntag beim Start; `right` = Abfragen mit Note > 1; `activeMs` = aktive Zeit (je Karte gedeckelt).
 */
export type RoundReport = { kind: SessionKind; day: string; n: number; right: number; activeMs: number; partial: boolean };

/** Heute schon gebucht? (Regel in `dayCount.ts`, gemeinsam mit Heute.) */
export { doneToday };

/** Wie viele Einträge des eingefrorenen Wörter-Plans heute schon erledigt sind (Wiederholung gebucht, neues Wort eingeführt). */
export function planDoneCount(plan: readonly (readonly [string, string, string])[], lexOf: (path: string) => DayMark | null, day: string): number {
  return planCount(plan, lexOf, day).done;
}
