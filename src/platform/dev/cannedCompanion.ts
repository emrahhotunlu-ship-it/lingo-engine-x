import { registerCannedReply } from './fakeSample';

// Feste Antworten des Entwicklungs-Adapters für Phase 5 (Plan §6.5): companion-chat@1,
// translate@3. Nur Entwicklung und Tests – nie im Build
// (check-platform.mjs sperrt die Marker). Testmarker:
// - Begleiter: `zzlong` (≈ 3.000 Zeichen, Scroll-Test), `zzen` (englische Antwort, Sprachtreue).
//   Enthält die Einleitung die Schutzregel („has NOT checked"), endet die Antwort mit
//   `[no-solution]`, sonst mit `[solution-ok]` – so prüft der E2E-Test das Schwärzen.
// - Übersetzer: `zzsame` (erste Antwort mit unlesbarem Register → Schemafehler → Neuversuch).

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const isRetry = (input: string): boolean => input.includes('did not match the required format');
const langOf = (name: string): Lang => (/^English$/i.test(name) ? 'en' : 'de');

// ---------------------------------------------------------------- companion-chat@1

function lastUserTurn(raw: unknown, flat: string): string {
  if (Array.isArray(raw)) {
    const turns = raw as Array<{ role?: unknown; content?: unknown }>;
    const last = turns[turns.length - 1];
    if (last && typeof last.content === 'string') return last.content;
  }
  return flat;
}

function leadOf(raw: unknown, flat: string): string {
  if (Array.isArray(raw)) {
    const first = (raw as Array<{ content?: unknown }>)[0];
    if (first && typeof first.content === 'string') return first.content;
  }
  return flat;
}

const LONG_DE =
  'Hier ist eine ausführliche Erklärung mit vielen Beispielen, damit du den Unterschied wirklich sicher beherrschst. ';

export function companionChatReply(flat: string, raw?: unknown): string {
  const lead = leadOf(raw, flat);
  const msg = lastUserTurn(raw, flat);
  const guarded = lead.includes('has NOT checked');
  const end = guarded ? '[no-solution]' : '[solution-ok]';
  const english = /Write your explanations in English/.test(lead);
  if (/zzen/i.test(msg) && !english) {
    return `Sure! **Leverage** means using something you already have to get an advantage. For example: "We can leverage our network to find new clients." It is very common in business English. ${end}`;
  }
  if (/zzlong/i.test(msg)) {
    const body = Array.from({ length: 28 }, (_, i) => `${i + 1}. ${LONG_DE}`).join('\n\n');
    return `### Ausführlich\n\n${body}\n\n${end}`;
  }
  if (english) {
    return `**Leverage** means using what you already have to gain an advantage.\n\n- "We can **leverage** our network to enter new markets."\n- "She leveraged her experience in the negotiation."\n\nIt usually takes a direct object. ${end}`;
  }
  return `**leverage** heißt hier *nutzen* oder *einsetzen*, um einen Vorteil zu erzielen.\n\n- „We can **leverage** our network to enter new markets.“\n- „She leveraged her experience in the negotiation.“\n\nIm Business-Englisch steht meist ein direktes Objekt dahinter. ${end}`;
}

// ---------------------------------------------------------------- translate@3

function blockText(input: string): string {
  const m = /<<<\n([\s\S]*?)\n>>>/.exec(input);
  return (m?.[1] ?? '').trim();
}

export function translateReply(input: string): string {
  const text = blockText(input);
  const fromLine = line(input, 'From');
  const from: Lang = /detect/i.test(fromLine) ? (/[äöüß]|\b(der|die|das|und|nicht|ist)\b/i.test(text) ? 'de' : 'en') : langOf(fromLine);
  const register = line(input, 'Register') || 'neutral';
  const notesLang = langOf(line(input, 'Notes language'));
  const same = /zzsame/i.test(text) && !isRetry(input);
  const note = (de: string, en: string) => (notesLang === 'de' ? de : en);
  // Kurze Eingabe (Wort/Wendung): mit Beispielsatz für „In den Vokabeltrainer“.
  if (text.split(/\s+/).length <= 4 && !/budget|zzsame/i.test(text)) {
    const de = from === 'de';
    return JSON.stringify({
      source: from,
      translation: de ? 'to keep up' : 'mithalten',
      register,
      alternatives: [],
      notes: [],
      terms: [],
      example: 'It is hard to keep up with all the new emails.',
    });
  }
  if (from === 'de') {
    const main = /budget/i.test(text) ? 'We need to approve the budget.' : 'Here is the translation of your text in natural American English.';
    return JSON.stringify({
      source: 'de',
      translation: main,
      register: same ? 'zz-unknown' : register,
      alternatives: [
        { text: 'The budget needs to be signed off.', register: 'formal', note: note('passiv, typisch für E-Mails an die Geschäftsführung', 'passive, typical for emails to management') },
        { text: 'We have to okay the budget.', register: 'casual', note: note('locker, nur unter Kollegen', 'casual, only among colleagues') },
      ],
      notes: [note('„freigeben“ heißt hier approve oder sign off, nicht release.', '"freigeben" means approve or sign off here, not release.')],
      terms: [{ en: 'to sign off on', de: 'freigeben' }],
    });
  }
  return JSON.stringify({
    source: 'en',
    translation: 'Das ist die Übersetzung deines Textes auf Deutsch.',
    register: same ? 'zz-unknown' : register,
    alternatives: [
      { text: 'Hier ist die Übersetzung Ihres Textes.', register: 'formal', note: note('mit Sie, für Kunden', 'formal address, for customers') },
      { text: 'Hier ist dein Text auf Deutsch.', register: 'casual', note: note('locker', 'casual') },
    ],
    notes: [],
    terms: [],
  });
}

// ---------------------------------------------------------------- memory-extract@1 (B5)
// Zwei feste Fakten in der verlangten Sprache; Testmarker `zznone` im Gespräch → leere Liste.

function memoryExtractReply(input: string): string {
  if (/zznone/i.test(input)) return JSON.stringify({ facts: [] });
  const en = /sentence in English/.test(input);
  const facts = en
    ? ['Has a trade fair in London on October 14.', 'Presents the Q3 numbers to the CFO next week.']
    : ['Hat am 14. Oktober eine Messe in London.', 'Präsentiert nächste Woche die Q3-Zahlen vor dem CFO.'];
  return JSON.stringify({ facts });
}

// ---------------------------------------------------------------- compare@1 (B1)

function compareReply(input: string): string {
  const en = /Write all fields in English/.test(input);
  return JSON.stringify(
    en
      ? {
          summary: 'You speak more fluently than four weeks ago and your email is clearer. You used more of your own phrases and made fewer typical German-English mistakes. Your sentences are still quite short when you speak.',
          better: ['More words per minute in the 45-second task', 'You used "push back the deadline" naturally'],
          next: 'Link your ideas with "that said" or "on top of that" when you speak.',
          level: 'Both versions are B2, the new one is closer to C1 in range.',
        }
      : {
          summary: 'Du sprichst flüssiger als vor vier Wochen und deine Mail ist klarer aufgebaut. Du hast mehr eigene Wendungen benutzt und weniger typische Deutsch-Fallen gemacht. Beim Sprechen sind deine Sätze noch recht kurz.',
          better: ['Mehr Wörter pro Minute im 45-Sekunden-Durchgang', 'Du hast "push back the deadline" frei benutzt'],
          next: 'Verbinde beim Sprechen deine Gedanken mit "that said" oder "on top of that".',
          level: 'Beide Fassungen liegen bei B2, die neue ist im Wortschatz näher an C1.',
        },
  );
}

export function registerCompanionReplies(): void {
  registerCannedReply('compare', compareReply);
  registerCannedReply('companion-chat', companionChatReply);
  registerCannedReply('memory-extract', memoryExtractReply);
  registerCannedReply('translate', translateReply);
}
