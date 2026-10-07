import type { ttDe } from './tt.de';

// UI texts of the AI tutor (MVP), English (American spelling). Prefix `tt`.

export const ttEn: Record<keyof typeof ttDe, string> = {
  ttAsk: 'Explain my answer',
  ttLabel: 'Explanation',
  ttMark: 'by Claude · may contain errors',
  ttMore: 'Ask more',
  ttLimit: 'You have used all 20 explanations from Claude for today. More tomorrow.',
  ttQuestion: 'Please explain in more detail: {task}\nMy answer: {given}\nCorrect: {solution}\nTopic: {pattern}',
};
