import { registerCannedReply } from '../fakeSample';

// Feste Antworten für pressure-check@1 und inbox-check@1 (Neubau P7, N103/N104). Sie lesen nur
// die Datenzeilen des Prompts. `zzjson` in der Antwort → kein JSON. Nur Entwicklung und Tests –
// nie Teil des Produktions-Builds.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const isEn = (input: string) => /^English$/i.test(line(input, 'Explanation language'));
const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

export function pressureCheckReply(input: string): string {
  const answer = line(input, 'Learner answer');
  if (/\bzzjson\b/i.test(answer)) return NOT_JSON;
  const en = isEn(input);
  const a = answer.toLowerCase();
  const out = {
    acknowledge: /\b(understand|appreciate|fair|see|hear)\b/.test(a),
    ask: a.includes('?'),
    answer: /\b(because|include|save|cost|value|support)\b/.test(a),
    secure: /\b(shall we|would it help|can we|next step|let's|let us)\b/.test(a),
    effect: en ? 'Friendly and calm, but the next step is missing.' : 'Freundlich und ruhig, aber der nächste Schritt fehlt.',
    fixes: /\bdiscuss about\b/.test(a) ? [{ mine: 'discuss about', right: 'discuss', why: en ? '"Discuss" takes no preposition.' : '„discuss“ steht ohne Präposition.' }] : [],
    better: "I understand, price matters. May I ask what you are comparing us with? We include hosting and support, so the total cost is often lower. Shall we compare both offers side by side?",
  };
  return JSON.stringify(out);
}

export function inboxCheckReply(input: string): string {
  if (/\bzzjson\b/i.test(input)) return NOT_JSON;
  const en = isEn(input);
  const must = (input.match(/^\d+\. /gm) ?? []).map((_, i) => i % 2 === 0);
  return JSON.stringify({
    gist: true,
    gistNote: en ? 'You spotted the real concern.' : 'Du hast das eigentliche Anliegen erkannt.',
    must,
    tone: 'fits',
    effect: en ? 'Polite and clear; the next step could be more concrete.' : 'Höflich und klar; der nächste Schritt könnte konkreter sein.',
    fixes: [{ mine: 'I send you', right: "I'll send you", why: en ? 'Use will for a promise.' : 'Für ein Versprechen steht will.' }],
    better: "Hi Laura,\n\nThanks for your reply, and good luck with the year-end closing. I've attached a one-page overview with our prices. Would it make sense to talk again in late February?\n\nBest regards",
  });
}

export function registerP7Replies(): void {
  registerCannedReply('pressure-check', pressureCheckReply);
  registerCannedReply('inbox-check', inboxCheckReply);
}
