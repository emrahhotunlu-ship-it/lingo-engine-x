import type { ttDe } from './tt.de';

// UI texts of the AI tutor (MVP), English (American spelling). Prefix `tt`.

export const ttEn: Record<keyof typeof ttDe, string> = {
  ttAsk: 'Explain my answer',
  ttLabel: 'Explanation',
  ttMark: 'by Claude · may contain errors',
  ttMore: 'Ask more',
  ttLimit: 'You have used all 20 explanations from Claude for today. More tomorrow.',
  ttXUnavailable: 'Claude’s extra explanation isn’t available right now. The explanation above still applies.',
  ttQuestion: 'Please explain in more detail: {task}\nMy answer: {given}\nCorrect: {solution}\nTopic: {pattern}',
};
