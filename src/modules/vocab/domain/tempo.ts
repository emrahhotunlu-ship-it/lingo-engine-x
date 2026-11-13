import { addDays, dayKey, daysBetween } from '../shared';
import { isFreeGood } from './grade';
import { FLAG } from './planner';
import type { VlogTuple } from './vlog';

// Politur P2 (Emrah 13.11.2026, E3 „A: neue Wörter nach Behalten, 3–10“): Tempo neuer Wörter je Lerntag. Rein, ohne Uhr und ohne Datenbank.
//
// Messgröße: „am Folgetag frei richtig“ – der ERSTE gebuchte Abruf eines neu eingeführten Worts an einem späteren Lerntag (höchstens
// `TEMPO_GAP_MAX` Tage nach der Einführung), frei getippt, ohne Hilfe, richtig. Fenster: die letzten `TEMPO_DAYS` Lerntage.
// Regel je neuem Lerntag: Quote ≥ 85 % und kein Rückstand → +1 · Quote < 70 % → −2 · sonst bleibt es. Grenzen 3–10. Unter `TEMPO_MIN_N`
// Abrufen im Fenster keine Änderung. Start = Einstellung „Neue Wörter pro Tag“ (auf 3–10 begrenzt); ändert Emrah die Einstellung, beginnt
// das Tempo dort neu. Eine Einstellung unter 3 (0 = keine neuen, 2 = bewusst wenige) bleibt fest: die App erhöht sie nie von selbst.
// Das Tempo ist die OBERGRENZE des Tages; wie viele neue Wörter wirklich kommen, bestimmt der Tagesplan (Wiederholungen zuerst, domain/day.ts).

export const TEMPO_MIN = 3;
export const TEMPO_MAX = 10;
export const TEMPO_DAYS = 14;
/** Unter so vielen Folgetag-Abrufen im Fenster ändert sich das Tempo nicht. */
export const TEMPO_MIN_N = 40;
export const TEMPO_UP = 0.85;
export const TEMPO_DOWN = 0.7;
export const TEMPO_STEP_UP = 1;
export const TEMPO_STEP_DOWN = 2;
/** Der erste Abruf zählt als „Folgetag“, wenn er höchstens so viele Lerntage nach der Einführung liegt (ein Ruhetag dazwischen ist erlaubt). */
export const TEMPO_GAP_MAX = 2;
/** So viele Lerntage Verlauf braucht die Rechnung (Fenster + Abstand zur Einführung). */
export const TEMPO_READ_DAYS = TEMPO_DAYS + TEMPO_GAP_MAX;

/** Folgetag-Abrufe im Fenster: `ok` frei richtig von `all`; `last` = der jüngste Lerntag vor heute mit solchen Abrufen (für den Satz „Gestern …“). */
export type Recall = { ok: number; all: number; last: { d: string; ok: number; all: number } | null };

/**
 * Quote „am Folgetag frei richtig“ aus dem Verlauf (`vlog`). Je Wort zählt nur der erste gebuchte Abruf nach dem Einführungstag; Belege aus
 * anderen Bereichen, umgerechnete Einträge und Antworten ohne Buchung zählen nicht. Wörter, die über „Kenne ich schon“ kamen, haben keine
 * Einführung und zählen deshalb nicht mit.
 */
export function nextDayRecall(tuples: readonly VlogTuple[], nowMs: number, days = TEMPO_DAYS): Recall {
  const today = dayKey(nowMs);
  const from = addDays(today, -(days - 1));
  const intro = new Map<string, string>();
  const done = new Set<string>();
  const byDay = new Map<string, { ok: number; all: number }>();
  let ok = 0;
  let all = 0;
  for (const tp of [...tuples].sort((a, b) => a[0] - b[0])) {
    const [t, path, , form, note, outcome, , , hint, , , flags] = tp;
    if (t > nowMs || (flags & (FLAG.ext | FLAG.mig)) !== 0) continue;
    const d = dayKey(t);
    if (form === 'intro') {
      // Eine spätere Einführung desselben Worts („Von vorn“) beginnt neu.
      intro.set(path, d);
      done.delete(path);
      continue;
    }
    const at = intro.get(path);
    if (!at || done.has(path) || note <= 0 || d <= at) continue;
    done.add(path);
    if (daysBetween(at, d) > TEMPO_GAP_MAX || d < from) continue;
    const good = note >= 2 && isFreeGood(form, outcome, hint);
    all++;
    if (good) ok++;
    const day = byDay.get(d) ?? { ok: 0, all: 0 };
    day.all++;
    if (good) day.ok++;
    byDay.set(d, day);
  }
  const lastDay = [...byDay.keys()].filter((d) => d < today).sort().at(-1);
  return { ok, all, last: lastDay ? { d: lastDay, ...byDay.get(lastDay)! } : null };
}

/** Gespeicherter Stand (`vmod/tempo`): Tempo `n` am Lerntag `d`, begonnen bei der Einstellung `base`. */
export type TempoState = { d: string; n: number; base: number };
/**
 * Warum das Tempo heute so ist: `start` neu begonnen (erste Rechnung oder Einstellung geändert) · `up` gut behalten, eins mehr · `down` zu
 * viel vergessen, zwei weniger · `keep` im Zielbereich · `few` noch zu wenige Abrufe · `backlog` gut behalten, aber Wiederholungen warten ·
 * `top`/`floor` an der Grenze · `fixed` Einstellung unter 3, keine Anpassung.
 */
export type TempoWhy = 'start' | 'up' | 'down' | 'keep' | 'few' | 'backlog' | 'top' | 'floor' | 'fixed';
export type Tempo = TempoState & { why: TempoWhy; ok: number; all: number };

const clamp = (n: number): number => Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(n)));

/** Start-Tempo aus der Einstellung: unter 3 unverändert (fest), sonst auf 3–10 begrenzt. */
export const startTempo = (setting: number): number => (setting < TEMPO_MIN ? Math.max(0, Math.round(setting)) : clamp(setting));

/**
 * Tempo für den Lerntag `day`. `prev` = gespeicherter Stand (oder `null`), `setting` = Einstellung „Neue Wörter pro Tag“, `backlog` = es
 * bleiben heute fällige Wiederholungen liegen. Für denselben Lerntag und dieselbe Einstellung bleibt der Stand, wie er ist (eingefroren).
 */
export function nextTempo(prev: TempoState | null, setting: number, rec: Pick<Recall, 'ok' | 'all'>, backlog: boolean, day: string): Tempo {
  const base = Math.max(0, Math.round(setting));
  const out = (n: number, why: TempoWhy): Tempo => ({ d: day, n, base, why, ok: rec.ok, all: rec.all });
  if (base < TEMPO_MIN) return out(base, 'fixed');
  if (!prev || prev.base !== base) return out(clamp(base), 'start');
  const cur = clamp(prev.n);
  if (prev.d >= day) return out(cur, 'keep');
  if (rec.all < TEMPO_MIN_N) return out(cur, 'few');
  const rate = rec.ok / rec.all;
  if (rate < TEMPO_DOWN) return cur <= TEMPO_MIN ? out(cur, 'floor') : out(clamp(cur - TEMPO_STEP_DOWN), 'down');
  if (rate >= TEMPO_UP) {
    if (backlog) return out(cur, 'backlog');
    return cur >= TEMPO_MAX ? out(cur, 'top') : out(clamp(cur + TEMPO_STEP_UP), 'up');
  }
  return out(cur, 'keep');
}

/**
 * Tempo für die eine Zeile am Rundenstart: `n` = höchstens so viele neue heute, `why` = Grund, `ok`/`all` = „am nächsten Tag noch gewusst“
 * in den letzten 14 Lerntagen, `last` = der jüngste Lerntag mit solchen Abrufen (`ago` = Tage vor heute).
 */
export type TempoInfo = { n: number; why: TempoWhy; ok: number; all: number; last: { ago: number; ok: number; all: number } | null };

const TEMPO_KEY: Record<Exclude<TempoWhy, 'fixed'>, string> = {
  start: 'vmTempoStart',
  few: 'vmTempoFew',
  up: 'vmTempoUp',
  down: 'vmTempoDown',
  keep: 'vmTempoKeep',
  backlog: 'vmTempoBacklog',
  top: 'vmTempoTop',
  floor: 'vmTempoFloor',
};
/** Das jüngste Tagesergebnis wird erst ab so vielen Abrufen genannt. */
export const TEMPO_LAST_MIN = 3;

/**
 * Text-Schlüssel der Zeile (Texte in src/i18n/parts/vm.*.ts): `main` = Grund in einem Satz mit {n}, {ok}, {all}. Solange der Grund selbst
 * noch keine Zahlen nennt (Start, zu wenige Abrufe), steht davor das jüngste Tagesergebnis (`last`: „Gestern 6 von 10 behalten.“).
 * `null` = keine Zeile (feste Einstellung unter 3 oder keine neuen Wörter).
 */
export function tempoText(x: TempoInfo): { main: string; vars: Record<string, number>; last: { key: string; vars: Record<string, number> } | null } | null {
  if (x.why === 'fixed' || x.n <= 0) return null;
  const quiet = x.why === 'start' || x.why === 'few';
  const last = quiet && x.last && x.last.all >= TEMPO_LAST_MIN ? { key: x.last.ago === 1 ? 'vmTempoLast1' : 'vmTempoLastN', vars: { ok: x.last.ok, all: x.last.all } } : null;
  return { main: TEMPO_KEY[x.why], vars: { n: x.n, ok: x.ok, all: x.all }, last };
}
