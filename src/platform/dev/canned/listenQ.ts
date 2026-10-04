// Feste Antwort für listen-q@1 (Anwenden, Stufe 2): je Wort der Wortliste ein kurzer Text mit Frage. `zzjson` in der
// Wortliste → kein JSON; `zzbad` → ein Text ohne Beleg (fällt in der Prüfung weg). Nur Entwicklung und Tests.

const line = (input: string, label: string): string => (new RegExp(`^${label}[^:]*: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();

export function listenQReply(input: string): string {
  const vocab = line(input, 'Learner vocabulary');
  if (/\bzzjson\b/i.test(vocab)) return 'Sorry, I cannot give a clean answer for that right now.';
  const en = /^English$/i.test(line(input, 'Explanation language'));
  const words = vocab.split(';').map((w) => w.trim()).filter((w) => w && w !== '(none)').slice(0, 3);
  const items = words.map((word, i) => ({
    word,
    text: `We talked about the ${word} on the phone today. The team wants to use the ${word} in the next meeting, because the client asked for it. Could you send me the details before Friday afternoon?`,
    question: 'Why does the team want to use it in the next meeting?',
    options: i % 2 ? ['The budget was cut.', 'The client asked for it.', 'The meeting was cancelled.'] : ['The client asked for it.', 'The budget was cut.', 'The meeting was cancelled.'],
    answer: i % 2 ? 1 : 0,
    quote: /\bzzbad\b/i.test(vocab) ? 'this quote is not in the text at all' : 'because the client asked for it',
    why: en ? 'The reason comes right after because in the text.' : 'Der Grund steht im Text direkt nach because.',
  }));
  return JSON.stringify({ items });
}
