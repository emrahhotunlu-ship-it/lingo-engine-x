import type { EvidenceCounts, FocusDim, Strength } from './types';

// Belegstärke je Fertigkeit, im Code berechnet (Plan §4.3, E2). Die angezeigte Belastbarkeit ist
// höchstens diese Stärke (`validate.ts`); ohne Belege (`none`) gibt es keine Stufe.
// Seit dem Fokus-Umbau nur noch für Grammatik und Wortschatz.

export function dimStrength(dim: FocusDim, c: EvidenceCounts): Strength {
  switch (dim) {
    case 'grammar':
      if (c.grammarN <= 0) return 'none';
      if (c.grammarN >= 200 && c.grammarTopics >= 8) return 'good';
      return c.grammarN >= 50 ? 'fair' : 'thin';
    case 'vocabulary': {
      const test = c.vtestDays !== null && c.vtestDays <= 90;
      const reviews = c.vocabReviews30 >= 300;
      if (test && reviews) return 'good';
      if (test || reviews) return 'fair';
      return c.vocabReviews30 > 0 || c.vtestDays !== null ? 'thin' : 'none';
    }
  }
}

export function allStrengths(c: EvidenceCounts): Record<FocusDim, Strength> {
  return { grammar: dimStrength('grammar', c), vocabulary: dimStrength('vocabulary', c) };
}
