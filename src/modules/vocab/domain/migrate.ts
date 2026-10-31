import { addDays, dayKey, dayStartOf, isDayKey } from '../shared';
import { type Catalog, danger, dueOn, formMs, isNewLex } from './catalog';
import { FORM_SPEC, isFreeGood } from './grade';
import { EV_F_MAX } from './cap';
import { FLAG, emptyLex } from './planner';
import { book, newTrack, trackFrom } from './tracks';
import type { Form, FormStats, Grade, Lex, LexKind, Outcome, Track } from './types';
import { type VlogTuple, tuple } from './vlog';

// Wörter-Modul V1: Umrechnung eines alten Kartendokuments in `lex` (plan.md §9.2, Kap. 9; M58). REIN: liest nur, schreibt nie.
// Die alten Felder (`fsrs`, `S`, `D`, `due`, `stage`, `hist`, `modes`, `xs`, `pa`/`ac`/`co` …) bleiben unberührt; das Ergebnis ist nur `lex`
// und die nachgespielten Verlaufseinträge für `vlog/*`. Formeln: docs/fsrs-umrechnung.md, Abschnitt „Wörter-Modul V1“.

export type LogEntry = { t: number; k?: string; type?: string; id?: string; m?: string; ex?: string; g?: number; ok?: boolean; override?: boolean; ms?: number; fk?: number };
export type SkipReason = 'invalid' | 'hidden' | 'done' | 'future_lex' | 'future_fsrs';
export type Converted = {
  path: string;
  lex: Lex | null;
  skip?: SkipReason;
  /** Nachgespielte Antworten (Flag „umgerechnet“) für `vlog/*`. */
  log: VlogTuple[];
  /** Für den Trockenlauf-Bericht. */
  report: { lv: number; uDue: number | null; bDue: number | null; h: number; full: 0 | 1; histFull: boolean };
};

const PARTICLES = new Set(['up', 'down', 'out', 'off', 'on', 'in', 'over', 'back', 'away', 'through', 'around', 'along', 'ahead', 'across', 'apart', 'aside', 'forward']);
/** Kern- oder Randwort (M21): eigene Funde, Lehrer, Beruf und Lesen sind Kern; Pakete und erzeugte Listen sind Rand. */
const CORE_SRC = new Set(['lookup', 'teacher', 'preply', 'own', 'job', 'read', 'tap', 'reading', 'c1', 'phrase']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Art des Lexems (Schritt 1). Die Lehrer-Charge 3 (V2) prüft die Zuordnung. */
export function kindOf(path: string, doc: Record<string, unknown>): LexKind {
  if (path.startsWith('chunk/')) return 'ch';
  const w = (typeof doc.word === 'string' ? doc.word : '').trim().toLowerCase().replace(/^to\s+/, '');
  const parts = w.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return 'w';
  const rest = parts.slice(1).filter((p) => !['something', 'sth', 'sb', 'someone', 'it'].includes(p));
  if (rest.length === 1 && PARTICLES.has(rest[0] as string) && doc.pos !== 'noun' && doc.pos !== 'adjective') return 'pv';
  return 'col';
}

/** Form im neuen Modul für eine alte Übungsart (`x`, sonst Modus `m`). */
export function formOfLegacy(x: string | undefined, m: string | undefined): Form | null {
  const k = x ?? m ?? '';
  if (k === 'known') return null;
  if (['type', 'cloze', 'cloze_part', 'situation', 'produce', 'colloc', 'say_it', 'wf', 'ocl'].includes(k)) return 'gap';
  if (['cloze_hint', 'tiles'].includes(k)) return 'gap_hint';
  if (['listen_type', 'dictation'].includes(k)) return 'listen';
  if (k === 'flip') return 'flip';
  if (['mc_de', 'mc_en', 'recog', 'ctx_mc', 'listen_mc', 'listen', 'match', 'find_trap', 'contrast', 'spot'].includes(k)) return 'choice';
  return null;
}

type Row = { t: number; form: Form; g: Grade; hint: number; ms: number; fk: number; ov: boolean };

/** Verlauf sammeln (Schritt 3): `hist[]` und passende Einträge aus `log/<Tag>`, entdoppelt über `t`. */
export function collectRows(path: string, doc: Record<string, unknown>, logs: ReadonlyMap<string, readonly LogEntry[]> | null): Row[] {
  const id = path.slice(path.indexOf('/') + 1);
  const chunk = path.startsWith('chunk/');
  const byT = new Map<number, Row>();
  const logT = new Map<number, LogEntry>();
  const daysWithLog = new Set<string>();
  if (logs)
    for (const [d, list] of logs) {
      daysWithLog.add(d);
      for (const e of list) if ((chunk ? e.type === 'chunk' || e.k === 'c' : e.k === 'v') && e.id === id && num(e.t)) logT.set(e.t, e);
    }
  const hist = Array.isArray(doc.hist) ? doc.hist : [];
  for (const h of hist) {
    if (!isObj(h) || num(h.t) === null) continue;
    const t = h.t as number;
    if (h.u === 1) continue; // ungeprüft: kein Beleg
    const form = formOfLegacy(typeof h.x === 'string' ? h.x : undefined, typeof h.m === 'string' ? h.m : undefined);
    const g0 = num(h.g);
    if (!form || g0 === null) continue;
    const le = logT.get(t);
    let g = Math.min(4, Math.max(1, Math.round(g0))) as Grade;
    // Antwort mit Note ≥ 3 ohne Log-Eintrag an einem Tag MIT Log: möglicherweise übersteuert → höchstens Hard (§9.2 Schritt 4).
    if (!le && g >= 3 && daysWithLog.has(dayKey(t))) g = 2;
    byT.set(t, { t, form, g, hint: num(h.h) ?? 0, ms: num(h.ms) ?? 0, fk: num(h.fk) ?? 0, ov: le?.override === true });
  }
  for (const [t, e] of logT) {
    if (byT.has(t)) continue;
    const form = formOfLegacy(e.ex, e.m);
    const g0 = num(e.g) ?? (e.ok === true ? 3 : e.ok === false ? 1 : null);
    if (!form || g0 === null) continue;
    byT.set(t, { t, form, g: Math.min(4, Math.max(1, Math.round(g0))) as Grade, hint: 0, ms: num(e.ms) ?? 0, fk: num(e.fk) ?? 0, ov: e.override === true });
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

function legacyTrack(doc: Record<string, unknown>, nowMs: number): Track {
  const f = isObj(doc.fsrs) ? doc.fsrs : null;
  const s = num(f?.stability) ?? num(doc.S) ?? 1;
  const d = num(f?.difficulty) ?? num(doc.D) ?? 5;
  const last = num(f?.last) ?? num(doc.last) ?? nowMs;
  const due = num(f?.due) ?? num(doc.due) ?? last + s * 86_400_000;
  const st = num(f?.state) ?? (doc.state === 'learning' ? 1 : 2);
  return trackFrom({ s, d, last, due, reps: num(f?.reps) ?? num(doc.reps) ?? 1, lapses: num(f?.lapses) ?? num(doc.lapses) ?? 0, st: st === 0 ? 2 : st });
}

const outcomeOf = (g: Grade): Outcome => (g === 1 ? 'wrong' : g === 2 ? 'typo' : 'ok');

export function convertDoc(path: string, doc: Record<string, unknown>, nowMs: number, logs: ReadonlyMap<string, readonly LogEntry[]> | null = null): Converted {
  const empty = (skip: SkipReason): Converted => ({ path, lex: null, skip, log: [], report: { lv: 0, uDue: null, bDue: null, h: 0, full: 0, histFull: false } });
  const head = path.startsWith('chunk/') ? doc.en : doc.word;
  if (typeof head !== 'string' || !head.trim()) return empty('invalid');
  if (doc.hidden === true) return empty('hidden');
  if (isObj(doc.lex)) {
    if (typeof doc.lex.v === 'number' && doc.lex.v > 1) return empty('future_lex');
    if (doc.lex.mig) return empty('done');
  }
  if (isObj(doc.fsrs) && typeof doc.fsrs.v === 'number' && doc.fsrs.v > 1) return empty('future_fsrs');

  const k = kindOf(path, doc);
  const pri: Lex['pri'] = CORE_SRC.has(typeof doc.src === 'string' ? doc.src : '') ? 'core' : 'edge';
  const lex = emptyLex(k, pri, nowMs);
  const reps = num(doc.reps) ?? 0;
  const stage = Math.max(0, Math.min(5, num(doc.stage) ?? 0));
  const learned = reps > 0 && doc.state !== 'new';
  const histLen = Array.isArray(doc.hist) ? doc.hist.length : 0;
  const histFull = histLen >= 12 && reps > histLen;
  if (!learned) {
    lex.mig = { t: nowMs, from: 'srs1', h: 0, full: 1 };
    lex.sync = num(doc.last) ?? 0;
    return { path, lex, log: [], report: { lv: 0, uDue: null, bDue: null, h: 0, full: 1, histFull } };
  }
  const rows = collectRows(path, doc, logs);
  lex.intro = isDayKey(doc.intro) ? doc.intro : rows[0] ? dayKey(rows[0].t) : num(doc.last) ? dayKey(doc.last as number) : dayKey(nowMs);
  // Startpunkt (Schritt 4): vollständig nachspielen nur, wenn der Verlauf alle Wiederholungen trägt; sonst Verstehen aus dem gespeicherten Stand.
  const complete = rows.length > 0 && rows.length >= reps && !histFull;
  lex.u = complete ? newTrack(rows[0]!.t) : legacyTrack(doc, nowMs);
  const log: VlogTuple[] = [];
  const doneDay = { u: new Set<string>(), b: new Set<string>() };
  let lastRow = 0;
  for (const r of rows) {
    const day = dayKey(r.t);
    const spec = FORM_SPEC[r.form];
    let note = 0;
    let track: 0 | 1 | 2 = 0;
    const g = Math.min(r.g, spec.max) as Grade;
    if (!r.ov && spec.track && r.form !== 'flip') {
      if (spec.track === 'b' && spec.free) {
        lex.b ??= newTrack(r.t);
        if (!doneDay.b.has(day)) {
          lex.b = book(lex.b, g, r.t, 0.9).track;
          doneDay.b.add(day);
          note = g;
          track = 1;
          if (g >= 2 && complete && !doneDay.u.has(day)) {
            lex.u = book(lex.u, g, r.t, 0.9).track;
            doneDay.u.add(day);
            track = 2;
          }
        }
        if (isFreeGood(r.form, outcomeOf(g), r.hint) && day !== lex.intro && !lex.ev.f.includes(day)) lex.ev.f = [...lex.ev.f, day].slice(-EV_F_MAX);
        if (g === 1) lex.lc += 1;
      } else if (complete && !doneDay.u.has(day)) {
        lex.u = book(lex.u, g, r.t, 0.9).track;
        doneDay.u.add(day);
        note = g;
        track = 0;
      }
    } else if (complete && r.form === 'flip' && !doneDay.u.has(day) && !r.ov) {
      lex.u = book(lex.u, g, r.t, 0.9).track;
      doneDay.u.add(day);
      note = g;
    }
    lastRow = Math.max(lastRow, r.t);
    log.push(tuple({ t: r.t, path, track, form: r.form, note, outcome: outcomeOf(r.g), ms: r.ms, fk: r.fk, hint: r.hint, sentence: null, lv: 0, flags: FLAG.mig | (r.ov ? FLAG.override : 0) | (r.form === 'flip' ? FLAG.anki : 0) }));
  }
  if (!complete && !lex.u.last) lex.u = legacyTrack(doc, nowMs);
  // Stufe (Schritt 6): aus den Belegen, höchstens alte Stufe + 1, nie über 6. Ohne Verlauf: Stufe 3, aus alter Stufe 4–5 → 4.
  if (!lex.b) {
    if (stage >= 4) {
      const s = Math.min(lex.u.s, 7);
      lex.b = trackFrom({ s, d: lex.u.d, last: lex.u.last ?? nowMs, due: lex.u.due, reps: 1, lapses: 0 });
      lex.lv = 4;
    } else lex.lv = Math.min(3, stage + 1);
  } else {
    const f = lex.ev.f.length;
    const bs = lex.b.s;
    let lv = 3;
    if (f >= 2) lv = 4;
    if (lv === 4 && f >= 3 && bs >= 7) lv = 5;
    if (lv === 5 && bs >= 21) lv = 6;
    lex.lv = Math.max(1, Math.min(lv, stage + 1, 6));
  }
  lex.sync = Math.max(num(doc.last) ?? 0, lastRow);
  lex.mig = { t: nowMs, from: 'srs1', h: rows.length, full: complete ? 1 : 0 };
  return { path, lex, log, report: { lv: lex.lv, uDue: lex.u.due, bDue: lex.b?.due ?? null, h: rows.length, full: complete ? 1 : 0, histFull } };
}

/**
 * Rückstand beim Umstieg (Schritt 7, F4): alle überfälligen Lexeme nach Gefährdung über 7 Lerntage verteilt (die gefährdetsten heute),
 * gleich viele Minuten je Tag. Geschrieben wird nur `lex.u.due` / `lex.b.due`.
 */
export const SPREAD_DAYS = 7;
export function spreadBacklog(cat: Catalog, nowMs: number, med: FormStats): [string, Lex][] {
  const day = dayKey(nowMs);
  const start = dayStartOf(day);
  const over = cat
    .items()
    .filter((it) => !isNewLex(it.lex) && (it.lex.u.due < start || (it.lex.b && it.lex.b.due < start)))
    .map((it) => ({ it, r: danger(it.lex, nowMs), ms: formMs(dueOn(it.lex, day)?.form ?? 'gap', med) }))
    .sort((a, b) => a.r - b.r || a.it.path.localeCompare(b.it.path));
  const total = over.reduce((a, x) => a + x.ms, 0);
  const per = total / SPREAD_DAYS;
  const out: [string, Lex][] = [];
  let acc = 0;
  for (const x of over) {
    const i = Math.min(SPREAD_DAYS - 1, Math.floor(acc / Math.max(1, per)));
    acc += x.ms;
    const at = dayStartOf(addDays(day, i));
    const l: Lex = { ...x.it.lex, u: { ...x.it.lex.u }, b: x.it.lex.b ? { ...x.it.lex.b } : null };
    if (l.u.due < start) l.u.due = at;
    if (l.b && l.b.due < start) l.b.due = at;
    out.push([x.it.path, l]);
  }
  return out;
}

/**
 * Rückweg (plan.md §9.4): War das Modul aus und hat der alte Bereich geantwortet (`doc.last > lex.sync`), spielt das Modul NUR die Antworten
 * mit `t > lex.sync` aus `hist` und `log/<Tag>` nach, mit denselben Regeln wie die Umrechnung (je Tag und Spur die erste, Auswahl ohne Wirkung),
 * entdoppelt über `t`. Ist die Lücke unvollständig (`hist` voll und der älteste Eintrag liegt nach `sync`), wird nichts geraten: `incomplete`.
 */
export function catchUp(lex0: Lex, doc: Record<string, unknown>, path: string, logs: ReadonlyMap<string, readonly LogEntry[]> | null = null): { lex: Lex; applied: number; incomplete: boolean } {
  const last = num(doc.last) ?? 0;
  if (last <= lex0.sync) return { lex: lex0, applied: 0, incomplete: false };
  const rows = collectRows(path, doc, logs).filter((r) => r.t > lex0.sync);
  const hist = Array.isArray(doc.hist) ? doc.hist.filter((h) => isObj(h) && typeof h.t === 'number') : [];
  const oldest = hist.length ? Math.min(...hist.map((h) => (h as { t: number }).t)) : Infinity;
  const incomplete = hist.length >= 12 && oldest > lex0.sync;
  const lex: Lex = { ...lex0, u: { ...lex0.u }, b: lex0.b ? { ...lex0.b } : null, ev: { ...lex0.ev, f: [...lex0.ev.f] } };
  const doneDay = { u: new Set<string>(lex.day ? [lex.day] : []), b: new Set<string>(lex.day ? [lex.day] : []) };
  let applied = 0;
  for (const r of rows) {
    const day = dayKey(r.t);
    const spec = FORM_SPEC[r.form];
    if (r.ov || !spec.track || r.form === 'flip') continue;
    const g = Math.min(r.g, spec.max) as Grade;
    if (spec.track === 'b' && spec.free) {
      lex.b ??= newTrack(r.t);
      if (doneDay.b.has(day)) continue;
      lex.b = book(lex.b, g, r.t, 0.9).track;
      doneDay.b.add(day);
      if (g >= 2 && !doneDay.u.has(day)) {
        lex.u = book(lex.u, g, r.t, 0.9).track;
        doneDay.u.add(day);
      }
      if (isFreeGood(r.form, outcomeOf(g), r.hint) && day !== lex.intro && !lex.ev.f.includes(day)) lex.ev.f = [...lex.ev.f, day].slice(-EV_F_MAX);
      lex.day = day;
      applied++;
    } else if (!doneDay.u.has(day)) {
      lex.u = book(lex.u, g, r.t, 0.9).track;
      doneDay.u.add(day);
      lex.day = day;
      applied++;
    }
  }
  lex.sync = Math.max(lex.sync, last);
  return { lex, applied, incomplete };
}
