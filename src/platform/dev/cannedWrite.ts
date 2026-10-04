// Feste Antwort des Entwicklungs-Adapters für write-review@1 (Schreibkorrektur). Sie liest den Text
// aus dem Auftrag und meldet nur Fehler, die wirklich darin vorkommen – so passt sie zu jedem
// Testtext und bleibt trotzdem ein realistisches Beispiel (typische Fehler eines Deutschsprachigen).

type Known = { orig: string; fix: string; cat: string; de: string; en: string };

const KNOWN: readonly Known[] = [
  {
    orig: 'We are working on it since March',
    fix: 'We have been working on it since March',
    cat: 'tenses',
    de: 'Mit „since“ und einer Handlung, die bis jetzt dauert, braucht man das Present Perfect (Continuous), nicht das Present Simple.',
    en: 'With “since” and an action that continues until now you need the Present Perfect (Continuous), not the Present Simple.',
  },
  {
    orig: 'We have an meeting',
    fix: 'We have a meeting',
    cat: 'articles',
    de: 'Vor einem Konsonantenlaut steht „a“, nicht „an“.',
    en: 'Before a consonant sound you use “a”, not “an”.',
  },
  {
    orig: 'I am agree with you',
    fix: 'I agree with you',
    cat: 'vocabulary',
    de: '„agree“ ist selbst das Verb, man sagt nicht „I am agree“.',
    en: '“agree” is the verb itself; you do not say “I am agree”.',
  },
  {
    orig: 'the actual situation',
    fix: 'the current situation',
    cat: 'false-friend',
    de: '„actual“ heißt „tatsächlich“, nicht „aktuell“. Gemeint ist „current“.',
    en: '“actual” means “real”, not “up to date”. You mean “current”.',
  },
  {
    orig: 'since three years',
    fix: 'for three years',
    cat: 'prepositions',
    de: 'Für eine Zeitspanne steht „for“, „since“ nennt einen Startpunkt.',
    en: 'For a length of time you use “for”; “since” names a starting point.',
  },
];

/** Der Text des Lernenden zwischen den Markierungen des Prompts. */
function learnerText(input: string): string {
  const m = /<<<TEXT\n([\s\S]*?)\nTEXT>>>/.exec(input);
  return (m?.[1] ?? '').trim();
}

export function cannedWriteReview(input: string): string {
  const text = learnerText(input);
  const german = /Explanation language: German/.test(input);
  const found = KNOWN.filter((k) => text.includes(k.orig));
  let corrected = text;
  for (const k of found) corrected = corrected.replace(k.orig, k.fix);
  const weak = 'We want to make the project better.';
  return JSON.stringify({
    corrected,
    errors: found.map((k) => ({ orig: k.orig, fix: k.fix, why: german ? k.de : k.en, cat: k.cat })),
    upgrades: text.includes(weak)
      ? [
          {
            weak,
            strong: 'We aim to strengthen the project.',
            why: german ? '„aim to strengthen“ klingt präziser und professioneller als „make better“.' : '“aim to strengthen” sounds more precise and professional than “make better”.',
          },
        ]
      : [],
    level: 'B2+',
    praise: german ? 'Dein Text ist klar aufgebaut, und die Gedanken folgen logisch aufeinander.' : 'Your text is clearly structured and the ideas follow each other logically.',
  });
}

/** Beispieltext für Tests: enthält drei der bekannten Fehler und einen schwachen Satz. */
export const CANNED_WRITE_TEXT =
  'Yesterday we discussed the offer with the client. We are working on it since March. We have an meeting next week. I know this client since three years. We want to make the project better. I think the price is fair and the team is ready for the next step.';
