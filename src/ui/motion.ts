import type { Transition } from 'framer-motion';

// Bewegung bestätigt Handlungen, sie dekoriert nicht (Kap. 4.6). 150–300 ms.
export const DURATION = { fast: 0.15, base: 0.22, slow: 0.3 } as const;
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const spring: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 };
export const fade: Transition = { duration: DURATION.base, ease: EASE_OUT };
