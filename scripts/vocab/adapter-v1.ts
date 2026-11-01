// Vokabeln V1: Adapter für den NEUEN Planer (src/modules/vocab). Gleiche Schnittstelle und gleicher Lerner wie `adapter-current.ts`.
//
// Echte Logik des Moduls, importiert: Tagesplan (`buildDayPlan`, eingefroren je Lerntag, Rückstand verteilen), Runde (`SessionRun`: Pflicht,
// Extra = `free`, Abend-Check, Wochen-Check, „Dieses Wort üben“, Lernschritte A/B, Wiederkehr nach Fehler, Anwenden), je Antwort `applyAnswer`
// (eine Buchung je Spur und Tag, Kopplung nach oben, Deckel, Fuzz-Korridor, Lastausgleich in Minuten), Belege (`evidencePlans`),
// Umrechnung des Altbestands (`convertDoc`, Szenario D) und die Median-Zeiten je Form wie `vmod/stats`.
// Gezeigter Satz: der Ursprungssatz (`<id>#0`; die Kunstwörter haben nur einen), ohne Satz bei `nosent`, `meaning` und `transfer` (Lage auf Deutsch).

import { dayKey, dayStartOf } from '../../src/domain/date';
import { Catalog, dueOn, forecastMinutes, isNewLex, loadByDay } from '../../src/modules/vocab/domain/catalog';
import { applyMove, buildDayPlan, type DayPlan } from '../../src/modules/vocab/domain/day';
import { applyAnswer, emptyLex, evidencePlans, introduce, type PlanCtx } from '../../src/modules/vocab/domain/planner';
import { SessionRun, type SessionKind, type Task as VTask } from '../../src/modules/vocab/domain/session';
import { convertDoc, spreadBacklog } from '../../src/modules/vocab/domain/migrate';
import { DEFAULT_CFG, type Form, type FormStats, type Outcome as VOutcome } from '../../src/modules/vocab/domain/types';
import { addDays, daysBetween } from '../../src/domain/date';
import type { InputKind, LegacyDoc, Outcome, PlannerAdapter, PlannerSession, SimEvidence, SimKind, SimWord, Task } from './sim-core';

// Zielzeit für Vergleichsläufe: `VOCAB_MIN=10 node scripts/vocab/simulate.mjs --adapter v1` (Standard 15, F5).
// Vergleich bei gleicher Zahl neuer Wörter: `VOCAB_NEW=3` (Kontingent je Tag; Standard 5).
const cfg = { ...DEFAULT_CFG, min: Number(process.env.VOCAB_MIN ?? DEFAULT_CFG.min), newPerDay: Number(process.env.VOCAB_NEW ?? DEFAULT_CFG.newPerDay) };
let cat = new Catalog([]);
const plans = new Map<string, DayPlan>();
const samples = new Map<Form, number[]>();
let maxMoved = 0;

const P = (id: string) => `vocab/${id}`;
const ID = (p: string) => p.replace(/^vocab\//, '');

function med(): FormStats {
  const out: FormStats = {};
  for (const [f, l] of samples) {
    if (l.length < 5) continue;
    const s = [...l].sort((a, b) => a - b);
    out[f] = s[Math.floor(s.length / 2)];
  }
  return out;
}
function sample(f: Form, ms: number): void {
  const l = samples.get(f) ?? [];
  l.push(ms + 5000);
  if (l.length > 200) l.shift();
  samples.set(f, l);
}

const INPUT: Record<Form, InputKind> = { intro: 'choice', gap: 'typed', nosent: 'typed', gap_hint: 'hint', meaning: 'meaning', listen: 'typed', choice: 'choice', flip: 'choice', transfer: 'transfer' };
const toOutcome = (o: Outcome): VOutcome => (o.verdict === 'correct' ? 'ok' : o.verdict === 'near' ? 'typo' : 'wrong');

function ctxFor(path: string, nowMs: number, planned: boolean): PlanCtx {
  const day = dayKey(nowMs);
  const load = loadByDay(cat, med(), path);
  return { cfg, path, planned, load: (i) => load.get(addDays(day, i)) ?? 0, siblings: cat.siblingOffsets(path, day) };
}

function ensurePlan(nowMs: number): DayPlan {
  const day = dayKey(nowMs);
  let p = plans.get(day);
  if (!p) {
    const r = buildDayPlan(cat, nowMs, cfg, med());
    for (const m of r.moves) {
      const it = cat.get(m.path);
      if (!it) continue;
      const lex = applyMove(it.lex, m, dayStartOf);
      maxMoved = Math.max(maxMoved, lex.mv);
      cat.set(m.path, lex);
    }
    p = r.plan;
    plans.set(day, p);
  }
  return p;
}

function makeSession(kind: SimKind, now0: number, target?: string): PlannerSession {
  const plan = ensurePlan(now0);
  const vkind: SessionKind = kind === 'extra' ? 'free' : kind;
  const run = new SessionRun(vkind, cat, plan, now0, { cfg, ...(target ? { paths: [P(target)] } : {}) });
  let cur: VTask | null = null;
  return {
    next(now: number): Task | null {
      const t = run.next(now);
      cur = t;
      if (!t) return null;
      const lex = cat.get(t.path)!.lex;
      const sentence = t.form === 'gap' || t.form === 'gap_hint' || t.form === 'listen' ? `${ID(t.path)}#0` : undefined;
      return {
        lexeme: ID(t.path),
        ex: t.form,
        input: INPUT[t.form],
        stage: lex.lv,
        step: t.step > 0 || t.intro,
        due: !!dueOn(lex, dayKey(now)),
        ...(t.intro ? { intro: true } : {}),
        ...(sentence ? { sentence } : {}),
        ...(t.group ? { group: t.group.map(ID) } : {}),
      };
    },
    answer(task: Task, o: Outcome | null, now: number, group?: Outcome[]): { planned: boolean } {
      const t = cur;
      cur = null;
      if (!t) return { planned: false };
      if (t.intro) {
        cat.set(t.path, introduce(cat.get(t.path)!.lex, now));
        run.done(t, now);
        return { planned: true };
      }
      if (!o) return { planned: false };
      let planned = false;
      const paths = t.group ?? [t.path];
      paths.forEach((p, i) => {
        const oc = (group ? group[i] : o) ?? o;
        const it = cat.get(p);
        if (!it) return;
        const r = applyAnswer(it.lex, { t: now, form: t.form, outcome: toOutcome(oc), hint: 0, ms: oc.submitMs, fk: oc.firstKeyMs, sentence: task.sentence ?? null }, ctxFor(p, now, t.planned || t.step > 0));
        cat.set(p, r.lex);
        if (r.booked.length) planned = true;
      });
      sample(t.form, o.submitMs);
      run.done(t, now);
      return { planned };
    },
  };
}

const adapter: PlannerAdapter = {
  name: 'neu (src/modules/vocab, V1)',
  init(words: readonly SimWord[], nowMs: number, legacy?: readonly LegacyDoc[]): void {
    plans.clear();
    samples.clear();
    maxMoved = 0;
    const leg = new Map((legacy ?? []).map((d) => [d.id as string, d]));
    const items = words.map((w) => {
      const d = leg.get(w.id);
      const conv = d ? convertDoc(P(w.id), d, nowMs) : null;
      const lex = conv && conv.lex ? conv.lex : emptyLex('w', w.src === 'lookup' ? 'core' : 'edge', nowMs);
      return { path: P(w.id), lex, order: w.order };
    });
    cat = new Catalog(items);
    // F4: Rückstand des Altbestands über 7 Lerntage nach Gefährdung verteilen (Umrechnung Schritt 7).
    if (legacy?.length) for (const [p, lex] of spreadBacklog(cat, nowMs, med())) cat.set(p, lex);
  },
  session: makeSession,
  evidence(e: SimEvidence): { planned: boolean } {
    const it = cat.get(P(e.lexeme));
    if (!it) return { planned: false };
    if (!evidencePlans(it.lex, e)) return { planned: false };
    const r = applyAnswer(it.lex, { t: e.t, form: 'gap', outcome: e.ok ? 'ok' : 'wrong', hint: 0, ms: 20_000, fk: 3000, sentence: null, flags: 16 }, ctxFor(it.path, e.t, true));
    cat.set(it.path, r.lex);
    return { planned: r.booked.length > 0 };
  },
  overdue(now: number): number {
    const start = dayStartOf(dayKey(now));
    let n = 0;
    for (const it of cat.items()) {
      if (isNewLex(it.lex)) continue;
      if (it.lex.u.due < start || (it.lex.b && it.lex.b.due < start)) n++;
    }
    return n;
  },
  forecast(now: number, n: number): number[] {
    const day = dayKey(now);
    const out = Array.from({ length: n }, () => 0);
    for (const it of cat.items()) {
      if (isNewLex(it.lex)) continue;
      const ds = new Set([dayKey(it.lex.u.due), ...(it.lex.b ? [dayKey(it.lex.b.due)] : [])]);
      for (const d of ds) {
        const i = daysBetween(day, d) - 1;
        if (i >= 0 && i < n) out[i] = (out[i] as number) + 1;
      }
    }
    return out;
  },
  forecastMinutes(now: number, n: number): number[] {
    return forecastMinutes(cat, med(), now, n);
  },
  moved(): number {
    return maxMoved;
  },
};

export default adapter;
