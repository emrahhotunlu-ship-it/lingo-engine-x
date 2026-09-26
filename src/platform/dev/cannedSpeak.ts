// Feste, realistische Antworten des Entwicklungs-Adapters für die Sprech-Vorlagen
// roleplay-turn@1, turn-analysis@1, roleplay-report@1 und scene-gen@1 (Plan §6.4).
// Deterministisch, erkannt an den festen Datenzeilen. Sonderwörter:
// - `zzqx`: erste Antwort verletzt das Schema (der eine Neuversuch ist gültig),
// - `zzjson`: kein JSON,
// - `zzde` im Satz: nicht Englisch (`english:false`).
// Satzmuster der Analyse: „must …“ → Fehler, „I think“ → Kleinigkeit, sonst sauber.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';
const isRetry = (input: string): boolean => input.includes('did not match the required format');

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

function explLang(input: string): Lang {
  const m = /Explanation language[^:\n]*: (German|English)/.exec(input);
  return m?.[1] === 'English' ? 'en' : 'de';
}

const GERMAN_WORDS = /\b(und|nicht|ich|wir|das|ist|der|die)\b/gi;

// ---------------------------------------------------------------- roleplay-turn@1

const FIGURE_LINES = [
  'That sounds reasonable on paper. But what exactly happens to us if we miss the date by a few weeks?',
  'Fine, I hear the risk. Who on your side guarantees that the test plan is ready by the end of April?',
  'Numbers, please. How many invoices would be affected in the first month?',
  'You keep saying "on time". What is your fallback if our ERP upgrade slips again?',
  'All right. If I agree to Q2, I want a weekly status report and a named contact. Can you commit to that?',
  'Good. Let me think about it and come back to you on Friday.',
];

export function roleplayTurnReply(input: string): string {
  const parts = input.split('\n\n');
  const last = parts[parts.length - 1] ?? '';
  if (/zzde/i.test(last) || (last.match(GERMAN_WORDS) ?? []).length >= 2) {
    return 'I am sorry, my German is not good enough for this. Could we continue in English, please?';
  }
  const mine = Math.max(0, parts.length - 2); // Anweisung + Eröffnung abziehen (grobe Schätzung)
  const n = Math.floor(mine / 2);
  return FIGURE_LINES[n % FIGURE_LINES.length] as string;
}

// ---------------------------------------------------------------- turn-analysis@1

type Analysis = Record<string, unknown>;

function analysis(sentence: string, lang: Lang, focus: string[]): Analysis {
  const de = lang === 'de';
  const lower = sentence.toLowerCase();
  const targets = focus.filter((w) => w && lower.includes(w.toLowerCase()));
  if (/zzde/i.test(sentence)) {
    return {
      verdict: 'errors',
      english: false,
      errors: [],
      upgraded: 'We need to keep the Q2 date.',
      changes: [],
      lands: de ? 'Auf Englisch bleibt das Gespräch im Fluss.' : 'Staying in English keeps the conversation flowing.',
      chunks: [{ en: 'keep the Q2 date', de: 'den Q2-Termin halten', def: 'not move the deadline', kind: 'collocation', register: 'neutral', why: de ? 'Kurz und eindeutig.' : 'Short and clear.' }],
      targets: [],
    };
  }
  const must = /\bmust\s+(\w+)/i.exec(sentence);
  if (must) {
    const wrong = must[0];
    return {
      verdict: 'errors',
      english: true,
      errors: [{ wrong, right: `need to ${must[1] ?? ''}`.trim(), cat: 'modals-deduction', why: de ? '„must“ klingt hier wie ein Befehl an den Kunden.' : '"must" sounds like an order to the client here.' }],
      upgraded: 'If we push back the go-live, the exposure is yours, not ours.',
      changes: [{ from: wrong, to: 'push back the go-live', why: de ? 'Klingt nach Planung statt nach Versäumnis.' : 'It sounds like planning, not like a failure.' }],
      lands: de ? 'Die Bedingung mit „if“ macht das Risiko für ihn greifbar.' : 'The "if" clause makes the risk concrete for him.',
      chunks: [{ en: 'push back the go-live', de: 'den Go-live verschieben', def: 'to move the launch to a later date', kind: 'collocation', register: 'neutral', why: de ? 'Übliche Wendung für Terminverschiebungen.' : 'A common way to talk about moving a date.' }],
      targets,
    };
  }
  if (/\bI think\b/i.test(sentence)) {
    const wrong = /\bI think\b/i.exec(sentence)?.[0] ?? 'I think';
    return {
      verdict: 'minor',
      english: true,
      errors: [{ wrong, right: 'In my view', cat: 'register', why: de ? 'Wirkt in Verhandlungen sicherer.' : 'Sounds more confident in a negotiation.' }],
      upgraded: 'In my view, my concern would be the timeline, not the budget.',
      changes: [{ from: wrong, to: 'In my view', why: de ? 'Sicherer im Ton.' : 'More confident in tone.' }],
      lands: de ? 'Du trennst Zeitplan und Budget, das nimmt ihm das Hauptargument.' : 'Separating timeline and budget takes away his main argument.',
      chunks: [{ en: 'my concern would be', de: 'mein Bedenken wäre', def: 'what worries me is', kind: 'frame', register: 'formal', why: de ? 'Höflicher Einstieg in einen Einwand.' : 'A polite way into an objection.' }],
      targets,
    };
  }
  return {
    verdict: 'clean',
    english: true,
    errors: [],
    upgraded: 'That hinges on how quickly your team can sign off on the test plan.',
    changes: [{ from: sentence.split(/\s+/).slice(0, 3).join(' ') || 'sentence', to: 'That hinges on', why: de ? 'Macht die Abhängigkeit sichtbar.' : 'Makes the dependency visible.' }],
    lands: de ? 'Der Ball liegt damit freundlich bei seinem Team.' : 'It puts the ball politely in his team’s court.',
    chunks: [
      { en: 'sign off on', de: 'freigeben', def: 'to approve officially', kind: 'collocation', register: 'neutral', why: de ? 'Standard für Freigaben im Projekt.' : 'The standard phrase for approvals.' },
      { en: 'that hinges on', de: 'das hängt ab von', def: 'depends mainly on', kind: 'frame', register: 'neutral', why: de ? 'Zeigt eine Abhängigkeit ohne Vorwurf.' : 'Shows a dependency without blame.' },
    ],
    targets,
  };
}

export function turnAnalysisReply(input: string): string {
  const sentence = line(input, 'Learner sentence');
  if (/zzjson/i.test(sentence)) return NOT_JSON;
  if (/zzqx/i.test(sentence) && !isRetry(input)) return JSON.stringify({ verdict: 'fine', english: 'yes' });
  const focus = line(input, 'Focus words')
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w && w !== '(none)');
  return JSON.stringify(analysis(sentence, explLang(input), focus));
}

// ---------------------------------------------------------------- roleplay-report@1

export function roleplayReportReply(input: string): string {
  const de = explLang(input) === 'de';
  const mine = [...input.matchAll(/^ {2}T\d+ learner: (.*) \((?:clean|minor|errors|na)[^)]*\)$/gm)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
  const first = mine[0] ?? 'I see your point';
  const second = mine[1] ?? first;
  const quote = first.split(/\s+/).slice(0, 4).join(' ').replace(/[.,!?;:]+$/, '');
  const said = second.split(/\s+/).slice(0, 4).join(' ').replace(/[.,!?;:]+$/, '');
  return JSON.stringify({
    goal: { state: mine.length >= 4 ? 'partly' : 'missed', why: de ? 'Du hast das Risiko benannt, aber noch keinen festen Termin vereinbart.' : 'You named the risk but did not agree on a firm date yet.' },
    summary: de ? 'Du bist ruhig geblieben und hast Gründe genannt. Bei seinem Einwand warst du noch zu vorsichtig.' : 'You stayed calm and gave reasons. You were still too cautious when he objected.',
    strengths: [{ quote, why: de ? 'Klarer Einstieg ohne Vorwurf.' : 'A clear start without blame.' }],
    focus: [
      {
        title: de ? 'Vorschläge abschwächen' : 'Softening proposals',
        said,
        better: 'I would rather we kept the Q2 date.',
        why: de ? '„I would rather we …“ klingt nach Vorschlag statt nach Befehl.' : '"I would rather we …" sounds like a proposal, not an order.',
        cat: 'register',
      },
    ],
    phrases: [{ en: 'that hinges on', de: 'das hängt ab von', def: 'depends mainly on', ex: 'That hinges on how fast your team can test.' }],
  });
}

// ---------------------------------------------------------------- scene-gen@1

export function sceneGenReply(input: string): string {
  const wish = line(input, 'Learner wish');
  if (/zzjson/i.test(wish)) return NOT_JSON;
  if (/zzqx/i.test(wish) && !isRetry(input)) return JSON.stringify({ title: 'x' });
  return JSON.stringify({
    title: 'Securing budget for the archive migration',
    title_de: 'Budget für die Archiv-Migration sichern',
    situation: 'Your finance director wants to postpone the archive migration to next year to save money. The old system runs out of support in December, and you have ten minutes in his office before the budget meeting.',
    situation_de: 'Dein Finanzchef will die Archiv-Migration auf nächstes Jahr schieben, um Geld zu sparen. Der Support für das alte System endet im Dezember, und du hast zehn Minuten in seinem Büro vor der Budgetrunde.',
    goal: 'Keep the migration in this year’s budget.',
    goal_de: 'Die Migration im Budget dieses Jahres halten.',
    persona: { name: 'Thomas Brandt', role: 'Finance Director', org: 'your own company', traits: 'Calm, skeptical of IT projects, wants every risk expressed in money.' },
    stake: 'He needs to cut five percent from next quarter’s spending.',
    objection: 'He believes the old system can run another year without support.',
    opening: 'I have ten minutes. Tell me why this cannot wait until next year.',
    useful: [
      { en: 'the risk is concrete', de: 'das Risiko ist konkret' },
      { en: 'in financial terms', de: 'in Zahlen ausgedrückt' },
      { en: 'if we wait, we pay twice', de: 'wenn wir warten, zahlen wir doppelt' },
      { en: 'I can phase the cost', de: 'ich kann die Kosten staffeln' },
    ],
    level: 'C1',
  });
}
