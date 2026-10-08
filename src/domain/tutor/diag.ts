import { isoWeek } from '../date';
import type { DiagnoseOut } from '../../prompts/diagnose';
import { NEW_ERRORS_MIN } from './confusion';

// Das Protokoll der Wochen-Diagnose in `app/patterns.diag[]` (Lernplattform 3.0 P49, K-10). Rein.
//
// Ein Eintrag: `{w, t, st, dev, pv?, lang?, rep?, out?, bad?}`
//   w    ISO-Woche `JJJJ-Www` · t Zeitpunkt (ms) der Beanspruchung bzw. des Ergebnisses · st `'pending'` (beansprucht) | `'done'`
//   dev  Gerät (Tab-Kennung) der Beanspruchung · pv `diagnose@1` · lang Sprache des Ergebnisses
//   rep  Zahl der zugeordneten Fehler im 28-Tage-Fenster beim Lauf · out das Ergebnis (`DiagnoseOut`) · bad Indizes gemeldeter Befunde
// Schreiben geht immer über die ROH-Einträge: unbekannte Felder und unlesbare Einträge bleiben unverändert stehen (data-guard). Nur gezielte Änderungen:
//   - eigene `pending`-Einträge werden freigegeben bzw. zu `done` (per Spread, nichts anderes am Eintrag ändert sich),
//   - abgelaufene oder fremde `pending`-Einträge (reine Protokollzeilen der Beanspruchung) fallen weg,
//   - Ausnahme von „nichts löschen“ (docs/datenmodell.md): von den Ergebnissen behalten nur die jüngsten 12 ihr `out`; ältere werden auf die Kurzform
//     ohne `out` gekürzt (der Eintrag selbst bleibt). Je Woche gibt es höchstens einen: ≈ 60 Byte je Woche.
// Eine Beanspruchung gilt 10 Minuten; die Ausschließlichkeit zwischen Geräten stellt die kooperative Sperre (`acquire`) her, die Transform prüft frisch.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** So viele Ergebnisse behalten ihr `out`; ältere werden gekürzt, nie entfernt. */
export const DIAG_FULL = 12;
export const CLAIM_TTL_MS = 10 * 60_000;
/** Eine Beanspruchung mit Zeitstempel in der Zukunft gilt erst ab so viel Vorlauf als ungültig (Uhrabweichung zwischen Geräten). */
export const FUTURE_SLACK_MS = 60_000;
const WEEK_RE = /^\d{4}-W\d{2}$/;

export type DiagEntry = { w: string; t: number; st: 'pending' | 'done'; dev: string; pv: string; lang: string; rep: number; out: DiagnoseOut | null; bad: number[] };

/** Ergebnis tolerant lesen (nur die Teile, die die Karte zeigt). Leere Befunde sind erlaubt („noch nichts Systematisches“). */
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
  if (!str(o.headline)) return null;
  const b = obj(o.better);
  const better = str(b.text) ? { text: str(b.text), ev: (Array.isArray(b.ev) ? b.ev : []).filter((e): e is string => typeof e === 'string').slice(0, 3) } : null;
  return { headline: str(o.headline), findings, better, next: str(o.next) };
}

function parse(r: unknown): DiagEntry | null {
  const e = obj(r);
  const w = str(e.w);
  const t = num(e.t);
  if (!WEEK_RE.test(w) || t <= 0) return null;
  const st = e.st === 'pending' ? 'pending' : 'done';
  return {
    w,
    t,
    st,
    dev: str(e.dev),
    pv: str(e.pv),
    lang: str(e.lang),
    rep: num(e.rep),
    out: st === 'done' ? readOut(e.out) : null,
    bad: (Array.isArray(e.bad) ? e.bad : []).filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0).slice(0, 3),
  };
}

/** Die Roh-Einträge von `diag` genau wie gespeichert (auch unlesbare und mit unbekannten Feldern). */
export const rawDiag = (doc: Doc | null | undefined): unknown[] => (Array.isArray(obj(doc).diag) ? [...(obj(doc).diag as unknown[])] : []);

/** `app/patterns.diag` tolerant lesen; unbrauchbare Einträge fehlen in der Liste (im Dokument bleiben sie), neueste zuletzt. */
export function readDiag(doc: Doc | null | undefined): DiagEntry[] {
  return rawDiag(doc)
    .map(parse)
    .filter((e): e is DiagEntry => e !== null)
    .sort((a, b) => a.t - b.t);
}

export const weekOf = (today: string): string => isoWeek(today);

/** Das Ergebnis dieser Woche: ein `done`-Eintrag belegt die Woche auch dann, wenn sein `out` fehlt oder unlesbar ist (dann gibt es nichts zu zeigen, aber keinen zweiten Aufruf). */
export const doneOf = (entries: readonly DiagEntry[], w: string): DiagEntry | null => [...entries].reverse().find((e) => e.w === w && e.st === 'done') ?? null;

/** Die jüngste fertige Diagnose überhaupt (Zeitpunkt für „neue Fehler seit der letzten Diagnose“); `out` kann fehlen. */
export const lastDone = (entries: readonly DiagEntry[]): DiagEntry | null => [...entries].reverse().find((e) => e.st === 'done') ?? null;

/** Ist die Beanspruchung noch gültig? Zukunftsdatiert gilt sie bis zu `FUTURE_SLACK_MS` Vorlauf mit. */
const fresh = (e: DiagEntry, now: number): boolean => now - e.t < CLAIM_TTL_MS && e.t - now <= FUTURE_SLACK_MS;

/** Eine noch gültige Beanspruchung dieser Woche (von irgendeinem Gerät). */
export const activeClaim = (entries: readonly DiagEntry[], w: string, now: number): DiagEntry | null => entries.find((e) => e.w === w && e.st === 'pending' && fresh(e, now)) ?? null;

export type DiagState =
  /** Diese Woche ist die Diagnose schon da. */
  | { kind: 'done'; entry: DiagEntry }
  /** Ein Gerät holt sie gerade (Beanspruchung jünger als 10 Minuten). */
  | { kind: 'pending'; entry: DiagEntry }
  /** Noch zu wenige neue zugeordnete Fehler seit der letzten Diagnose. */
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

/** Auf die Kurzform kürzen: nur `out` entfällt, alle anderen Felder (auch unbekannte und `bad`) bleiben. */
function shorten(raw: unknown): unknown {
  const { out: _out, ...rest } = obj(raw);
  void _out;
  return rest;
}

/**
 * Liste für das Schreiben: abgelaufene und fremde `pending`-Einträge fallen weg, alles andere bleibt roh stehen. Nur die Ergebnisse jenseits der jüngsten
 * `DIAG_FULL` verlieren ihr `out` (Kurzform).
 */
function tidy(list: readonly unknown[], w: string, now: number): unknown[] {
  const keep = list.filter((r) => {
    const e = parse(r);
    return !e || e.st === 'done' || (e.w === w && fresh(e, now));
  });
  const withOut = keep
    .map((r, k) => ({ k, e: parse(r) }))
    .filter((x): x is { k: number; e: DiagEntry } => !!x.e && x.e.st === 'done' && !!x.e.out)
    .sort((a, b) => b.e.t - a.e.t);
  const short = new Set(withOut.slice(DIAG_FULL).map((x) => x.k));
  return keep.map((r, k) => (short.has(k) ? shorten(r) : r));
}

export type ClaimResult = { op: { set: Record<string, unknown> } | { update: Record<string, unknown> } | null; claimed: boolean };

/**
 * Beanspruchung für `writer.transform('app/patterns', …)` auf dem FRISCHEN Stand. `claimed` ist nur wahr, wenn dieses Gerät sie bekommen hat:
 * dann steht ein `pending`-Eintrag `{w, t: now, st, dev, lang}` in `diag`. Gibt es schon ein Ergebnis dieser Woche oder eine gültige Beanspruchung,
 * wird nichts geschrieben und `claimed` ist falsch.
 */
export function claimOp(cur: Doc | undefined, i: { w: string; dev: string; now: number; lang: string }): ClaimResult {
  const entries = readDiag(cur);
  if (doneOf(entries, i.w) || activeClaim(entries, i.w, i.now)) return { op: null, claimed: false };
  // Abgelaufene Beanspruchungen derselben Woche werden ersetzt (tidy lässt nur gültige stehen).
  const rest = tidy(rawDiag(cur), i.w, i.now).filter((r) => !(parse(r)?.st === 'pending' && parse(r)?.w === i.w));
  const diag = [...rest, { w: i.w, t: i.now, st: 'pending', dev: i.dev, lang: i.lang }];
  return { op: cur ? { update: { diag } } : { set: { diag } }, claimed: true };
}

/** Beanspruchung freigeben (Fehler, Abbruch): nur der eigene `pending`-Eintrag (`dev` und `t`) fällt weg. */
export function releaseOp(cur: Doc | undefined, i: { dev: string; t: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  const raw = rawDiag(cur);
  const next = raw.filter((r) => {
    const e = parse(r);
    return !(e && e.st === 'pending' && e.dev === i.dev && e.t === i.t);
  });
  return next.length === raw.length ? null : { update: { diag: next } };
}

/** Ergebnis eintragen: der eigene `pending`-Eintrag wird zu `done` (Spread: unbekannte Felder bleiben). Gibt es schon ein Ergebnis dieser Woche, bleibt es. */
export function finishOp(cur: Doc | undefined, i: { dev: string; t: number; w: string; now: number; out: DiagnoseOut; pv: string; lang: string; rep: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  if (doneOf(readDiag(cur), i.w)) return null;
  const raw = rawDiag(cur);
  let replaced = false;
  const next = raw.map((r) => {
    const e = parse(r);
    if (!replaced && e && e.st === 'pending' && e.dev === i.dev && e.t === i.t) {
      replaced = true;
      return { ...obj(r), w: i.w, t: i.now, st: 'done', dev: i.dev, pv: i.pv, lang: i.lang, rep: i.rep, out: i.out };
    }
    return r;
  });
  if (!replaced) next.push({ w: i.w, t: i.now, st: 'done', dev: i.dev, pv: i.pv, lang: i.lang, rep: i.rep, out: i.out });
  return { update: { diag: tidy(next, i.w, i.now) } };
}

/** „Melden“: Befund `index` des Ergebnisses der Woche `w` als gemeldet markieren (Spread auf dem Roh-Eintrag, löscht nie). */
export function reportOp(cur: Doc | undefined, i: { w: string; index: number }): { update: Record<string, unknown> } | null {
  if (!cur) return null;
  const raw = rawDiag(cur);
  let at = -1;
  raw.forEach((r, k) => {
    const e = parse(r);
    if (e && e.w === i.w && e.st === 'done' && e.out && (at < 0 || e.t >= (parse(raw[at])?.t ?? 0))) at = k;
  });
  const e = parse(raw[at]);
  if (at < 0 || !e || e.bad.includes(i.index)) return null;
  const next = raw.map((r, k) => (k === at ? { ...obj(r), bad: [...e.bad, i.index].sort((a, b) => a - b).slice(0, 3) } : r));
  return { update: { diag: next } };
}
