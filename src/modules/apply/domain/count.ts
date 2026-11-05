// Disziplin des Tages (F3, Nachtrag learning-scientist Muss 4): Rotation combo → reply → write → summary über einen ZÄHLER erledigter Anwenden-Tage, nicht über
// das Datum. Der Zähler steht in `app/profile.apc = {n, d}` (`d` = zuletzt gezählter Lerntag, damit ein Tag nie doppelt zählt); additiv und tolerant.
// Ein kurzer Tag (`app/profile.kt[Tag] = 1`, Entscheidung 2A) zählt nicht: die Disziplin wandert zum nächsten vollen Tag. Rein, ohne Importe
// (wird von registry.ts und damit von Heute geladen).

type Doc = Readonly<Record<string, unknown>>;

export const APPLY_KINDS = ['combo', 'reply', 'write', 'summary'] as const;
export type ApplyKind = (typeof APPLY_KINDS)[number];
/** Disziplinen mit eigenem Schreibbildschirm (der eigene Satz hat seinen eigenen Bildschirm `comboSentence`). */
export type WriteKind = Exclude<ApplyKind, 'combo'>;
export const WRITE_KINDS: readonly WriteKind[] = ['reply', 'write', 'summary'];

export const isApplyKind = (v: unknown): v is ApplyKind => typeof v === 'string' && (APPLY_KINDS as readonly string[]).includes(v);
export const isWriteKind = (v: unknown): v is WriteKind => v === 'reply' || v === 'write' || v === 'summary';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const obj = (v: unknown): Doc | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : null);

export type ApplyCount = { n: number; d: string | null };

/** `apc` lesen; `null` = vorhanden, aber unerwarteter Aufbau (wird nie überschrieben, Kap. 9 Regel 6). Fehlt es, gilt `{n: 0, d: null}`. */
export function readApplyCount(profile: Doc | null | undefined): ApplyCount | null {
  const raw = profile?.apc;
  if (raw === undefined || raw === null) return { n: 0, d: null };
  const o = obj(raw);
  if (!o || typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n < 0) return null;
  const d = typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : null;
  return { n: o.n, d };
}

/** Disziplin zu einem Zählerstand. */
export const applyOfCount = (n: number): ApplyKind => APPLY_KINDS[((Math.floor(n) % APPLY_KINDS.length) + APPLY_KINDS.length) % APPLY_KINDS.length] ?? 'combo';

/** Disziplin für einen NEUEN Tagesplan (beim Einfrieren). Ein unlesbarer Zähler gibt den eigenen Satz (nie raten). */
export function applyOfDay(profile: Doc | null | undefined): ApplyKind {
  const c = readApplyCount(profile);
  return c ? applyOfCount(c.n) : 'combo';
}

/** Ist `day` ein kurzer Tag (`kt[day] = 1`)? */
export function isShortDayOf(profile: Doc | null | undefined, day: string): boolean {
  const kt = obj(profile?.kt);
  return !!kt && kt[day] === 1;
}

/**
 * Profil-Patch „Anwenden-Tag erledigt“ (läuft im selben `recordProfileFields`-Schritt wie `act[Tag]['u-task']`, auf dem frischen Stand): `n + 1`, nur wenn der
 * Tag noch nicht gezählt ist und kein kurzer Tag war. `null` = nichts zu tun (oder unerwarteter Aufbau, dann wird nichts geschrieben).
 */
export function applyCountPatch(cur: Doc, day: string): { apc: { n: number; d: string } } | null {
  if (!DAY_RE.test(day) || isShortDayOf(cur, day)) return null;
  const c = readApplyCount(cur);
  // D2: nur vorwärts – ein späterer Abschluss eines früheren Lerntags (anderes Gerät, Block über 04:00) setzt `d` nie zurück.
  if (!c || (c.d !== null && day <= c.d)) return null;
  return { apc: { n: c.n + 1, d: day } };
}
