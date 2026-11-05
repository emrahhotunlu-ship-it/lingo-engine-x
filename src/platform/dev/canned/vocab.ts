// Testantworten des Wörter-Moduls, Großpaket A Schritt 5 (vocab-transfer@1, vocab-own-sentence@1, vocab-meaning@1). Besitzer: nur das Wörter-Modul.
// Sie lesen nur die festen Datenzeilen des Prompts. Steuerung für E2E (nur hier, nie im Produkt):
//  - Zielwort im Text → „ok“, sonst „unused“; `#odd` im Text → das erste benutzte Zielwort „odd“ (Präposition), mit korrigierter Fassung ohne `#odd`.
//  - `zzqx` im Text: die erste Antwort verletzt das Schema (der eine Neuversuch mit „did not match“ ist gültig); `zzjson`: gar kein JSON.
//  - `#evade` im Text: das erste Zielwort gilt als ausgewichen (unused mit Ersatzwort „#evade“).
//  - Bedeutung: gleich, wenn die Antwort in der gelernten Bedeutung steht (oder umgekehrt); Lücke: beginnt die Antwort mit „syn“ → synonym, mit „simp“ → simpler.
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
  if (/#evade/.test(text) && words[0]) words[0] = { key: words[0].key, v: 'unused', err: null, at: '#evade', why: de ? 'Hier stand ein anderes Wort.' : 'A different word was used here.' };
  const better = `${fixedOf(text).replace(/\s*#evade\b/g, '')} ${targetsOf(input).map((t) => t.word).join(', ')}.`;
  return JSON.stringify({ words, extra: null, fixed: odd ? fixedOf(text) : '', better });
}

export function ownSentenceReply(input: string): string {
  const text = line(input, 'Learner sentence');
  if (/zzjson/.test(text)) return 'Sorry, I cannot answer in JSON.';
  const de = isDe(input);
  const t = targetsOf(input)[0] ?? { key: 'w1', word: 'word' };
  const odd = /#odd/.test(text);
  const w = judge(text, t, de, odd);
  if (/zzqx/.test(text) && !retry(input)) return JSON.stringify({ v: 'maybe', err: null, at: '', why: '', extra: null, fixed: '', better: '' });
  return JSON.stringify({ v: w.v, err: w.err, at: w.at, why: w.why, extra: null, fixed: odd ? fixedOf(text) : '', better: `In short: we ${t.word} it as planned.` });
}

export function meaningReply(input: string): string {
  const de = isDe(input);
  const given = line(input, 'Learner answer').toLowerCase();
  const learned = (/^Word: .*\(learned meaning: (.*)\)$/m.exec(input)?.[1] ?? '').toLowerCase();
  if (/^Sentence: .*___/m.test(input)) {
    const kind = given.startsWith('syn') ? 'synonym' : given.startsWith('simp') ? 'simpler' : given && (learned.includes(given) || given.includes(learned)) ? 'same' : 'no';
    return JSON.stringify({ kind, why: kind === 'no' ? (de ? 'Das passt hier nicht.' : 'That does not fit here.') : de ? 'Das passt hier, mit kleinem Unterschied.' : 'That fits here, with a small difference.' });
  }
  const ok = !!given && (learned.includes(given) || given.includes(learned));
  return JSON.stringify({
    ok,
    why: ok ? (de ? 'Das trifft den Sinn in diesem Satz.' : 'That captures the meaning in this sentence.') : de ? 'Das trifft den Sinn in diesem Satz nicht ganz.' : 'That does not quite capture the meaning in this sentence.',
  });
}

/**
 * Feste Antwort für `word-know@1` (Großpaket W2): je Karte 3 Wortpartner und 2 Sätze, das Wort genau einmal. Marker im Wort: `zzbad` → die
 * Wortpartner enden mit einer Präposition und der erste Satz enthält das Wort nicht (beides fällt bei der Prüfung weg).
 */
export function wordKnowReply(input: string): string {
  const items = [...input.matchAll(/^- id=([^|]+?) \| word=([^|]+?) \|.*$/gm)].map((m) => {
    const id = (m[1] ?? '').trim();
    const w = (m[2] ?? '').trim().replace(/^to\s+/i, '');
    const bad = /zzbad/i.test(w);
    return {
      id,
      col: bad
        ? [{ p: `${w} with`, de: 'mit', ex: `We [${w} with] them.` }]
        : [
            { p: `clear ${w}`, de: 'klar', ex: `The client asked for a [clear ${w}] before the contract review.` },
            { p: `${w} in detail`, de: 'ausführlich', ex: `Our team lead explained the [${w} in detail] during the kickoff call.` },
            { p: `key ${w}`, de: 'zentral', ex: `The [key ${w}] for the pilot is a stable cloud archive.` },
          ],
      sents: [
        { en: bad ? 'This sentence has none of the words we need.' : `In the client call, Maria mentioned the ${w} twice before the demo.`, de: 'Im Kundentermin erwähnte Maria es zweimal vor der Vorführung.', sit: 'client call' },
        { en: `Our IT lead wants to discuss the ${w} with the vendor next week.`, de: 'Unser IT-Leiter möchte es nächste Woche mit dem Anbieter besprechen.', sit: 'vendor meeting' },
      ],
    };
  });
  return JSON.stringify({ items });
}

export function registerVocabReplies(): void {
  registerCannedReply('word-know', wordKnowReply);
  registerCannedReply('vocab-transfer', transferReply);
  registerCannedReply('vocab-own-sentence', ownSentenceReply);
  registerCannedReply('vocab-meaning', meaningReply);
}
