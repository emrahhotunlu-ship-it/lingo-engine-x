import type { UnitState } from '../metrics/definitions';
import { VTEST_VALID_DAYS } from '../metrics/tests';

// Wort-Himmel (Lernplattform 3.0 §6.3, P59), reine Logik: Lage der Punkte, Schleier aus dem Wortschatztest, Zählung.
// Lage: Sonnenblumen-Spirale – Eintrag i (nach Rang sortiert) im Goldenen Winkel × i, Radius nach Häufigkeitsrang `r`:
// radius = c·√r (normiert auf den seltensten Eintrag = 1). Häufige Wörter innen, seltene außen; die Lage hängt nur vom Atlas ab
// (deterministisch, gleiches Bild auf jedem Gerät). Ring bei Rang 5.000. Nichts wird gespeichert.

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Rang des Rings („die 5.000 häufigsten Wörter“). */
export const SKY_RING_RANK = 5000;
/** Breite eines Bands des Wortschatztests in Rängen (10 Bänder). */
export const VTEST_BAND = 1000;

export type SkyTone = 'firm' | 'safe' | 'learning' | 'new' | 'none';
export const SKY_TONES: readonly SkyTone[] = ['none', 'new', 'learning', 'safe', 'firm'];

export type SkyLayout = {
  /** Normierte Lage je Eintrag in [-1, 1] (Mittelpunkt 0,0). */
  xs: Float32Array;
  ys: Float32Array;
  /** Normierter Radius je Eintrag in [0, 1]. */
  rho: Float32Array;
  /** Größter Rang (Außenrand). */
  rMax: number;
};

/** Normierter Radius eines Rangs (0 = Mitte, 1 = Außenrand). */
export const rankRadius = (rank: number, rMax: number): number => (rMax > 0 ? Math.min(1, Math.sqrt(Math.max(0, rank) / rMax)) : 0);

/** Lage aller Einträge (Reihenfolge wie übergeben, erwartet: nach Rang sortiert). */
export function skyLayout(entries: readonly { r: number }[]): SkyLayout {
  const n = entries.length;
  const rMax = entries.reduce((m, e) => Math.max(m, e.r), 0);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const rho = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = rankRadius(entries[i]!.r, rMax);
    const a = i * GOLDEN_ANGLE;
    rho[i] = p;
    xs[i] = Math.cos(a) * p;
    ys[i] = Math.sin(a) * p;
  }
  return { xs, ys, rho, rMax };
}

/** Ton je Eintrag: Karte vorhanden → Zustand der Karte (ohne bekannten Zustand: „Neu“), sonst `none`. */
export function skyTones(ids: readonly string[], hasCard: (id: string) => boolean, stateOf: (id: string) => UnitState | undefined): SkyTone[] {
  return ids.map((id) => (hasCard(id) ? (stateOf(id) ?? 'new') : 'none'));
}

export type SkyCounts = { words: number; stars: number; firm: number; safe: number; learning: number; fresh: number; inRing: number };

/** Zahlen für Legende und Vorlesetext (Sterne = Atlas-Wörter mit Karte, dieselbe Zahl wie die Atlas-Zeile). */
export function skyCounts(entries: readonly { r: number }[], tones: readonly SkyTone[]): SkyCounts {
  const c: SkyCounts = { words: entries.length, stars: 0, firm: 0, safe: 0, learning: 0, fresh: 0, inRing: 0 };
  entries.forEach((e, i) => {
    if (e.r <= SKY_RING_RANK) c.inRing++;
    const t = tones[i] ?? 'none';
    if (t === 'none') return;
    c.stars++;
    if (t === 'firm') c.firm++;
    else if (t === 'safe') c.safe++;
    else if (t === 'learning') c.learning++;
    else c.fresh++;
  });
  return c;
}

export type SkyVeil = { bands: number[]; t: number; d: string | null };

type Doc = Readonly<Record<string, unknown>>;

/**
 * Schleier aus dem letzten Wortschatztest (`app/profile.vtests[last].bands`, 10 Bänder zu je 1.000 Rängen, Anteil erkannt 0…1).
 * Nur wenn der Test höchstens 90 Tage alt ist und alle 10 Bänder gültig sind, sonst `null` (kein Schleier, ehrlich).
 */
export function skyVeil(profile: Doc | null | undefined, nowMs: number): SkyVeil | null {
  const list = (Array.isArray(profile?.vtests) ? (profile.vtests as unknown[]) : [])
    .filter((v): v is Doc => !!v && typeof v === 'object')
    .sort((a, b) => (typeof a.t === 'number' ? a.t : 0) - (typeof b.t === 'number' ? b.t : 0));
  const v = list[list.length - 1];
  if (!v) return null;
  const t = typeof v.t === 'number' ? v.t : 0;
  if (!t || nowMs - t > VTEST_VALID_DAYS * 86_400_000 || nowMs < t - 86_400_000) return null;
  const raw = v.bands;
  if (!Array.isArray(raw) || raw.length !== 10) return null;
  const bands = raw.map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : NaN));
  if (bands.some((x) => Number.isNaN(x))) return null;
  return { bands, t, d: typeof v.d === 'string' ? v.d : null };
}

/** Rasterzellen (16 px) für die Antipp-Suche: Schlüssel „cx,cy“ → Indizes. */
export function skyGrid(px: Float32Array, py: Float32Array, cell = 16): Map<string, number[]> {
  const g = new Map<string, number[]>();
  for (let i = 0; i < px.length; i++) {
    const k = `${Math.floor(px[i]! / cell)},${Math.floor(py[i]! / cell)}`;
    const a = g.get(k);
    if (a) a.push(i);
    else g.set(k, [i]);
  }
  return g;
}

/** Nächster Punkt zu (x, y) in der Nachbarschaft (3×3 Zellen); bevorzugt Sterne (Karten) bei gleicher Nähe ±6 px. */
export function skyHit(grid: Map<string, number[]>, px: Float32Array, py: Float32Array, x: number, y: number, isStar: (i: number) => boolean, cell = 16): number | null {
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  let best: number | null = null;
  let bestD = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const i of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        const d = Math.hypot(px[i]! - x, py[i]! - y) - (isStar(i) ? 6 : 0);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  return bestD <= cell ? best : null;
}
