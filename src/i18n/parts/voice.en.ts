import type { voiceDe } from './voice.de';

// Oberflächentexte Stimme und Spracheingabe (Phase 3), Englisch.

export const voiceEn: Record<keyof typeof voiceDe, string> = {
  voiceTitle: 'Voice',
  voicePreview: 'Preview',
  voiceRate: 'Speed',
  voiceAutoplay: 'Read replies aloud in role-play',
  voiceNone: 'No English voice found',
  micStart: 'Speak',
  micListening: 'Listening…',
  micNoSpeech: "Didn't catch that – try again?",
};
