import type { voiceDe } from './voice.de';

// Oberflächentexte Stimme und Spracheingabe (Phase 3), Englisch.

export const voiceEn: Record<keyof typeof voiceDe, string> = {
  voiceTitle: 'Voice',
  voicePreview: 'Preview',
  voiceRate: 'Speed',
  voiceAutoplay: 'Read replies aloud in role-play',
  voiceNone: 'No English voice found',
  voiceNeuralReady: 'New voice ready',
  voiceNeuralCache: 'loaded from storage in {s} s',
  voiceNeuralDown: 'downloaded in {s} s',
  voiceNeuralLoading: 'Loading the new voice…',
  voiceNeuralFailed: "The new voice doesn't run on this device. The device voice speaks instead.",
  voiceNeuralHeart: 'Heart · female, US',
  voiceNeuralMichael: 'Michael · male, US',
  micStart: 'Speak',
  micListening: 'Listening…',
  micNoSpeech: "Didn't catch that – try again?",
};
