// Feste Antworten für word-prep@1 und word-judge@1 (docs/ki-paket-plan.md §2–§3). Sie lesen nur die
// festen Datenzeilen des Prompts. Sonderwörter in der Antwort (word-judge):
// - `zzok`: Claude lässt die Antwort gelten (richtig),
// - `zzsyn`: passendes Synonym (fast richtig, mit Unterschied),
// - `actual`: falscher Freund (Deutsch-Falle).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const langOf = (input: string): Lang => (/^Explanation language: English/m.test(input) ? 'en' : 'de');

const WHY: Record<Lang, { why: string; syn: string; dis: string }> = {
  de: {
    why: 'Hier passt genau dieses Wort, weil es mit dem Rest des Satzes eine feste Verbindung bildet.',
    syn: 'Passt auch, klingt aber weniger förmlich als das gesuchte Wort.',
    dis: 'Das Wort hat eine andere Bedeutung und passt deshalb nicht in diesen Satz.',
  },
  en: {
    why: 'This exact word fits here because it forms a fixed combination with the rest of the sentence.',
    syn: 'Also fits, but sounds less formal than the word you were looking for.',
    dis: 'This word has a different meaning, so it does not fit this sentence.',
  },
};

const FRAMES = [
  (w: string) => `During the call with the new client, our sales lead used ${w} to describe the plan.`,
  (w: string) => `In yesterday's project meeting, the team discussed ${w} in great detail before lunch.`,
  (w: string) => `At the weekend, my neighbor mentioned ${w} while we were talking about the garden.`,
  (w: string) => `Her email to the board made ${w} the central point of the whole proposal.`,
];

/** Vier Sätze je Karte mit dem Wort in der Grundform (ohne „to "). */
export function wordPrepReply(input: string): string {
  const lang = langOf(input);
  const cards = [...input.matchAll(/^Card (\d+): (.*)$/gm)].map((m) => ({ i: Number(m[1]), w: (m[2] ?? '').replace(/^to\s+/i, '').trim() }));
  return JSON.stringify({
    cards: cards.map(({ i, w }) => ({
      i,
      cwhy: WHY[lang].why,
      items: FRAMES.map((f, k) => ({ en: f(w), gap: w, ok: [], syn: k === 0 ? [{ w: 'zzsyn', why: WHY[lang].syn }] : [], why: WHY[lang].why })),
      dis: ['basic', 'random', 'casual'].map((d) => ({ w: d, why: WHY[lang].dis })),
    })),
  });
}

const JUDGE: Record<Lang, { ok: string; syn: string; wrong: (g: string, x: string) => string; trap: string }> = {
  de: {
    ok: 'Deine Form ist hier ebenso richtig.',
    syn: 'Passt auch, ist aber allgemeiner; das gesuchte Wort ist im Geschäftskontext genauer.',
    wrong: (g, x) => `„${g}“ hat eine andere Bedeutung und passt nicht in diesen Satz; gesucht ist „${x}“.`,
    trap: '„actual“ heißt „tatsächlich“, nicht „aktuell“ – ein falscher Freund.',
  },
  en: {
    ok: 'Your form is just as correct here.',
    syn: 'Also fits, but it is more general; the target word is more precise in business.',
    wrong: (g, x) => `"${g}" has a different meaning and does not fit this sentence; the answer is "${x}".`,
    trap: '"actual" means "real", not "current" – a false friend.',
  },
};

export function wordJudgeReply(input: string): string {
  const lang = langOf(input);
  const given = line(input, 'Learner answer');
  const expected = line(input, 'Expected');
  const target = line(input, 'Target').replace(/\s*\(.*\)$/, '').replace(/^to\s+/i, '');
  const example = `We asked the supplier to ${target} the numbers before the review on Monday.`;
  if (/zzok/i.test(given)) return JSON.stringify({ verdict: 'correct', why: JUDGE[lang].ok, example: '', trap: false });
  if (/zzsyn/i.test(given)) return JSON.stringify({ verdict: 'synonym', why: JUDGE[lang].syn, example, trap: false });
  if (/^actual$/i.test(given)) return JSON.stringify({ verdict: 'wrong', why: JUDGE[lang].trap, example, trap: true });
  return JSON.stringify({ verdict: 'wrong', why: JUDGE[lang].wrong(given, expected), example, trap: false });
}
