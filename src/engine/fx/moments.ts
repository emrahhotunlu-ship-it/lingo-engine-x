import { logWarn } from '../../platform/diagnostics';
import type { LearnEvent } from './events';
import { effectiveLevel } from './level';
import type * as Particles from './particles';

// Sichtbare Momente der Erlebnis-Engine (Design-Lead 07.10.2026, EE §4 M1/M6/M7): nur Stufe „Voll“ spielt Teilchen; „Ruhig“ behält Federn und
// Zahlen (CSS), „Aus“ zeigt den Endzustand. Die Teilchen-Engine (`particles.ts`) wird erst beim ersten Effekt geladen.
// Richtig: kleiner Lichtfunke aus der Lücke bzw. Option; ab 3 richtigen in Folge (Combo) etwas mehr, gedeckelt bei Stufe 3. Falsch: keine Teilchen,
// die Combo endet. Runde/Tag: ruhige Funken und wenige Plättchen in Grün und Weiß (kein Bonbon-Konfetti).

/** Richtige Antworten in Folge (nur Darstellung, nichts wird gespeichert). */
let combo = 0;
let lastVerdictAt = 0;
type Engine = typeof Particles;
let engine: Promise<Engine> | null = null;
const load = (): Promise<Engine> => (engine ??= import('./particles'));

const cssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/** Ort der richtigen Antwort: die Lücke oder Option, sonst das Urteilszeichen. */
function answerSpot(el: Element | null | undefined): Element | null {
  if (el && el.isConnected) return el;
  if (typeof document === 'undefined') return null;
  return document.querySelector('[data-testid="gap"][data-state="correct"], .lx-choice[data-state="correct"], .dz-badge[data-mark="ok"]');
}

export const comboLevel = (n: number): 0 | 1 | 2 | 3 => (n >= 8 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0);

export function getCombo(): number {
  return combo;
}

export function playMoment(e: LearnEvent): void {
  if (e.k === 'verdict') {
    // Zwei Meldungen desselben Prüfens (Lücke und Urteilszeile) zählen einmal.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastVerdictAt < 300) return;
    lastVerdictAt = now;
    if (e.v === 'ok') combo++;
    else if (e.v === 'wrong' || e.v === 'dontKnow') combo = 0;
    if (typeof document !== 'undefined') {
      const lvl = comboLevel(combo);
      if (lvl > 0) document.documentElement.dataset.combo = String(lvl);
      else delete document.documentElement.dataset.combo;
    }
    if (e.v !== 'ok' || effectiveLevel() !== 'full') return;
    // Nach dem Zeichnen messen (das Urteil steht dann im Bild).
    requestAnimationFrame(() => {
      const spot = answerSpot(e.el);
      if (!spot) return;
      const lvl = comboLevel(combo);
      const ok = cssVar('--lx-spark-1', '#34d399');
      const hi = cssVar('--lx-spark-2', '#ecfdf5');
      void load()
        .then((p) => {
          const c = p.centerOf(spot);
          if (!c) return;
          p.burst(c.x, c.y, { n: 10 + lvl * 6, colors: lvl >= 2 ? [ok, hi, ok] : [ok, hi], speed: [70, 150 + lvl * 30], angle: [-160, -20], gravity: 260, life: [380, 620], size: [1.2, 2.4], shape: 'spark' });
        })
        .catch((err: unknown) => logWarn('fx:particles', err));
    });
    return;
  }
  if (effectiveLevel() !== 'full') return;
  const spot = e.el ?? null;
  const ok = cssVar('--lx-spark-1', '#34d399');
  const hi = cssVar('--lx-spark-2', '#ecfdf5');
  const gold = cssVar('--lx-gold-text', '#f4c56a');
  void load()
    .then((p) => {
      const c = p.centerOf(spot) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
      if (e.m === 'day') {
        // Tag geschafft: Funkenkranz rund um den Ring, danach wenige Plättchen, die langsam fallen.
        p.burst(c.x, c.y, { n: 28, colors: [ok, hi], speed: [90, 190], gravity: 40, life: [600, 900], size: [1.4, 2.6], shape: 'spark' });
        p.burst(c.x, c.y - 40, { n: 26, colors: [ok, hi, gold], speed: [120, 260], angle: [-150, -30], gravity: 380, life: [1100, 1600], size: [3, 5], shape: 'flake', stagger: 160 });
      } else {
        p.burst(c.x, c.y, { n: 22, colors: [ok, hi], speed: [80, 200], angle: [-170, -10], gravity: 300, life: [600, 1000], size: [1.4, 2.6], shape: 'spark', stagger: 120 });
      }
    })
    .catch((err: unknown) => logWarn('fx:particles', err));
}

/** Nur für Tests. */
export function resetMoments(): void {
  combo = 0;
  lastVerdictAt = 0;
}
