import { verdictHaptic } from '../../platform/haptics';
import { playCue } from '../../platform/sound';
import { subscribe, type LearnEvent } from './events';
import { FRAME_SAMPLES, setFrameMeasure } from './level';
import { playMoment } from './moments';

// Der Dirigent (Lernplattform 3.0 P30, Erlebnis-Engine §2.2): nimmt Lernereignisse an und spielt dazu Ton und Vibration, an EINER Stelle.
// Regeln: höchstens ein Urteil je 300 ms (zwei Meldungen desselben Prüfens, z. B. Lücke und Ergebniszeile, ergeben einen Ton);
// „Weiß ich nicht“ bleibt still; die sichtbaren Effekte der Stufe 1 sind reines CSS und hängen an `data-fx` (kein Code hier).
// Nach der ersten Geste misst er 30 Bildabstände (Low-Power-Heuristik, §9.3); das Ergebnis steht in Einstellungen › Effekte (nicht im Fehlerprotokoll: es ist kein Fehler).

/** Sperrzeit zwischen zwei Urteilen. */
export const VERDICT_GAP_MS = 300;
let blocked = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const CUE = { ok: 'correct', near: 'near', wrong: 'wrong' } as const;

/** Ein Urteil verarbeiten (Ton und Vibration; Zeitgeber statt Uhrzeit, weil eine feste Testuhr die Zeit anhält). */
export function playVerdict(e: LearnEvent): void {
  if (e.k !== 'verdict' || e.v === 'dontKnow' || blocked) return;
  blocked = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    blocked = false;
    timer = null;
  }, VERDICT_GAP_MS);
  const cue = CUE[e.v];
  playCue(cue);
  verdictHaptic(cue);
}

/** Nur für Tests: Sperre lösen. */
export function resetDirector(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  blocked = false;
}

/** Bildabstände messen (requestAnimationFrame). Ohne Bildschirm (Tests) kommt eine leere Liste. */
export function measureFrames(n: number = FRAME_SAMPLES): Promise<number[]> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve([]);
      return;
    }
    const out: number[] = [];
    let last = 0;
    const step = (t: number): void => {
      if (last) out.push(t - last);
      last = t;
      if (out.length >= n) resolve(out);
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

let installed = false;

/** Dirigent einhängen (einmal): Urteile abspielen und nach der ersten Geste die Bildrate messen. */
export function installDirector(): void {
  if (installed) return;
  installed = true;
  subscribe(playVerdict);
  subscribe(playMoment);
  if (typeof window === 'undefined') return;
  const onFirst = (): void => {
    window.removeEventListener('pointerdown', onFirst);
    window.removeEventListener('keydown', onFirst);
    void measureFrames().then(setFrameMeasure);
  };
  window.addEventListener('pointerdown', onFirst, { passive: true });
  window.addEventListener('keydown', onFirst);
}
