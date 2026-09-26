import { hash32, mulberry32, shuffle } from '../random';
import type { Question } from './types';

// Artikel ohne Fragen (Startbestand, alte articles/ai*): lokale Fragen „Welche Aussage steht im
// Text?" (Plan F16). Richtig ist eine Kernaussage des Artikels, die drei anderen Optionen sind
// Kernaussagen ANDERER Artikel. Keine KI, deterministisch je Artikel.

export const KEYPOINT_QUESTION = 'Which statement matches what the text says?';

type Source = { id: string; keypoints: readonly string[] };

export function keypointQuestions(article: Source, pool: readonly Source[], count = 3): Question[] {
  const own = article.keypoints.map((k) => k.trim()).filter(Boolean);
  const ownSet = new Set(own.map((k) => k.toLowerCase()));
  const others = [...new Set(pool.filter((p) => p.id !== article.id).flatMap((p) => p.keypoints.map((k) => k.trim())))].filter(
    (k) => k && !ownSet.has(k.toLowerCase()),
  );
  if (!own.length || others.length < 3) return [];
  const rng = mulberry32(hash32(`kp|${article.id}`));
  const chosen = shuffle(own, rng).slice(0, Math.min(count, own.length));
  const distract = shuffle(others, rng);
  return chosen.map((right, i) => {
    const wrong = [0, 1, 2].map((j) => distract[(i * 3 + j) % distract.length] ?? '');
    return {
      key: `kp#${i}`,
      q: KEYPOINT_QUESTION,
      qLang: 'en' as const,
      options: [right, ...wrong],
      answer: 0,
      type: 'keypoint' as const,
      explain: {},
    };
  });
}
