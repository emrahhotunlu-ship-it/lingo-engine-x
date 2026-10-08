import { isoWeek } from '../date';
import type { DiagnoseOut } from '../../prompts/diagnose';
import { NEW_ERRORS_MIN } from './confusion';

// Das Protokoll der Wochen-Diagnose in `app/patterns.diag[]` (Lernplattform 3.0 P49, K-10). Rein.
//
// Ein Eintrag: `{w, t, st, dev, pv?, lang?, rep?, out?, bad?}`
//   w    ISO-Woche `JJJJ-Www` · t Zeitpunkt (ms) der Beanspruchung bzw. des Ergebnisses · st `'pending'` (beansprucht) | `'done'`
//   dev  Gerät (Tab-Kennung) der Beanspruchung · pv `diagnose@1` · lang Sprache des Ergebnisses
//   rep  Zahl der zugeordneten Fehler im 28-Tage-Fenster beim Lauf (Basis der Aussage) · out das Ergebnis (`DiagnoseOut`) · bad Indizes gemeldeter Befunde
// Höchstens 12 Einträge. Eine Beanspruchung gilt 10 Minuten; danach darf ein anderes Gerät (oder dasselbe nach einem Fehler) neu beanspruchen.
// Die eigentliche Ausschließlichkeit zwischen Geräten stellt die kooperative Sperre (`acquire`) her; die Transform prüft zusätzlich frisch.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const DIAG_MAX = 12;
export const CLAIM_TTL_MS = 10 * 60_000;
const WEEK_RE = /^\d{4}-W\d{2}$/;

export type DiagEntry = { w: string; t: number; st: 'pending' | 'done'; dev: string; pv: string; lang: string; rep: number; out: DiagnoseOut | null; bad: number[] };

/** Ergebnis tolerant lesen (nur die Teile, die die Karte zeigt); ungültig → `null`. */
export function readOut(v: unknown): DiagnoseOut | null {
  const o = obj(v);
  const findings = (Array.isArray(o.findings) ? o.findings : [])
    .map((f) => {
      const x = obj(f);
      const ev = (Array.isArray(x.ev) ? x.ev : []).filter((e): e is string => typeof e === 'string').slice(0, 3);
      return { title: str(x.title), why: str(x.why), rule: str(x.rule), ev, action: str(x.action) };
    })
    .filter((f) => f.title && f.why && f.action)
    .slice(0, 3);
  if (!str(o.headline) || !findings.length) return null;
  const b = obj(o.better);
  const better = str(b.text) ? { text: str(b.text), ev: (Array.isArray(b.ev) ? b.ev : []).filter((e): e is string => typeof e === 'string').slice(0, 3) } : null;
  return { headline: str(o.headline), findings, better, next: str(o.next) };
}

/** `app/patterns.diag` tolerant lesen; unbrauchbare Einträge fallen weg, neueste zuletzt. */
export function readDiag(doc: Doc | null | undefined): DiagEntry[] {
  const raw = obj(doc).diag;
  const out: DiagEntry[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const e = obj(r);
    const w = str(e.w);
    const t = num(e.t);
    if (!WEEK_RE.test(w) || t <= 0) continue;
    const st = e.st === 'pending' ? 'pending' : 'done';
    out.push({
      w,
      t,
      st,
      dev: str(e.dev),
      pv: str(e.pv),
      lang: str(e.lang),
      rep: num(e.rep),
      out: st === 'done' ? readOut(e.out) : null,
      bad: (Array.isArray(e.bad) ? e.bad : []).filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0).slice(0, 3),
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const weekOf = (today: string): string => isoWeek(today);

/** Das fertige Ergebnis dieser Woche (`done` mit gültigem Ergebnis). */
export const doneOf = (entries: readonly DiagEntry[], w: string): DiagEntry | null => [...entries].reverse().find((e) => e.w === w && e.st === 'done' && e.out) ?? null;

/** Die jüngste fertige Diagnose überhaupt (Basis für „neue Fehler seit der letzten Diagnose“ und „Besser geworden“). */
export const lastDone = (entries: readonly DiagEntry[]): DiagEntry | null => [...entries].reverse().find((e) => e.st === 'done' && e.out) ?? null;

/** Eine noch gültige Beanspruchung dieser Woche (von irgendeinem Gerät). */
export const activeClaim = (entries: readonly DiagEntry[], w: string, now: number): DiagEntry | null =>
  entries.find((e) => e.w === w && e.st === 'pending' && now - e.t < CLAIM_TTL_MS && now - e.t >= -60_000) ?? null;

export type DiagState =
  /** Diese Woche ist die Diagnose schon da. */
  | { kind: 'done'; entry: DiagEntry }
  /** Ein Gerät holt sie gerade (Beanspruchung jünger als 10 Minuten). */
  | { kind: 'pending'; entry: DiagEntry }
  /** Noch zu wenig neue zugeordnete Fehler seit der letzten Diagnose. */
  | { kind: 'few'; have: number; need: number }
  /** Sie darf jetzt geholt werden. */
  | { kind: 'due' };

/**
 * Wie steht die Diagnose in dieser Woche? `newErrors` = neue zugeordnete Fehler seit der letzten Diagnose (`newMappedErrors`).
 * Die Reihenfolge ist wichtig: Ergebnis der Woche vor Beanspruchung vor Mindestmenge.
 */
export function diagState(entries: readonly DiagEntry[], today: string, now: number, newErrors: number): DiagState {
  const w = weekOf(today);
  const done = doneOf(entries, w);
  if (done) return { kind: 'done', entry: done };
  const claim = activeClaim(entries, w, now);
  if (claim) return { kind: 'pending', entry: claim };
  if (newErrors < NEW_ERRORS_MIN) return { kind: 'few', have: newErrors, need: NEW_ERRORS_MIN };
  return { kind: 'due' };
}

const entryDoc = (e: DiagEntry): Record<string, unknown> => ({
  w: e.w,
  t: e.t,
  st: e.st,
  dev: e.dev,
  ...(e.pv ? { pv: e.pv } : {}),
  ...(e.lang ? { lang: e.lang } : {}),
  ...(e.st === 'done' ? { rep: e.rep } : {}),
  ...(e.st === 'done' && e.out ? { out: e.out } : {}),
  ...(e.bad.length ? { bad: e.bad } : {}),
});

/** Auf höchstens 12 kürzen: Beanspruchungen anderer, älterer Wochen und abgelaufene fallen zuerst weg, dann die ältesten Ergebnisse. */
function cap(entries: readonly DiagEntry[], w: string, now: number): DiagEntry[] {
  const keep = entries.filter((e) => e.st === 'done' || (e.w === w && now - e.t < CLAIM_TTL_MS));
  return keep.slice(-DIAG_MAX);
}

export type ClaimResult = { op: { set: Record<string, unknown> } | { update: Record<string, unknown> } | null; claimed: boolean };

/**
 * Beanspruchung für `writer.transform('app/patterns', …)` auf dem FRISCHEN Stand. `claimed` ist nur wahr, wenn dieses Gerät sie bekommen hat:
 * dann steht ein `pending`-Eintrag `{w, t: now, dev}` in `diag`. Gibt es schon ein Ergebnis dieser Woche oder eine gültige Beanspruchung,
 * wird nichts geschrieben und `claimed` ist falsch.
 */
export function claimOp(cur: Doc | undefined, i: { w: string; dev: string; now: number; lang: string }): ClaimResult {
  const entries = readDiag(cur);
  if (doneOf(entries, i.w) || activeClaim(entries, i.w, i.now)) return { op: null, claimed: false };
  const mine: DiagEntry = { w: i.w, t: i.now, st: 'pending', dev: i.dev, pv: '', lang: i.lang, rep: 0, out: null, bad: [] };
  // Abgelaufene Beanspruchungen derselben Woche werden ersetzt.
  const rest = entries.filter((e) => !(e.st === 'pending' && e.w === i.w));
  const diag = cap([...rest, mine], i.w, i.now).map(entryDoc);
  return { op: cur ? { update: { diag } } : { set: { diag } }, claimed: true };
}

/** Beanspruchung freigeben (Fehler, Abbruch): nur der eigene `pending`-Eintrag (`dev` und `t`) fällt weg. */
export function releaseOp(cur: Doc | undefined, i: { dev: string; t: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  const entries = readDiag(cur);
  const next = entries.filter((e) => !(e.st === 'pending' && e.dev === i.dev && e.t === i.t));
  if (next.length === entries.length) return null;
  return { update: { diag: next.map(entryDoc) } };
}

/** Ergebnis eintragen: der eigene `pending`-Eintrag wird zu `done`. Gibt es schon ein Ergebnis dieser Woche, bleibt es (keine Doppelung). */
export function finishOp(cur: Doc | undefined, i: { dev: string; t: number; w: string; now: number; out: DiagnoseOut; pv: string; lang: string; rep: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  const entries = readDiag(cur);
  if (doneOf(entries, i.w)) return null;
  const done: DiagEntry = { w: i.w, t: i.now, st: 'done', dev: i.dev, pv: i.pv, lang: i.lang, rep: i.rep, out: i.out, bad: [] };
  const rest = entries.filter((e) => !(e.st === 'pending' && e.dev === i.dev && e.t === i.t));
  return { update: { diag: cap([...rest, done], i.w, i.now).map(entryDoc) } };
}

/** „Melden“: Befund `index` des Ergebnisses der Woche `w` als gemeldet markieren (löscht nie). */
export function reportOp(cur: Doc | undefined, i: { w: string; index: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  const entries = readDiag(cur);
  const at = entries.findIndex((e) => e.w === i.w && e.st === 'done' && e.out);
  const e = entries[at];
  if (!e || e.bad.includes(i.index)) return null;
  const next = entries.map((x, k) => (k === at ? { ...x, bad: [...x.bad, i.index].sort((a, b) => a - b).slice(0, 3) } : x));
  return { update: { diag: next.map(entryDoc) } };
}
