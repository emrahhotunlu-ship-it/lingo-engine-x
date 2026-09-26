// Oberflächentexte des KI-Tors (src/ai), Deutsch. Werden in de.ts per Spread eingebunden.
// Einfache Sprache, keine Fachwörter (CLAUDE.md A2).

export const aiDe = {
  aiThinking: 'Denkt nach …',
  aiQueued: 'Wartet kurz …',
  aiSlow: 'Das dauert länger als üblich. Du kannst warten oder abbrechen.',
  aiStop: 'Stopp',
  aiRetry: 'Erneut versuchen',
  aiRetryIn: 'Erneut versuchen in {n} s',
  aiUnavailable: 'Claude ist in dieser Ansicht nicht verfügbar.',
  aiBusy: 'Claude ist gerade ausgelastet. Versuch es in einer Minute noch einmal.',
  aiSignin: 'Deine Anmeldung bei claude.ai ist abgelaufen. Melde dich neu an und versuch es dann noch einmal.',
  aiRefused: 'Claude hat diese Anfrage abgelehnt. Formuliere sie etwas anders.',
  aiEmpty: 'Claude hat keine Antwort geliefert. Versuch es mit weniger Text.',
  aiInvalid: 'Die Antwort von Claude war unvollständig. Versuch es noch einmal.',
  aiTooLarge: 'Der Text ist zu lang für eine Anfrage. Kürze ihn und versuch es noch einmal.',
  aiFailed: 'Das hat gerade nicht geklappt. Versuch es noch einmal.',
} as const;

export type AiMessageKey = keyof typeof aiDe;
