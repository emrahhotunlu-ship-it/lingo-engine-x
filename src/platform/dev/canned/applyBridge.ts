// Feste, realistische Antwort für apply-bridge@1 (Anwenden, Brücken-Sätze: ein Wort + ein Muster im eigenen Satz). Besitzer: Paket P4.
// Marker im Satz: `zzword` → Wort falsch (falsche Bedeutung), `zzodd` → Wort fast richtig (Präposition), `zzthin` → zu nah am Kartensatz,
// `zzpat` → Muster falsch, `zzavoid` → Muster vermieden, `zzunsure` → Muster nicht entscheidbar, `zzextra` → ein weiterer Fehler,
// `zzjson` → kein JSON, `zzschema` → beim ersten Aufruf ungültige Form (der Neuversuch ist gültig).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

/** Wörtliche Fundstelle des Zielworts im Satz (auch gebeugt: der Wortanfang reicht), sonst leer. */
function findWord(sentence: string, word: string): string {
  const parts = word.trim().split(/\s+/);
  const head = (parts[0] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!head) return '';
  const stem = head.length > 4 ? head.slice(0, -1) : head;
  const m = new RegExp(`\\b${stem}[a-z]*(?:\\s+[a-z']+){0,${Math.max(0, parts.length - 1)}}`, 'i').exec(sentence);
  return m?.[0] ?? '';
}

export function applyBridgeReply(input: string): string {
  const sentence = line(input, 'Learner sentence');
  if (/\bzzjson\b/i.test(sentence)) return NOT_JSON;
  if (/\bzzschema\b/i.test(sentence) && !input.includes('did not match the required format')) return JSON.stringify({ word: { v: 'ok' } });
  const de = /^German$/i.test(line(input, 'Explanation language'));
  const word = /^Target word: w1: (.+?) \(/m.exec(input)?.[1]?.trim() ?? '';
  const has = (m: string): boolean => new RegExp(`\\b${m}\\b`, 'i').test(sentence);
  const clean = sentence
    .replace(/\bzz[a-z]+\b/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const at = findWord(sentence, word);
  const wv = has('zzword') ? 'wrong' : has('zzodd') ? 'odd' : has('zzthin') ? 'thin' : 'ok';
  const pv = has('zzpat') ? 'wrong' : has('zzavoid') ? 'avoided' : has('zzunsure') ? 'unsure' : 'ok';
  const wWhy: Record<string, readonly [string, string]> = {
    ok: [`„${word}“ passt hier genau in der gelernten Bedeutung.`, `The word fits here in exactly the meaning you learned.`],
    odd: [`Die Bedeutung stimmt, aber nach „${word}“ steht hier eine andere Präposition.`, `The meaning is right, but the word takes a different preposition here.`],
    wrong: [`„${word}“ bedeutet hier etwas anderes, als der Satz sagen soll.`, `The word means something different from what the sentence is meant to say.`],
    thin: ['Der Satz ist fast der Beispielsatz der Karte; er zeigt noch nicht, dass du das Wort selbst benutzen kannst.', 'The sentence is almost the card example; it does not show yet that you can use the word yourself.'],
  };
  const pWhy: Record<string, readonly [string, string]> = {
    ok: ['Die Form ist richtig gebildet und passt zu dem, was der Satz sagt.', 'The form is built correctly and fits what the sentence says.'],
    wrong: ['Hier braucht das Muster eine andere Verbform; im Deutschen steht an dieser Stelle oft das Präsens.', 'The pattern needs a different verb form here; German often uses the present at this point.'],
    avoided: ['Der Satz ist in Ordnung, benutzt aber eine andere Form als das Muster.', 'The sentence is fine but uses a different structure than the pattern.'],
    unsure: ['Es ist nicht klar zu erkennen, ob das hier das verlangte Muster ist.', 'It is not clear whether this is the pattern that was asked for.'],
  };
  const words = sentence.split(/\s+/).filter((w) => !/^zz/i.test(w));
  const patAt = pv === 'ok' || pv === 'wrong' ? words.slice(0, 3).join(' ') : '';
  const last = words[words.length - 1]?.replace(/[.,!?]+$/, '') ?? '';
  const extra = has('zzextra') && wv === 'ok' && pv !== 'wrong' && words.length > 3 && last ? { from: last, to: 'soon', why: de ? 'Dieses Wort passt hier nicht ganz.' : 'This word does not quite fit here.' } : null;
  const needs = wv === 'odd' || wv === 'wrong' || pv === 'wrong' || extra !== null;
  const keepDe = needs ? 'Erst den Bezugspunkt nennen, dann die Form bilden.' : 'Wort und Muster sitzen – genau so weiter.';
  const keepEn = needs ? 'Name the reference point first, then build the form.' : 'The word and the pattern both work here, so keep this up.';
  const pick = (m: Record<string, readonly [string, string]>, k: string): string => (m[k] ?? ['', ''])[de ? 0 : 1];
  return JSON.stringify({
    word: { v: wv, err: wv === 'wrong' ? 'sense' : wv === 'odd' ? 'prep' : null, at, why: pick(wWhy, wv) },
    pat: { v: pv, at: patAt, why: pick(pWhy, pv) },
    extra,
    fixed: needs ? clean : '',
    better: `${clean.replace(/[.!?]+$/, '')}, as agreed.`,
    keep: de ? keepDe : keepEn,
  });
}
