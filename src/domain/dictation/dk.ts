import { dkSchema } from '../../data/schemas';
import type { TransformOp } from '../../data/writer';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.2): gespeichertes Ergebnis der Laptop-Diktat-Probe.
// `app/profile.dk = { v: 1, mac?: { ok, t, sig }, win?: { ok, t, sig } }`, kleiner als 200 Byte.
// `sig` nennt nur Betriebssystem und Browser („macos-chrome“), nie eine Gerätekennung, Version oder Nutzerkennung.
// Leichtgewichtig (ohne Wörterbuch), damit die Hinweiszeile im Übungsrahmen es laden kann.

export type DkOs = 'mac' | 'win';
export type DkEntry = { ok: boolean; t: number; sig: string };
export type Dk = { v: 1; mac?: DkEntry; win?: DkEntry };

export const DK_MAX_BYTES = 200;
const SIG_MAX = 24;

type UaData = { platform?: unknown; brands?: unknown } | null | undefined;

/** Betriebssystem aus `navigator.userAgentData.platform` (falls da) oder dem User-Agent; Linux, Handy usw. = `null`. */
export function osOf(uaData: UaData, ua: string): DkOs | null {
  const p = typeof uaData?.platform === 'string' ? uaData.platform.toLowerCase() : '';
  if (p) {
    if (p.includes('mac')) return 'mac';
    if (p.includes('win')) return 'win';
    return null;
  }
  if (/iphone|ipad|android/i.test(ua)) return null;
  if (/mac os x|macintosh/i.test(ua)) return 'mac';
  if (/windows/i.test(ua)) return 'win';
  return null;
}

function browserOf(uaData: UaData, ua: string): string {
  const brands = Array.isArray(uaData?.brands) ? (uaData.brands as Array<{ brand?: unknown }>).map((b) => (typeof b.brand === 'string' ? b.brand.toLowerCase() : '')) : [];
  const has = (s: string) => brands.some((b) => b.includes(s));
  if (has('edge') || /edg\//i.test(ua)) return 'edge';
  if (has('opera') || /opr\//i.test(ua)) return 'opera';
  if (has('chrome') || /chrome\//i.test(ua)) return 'chrome';
  if (has('chromium')) return 'chromium';
  if (/firefox\//i.test(ua)) return 'firefox';
  if (/safari\//i.test(ua)) return 'safari';
  return 'other';
}

/** „macos-chrome“, „windows-edge“: nur Kleinbuchstaben und Bindestrich, höchstens 24 Zeichen. */
export function sigOf(os: DkOs, uaData: UaData, ua: string): string {
  return `${os === 'mac' ? 'macos' : 'windows'}-${browserOf(uaData, ua)}`.replace(/[^a-z-]/g, '').slice(0, SIG_MAX);
}

/** Betriebssystem und Signatur dieses Browsers (`null` = kein Mac, kein Windows: Ergebnis wird nicht gespeichert). */
export function currentDevice(): { os: DkOs; sig: string } | null {
  if (typeof navigator === 'undefined') return null;
  const uaData = (navigator as Navigator & { userAgentData?: UaData }).userAgentData;
  const ua = navigator.userAgent ?? '';
  const os = osOf(uaData, ua);
  return os ? { os, sig: sigOf(os, uaData, ua) } : null;
}

/** Streng gelesen; ein unlesbares `dk` gilt als nicht vorhanden (es sperrt nie etwas). */
export function readDk(raw: unknown): Dk | null {
  const r = dkSchema.safeParse(raw);
  if (!r.success) return null;
  const out: Dk = { v: 1 };
  const pick = (e: DkEntry): DkEntry => ({ ok: e.ok, t: e.t, sig: e.sig });
  if (r.data.mac) out.mac = pick(r.data.mac);
  if (r.data.win) out.win = pick(r.data.win);
  return out;
}

/** Hat dieses Betriebssystem eine erfolgreiche Probe? */
export function dkOk(raw: unknown, os: DkOs | null): boolean {
  if (!os) return false;
  return readDk(raw)?.[os]?.ok === true;
}

/**
 * Schreibschritt für `writer.transform('app/profile', …)`: nur bei Änderung (Ergebnis oder Signatur anders), sonst `null`.
 * Fehlt das Profil, wird nichts angelegt. `update` verschmilzt `dk` mit dem gespeicherten Stand (das andere Betriebssystem bleibt).
 * Erfolg bleibt Erfolg: Ein gespeichertes `ok: true` mit gleicher Signatur wird nie durch einen Fehlversuch ersetzt.
 */
export function dkStep(current: Record<string, unknown> | undefined, os: DkOs, entry: DkEntry): TransformOp | null {
  if (!current) return null;
  const prev = readDk(current.dk)?.[os];
  if (prev && prev.sig === entry.sig && (prev.ok || !entry.ok)) return null;
  return { update: { dk: { v: 1, [os]: entry } } };
}

export const dkBytes = (dk: Dk): number => new TextEncoder().encode(JSON.stringify(dk)).length;
