import type { Transition, Variants } from 'framer-motion';

// Bewegung bestätigt Handlungen, sie dekoriert nicht (Kap. 4.6). 120–300 ms, nie länger; kein Konfetti.
export const DURATION = { fast: 0.15, base: 0.22, slow: 0.3 } as const;
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const spring: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 };
export const fade: Transition = { duration: DURATION.base, ease: EASE_OUT };

// Lernplattform 2.0 §7: die fünf Bewegungsvorlagen aller Übungen. Bei reduzierter Bewegung gelten sie
// sofort und ohne Dauer – nie langsamer (`motionSafe`). `useReducedMotion` kommt von framer-motion.

/** Eine Aufgabe löst die andere ab: die alte blendet in 120 ms aus, die neue startet ohne Leerbild bei 0,6 und ist in 150 ms da (`AnimatePresence mode="popLayout"`). */
export const itemEnter: Variants = {
  initial: { opacity: 0.6 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** Das Ergebnis rückt von oben ein (y −6 → 0, 220 ms). */
export const resultEnter = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: EASE_OUT } satisfies Transition,
} as const;

/** Aufklappbereich: Höhe in 220 ms. */
export const disclose = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.22, ease: EASE_OUT } satisfies Transition,
} as const;

/** Die Lösung gleitet in die Lücke (200 ms). */
export const gapMorph: Transition = { duration: 0.2, ease: EASE_OUT };

/** Ring und Punkte füllen sich (300 ms). */
export const ringFill: Transition = { duration: 0.3, ease: EASE_OUT };

/** Reduzierte Bewegung: sofort und ohne Dauer. Reiht sich vor jede Vorlage ein: `transition={motionSafe(reduce, gapMorph)}`. */
export const motionSafe = (reduce: boolean | null, t: Transition): Transition => (reduce ? { duration: 0 } : t);

// Lernplattform 3.0 P30 (Erlebnis-Engine §3.1): Feder-Tokens nach wahrgenommener Dauer und Federung (Apple-Weise), nicht nach Steifigkeit und Dämpfung.
// Sie ersetzen `spring` oben schrittweise: neue Bewegung nimmt nur diese Namen, alte Stellen wechseln mit ihren Paketen.
// `t95` = Zeit bis 95 % des Wegs (gemessen mit dem Federgenerator, `tests/unit/fxLevel.test.ts`). Bedienbewegung nutzt nur snap, glide, settle, pop und sheet
// (t95 ≤ 286 ms, Kap. 4.4 „150–300 ms“); ring und morph sind nur für seltene Momente (Runde, Tag, Struktur-Film).
export const SPRINGS = {
  /** Drücken, Schalter, Reiter-Pille, Segmente. */
  snap: { type: 'spring', visualDuration: 0.18, bounce: 0 },
  /** Bildschirm- und Kartenwege, gemeinsame Elemente. */
  glide: { type: 'spring', visualDuration: 0.28, bounce: 0 },
  /** Karte landet, Baustein rastet ein, Lösung in der Lücke. */
  settle: { type: 'spring', visualDuration: 0.32, bounce: 0.2 },
  /** Nur kleine Dinge bis 32 px: Punkte, Häkchen, Ziffern. */
  pop: { type: 'spring', visualDuration: 0.24, bounce: 0.3 },
  /** Blätter. */
  sheet: { type: 'spring', visualDuration: 0.36, bounce: 0.08 },
  /** Nur Momente: Ringe füllen, Ziffern rollen. */
  ring: { type: 'spring', visualDuration: 0.6, bounce: 0.1 },
  /** Nur Momente: Wörter wandern im Struktur-Film. */
  morph: { type: 'spring', visualDuration: 0.45, bounce: 0.15 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof SPRINGS;
/** Die Federn der Bedienbewegung (≤ 300 ms wahrgenommen). */
export const OPERATING_SPRINGS = ['snap', 'glide', 'settle', 'pop', 'sheet'] as const satisfies readonly SpringName[];
