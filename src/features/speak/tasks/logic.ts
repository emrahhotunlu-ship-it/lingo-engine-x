import type { ChartItem } from './content';

// Reine Logik der kurzen Sprechaufgaben (Neubau N79, B9): Diagramm-Geometrie, Wortvergleich der
// Rückübersetzung, „Zielwort benutzt?“ beim Umschreiben. Rein und getestet.

export type Bar = { x: number; y: number; w: number; h: number; label: string; value: number };
export type Pt = { x: number; y: number; label: string; value: number };
export type ChartGeo = { w: number; h: number; top: number; base: number; max: number; bars: Bar[]; points: Pt[]; grid: number[] };

/** Schöne obere Grenze (1, 2, 2.5, 5, 10 × 10^n) über dem Höchstwert. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Geometrie für ein einfaches Balken- oder Liniendiagramm (Koordinaten im viewBox `0 0 w h`). */
export function chartGeometry(c: Pick<ChartItem, 'kind' | 'labels' | 'values'>, w = 320, h = 180): ChartGeo {
  const top = 12;
  const base = h - 24;
  const left = 8;
  const right = w - 8;
  const n = Math.max(1, Math.min(c.labels.length, c.values.length));
  const max = niceMax(Math.max(0, ...c.values.slice(0, n)));
  const yOf = (v: number) => base - (Math.max(0, v) / max) * (base - top);
  const slot = (right - left) / n;
  const bars: Bar[] = [];
  const points: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const value = c.values[i] ?? 0;
    const label = c.labels[i] ?? '';
    const cx = left + slot * i + slot / 2;
    const y = yOf(value);
    if (c.kind === 'bar') {
      const bw = Math.max(4, slot * 0.56);
      bars.push({ x: cx - bw / 2, y, w: bw, h: base - y, label, value });
    }
    points.push({ x: cx, y, label, value });
  }
  const grid = [0.5, 1].map((f) => yOf(max * f));
  return { w, h, top, base, max, bars, points, grid };
}

const norm = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export type DiffWord = { w: string; same: boolean };

/**
 * Wortvergleich (LCS über kleingeschriebene Wörter, Satzzeichen zählen nicht): Welche Wörter der
 * eigenen Fassung stehen so im Original, welche nicht – und umgekehrt. Nur zum Markieren.
 */
export function wordDiff(original: string, mine: string): { orig: DiffWord[]; mine: DiffWord[]; same: number } {
  const a = original.split(/\s+/).filter(Boolean);
  const b = mine.split(/\s+/).filter(Boolean);
  const an = a.map((x) => norm(x).join(' '));
  const bn = b.map((x) => norm(x).join(' '));
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) {
      const row = dp[i] as number[];
      row[j] = an[i] && an[i] === bn[j] ? (dp[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(dp[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  const sa = new Array<boolean>(a.length).fill(false);
  const sb = new Array<boolean>(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (an[i] && an[i] === bn[j]) {
      sa[i] = true;
      sb[j] = true;
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) i++;
    else j++;
  }
  return { orig: a.map((w, k) => ({ w, same: !!sa[k] })), mine: b.map((w, k) => ({ w, same: !!sb[k] })), same: sb.filter(Boolean).length };
}

/** Das markanteste Wort des Zielbegriffs (das längste; bei Gleichstand das erste). */
export function keyWord(target: string): string {
  return norm(target).reduce((best, w) => (w.length > best.length ? w : best), '');
}

/** Hat die Umschreibung das Zielwort benutzt? Ganzer Begriff oder Wortstamm des markantesten Worts. */
export function usesTarget(answer: string, target: string): boolean {
  const words = norm(answer);
  const phrase = norm(target).join(' ');
  if (phrase && ` ${words.join(' ')} `.includes(` ${phrase} `)) return true;
  const key = keyWord(target);
  if (key.length < 4) return words.includes(key);
  const stem = key.slice(0, Math.max(4, key.length - 2));
  return words.some((w) => w.startsWith(stem));
}

/** Wörter pro Minute (für die Pitch-Runden). */
export function wordsPerMinute(text: string, ms: number): number {
  const n = norm(text).length;
  if (!n || ms <= 0) return 0;
  return Math.round((n * 60_000) / ms);
}
