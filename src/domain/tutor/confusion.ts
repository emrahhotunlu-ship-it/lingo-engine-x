import { addDays, dayKey } from '../date';
import { patternById } from '../grammar/patterns';

// Belege für „Häufigste Verwechslungen · 28 Tage“ und die Wochen-Diagnose (Lernplattform 3.0 P49, KI-Tutor T5). Rein und ohne Claude:
// die Karte entsteht allein aus diesen Zahlen; `diagnose@1` bekommt dieselben Belegzeilen mit Kennungen und darf nur sie zitieren.
//
// Quellen (nur Einträge MIT Muster-Kennung `pat`):
//   - `log/<tag>.entries[]` mit `k: 'g'`: jede bewertete Grammatikantwort (`ok`, `t`, `pat`),
//   - `grammar/<thema>.errors[]`: `cf` (Kontrastmuster aus „Erklär mir meine Antwort“), `q`, `given`, `ans`, `t`,
//   - `app/repair.items[]` mit `pat` und `src` (Schreiben, Klinik): Fehler aus eigenen Texten.
// Fenster: 28 Lerntage (Wechsel 04:00, Ortszeit) bis einschließlich heute; die 28 Tage davor liefern den Trend. Der Tag eines Eintrags
// kommt aus seinem Zeitstempel (`dayKey`), nicht aus dem Dokumentschlüssel – so liegt die Grenze auch am Tag der Zeitumstellung bei 04:00.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const WINDOW_DAYS = 28;
/** Ab so vielen neuen zugeordneten Fehlern seit der letzten Diagnose darf die Wochen-Diagnose laufen. */
export const NEW_ERRORS_MIN = 12;
export const PAIRS_MAX = 3;
/** Ein Paar braucht mindestens so viele Belege. */
export const PAIR_MIN = 2;
/** Belegzeilen höchstens so viele UTF-8-Bytes (Prompt bleibt weit unter 8 KB). */
export const EVIDENCE_MAX_BYTES = 4900;

export type ConfusionSources = {
  /** `grammar/<thema>` nach Thema. */
  grammar?: ReadonlyMap<string, Doc> | null;
  /** `log/<tag>` nach Tag (`JJJJ-MM-TT`). */
  logs?: ReadonlyMap<string, Doc> | null;
  /** `app/repair`. */
  repair?: Doc | null;
};

export type Window = { from: string; to: string; prevFrom: string; prevTo: string };

/** Die 28 Lerntage bis einschließlich `today` und die 28 davor. Reine Kalenderrechnung auf Tagesschlüsseln. */
export function windowOf(today: string): Window {
  return { to: today, from: addDays(today, -(WINDOW_DAYS - 1)), prevTo: addDays(today, -WINDOW_DAYS), prevFrom: addDays(today, -(2 * WINDOW_DAYS - 1)) };
}

/** Lerntag eines Zeitpunkts (Wechsel 04:00 Ortszeit). */
export const dayOfMs = (t: number): string => dayKey(t);

const inRange = (day: string, a: string, b: string): boolean => day >= a && day <= b;

type Attempt = { pat: string; day: string; t: number; ok: boolean };

/** Alle bewerteten Grammatikantworten mit Muster aus den Tagesprotokollen. */
export function attemptsOf(logs: ReadonlyMap<string, Doc> | null | undefined): Attempt[] {
  const out: Attempt[] = [];
  for (const [key, doc] of logs ?? []) {
    for (const e of arr(doc.entries)) {
      const pat = str(e.pat);
      if (str(e.k) !== 'g' || !pat) continue;
      const t = num(e.t);
      // Ohne Zeitstempel zählt der Schlüssel des Tagesdokuments.
      const day = t > 0 ? dayOfMs(t) : /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
      if (day) out.push({ pat, day, t, ok: e.ok === true });
    }
  }
  return out;
}

export type PatStat = { pat: string; n: number; w: number; prevN: number; prevW: number; /** Falsche Antworten je Woche im Fenster, älteste zuerst. */ weeks: [number, number, number, number] };

export type Pair = {
  a: string;
  b: string;
  /** Belege im Fenster: bestätigte Verwechslungen (`cf`) bzw. falsche Antworten im Muster `a` (angenommenes Paar). */
  n: number;
  /** `true`: aus `cf` belegt; `false`: vom Kurs als Kontrastpaar vorgegeben, `n` zählt die falschen Antworten in `a`. */
  confirmed: boolean;
  /** Falsche Antworten in `a` oder `b` je Woche, älteste zuerst (4 Wochen). */
  weeks: [number, number, number, number];
  ex: Array<{ q: string; given: string; ans: string }>;
};

export type EvLine = { id: string; text: string };

export type Confusion = {
  window: Window;
  pairs: Pair[];
  pats: PatStat[];
  lines: EvLine[];
  /** Kennungen aller Belegzeilen (ohne Klammern). */
  ids: string[];
  /** Erlaubte Aktionen der Diagnose: `contrast:<a>|<b>` und `pattern:<id>`. */
  allowed: string[];
  /** Zugeordnete Fehler im Fenster (falsche Antworten mit Muster plus Fehlersätze aus eigenen Texten). */
  mapped: number;
};

const bareId = (id: string): string => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id);
const known = (id: string): boolean => patternById(id) !== null;

function weekIndex(day: string, w: Window): number {
  // 0 = älteste Woche, 3 = die letzte (endet heute).
  const back = Math.floor(daysFrom(day, w.to) / 7);
  return 3 - back;
}
function daysFrom(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Zahlen je Muster im Fenster und davor. */
export function patStats(attempts: readonly Attempt[], w: Window): PatStat[] {
  const map = new Map<string, PatStat>();
  const get = (pat: string): PatStat => {
    let s = map.get(pat);
    if (!s) map.set(pat, (s = { pat, n: 0, w: 0, prevN: 0, prevW: 0, weeks: [0, 0, 0, 0] }));
    return s;
  };
  for (const a of attempts) {
    if (!known(a.pat)) continue;
    if (inRange(a.day, w.from, w.to)) {
      const s = get(a.pat);
      s.n++;
      if (!a.ok) {
        s.w++;
        const k = weekIndex(a.day, w);
        if (k >= 0 && k <= 3) s.weeks[k as 0 | 1 | 2 | 3]++;
      }
    } else if (inRange(a.day, w.prevFrom, w.prevTo)) {
      const s = get(a.pat);
      s.prevN++;
      if (!a.ok) s.prevW++;
    }
  }
  return [...map.values()].sort((a, b) => b.w - a.w || b.n - a.n || a.pat.localeCompare(b.pat));
}

type Mistake = { pat: string; cf: string; day: string; q: string; given: string; ans: string };

function grammarMistakes(grammar: ReadonlyMap<string, Doc> | null | undefined, w: Window): Mistake[] {
  const out: Mistake[] = [];
  for (const doc of grammar?.values() ?? []) {
    for (const e of arr(doc.errors)) {
      const pat = str(e.pat);
      const t = num(e.t);
      if (!pat || t <= 0) continue;
      const day = dayOfMs(t);
      if (!inRange(day, w.from, w.to)) continue;
      out.push({ pat, cf: str(e.cf), day, q: str(e.q), given: str(e.given), ans: str(e.ans) });
    }
  }
  return out;
}

type RepairBit = { pat: string; src: string; day: string; t: number };
function repairBits(repair: Doc | null | undefined): RepairBit[] {
  const out: RepairBit[] = [];
  for (const it of arr(obj(repair).items)) {
    const pat = str(it.pat);
    const t = num(it.t);
    if (!pat || t <= 0) continue;
    out.push({ pat, src: str(it.src), day: dayOfMs(t), t });
  }
  return out;
}

const clip = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
// eslint-disable-next-line no-control-regex -- Steuerzeichen werden bewusst entfernt
const clean = (s: string): string => s.replace(/[\u0000-\u001f\u007f"“”„]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Paare: erst bestätigte Verwechslungen (`cf`), dann vom Kurs vorgegebene Kontrastpaare mit mindestens `PAIR_MIN` falschen Antworten. */
export function pairsOf(src: ConfusionSources, today: string): Pair[] {
  const w = windowOf(today);
  const attempts = attemptsOf(src.logs).filter((a) => !a.ok && inRange(a.day, w.from, w.to));
  const wrongBy = (pats: readonly string[]): [number, number, number, number] => {
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (const a of attempts) {
      if (!pats.includes(a.pat)) continue;
      const k = weekIndex(a.day, w);
      if (k >= 0 && k <= 3) out[k as 0 | 1 | 2 | 3]++;
    }
    return out;
  };
  const confirmed = new Map<string, Pair>();
  for (const m of grammarMistakes(src.grammar, w)) {
    const b = bareId(m.cf);
    if (!m.cf || !known(m.pat) || !known(b) || b === m.pat) continue;
    const key = `${m.pat}|${b}`;
    const p = confirmed.get(key) ?? { a: m.pat, b, n: 0, confirmed: true, weeks: wrongBy([m.pat, b]), ex: [] };
    p.n++;
    if (p.ex.length < 2 && m.q && m.given) p.ex.push({ q: clip(clean(m.q), 120), given: clip(clean(m.given), 60), ans: clip(clean(m.ans), 60) });
    confirmed.set(key, p);
  }
  const out = [...confirmed.values()].filter((p) => p.n >= PAIR_MIN);
  const have = new Set(out.flatMap((p) => [p.a, p.b]));
  // Vom Kurs vorgegebene Kontrastpaare: nur, wenn das Muster selbst oft genug falsch beantwortet wurde und nicht schon in einem Paar steht.
  for (const s of patStats(attemptsOf(src.logs), w)) {
    if (s.w < PAIR_MIN + 1 || have.has(s.pat)) continue;
    const partner = patternById(s.pat)?.contrast?.with;
    const b = partner ? bareId(partner) : '';
    if (!b || b === s.pat || !known(b) || have.has(b)) continue;
    out.push({ a: s.pat, b, n: s.w, confirmed: false, weeks: wrongBy([s.pat, b]), ex: [] });
    have.add(s.pat);
    have.add(b);
  }
  return out.sort((x, y) => y.n - x.n || Number(y.confirmed) - Number(x.confirmed) || `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)).slice(0, PAIRS_MAX);
}

const nameEn = (id: string): string => patternById(id)?.name.en ?? id;

/** Alles, was Karte und Diagnose brauchen. */
export function confusionOf(src: ConfusionSources, today: string): Confusion {
  const w = windowOf(today);
  const attempts = attemptsOf(src.logs);
  const pats = patStats(attempts, w);
  const pairs = pairsOf(src, today);
  const repair = repairBits(src.repair).filter((r) => inRange(r.day, w.from, w.to));
  const lines: EvLine[] = [];
  const allowed: string[] = [];
  const perWeek = (ws: readonly number[]): string => `; wrong per week (oldest first): ${ws.join(', ')}`;
  for (const p of pats.filter((s) => s.w > 0).slice(0, 8)) {
    const before = p.prevN > 0 ? ` (before: ${p.prevW} of ${p.prevN})` : '';
    lines.push({ id: `p:${p.pat}`, text: `${nameEn(p.pat)}: ${p.n} attempts, ${p.w} wrong${before}${perWeek(p.weeks)}` });
    allowed.push(`pattern:${p.pat}`);
  }
  const pairIds = new Map<string, string>();
  for (const pr of pairs) {
    const ex = pr.ex[0] ? `, e.g. "${pr.ex[0].given}" instead of "${pr.ex[0].ans}"` : '';
    const A = nameEn(pr.a);
    const B = nameEn(pr.b);
    const id = pr.confirmed ? `cf:${pr.a}>${pr.b}` : `pc:${pr.a}|${pr.b}`;
    lines.push(
      pr.confirmed
        ? { id, text: `${B} used where ${A} was needed: ${pr.n}×${ex}${perWeek(pr.weeks)}` }
        : {
            id,
            text: `${A}: ${pr.n} wrong answers. The course teaches ${A} together with ${B} as a contrast pair; it is NOT recorded that the learner chose ${B} instead. Wrong answers per week in ${A} and ${B} combined (oldest first): ${pr.weeks.join(', ')}`,
          },
    );
    pairIds.set(`contrast:${pr.a}|${pr.b}`, id);
  }
  const bySrc = new Map<string, number>();
  for (const r of repair) bySrc.set(`${r.src}|${r.pat}`, (bySrc.get(`${r.src}|${r.pat}`) ?? 0) + 1);
  for (const [k, n] of [...bySrc].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4)) {
    const [s, pat] = k.split('|') as [string, string];
    if (!s || !known(pat)) continue;
    lines.push({ id: `src:${s}:${pat}`, text: `${n} mistake${n === 1 ? '' : 's'} in own ${s === 'write' ? 'writing' : s === 'clinic' ? 'sentences' : s} in the pattern ${nameEn(pat)}` });
  }
  // Auf die Bytegrenze kürzen (von hinten).
  const enc = new TextEncoder();
  const text = (ls: readonly EvLine[]): string => ls.map((l) => `[${l.id}] ${l.text}`).join('\n');
  while (lines.length > 1 && enc.encode(text(lines)).length > EVIDENCE_MAX_BYTES) lines.pop();
  const kept = new Set(lines.map((l) => l.id));
  const mapped = attempts.filter((a) => !a.ok && inRange(a.day, w.from, w.to) && known(a.pat)).length + repair.filter((r) => known(r.pat) && (r.src === 'write' || r.src === 'clinic')).length;
  return {
    window: w,
    pairs,
    pats,
    lines,
    ids: [...kept],
    // Nur Aktionen, deren Belegzeile nicht der Kürzung zum Opfer fiel.
    allowed: [...allowed.filter((a) => a.startsWith('pattern:') && kept.has(`p:${a.slice(8)}`)), ...[...pairIds].filter(([, id]) => kept.has(id)).map(([a]) => a)],
    mapped,
  };
}

export const evidenceText = (lines: readonly EvLine[]): string => lines.map((l) => `[${l.id}] ${l.text}`).join('\n');

/**
 * Neue zugeordnete Fehler seit dem Zeitpunkt der letzten Diagnose (`sinceMs`, 0 = nie): falsche Grammatikantworten mit Muster und Fehlersätze aus
 * eigenen Texten, jeweils im 28-Tage-Fenster. Erst ab `NEW_ERRORS_MIN` darf die Wochen-Diagnose laufen.
 */
export function newMappedErrors(src: ConfusionSources, today: string, sinceMs: number): number {
  const w = windowOf(today);
  const a = attemptsOf(src.logs).filter((x) => !x.ok && known(x.pat) && inRange(x.day, w.from, w.to) && x.t > sinceMs).length;
  const r = repairBits(src.repair).filter((x) => known(x.pat) && (x.src === 'write' || x.src === 'clinic') && inRange(x.day, w.from, w.to) && x.t > sinceMs).length;
  return a + r;
}

/** Erlaubt `contrast:<a>|<b>` → Paar; sonst `null`. */
export function parseContrast(action: string): { a: string; b: string } | null {
  const m = /^contrast:([a-z0-9.-]+)\|([a-z0-9.-]+)$/.exec(action);
  return m && m[1] && m[2] ? { a: m[1], b: m[2] } : null;
}

/**
 * Belegzeilen `[dx:<a>|<b>]` für `assess@4`: die Befunde der jüngsten gültigen Diagnose (nicht gemeldet, höchstens 5 Wochen alt), je Befund mit
 * Aktion `contrast:`. Rein; ohne Diagnose leer.
 */
export function dxLines(diag: readonly Doc[] | null | undefined, today: string): EvLine[] {
  const latest = [...(diag ?? [])].filter((d) => str(d.st) === 'done' && d.out && typeof d.out === 'object').sort((a, b) => num(b.t) - num(a.t))[0];
  if (!latest || daysFrom(dayOfMs(num(latest.t)), today) > 35) return [];
  const bad = new Set(Array.isArray(latest.bad) ? latest.bad.filter((x): x is number => typeof x === 'number') : []);
  const out: EvLine[] = [];
  arr(obj(latest.out).findings).forEach((f, i) => {
    const c = parseContrast(str(f.action));
    if (!c || bad.has(i) || !known(c.a) || !known(c.b)) return;
    // „verwechselt“ nur, wenn der Befund eine bestätigte Verwechslung (`cf:`) zitiert; sonst bleibt es ein vorgeschlagener Kontrast.
    const proven = (Array.isArray(f.ev) ? f.ev : []).some((e) => typeof e === 'string' && e.startsWith('cf:'));
    const what = proven ? `${nameEn(c.a)} is confused with ${nameEn(c.b)}` : `contrasting ${nameEn(c.a)} with ${nameEn(c.b)} was suggested (no mix-up recorded)`;
    out.push({ id: `dx:${c.a}|${c.b}`, text: `weekly diagnosis (${dayOfMs(num(latest.t))}): ${what}${str(f.title) ? ` ("${clean(str(f.title))}")` : ''}` });
  });
  return out;
}
