import { registerCannedReply } from '../fakeSample';
import { CANNED_ASOF, CANNED_CHECK, CANNED_KEYWORDS, CANNED_PARAS, CANNED_SUMMARY, CANNED_TITLE } from './readArticle';

// Feste Antworten des Entwicklungs-Adapters für das Lesen-Modul (read-article@1, read-topics@1), damit die ganze Strecke offline läuft.
// Der Text ist erfunden und besteht alle neun Prüftore von `acceptArticle` (Gegenprobe: tests/unit/read/devReply.test.ts).
// Sonderwörter im eigenen Thema für Fehlerpfade:
// - `zzjson`: gar kein JSON (→ `invalid_json`),
// - `zzbad`: erste Antwort verletzt die Prüftore (zu kurz), der Neuversuch („did not match“) ist gültig.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

const TITLES: Readonly<Record<string, string>> = {
  bizdev: 'Where Partnerships Open New Markets',
  saas: CANNED_TITLE,
  ai: 'What Language Models Change About Everyday Work',
  economy: 'How Interest Rates Shape the Plans of Young Companies',
  architecture: 'The Trade-offs Behind Event-Driven Systems',
  management: 'Why Clear Feedback Beats Frequent Meetings',
  claudecode: 'A Careful Workflow for Coding with an AI Assistant',
  custom: 'A Closer Look at Your Own Topic',
};

/** Thema aus der Themenzeile des Prompts (`Topic: <Beschreibung>` oder eigenes Thema zwischen <<< und >>>). */
function topicOf(input: string): { key: string; custom: string } {
  if (/^Topic: the reader's own topic/m.test(input)) {
    const m = /<<<\n([\s\S]*?)\n>>>/.exec(input);
    return { key: 'custom', custom: (m?.[1] ?? '').trim() };
  }
  const line = /^Topic: (.*)\.$/m.exec(input)?.[1] ?? '';
  const key = line.startsWith('business development')
    ? 'bizdev'
    : line.startsWith('SaaS')
      ? 'saas'
      : line.startsWith('artificial intelligence')
        ? 'ai'
        : line.startsWith('the economy')
          ? 'economy'
          : line.startsWith('software architecture')
            ? 'architecture'
            : line.startsWith('management')
              ? 'management'
              : line.startsWith('using Claude Code')
                ? 'claudecode'
                : 'custom';
  return { key, custom: '' };
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function recentTitles(input: string): string[] {
  const i = input.indexOf('Recent article titles');
  if (i < 0) return [];
  return input
    .slice(i)
    .split('\n')
    .slice(1)
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

const NAMES: Readonly<Record<string, string>> = {
  bizdev: 'Partnerships',
  saas: 'Pricing',
  ai: 'AI at Work',
  economy: 'Interest Rates',
  architecture: 'Event-Driven Design',
  management: 'Feedback',
  claudecode: 'AI-Assisted Coding',
  custom: 'Your Topic',
};
const ORDINALS = ['Three Practical', 'Four Honest', 'Five Common', 'Six Useful', 'Seven Fresh', 'Eight Careful', 'Nine Simple', 'Ten Quick'];

/** Titel des Themas; steht er schon im Verlauf, kommt ein deutlich anderer („Three Practical Questions About …“), sonst lehnt das Dublettentor ab. */
function titleFor(key: string, recent: readonly string[]): string {
  const base = TITLES[key] ?? 'A Closer Look at Your Own Topic';
  const taken = new Set(recent.map(norm));
  if (!taken.has(norm(base))) return base;
  for (const w of ORDINALS) {
    const t = `${w} Questions About ${NAMES[key] ?? 'Your Topic'}`;
    if (!taken.has(norm(t))) return t;
  }
  return `${base} – Part ${recent.length + 1}`;
}

export function readArticleReply(input: string): string {
  const { key, custom } = topicOf(input);
  if (/\bzzjson\b/i.test(custom)) return 'Sorry, I cannot give a clean answer for that right now.';
  const retry = input.includes('did not match the required format');
  const short = /\bzzbad\b/i.test(custom) && !retry;
  const paras = short ? CANNED_PARAS.slice(0, 1) : CANNED_PARAS;
  const title = titleFor(key, recentTitles(input));
  return JSON.stringify({
    title,
    topic: key,
    kind: 'explainer',
    level: 'c1',
    asOf: CANNED_ASOF,
    summary: CANNED_SUMMARY,
    paras,
    keyWords: CANNED_KEYWORDS,
    check: CANNED_CHECK,
  });
}

export function readTopicsReply(input: string): string {
  const chosen = new Set(
    input
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => norm(l.slice(2))),
  );
  const all = ['Pricing strategy for B2B software', 'Hiring your first engineering manager', 'Cost control for AI features', 'Event-driven architecture trade-offs', 'Why interest rates shape startup funding', 'Pair programming with an AI assistant', 'Reducing churn in the first ninety days'];
  return JSON.stringify({ topics: all.filter((t) => !chosen.has(norm(t))).slice(0, 6) });
}

/**
 * `read-apply@1` (Kurslektion, „Claude prüfen“): die gehobene Fassung ist die Musterlösung aus dem Prompt (sie enthält die Zielwendungen),
 * die korrigierte Fassung der Text des Nutzers. Sonderwort `zzjson` im Text: gar kein JSON (→ `invalid_json`).
 */
export function readApplyReply(input: string): string {
  const text = (/<<<\n([\s\S]*?)\n>>>/.exec(input)?.[1] ?? '').trim();
  if (/\bzzjson\b/i.test(text)) return 'Sorry, I cannot give a clean answer for that right now.';
  const model = (/^Reference solution[^:]*: (.*)$/m.exec(input)?.[1] ?? '').trim() || text;
  const fixed = /[.!?]$/.test(text) ? text : `${text}.`;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  return JSON.stringify({
    verdict: sentences >= 2 && /[.!?]$/.test(text) ? 'right' : 'almost',
    fixed,
    c1: model,
    why: /^Explanation language: English$/m.test(input)
      ? 'Your sentences are easy to understand. The more natural version sounds better because it uses the phrase in the right context.'
      : 'Deine Sätze sind gut verständlich. Die natürlichere Fassung klingt besser, weil sie die Wendung im passenden Zusammenhang benutzt.',
  });
}

export function registerReadReplies(): void {
  registerCannedReply('read-article', readArticleReply);
  registerCannedReply('read-topics', readTopicsReply);
  registerCannedReply('read-apply', readApplyReply);
}
