// Feste Antwort für combo-check@1 (Anwenden, Übung „Eigener Satz“). `zzrule` im Satz → Regel falsch, `zzno` → Satz falsch
// (mit Korrektur), `zzjson` → kein JSON. Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();

export function comboCheckReply(input: string): string {
  const sentence = line(input, 'His sentence');
  if (/\bzzjson\b/i.test(sentence)) return 'Sorry, I cannot give a clean answer for that right now.';
  const en = /^English$/i.test(line(input, 'Explanation language'));
  const ruleOk = !/\bzzrule\b/i.test(sentence);
  const correct = ruleOk && !/\bzzno\b/i.test(sentence);
  const word = line(input, 'Word he had to use');
  return JSON.stringify({
    ruleOk,
    correct,
    fixed: correct ? '' : `We have been working on the ${word} since March.`,
    why: correct ? (en ? 'The rule is applied correctly.' : 'Die Regel ist richtig angewendet.') : en ? 'The rule needs another form here.' : 'Hier braucht die Regel eine andere Form.',
  });
}
