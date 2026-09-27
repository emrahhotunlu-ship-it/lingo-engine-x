import { weeklyExample } from '../../../prompts/weeklyReport';

// Feste Antwort für weekly-report@1 (Phase 6): zitiert die ersten beiden Fakt-Kennungen des
// Prompts in der Sprache der Anweisung. Nur Entwicklung und Tests.

export function weeklyReply(input: string): string {
  const lang = /^Write everything in English/m.test(input) ? 'en' : 'de';
  const facts = [...input.matchAll(/^\[([a-z]+:[^\]]*)\] (.*)$/gm)].map((m) => ({ id: m[1] ?? '', text: m[2] ?? '' }));
  return JSON.stringify(weeklyExample({ lang, facts }));
}
