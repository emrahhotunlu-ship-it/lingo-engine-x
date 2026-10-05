import type { engineDe } from './engine.de';

// UI texts for course extension, swipe gestures and vibration (ch. 4.3, 4.5, 6.2), English.

export const engineEn: Record<keyof typeof engineDe, string> = {
  setHapticTitle: 'Vibration',
  setHaptic: 'Vibrate briefly when checking',
  setHapticNone: 'This device cannot vibrate (for example the iPhone). Feedback is then visual only.',
};
