// Preply-Dokumente lesen (Phase 5 §5.3/5.4): `preply/pp<ms>` (Plan) und `preply/pi<ms>`
// (Import), Altformat der alten App und Neuformat gleichermaßen. Rein und tolerant: fehlende
// oder falsch getypte Felder werden leer, nie ein Absturz. Geschrieben wird hier nichts.

type Doc = Readonly<Record<string, unknown>>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);

/** Zeitpunkt aus der Kennung `pp<ms>`/`pi<ms>` (Altdokumente ohne `t`). */
export function msFromId(id: string): number {
  const m = /^p[pi](\d{10,})/.exec(id);
  return m ? Number(m[1]) : 0;
}

export type Watch = { mistake: string; fix: string; note: string };
export type PlanView = {
  id: string;
  kind: 'plan';
  t: number;
  lang: string;
  ctxKind: string;
  title: string;
  minutes: number;
  goal_en: string;
  goal_x: string;
  warmup: string[];
  talk: string[];
  say: string[];
  watch: Watch[];
  message: string;
  done: boolean;
  doneT: number;
  heldDay: string;
  heldMin: number;
};

export type ImportCorrection = { wrong: string; right: string; topic: string; why: string };
export type ImportItem = {
  type: string;
  topic: string;
  prompt: string;
  answer: string;
  accepted: string[];
  options: string[];
  hint_de: string;
  explanation_de: string;
  explanation_en: string;
};
export type ImportWord = { en: string; de: string; pos: string; ex: string; fromLesson: boolean };
export type ImportView = {
  id: string;
  kind: 'import';
  t: number;
  lang: string;
  raw: string;
  title: string;
  summary: string;
  corrections: ImportCorrection[];
  /** Lesbare Aufgaben (Altformat: Strings). */
  tasks: string[];
  /** Strukturierte Übungen (Neuformat, E5-16); im Altformat leer. */
  items: ImportItem[];
  words: ImportWord[];
  homework: string[];
  applied: boolean;
  appliedT: number;
  hwDone: Record<string, string>;
  res: Doc | null;
};

export type PreplyView = PlanView | ImportView;

export function isImportDoc(id: string, d: Doc): boolean {
  return d.kind === 'import' || id.startsWith('pi');
}

export function readPlan(id: string, d: Doc): PlanView {
  return {
    id,
    kind: 'plan',
    t: num(d.t) || msFromId(id),
    lang: str(d.lang),
    ctxKind: str(obj(d.ctx).kind),
    title: str(d.title),
    minutes: num(d.minutes),
    goal_en: str(d.goal_en),
    goal_x: str(d.goal_x),
    warmup: strs(d.warmup),
    talk: strs(d.talk),
    say: strs(d.say),
    watch: arr(d.watch)
      .map((w) => ({ mistake: str(obj(w).mistake), fix: str(obj(w).fix), note: str(obj(w).note) }))
      .filter((w) => w.mistake || w.fix),
    message: str(d.message),
    done: d.done === true,
    doneT: num(d.doneT),
    heldDay: str(d.heldDay),
    heldMin: num(d.heldMin) || num(d.minutes),
  };
}

export function readImport(id: string, d: Doc): ImportView {
  const items: ImportItem[] = arr(d.items)
    .map((x) => {
      const o = obj(x);
      return {
        type: str(o.type),
        topic: str(o.topic),
        prompt: str(o.prompt),
        answer: str(o.answer),
        accepted: strs(o.accepted),
        options: strs(o.options),
        hint_de: str(o.hint_de),
        explanation_de: str(o.explanation_de),
        explanation_en: str(o.explanation_en),
      };
    })
    .filter((i) => i.prompt && i.answer);
  const hw = obj(d.hwDone);
  const hwDone: Record<string, string> = {};
  for (const [k, v] of Object.entries(hw)) if (typeof v === 'string' && v) hwDone[k] = v;
  return {
    id,
    kind: 'import',
    t: num(d.t) || msFromId(id),
    lang: str(d.lang),
    raw: typeof d.raw === 'string' ? d.raw : '',
    title: str(d.title),
    summary: str(d.summary),
    corrections: arr(d.corrections)
      .map((c) => ({ wrong: str(obj(c).wrong), right: str(obj(c).right), topic: str(obj(c).topic), why: str(obj(c).why) }))
      .filter((c) => c.wrong && c.right),
    tasks: strs(d.tasks).length ? strs(d.tasks) : items.map((i) => i.prompt),
    items,
    words: arr(d.words)
      .map((w) => {
        const o = obj(w);
        return { en: str(o.en), de: str(o.de), pos: str(o.pos), ex: str(o.ex), fromLesson: o.fromLesson !== false };
      })
      .filter((w) => w.en && w.de),
    homework: strs(d.homework),
    applied: d.applied === true,
    appliedT: num(d.appliedT),
    hwDone,
    res: d.res && typeof d.res === 'object' ? obj(d.res) : null,
  };
}

export function readPreply(id: string, d: Doc): PreplyView {
  return isImportDoc(id, d) ? readImport(id, d) : readPlan(id, d);
}

/** Alle Preply-Dokumente, neueste zuerst. */
export function preplyList(all: ReadonlyMap<string, Doc>): PreplyView[] {
  return [...all].map(([id, d]) => readPreply(id, d)).sort((a, b) => b.t - a.t || b.id.localeCompare(a.id));
}

/** Jüngster offener Plan (`done !== true`) oder `null`. */
export function openPlan(list: readonly PreplyView[]): PlanView | null {
  for (const v of list) if (v.kind === 'plan' && !v.done && (v.goal_en || v.say.length || v.talk.length)) return v;
  return null;
}

/** Plan für den Reiter „Vorbereiten": offen, oder am Lerntag `today` gehalten. */
export function currentPlan(list: readonly PreplyView[], today: string): PlanView | null {
  for (const v of list) {
    if (v.kind !== 'plan' || !(v.goal_en || v.say.length || v.talk.length)) continue;
    return !v.done || v.heldDay === today ? v : null;
  }
  return null;
}

/** Jüngster Import (für „Nach letztem Import" und die Stundenvorbereitung). */
export function lastImport(list: readonly PreplyView[]): ImportView | null {
  for (const v of list) if (v.kind === 'import') return v;
  return null;
}
