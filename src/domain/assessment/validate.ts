import { focusChannels } from './actions';
import { confidenceRank, CONFIDENCES, DIMS, type AssessData, type AssessDim, type Confidence, type Dim, type Strength } from './types';

// Nachprüfung im Code nach dem Schema (Plan §4.3, E2): Die Belastbarkeit einer Fertigkeit ist
// höchstens die im Code berechnete Belegstärke; ohne Belege (`none`) gibt es keine Stufe und
// keinen KI-Text (die Oberfläche zeigt „Noch zu wenig Belege"). Der Fokus bekommt seine Kanäle.

export function capConfidence(ai: Confidence, code: Strength): Confidence {
  if (code === 'none') return 'thin';
  return CONFIDENCES[Math.min(confidenceRank(ai), confidenceRank(code))] ?? 'thin';
}

export function finalizeAssess(d: AssessData, strength: Readonly<Record<Dim, Strength>>): AssessData {
  const dims = DIMS.map((id): AssessDim => {
    const x = d.dims.find((y) => y.id === id) ?? { id, level: null, confidence: 'thin' as const, why: null };
    const s = strength[id];
    if (s === 'none') return { id, level: null, confidence: 'thin', why: null };
    return { id, level: x.level, confidence: capConfidence(x.confidence, s), why: x.why };
  });
  const focus = d.focus ? { ...d.focus, channels: focusChannels(d.focus.action) } : null;
  return { ...d, dims, focus };
}
