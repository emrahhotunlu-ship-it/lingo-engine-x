import { registerCannedReply } from '../fakeSample';

// Feste Antwort für speak-task-check@1 (Neubau N79, B9: Pitch 30/60/120, Diagramm, Umschreiben,
// Rückübersetzung). Liest nur die Datenzeilen des Prompts. `zzjson` in der Antwort → kein JSON.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

type Kind = 'pitch' | 'chart' | 'circum' | 'back';

const CORE: Record<Kind, { de: string; en: string }> = {
  pitch: { de: 'Die Kernbotschaft bleibt gleich, aber der Abschluss mit nächstem Schritt fehlt.', en: 'The core message stays the same, but the closing ask is missing.' },
  chart: { de: 'Trend und Vergleich sind klar, die Folgerung fehlt noch.', en: 'Trend and comparison are clear, the conclusion is still missing.' },
  circum: { de: 'Ein Kunde würde verstehen, was du meinst.', en: 'A customer would understand what you mean.' },
  back: { de: 'Die Bedeutung stimmt; die Unterschiede sind nur Stil.', en: 'The meaning is the same; the differences are only style.' },
};

const BETTER: Record<Kind, string> = {
  pitch: 'We help mid-sized companies find any document in seconds. Most teams still lose hours every week searching shared drives. With our cloud archive, everything is searchable and audit-proof. Shall we look at your process together next week?',
  chart: 'The number of processed documents more than tripled between January and June. Growth was steady at first and picked up sharply in April. So the new workflow is clearly paying off.',
  circum: "It's the period of time a company has to keep documents, for example invoices, before it's allowed to delete them.",
  back: "We'd like to get a better sense of how your team handles invoices today.",
};

function kindOf(input: string): Kind {
  const t = line(input, 'Task type');
  if (/^elevator pitch/i.test(t) || /Task type: elevator pitch/.test(input)) return 'pitch';
  if (/Task type: describe a chart/.test(input)) return 'chart';
  if (/Task type: paraphrase a term/.test(input)) return 'circum';
  return 'back';
}

export function speakTaskCheckReply(input: string): string {
  const answer = line(input, 'Learner answer');
  if (/\bzzjson\b/i.test(answer)) return NOT_JSON;
  const en = /^English$/i.test(line(input, 'Explanation language'));
  const kind = kindOf(input);
  const a = answer.toLowerCase();
  const fixes = /\bdiscuss about\b/.test(a)
    ? [{ mine: 'discuss about', right: 'discuss', why: en ? '"Discuss" takes no preposition.' : '„discuss“ steht ohne Präposition.' }]
    : /\bsince three years\b/.test(a)
      ? [{ mine: 'since three years', right: 'for three years', why: en ? 'Use "for" with a length of time.' : 'Bei einer Zeitdauer steht „for“.' }]
      : [];
  const words = answer.split(/\s+/).filter(Boolean).length;
  const verdict = words < 4 ? 'wrong' : fixes.length ? 'close' : 'ok';
  return JSON.stringify({
    verdict,
    core: en ? CORE[kind].en : CORE[kind].de,
    effect: en ? 'Clear and friendly; a few sentences could be shorter.' : 'Klar und freundlich; einige Sätze könnten kürzer sein.',
    fixes,
    better: BETTER[kind],
  });
}

export function registerP5TaskReplies(): void {
  registerCannedReply('speak-task-check', speakTaskCheckReply);
}
