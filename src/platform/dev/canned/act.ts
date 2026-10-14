// Testantworten Wörter aktivieren, Stufe 2 (`activate-check@1`). Nur Entwicklung und Tests – nie Teil des Produktions-Builds.
// Liest nur die festen Datenzeilen des Prompts. Sonderwörter im Text des Lernenden: `zzjson` → kein JSON, `zzqx` → erste Antwort verletzt das Schema
// (der Neuversuch mit angehängtem Mangel ist gültig).

import { registerCannedReply } from '../fakeSample';

const line = (input: string, label: string): string => new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';
const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

const stem = (w: string): string => {
  const s = w.replace(/(ies|es|s|ed|ing|e|y)$/, '');
  return s.length >= 3 ? s : w;
};
const uses = (text: string, word: string): boolean => {
  const low = text.toLowerCase();
  const ws = (word.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length >= 3);
  return ws.length > 0 && ws.every((w) => low.includes(stem(w)));
};

/** Zielwörter aus den Zeilen „Target N (main): wort (word; meaning: …; shown …)“ in der Reihenfolge des Prompts. */
function targetsOf(input: string): string[] {
  return [...input.matchAll(/^Target \d(?: \(main\))?: (.*?) \((?:word|phrase); meaning: /gm)].map((m) => (m[1] ?? '').trim());
}

const WHY = {
  correct: { de: 'Alle Zielwörter sind richtig und natürlich benutzt, und der Text passt zur Aufgabe.', en: 'All target words are used correctly and naturally, and the text fits the assignment.' },
  minor: { de: 'Die Zielwörter sind richtig benutzt. Ein Satz beginnt aber mit einem Großbuchstaben und endet mit einem Punkt.', en: 'The target words are used correctly. A sentence starts with a capital letter and ends with a period.' },
  wrong: { de: 'Mindestens ein Zielwort fehlt in deinem Text. Baue es ein, damit die Übung zählt.', en: 'At least one target word is missing from your text. Include it so the exercise counts.' },
} as const;

const WHY_BETTER = { de: 'So klingt es im Beruf knapper und natürlicher.', en: 'It sounds shorter and more natural at work.' } as const;

export function activateCheckReply(input: string): string {
  const text = line(input, 'Learner text');
  const lang = /^Explanation language: German$/m.test(input) ? 'de' : 'en';
  if (/\bzzjson\b/i.test(text)) return NOT_JSON;
  const isRetry = input.includes('did not match the required format');
  const words = targetsOf(input);
  if (/\bzzqx\b/i.test(text) && !isRetry) return JSON.stringify({ verdict: 'maybe', targets: 'yes' });
  const used = words.map((w) => uses(text, w) || /\bzzqx\b/i.test(text));
  const allUsed = used.every(Boolean);
  const tidy = /^[A-Z]/.test(text) && /[.!?]$/.test(text);
  const verdict = !allUsed ? 'wrong' : tidy ? 'correct' : 'minor';
  // Zweite und dritte Schicht (C1-Fassung, warum besser) auch bei „correct“ und „minor“, damit die Schichten testbar sind (UX-Prüfung 14.10.).
  const better = verdict === 'wrong' ? '' : `At work, we use ${words.join(' and ')} in one clear, concise sentence.`;
  const fixed = verdict === 'correct' ? text : verdict === 'minor' ? `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}` : `At work, we always use ${words.join(' and ')} in a clear sentence.`;
  return JSON.stringify({
    verdict,
    mainVerdict: used[0] === false ? 'wrong' : verdict === 'wrong' ? 'minor' : verdict,
    targets: used.map((u) => ({ used: u, correct: u })),
    alt: '',
    fixed,
    why: WHY[verdict][lang],
    better,
    whyBetter: better ? WHY_BETTER[lang] : '',
    // Eine konkrete Klasse (die Oberfläche lässt „Sonstiges“ weg): fehlendes Zielwort = Wortwahl, kleiner Fehler = Wortstellung.
    errType: verdict === 'correct' ? null : verdict === 'wrong' ? 'word_choice' : 'word_order',
    reusable: verdict === 'correct',
  });
}

export function registerActReplies(): void {
  registerCannedReply('activate-check', activateCheckReply);
}
