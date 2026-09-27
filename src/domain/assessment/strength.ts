import type { Dim, EvidenceCounts, Strength } from './types';

// Belegstärke je Fertigkeit, im Code berechnet (Plan §4.3, E2). Die angezeigte Belastbarkeit ist
// höchstens diese Stärke (`validate.ts`); ohne Belege (`none`) gibt es keine Stufe.

export function dimStrength(dim: Dim, c: EvidenceCounts): Strength {
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
    case 'reading':
      return tier(c.reading, 5, 2);
    case 'listening':
      return tier(c.listening, 6, 2);
    case 'writing':
      return tier(c.writing, 5, 2);
    case 'speaking':
      return tier(c.speaking, 5, 2);
  }
}

function tier(n: number, good: number, fair: number): Strength {
  if (n <= 0) return 'none';
  if (n >= good) return 'good';
  return n >= fair ? 'fair' : 'thin';
}

export function allStrengths(c: EvidenceCounts): Record<Dim, Strength> {
  return {
    grammar: dimStrength('grammar', c),
    vocabulary: dimStrength('vocabulary', c),
    reading: dimStrength('reading', c),
    listening: dimStrength('listening', c),
    writing: dimStrength('writing', c),
    speaking: dimStrength('speaking', c),
  };
}
