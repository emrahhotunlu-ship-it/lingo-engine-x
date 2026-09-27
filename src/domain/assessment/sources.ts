import { addDays, isDayKey } from '../date';

// Tolerante Leser je Quelle (Plan §0.1, §4.2): der EINE Adapter zwischen den Formaten aus
// Phase 1–5 (und der alten App) und dem Belegpaket. Eine fehlende oder fremd geformte Quelle
// ergibt eine leere Liste, nie einen Fehler. Nutzertext wird hier noch nicht gekürzt (evidence.ts).

type Doc = Readonly<Record<string, unknown>>;

export const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const DAY = 86_400_000;

/** Aktive Tage, Minuten und Kanäle der letzten `n` Lerntage aus `app/profile`. */
export function profileWindow(profile: Doc, today: string, n = 14): { days: number; answers: number; minutes: number; acts: Record<string, number> } {
  const days = obj(profile.days);
  const minutes = obj(profile.minutes);
  const act = obj(profile.act);
  let active = 0;
  let answers = 0;
  let mins = 0;
  const acts: Record<string, number> = {};
  for (let k = 0; k < n; k++) {
    const d = addDays(today, -k);
    const a = num(days[d]);
    const m = num(minutes[d]);
    const dayAct = obj(act[d]);
    if (a > 0 || m > 0 || Object.keys(dayAct).length) active++;
    answers += Math.max(0, a);
    mins += Math.max(0, m);
    for (const [key, v] of Object.entries(dayAct)) if (!key.endsWith('~') && num(v) > 0) acts[key] = (acts[key] ?? 0) + num(v);
  }
  return { days: active, answers, minutes: mins, acts };
}

export type GrammarSource = { topic: string; p: number; n: number; recent: number[]; errors: Array<{ q: string; given: string; ans: string }> };

export function grammarSources(grammar: ReadonlyMap<string, Doc>): GrammarSource[] {
  const out: GrammarSource[] = [];
  for (const [id, d] of grammar) {
    const errors = arr(d.errors)
      .map(obj)
      .filter((e) => e.done !== true && str(e.q))
      .sort((a, b) => num(b.t) - num(a.t))
      .slice(0, 3)
      .map((e) => ({ q: str(e.q), given: str(e.given), ans: str(e.ans) }));
    out.push({ topic: str(d.id) || id, p: num(d.p), n: num(d.n), recent: arr(d.recent).filter((x): x is number => typeof x === 'number').slice(-8), errors });
  }
  return out;
}

export type RadarSource = { c: string; s: string; q: string; g: string; a: string; t: number };

export function radarSources(radar: Doc | null | undefined, max = 80): RadarSource[] {
  return arr(obj(radar).events)
    .map(obj)
    .map((e) => ({ c: str(e.c), s: str(e.s), q: str(e.q), g: str(e.g), a: str(e.a), t: num(e.t) }))
    .filter((e) => e.c)
    .sort((a, b) => b.t - a.t)
    .slice(0, max);
}

export type WritingSource = { id: string; t: number; cefr: string; scores: Record<string, number>; errors: Array<{ wrong: string; right: string; cat: string }> };

/** Korrigierte Texte, neueste zuerst. Fehler in beiden Formen (`orig/fix` und `wrong/right`). */
export function writingSources(writing: ReadonlyMap<string, Doc>): WritingSource[] {
  const out: WritingSource[] = [];
  for (const [id, d] of writing) {
    const res = obj(d.res);
    if (!Object.keys(res).length) continue;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj(res.scores))) if (typeof v === 'number') scores[k] = v;
    const errors = arr(res.errors)
      .map(obj)
      .map((e) => ({ wrong: str(e.orig) || str(e.wrong), right: str(e.fix) || str(e.right), cat: str(e.cat) }))
      .filter((e) => e.wrong || e.right)
      .slice(0, 5);
    const t = num(d.t) || Date.parse(`${str(d.date)}T12:00:00Z`) || numFromId(id);
    out.push({ id, t: Number.isFinite(t) ? t : 0, cefr: str(res.cefr), scores, errors });
  }
  return out.sort((a, b) => b.t - a.t);
}

function numFromId(id: string): number {
  const m = /(\d{12,14})/.exec(id);
  return m ? Number(m[1]) : 0;
}

export type ReadingSource = { id: string; t: number; score: number | null; cefr: string; misunderstood: string[] };

export function readingSources(reading: ReadonlyMap<string, Doc>): ReadingSource[] {
  const out: ReadingSource[] = [];
  for (const [id, d] of reading) {
    const res = obj(d.res);
    const quiz = obj(d.quiz);
    const score = numOrNull(res.score) ?? (num(quiz.n) > 0 ? Math.round((num(quiz.ok) / num(quiz.n)) * 100) : null);
    if (score === null && !Object.keys(res).length) continue;
    out.push({
      id,
      t: num(d.t),
      score,
      cefr: str(obj(res.language).cefr),
      misunderstood: arr(res.misunderstood).map(str).filter(Boolean).slice(0, 3),
    });
  }
  return out.sort((a, b) => b.t - a.t);
}

export type ListenSource = { id: string; t: number; n: number; ok: number; level: string; rate: number };

export function listenSources(profile: Doc): ListenSource[] {
  return arr(profile.listen)
    .map(obj)
    .map((l, i) => ({ id: str(l.id) || String(i), t: num(l.t), n: num(l.n), ok: num(l.ok), level: str(l.level), rate: num(l.rate) || 1 }))
    .filter((l) => l.n > 0)
    .sort((a, b) => b.t - a.t);
}

export type SpeakSource = { id: string; t: number; title: string; goal: string; clean: number | null; turns: number; focus: Array<{ said: string; better: string; cat: string }>; tier: string };

/** Rollenspiel-Analysen aus `talk/<JJJJ-MM>.runs[]` (Phase 3): nur Läufe mit Bericht. */
export function speakSources(talk: ReadonlyMap<string, Doc>): SpeakSource[] {
  const out: SpeakSource[] = [];
  for (const d of talk.values()) {
    for (const r of arr(d.runs).map(obj)) {
      const rep = obj(r.report);
      if (!Object.keys(rep).length) continue;
      out.push({
        id: str(r.id),
        t: num(r.t),
        title: str(r.title),
        goal: str(obj(rep.goal).state) || str(r.goal),
        clean: numOrNull(r.clean),
        turns: num(r.turns),
        focus: arr(rep.focus)
          .map(obj)
          .map((f) => ({ said: str(f.said), better: str(f.better), cat: str(f.cat) }))
          .filter((f) => f.said)
          .slice(0, 3),
        tier: str(r.tier),
      });
    }
  }
  return out.filter((s) => s.id).sort((a, b) => b.t - a.t);
}

export type PreplySource = { id: string; t: number; corrections: Array<{ wrong: string; right: string; topic: string }> };

export function preplySources(preply: ReadonlyMap<string, Doc>): PreplySource[] {
  const out: PreplySource[] = [];
  for (const [id, d] of preply) {
    const corrections = arr(d.corrections)
      .map(obj)
      .map((c) => ({ wrong: str(c.wrong) || str(c.orig), right: str(c.right) || str(c.fix), topic: str(c.topic) }))
      .filter((c) => c.wrong && c.right)
      .slice(0, 6);
    if (corrections.length) out.push({ id, t: num(d.t), corrections });
  }
  return out.sort((a, b) => b.t - a.t);
}

export type LogDaySource = { day: string; byKind: Record<string, { n: number; ok: number }>; forgot: string[] };

/** Trefferquote je Art (`k:'v'`, `k:'g'`, `type:*`) und falsch beantwortete Karten je Tag. */
export function logSources(logs: ReadonlyMap<string, Doc>): LogDaySource[] {
  const out: LogDaySource[] = [];
  for (const [day, d] of logs) {
    if (!isDayKey(day)) continue;
    const byKind: Record<string, { n: number; ok: number }> = {};
    const forgot: string[] = [];
    for (const e of arr(d.entries).map(obj)) {
      if (e.type === 'speak' || e.type === 'biz' || e.type === 'say' || e.type === 'fluency' || e.type === 'tones') continue;
      const kind = str(e.type) || (e.k === 'v' ? 'vocab' : e.k === 'g' ? 'grammar' : str(e.k) || 'other');
      const b = (byKind[kind] ??= { n: 0, ok: 0 });
      b.n++;
      if (e.ok === true) b.ok++;
      if (e.k === 'v' && e.ok === false && typeof e.id === 'string') forgot.push(e.id);
    }
    if (Object.keys(byKind).length) out.push({ day, byKind, forgot });
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : -1));
}

export type VocabSource = {
  byStage: number[];
  total: number;
  meanR: number | null;
  leeches: string[];
  reviews30: number;
};

/** Karten je Stufe, mittlere Abrufwahrscheinlichkeit, Blutegel, Wiederholungen der letzten 30 Tage. */
export function vocabSource(vocab: ReadonlyMap<string, Doc>, nowMs: number): VocabSource {
  const byStage = [0, 0, 0, 0, 0, 0];
  let total = 0;
  let rSum = 0;
  let rN = 0;
  let reviews30 = 0;
  const leech: Array<{ w: string; l: number }> = [];
  for (const d of vocab.values()) {
    if (d.hidden === true) continue;
    total++;
    const st = Math.max(0, Math.min(5, Math.round(num(d.stage))));
    byStage[st] = (byStage[st] ?? 0) + 1;
    const f = obj(d.fsrs);
    const s = num(f.stability) || num(d.S);
    const last = num(f.last) || num(d.last);
    if (s > 0 && last > 0) {
      const days = Math.max(0, (nowMs - last) / DAY);
      // FSRS-Vergessenskurve (ts-fsrs: R = (1 + F·t/S)^C mit F = 19/81, C = −0,5).
      rSum += Math.pow(1 + (19 / 81) * (days / s), -0.5);
      rN++;
    }
    const lapses = num(f.lapses) || num(d.lapses);
    if (lapses >= 3) leech.push({ w: str(d.word), l: lapses });
    for (const h of arr(d.hist).map(obj)) if (num(h.t) > nowMs - 30 * DAY) reviews30++;
  }
  return {
    byStage,
    total,
    meanR: rN ? rSum / rN : null,
    leeches: leech
      .sort((a, b) => b.l - a.l)
      .slice(0, 15)
      .map((x) => x.w)
      .filter(Boolean),
    reviews30,
  };
}

export type VtestSource = { d: string; passive: number; active: number; t: number };

export function lastVtest(profile: Doc): VtestSource | null {
  const list = arr(profile.vtests)
    .map(obj)
    .filter((v) => typeof v.passive === 'number')
    .sort((a, b) => num(a.t) - num(b.t));
  const v = list[list.length - 1];
  return v ? { d: str(v.d), passive: num(v.passive), active: num(v.active), t: num(v.t) } : null;
}

/** Selbst markierte Can-Do-Punkte (`profile.canDo[<cefrId>]`), nur Kennungen der Liste `known`. */
export function canDoSelf(profile: Doc, known: ReadonlySet<string>): string[] {
  return Object.entries(obj(profile.canDo))
    .filter(([k, v]) => known.has(k) && v !== null && v !== false && v !== undefined)
    .map(([k]) => k);
}
