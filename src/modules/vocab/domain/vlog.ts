import { dayKey } from '../shared';
import { FORMS, OUTCOMES, type Form, type Outcome } from './types';

// Vollständiger Verlauf ab V1 (plan.md §3.4; M19): `vlog/<JJJJ-MM>-a` (Lerntage 1.–15.) und `-b` (16.–Monatsende), Fortsetzung `-a2`, `-a3` …
// Form: Objekt-Map `{v: 1, e: {"<t base36>-<Gerät 4>": Tupel}}`. Zwei Geräte verlieren nichts (verschachtelte Objekte werden beim `update`
// zusammengeführt, db.d.ts), dieselbe Antwort ergibt denselben Schlüssel (idempotent). „Rückgängig“ setzt den Schlüssel auf `null`.
// Tupel: [t, lexemPfad, spur 0|1|2 (u|b|beides), form, note 0–4 (0 = ohne Planwirkung), ausgang, ms, fk, hilfe 0–3, satzKey, stufe 1–7, flags].

export type VlogTuple = [number, string, 0 | 1 | 2, Form, number, Outcome, number, number, number, string, number, number];
export const VLOG_SOFT_MAX = 200 * 1024;
/** Höchstens so viele Teile je Halbmonat (`-a`, `-a2` … `-a9`). */
export const VLOG_MAX_PARTS = 9;

export function tuple(x: { t: number; path: string; track: 0 | 1 | 2; form: Form; note: number; outcome: Outcome; ms: number; fk: number; hint: number; sentence: string | null; lv: number; flags: number }): VlogTuple {
  const r10 = (v: number) => Math.min(600_000, Math.max(0, Math.round(v / 10) * 10));
  return [x.t, x.path, x.track, x.form, x.note, x.outcome, r10(x.ms), r10(x.fk), Math.max(0, Math.min(3, x.hint)), x.sentence ?? '', x.lv, x.flags];
}

/** Gerätekennung: 4 Zeichen [a-z0-9]. */
export function deviceTag(raw: string, len = 4): string {
  const s = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (s + '000000').slice(0, len);
}

/** Schlüssel `<t base36>-<Gerät 4>`; die Umrechnung nutzt 6 Zeichen (`m` + Pfad-Kennung), damit zwei Lexeme mit gleicher Zeit nie kollidieren. */
export function vlogKey(t: number, device: string): string {
  return `${t.toString(36)}-${deviceTag(device, device.startsWith('m') && device.length === 6 ? 6 : 4)}`;
}

/** Halbmonatsdokument nach dem LERNTAG von `t` (Wechsel 04:00). `part` ≥ 2 = Fortsetzung. */
export function vlogDocId(t: number, part = 1): string {
  const d = dayKey(t);
  const half = Number(d.slice(8, 10)) <= 15 ? 'a' : 'b';
  return `vlog/${d.slice(0, 7)}-${half}${part > 1 ? part : ''}`;
}

export function isVlogTuple(v: unknown): v is VlogTuple {
  return (
    Array.isArray(v) &&
    v.length === 12 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'string' &&
    [0, 1, 2].includes(v[2] as number) &&
    (FORMS as readonly unknown[]).includes(v[3]) &&
    typeof v[4] === 'number' &&
    (OUTCOMES as readonly unknown[]).includes(v[5]) &&
    typeof v[11] === 'number'
  );
}
