import { installDirector } from './director';

// Erlebnis-Engine (Lernplattform 3.0 P30): wer ein Lernereignis meldet, importiert von hier; der Import hängt den Dirigenten ein.
installDirector();

export { emit } from './events';
export type { FxArea, LearnEvent } from './events';
export { useFxLevel, useFxState, effectiveLevel, setFxPref } from './level';
export type { FxLevel } from './level';
