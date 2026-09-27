import type { engineDe } from './engine.de';

// UI texts for course extension, swipe gestures and vibration (ch. 4.3, 4.5, 6.2), English.

export const engineEn: Record<keyof typeof engineDe, string> = {
  ceTitle: 'Extend the course',
  ceLead: 'Claude plans four new lessons based on your assessment and your most frequent mistakes.',
  ceDoneTitle: 'All lessons completed',
  ceDoneLead: 'Keep going with a new unit: Claude puts together four lessons based on your assessment and your most frequent mistakes.',
  ceSubmit: 'Create new lessons',
  ceCreated: 'New lessons are ready: Unit {unit}',
  ceBadge: 'Created by Claude',
  setHapticTitle: 'Vibration',
  setHaptic: 'Vibrate briefly when checking',
  setHapticNone: 'This device cannot vibrate (for example the iPhone). Feedback is then visual only.',
};
