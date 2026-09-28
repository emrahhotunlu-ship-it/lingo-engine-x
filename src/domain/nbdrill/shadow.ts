// Nachsprechen Satz für Satz (Lehrer P2, Plan N105): Ein Satz wird vorgesprochen, danach erscheint
// „Jetzt du“ so lange, wie der Satz gedauert hat. Drei Durchgänge mit steigendem Tempo
// (0,9 · 1,0 · 1,1). Keine Wertung. Quellen: Sätze aus Block 2 (`ctx.sentences`), sonst die
// Wendungen (Preply-Tag), sonst die drei Nachsprech-Sätze des Themen-Texts.

export const SHADOW_RATES = [0.9, 1, 1.1] as const;
export const SHADOW_MAX = 3;
/** „Jetzt du“ dauert mindestens so lange (kurze Sätze, schnelle Sprachausgabe). */
export const YOU_MIN_MS = 1500;
export const YOU_MAX_MS = 12_000;

export type ShadowStep = { pass: number; i: number; rate: number };

/** Alle Schritte: Durchgang für Durchgang, darin Satz für Satz. */
export function shadowSteps(n: number): ShadowStep[] {
  const out: ShadowStep[] = [];
  SHADOW_RATES.forEach((rate, pass) => {
    for (let i = 0; i < n; i++) out.push({ pass, i, rate });
  });
  return out;
}

/** Geschätzte Sprechdauer (≈ 150 Wörter/Min. bei Tempo 1). */
export function estimateMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words * 400) / Math.max(0.5, rate));
}

/** Dauer von „Jetzt du“: gemessene Sprechdauer, sonst geschätzt; in festen Grenzen. */
export function youMs(measured: number | null, text: string, rate: number): number {
  const ms = measured !== null && measured > 200 ? measured : estimateMs(text, rate);
  return Math.min(YOU_MAX_MS, Math.max(YOU_MIN_MS, Math.round(ms)));
}

/** Erste nicht leere Quelle: gesäubert, ohne Doppelte, höchstens drei Sätze. */
export function shadowSentences(...sources: ReadonlyArray<readonly string[] | null | undefined>): string[] {
  for (const src of sources) {
    const list = [...new Set((src ?? []).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 1))].slice(0, SHADOW_MAX);
    if (list.length) return list;
  }
  return [];
}
