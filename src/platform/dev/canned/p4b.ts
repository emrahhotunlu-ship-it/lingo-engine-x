import { registerCannedReply } from '../fakeSample';

// Feste Antworten für listening-dialog@1, followup-check@1 und tone-read@1 (Paket B, Lesen/Hören/
// Schreiben). Sie lesen nur die Datenzeilen des Prompts. `zzjson` in den Nutzerdaten → kein JSON.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';
const between = (input: string, re: RegExp): string => (re.exec(input)?.[1] ?? '').trim();

// ---------------------------------------------------------------- listening-dialog@1

export const DIALOG = {
  title: 'Rollout planning call',
  setting: { de: 'Drei Kolleginnen und Kollegen besprechen, wie der Rollout beim Kunden weitergeht.', en: 'Three colleagues discuss how the customer rollout should continue.' },
  speakers: [
    { name: 'Megan', role: 'Project lead', accent: 'us' },
    { name: 'Oliver', role: 'Finance partner', accent: 'gb' },
    { name: 'Priya', role: 'IT architect', accent: 'in' },
  ],
  lines: [
    { s: 0, text: "Okay, thanks for joining on short notice. I'd like to decide today how we move forward with the rollout." },
    { s: 1, text: 'Sure. Just so we are on the same page, the budget for this quarter is pretty tight.' },
    { s: 2, text: 'Understood. From a technical side, the two missing interfaces are the real bottleneck.' },
    { s: 0, text: 'Right. So what if we start with three sites first and add the rest in January?' },
    { s: 1, text: "Hmm, I'm not sure that works for us. Could we at least get a cost estimate before we commit?" },
    { s: 2, text: 'I can send a rough estimate for both interfaces by Friday. It will not be perfect, but it will be close.' },
    { s: 0, text: "Great. Oliver, if the estimate is under forty thousand, can you sign off next week?" },
    { s: 1, text: 'Yes, under forty thousand I can approve it myself.' },
    { s: 0, text: "Perfect. Then I'll tell the customer we start with three sites in November." },
  ],
  points: [
    'Priya sends a cost estimate for both interfaces by Friday.',
    'Oliver approves the budget next week if it is under 40,000.',
    'The rollout starts with three sites in November.',
  ],
};

export function listeningDialogReply(input: string): string {
  if (/\bzzjson\b/i.test(between(input, /business (.*?) between/))) return NOT_JSON;
  const en = /one short English sentence: who talks/.test(input);
  return JSON.stringify({ ...DIALOG, setting: en ? DIALOG.setting.en : DIALOG.setting.de });
}

// ---------------------------------------------------------------- followup-check@1

const keyWords = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9,]{5,}/g) ?? []).filter((w) => !['sends', 'which', 'there', 'their', 'under'].includes(w));

export function followupCheckReply(input: string): string {
  const mail = between(input, /\nTheir email:\n([\s\S]*?)\nCheck:/);
  if (/\bzzjson\b/i.test(mail)) return NOT_JSON;
  const en = /with a short English note/.test(input);
  const points = between(input, /\nAgreements from the meeting:\n([\s\S]*?)\nTheir notes/)
    .split('\n')
    .filter((l) => /^\d+\. /.test(l))
    .map((l) => l.replace(/^\d+\. /, ''));
  const low = mail.toLowerCase();
  const res = points.map((p, i) => {
    const hits = keyWords(p).filter((w) => low.includes(w)).length;
    const covered = hits >= 2 ? 'yes' : hits === 1 ? 'partly' : 'no';
    const note =
      covered === 'yes'
        ? en ? 'This is clearly in your email.' : 'Das steht klar in deiner Mail.'
        : covered === 'partly'
          ? en ? 'Mentioned, but the details are missing.' : 'Erwähnt, aber die Einzelheiten fehlen.'
          : en ? 'This agreement is missing.' : 'Diese Vereinbarung fehlt.';
    return { i, covered, note };
  });
  const fixes = /\bsince two weeks\b/i.test(mail)
    ? [{ mine: 'since two weeks', right: 'for two weeks', why: en ? 'Use for with a length of time.' : 'Bei einer Zeitdauer steht for.' }]
    : [];
  return JSON.stringify({
    points: res,
    effect: en ? 'Clear and polite, a good length for a follow-up.' : 'Klar und höflich, eine gute Länge für ein Follow-up.',
    fixes,
    better:
      "Hi all, thanks for today's call. Quick recap: Priya will send a cost estimate for both interfaces by Friday. If it comes in under 40,000, Oliver will approve the budget next week. We will start the rollout with three sites in November. Best, Megan",
  });
}

// ---------------------------------------------------------------- tone-read@1

export function toneReadReply(input: string): string {
  const text = between(input, /\nText:\n([\s\S]*?)\n- tones:/);
  if (/\bzzjson\b/i.test(text)) return NOT_JSON;
  const en = /one short English sentence why/.test(input);
  const low = text.toLowerCase();
  const polite = /\b(please|thank|appreciate|would you)\b/.test(low);
  const pushy = /!|\basap\b|\bimmediately\b|\bmust\b/.test(low);
  const tones = pushy ? ['urgent', 'direct'] : polite ? ['polite', 'friendly'] : ['neutral', 'direct'];
  return JSON.stringify({
    tones,
    note: pushy
      ? en ? 'Words like "ASAP" and the exclamation mark make it sound pushy.' : 'Wörter wie „ASAP“ und das Ausrufezeichen wirken drängend.'
      : polite
        ? en ? 'Phrases like "thank you" keep it friendly and polite.' : 'Wendungen wie „thank you“ machen den Text freundlich und höflich.'
        : en ? 'Short, plain sentences make it sound matter-of-fact.' : 'Kurze, schlichte Sätze wirken sachlich.',
    tip: pushy ? (en ? 'Try "at your earliest convenience" instead of "ASAP".' : 'Versuch „at your earliest convenience“ statt „ASAP“.') : '',
  });
}

export function registerP4bReplies(): void {
  registerCannedReply('listening-dialog', listeningDialogReply);
  registerCannedReply('followup-check', followupCheckReply);
  registerCannedReply('tone-read', toneReadReply);
}
