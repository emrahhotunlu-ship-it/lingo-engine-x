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
