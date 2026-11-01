// Testantworten des Wörter-Moduls, Großpaket A Schritt 5 (vocab-transfer@1, vocab-own-sentence@1, vocab-meaning@1). Besitzer: nur das Wörter-Modul.
// Sie lesen nur die festen Datenzeilen des Prompts. Steuerung für E2E (nur hier, nie im Produkt):
//  - Zielwort im Text → „ok“, sonst „unused“; `#odd` im Text → das erste benutzte Zielwort „odd“ (Präposition), mit korrigierter Fassung ohne `#odd`.
//  - `zzqx` im Text: die erste Antwort verletzt das Schema (der eine Neuversuch mit „did not match“ ist gültig); `zzjson`: gar kein JSON.
//  - Bedeutung: gleich, wenn die Antwort in der gelernten Bedeutung steht (oder umgekehrt) oder mit „syn“ beginnt.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';

type Target = { key: string; word: string };

const line = (input: string, key: string): string => new RegExp(`^${key}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';
const isDe = (input: string): boolean => /^Explanation language: German$/m.test(input);
const retry = (input: string): boolean => /did not match/.test(input);

function targetsOf(input: string): Target[] {
  return [...input.matchAll(/^(?:Target: )?(w\d): (.+?) \((?:word|phrasal verb|collocation|fixed phrase); meaning:/gm)].map((m) => ({ key: m[1]!, word: m[2]! }));
}

/** Fundstelle: die ersten Buchstaben des ersten Worts (fängt einfache Beugungen: postpone → postponed). */
function find(text: string, word: string): string {
  const head = word.split(/\s+/)[0] ?? word;
  const stem = head.length > 5 ? head.slice(0, head.length - 1) : head;
  const m = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i').exec(text);
  return m?.[0] ?? '';
}

function judge(text: string, t: Target, de: boolean, odd: boolean) {
  const at = find(text, t.word);
  if (!at) return { key: t.key, v: 'unused', err: null, at: '', why: '' };
  if (odd) return { key: t.key, v: 'odd', err: 'prep', at, why: de ? `Bei „${t.word}“ passt hier eine andere Präposition.` : `With "${t.word}", a different preposition fits here.` };
  return { key: t.key, v: 'ok', err: null, at, why: de ? `„${t.word}“ steht hier im richtigen Sinn und klingt natürlich.` : `"${t.word}" is used in the right sense here and sounds natural.` };
}

function textOf(input: string): string {
  return /<<<TEXT\n([\s\S]*?)\nTEXT>>>/.exec(input)?.[1] ?? '';
}

const fixedOf = (text: string): string => text.replace(/\s*#odd\b/g, '').replace(/\s*zzqx\b/g, '').trim();

export function transferReply(input: string): string {
  const text = textOf(input);
  if (/zzjson/.test(text)) return 'Sorry, I cannot answer in JSON.';
  const de = isDe(input);
  const odd = /#odd/.test(text);
  let first = odd;
  const words = targetsOf(input).map((t) => {
    const w = judge(text, t, de, first);
    if (w.v !== 'unused') first = false;
    return w;
  });
  if (/zzqx/.test(text) && !retry(input)) return JSON.stringify({ words: words.slice(1), extra: null, fixed: '' });
  return JSON.stringify({ words, extra: null, fixed: odd ? fixedOf(text) : '' });
}

export function ownSentenceReply(input: string): string {
  const text = line(input, 'Learner sentence');
  if (/zzjson/.test(text)) return 'Sorry, I cannot answer in JSON.';
  const de = isDe(input);
  const t = targetsOf(input)[0] ?? { key: 'w1', word: 'word' };
  const odd = /#odd/.test(text);
  const w = judge(text, t, de, odd);
  if (/zzqx/.test(text) && !retry(input)) return JSON.stringify({ v: 'maybe', err: null, at: '', why: '', extra: null, fixed: '', better: '' });
  return JSON.stringify({ v: w.v, err: w.err, at: w.at, why: w.why, extra: null, fixed: odd ? fixedOf(text) : '', better: `Another clear example: ${t.word} fits well in this sentence.` });
}

export function meaningReply(input: string): string {
  const de = isDe(input);
  const given = line(input, 'Learner answer').toLowerCase();
  const learned = (/^Word: .*\(learned meaning: (.*)\)$/m.exec(input)?.[1] ?? '').toLowerCase();
  const ok = !!given && (given.startsWith('syn') || learned.includes(given) || given.includes(learned));
  return JSON.stringify({
    ok,
    why: ok ? (de ? 'Das trifft den Sinn in diesem Satz.' : 'That captures the meaning in this sentence.') : de ? 'Das trifft den Sinn in diesem Satz nicht ganz.' : 'That does not quite capture the meaning in this sentence.',
  });
}

export function registerVocabReplies(): void {
  registerCannedReply('vocab-transfer', transferReply);
  registerCannedReply('vocab-own-sentence', ownSentenceReply);
  registerCannedReply('vocab-meaning', meaningReply);
}
