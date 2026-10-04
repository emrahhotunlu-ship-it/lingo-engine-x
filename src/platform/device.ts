// Geräteart (Emrahs Wunsch 01.10.2026 „Handy-Modus“). Handy = Touch als Hauptzeiger UND die kurze
// Seite des BILDSCHIRMS unter 500 px (iPhone 320–440, Android-Handys 360–430; iPad ab 744, Laptop
// ohne Touch). Der Bildschirm, nicht das Fenster, und die kurze Seite: Beides ändert sich beim
// Drehen des Handys nicht – die Pflichtliste darf dabei nie springen (Kap. 15).

export const PHONE_MAX_SHORT_SIDE = 500;

export type DeviceFacts = { coarse: boolean; width: number; height: number };

/** Rein: Ist das ein Handy? */
export function isPhone(f: DeviceFacts): boolean {
  const short = Math.min(f.width, f.height);
  return f.coarse && short > 0 && short < PHONE_MAX_SHORT_SIDE;
}

/** Fakten dieses Geräts (nur im Browser). */
export function deviceFacts(): DeviceFacts | null {
  if (typeof window === 'undefined') return null;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const s = window.screen;
  return { coarse, width: s?.width ?? window.innerWidth, height: s?.height ?? window.innerHeight };
}

/** Läuft die App gerade auf einem Handy? */
export function isPhoneDevice(): boolean {
  const f = deviceFacts();
  return f ? isPhone(f) : false;
}
