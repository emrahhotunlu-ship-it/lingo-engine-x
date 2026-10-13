import { registerCannedReply } from '../fakeSample';

// Feste Antworten des Entwicklungs-Adapters für das Lesen-Modul (read-article@1, read-topics@1), damit die ganze Strecke offline läuft.
// Der Text ist erfunden und besteht alle neun Prüftore von `acceptArticle` (Gegenprobe: tests/unit/read/devReply.test.ts).
// Sonderwörter im eigenen Thema für Fehlerpfade:
// - `zzjson`: gar kein JSON (→ `invalid_json`),
// - `zzbad`: erste Antwort verletzt die Prüftore (zu kurz), der Neuversuch („did not match“) ist gültig.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type S = { e: string; d: string };

const PARAS: S[][] = [
  [
    { e: 'Pricing is often treated as a spreadsheet exercise, but for most software companies it quietly shapes who becomes a customer and how long they stay.', d: 'Preisgestaltung wird oft als Tabellenübung behandelt, doch bei den meisten Softwareunternehmen bestimmt sie leise mit, wer zum Kunden wird und wie lange er bleibt.' },
    { e: 'A pricing page is therefore one of the few places where product, marketing and finance have to agree on a single message.', d: 'Eine Preisseite ist deshalb einer der wenigen Orte, an denen Produkt, Marketing und Finanzen sich auf eine einzige Botschaft einigen müssen.' },
    { e: 'When that message is vague, buyers fill the gap with their own assumptions, and those assumptions are rarely generous.', d: 'Ist diese Botschaft vage, füllen die Käufer die Lücke mit eigenen Annahmen, und diese Annahmen sind selten großzügig.' },
    { e: 'For a growing company, the cost of getting this wrong compounds every quarter that the page stays unchanged.', d: 'Für ein wachsendes Unternehmen summieren sich die Kosten eines Fehlers in jedem Quartal, in dem die Seite unverändert bleibt.' },
  ],
  [
    { e: 'Consider the common choice between charging per seat and charging for usage.', d: 'Man denke an die verbreitete Entscheidung, ob man pro Nutzer oder nach Verbrauch abrechnet.' },
    { e: 'Per-seat pricing is easy to forecast, yet it can punish customers for sharing the product widely, which slows adoption inside a company.', d: 'Die Abrechnung pro Nutzer lässt sich leicht prognostizieren, kann Kunden aber dafür bestrafen, dass sie das Produkt breit einsetzen, was die Verbreitung im Unternehmen bremst.' },
    { e: 'Usage-based pricing tracks the value more closely, although it makes revenue harder to predict and invoices harder to explain.', d: 'Eine nutzungsabhängige Abrechnung bildet den Wert genauer ab, macht den Umsatz jedoch schwerer vorhersagbar und Rechnungen schwerer erklärbar.' },
    { e: 'Neither model is simply better, which is why the right choice depends on how customers actually experience the value.', d: 'Keines der beiden Modelle ist schlicht besser, deshalb hängt die richtige Wahl davon ab, wie Kunden den Wert tatsächlich erleben.' },
  ],
  [
    { e: 'Many teams respond by offering three tiers, because a middle option makes the premium plan look reasonable by comparison.', d: 'Viele Teams reagieren mit drei Stufen, weil eine mittlere Option den Premiumtarif im Vergleich vernünftig aussehen lässt.' },
    { e: 'The risk is that the tiers are designed around internal features instead of around the problems customers want to solve.', d: 'Das Risiko besteht darin, dass die Stufen um interne Funktionen herum entworfen werden statt um die Probleme, die Kunden lösen wollen.' },
    { e: 'A better test is whether a prospect can say in one sentence why they would choose the plan they are looking at.', d: 'Ein besserer Test ist, ob ein Interessent in einem Satz sagen kann, warum er den Tarif wählen würde, den er gerade ansieht.' },
  ],
  [
    { e: 'Churn offers another clue, because customers who leave within the first few months often signed up for the wrong plan.', d: 'Auch die Kündigungsquote liefert einen Hinweis, denn Kunden, die in den ersten Monaten gehen, haben sich oft für den falschen Tarif entschieden.' },
    { e: 'In such cases the roughly one third of accounts that cancel early may not be unhappy with the product at all.', d: 'In solchen Fällen sind vielleicht rund ein Drittel der Konten, die früh kündigen, mit dem Produkt gar nicht unzufrieden.' },
    { e: 'Their problem is that the price promised something the onboarding never delivered.', d: 'Ihr Problem ist, dass der Preis etwas versprach, das die Einführung nie einlöste.' },
    { e: 'Looking at which plan customers chose, and what they did in the first week, shows where expectations and reality part ways.', d: 'Ein Blick darauf, welchen Tarif Kunden gewählt haben und was sie in der ersten Woche taten, zeigt, wo Erwartung und Wirklichkeit auseinandergehen.' },
  ],
  [
    { e: 'Companies that revisit their prices once a year usually learn more than those that never touch them.', d: 'Unternehmen, die ihre Preise einmal im Jahr überprüfen, lernen meist mehr als solche, die sie nie anfassen.' },
    { e: 'Small experiments, such as testing a new tier with 5 percent of new visitors, limit the damage if the idea fails.', d: 'Kleine Experimente, etwa ein neuer Tarif für 5 Prozent der neuen Besucher, begrenzen den Schaden, falls die Idee scheitert.' },
    { e: 'Existing customers deserve extra care, since a sudden increase can feel like a breach of trust even when the new price is fair.', d: 'Bestehende Kunden verdienen besondere Sorgfalt, da sich eine plötzliche Erhöhung wie ein Vertrauensbruch anfühlen kann, selbst wenn der neue Preis fair ist.' },
  ],
  [
    { e: 'In the end, good pricing is less about finding the perfect number than about making the logic behind the number easy to understand.', d: 'Letztlich geht es bei guter Preisgestaltung weniger darum, die perfekte Zahl zu finden, als die Logik hinter der Zahl leicht verständlich zu machen.' },
    { e: 'Teams that can explain their pricing to a new colleague in two minutes tend to explain it well to customers, too.', d: 'Teams, die einem neuen Kollegen ihre Preise in zwei Minuten erklären können, erklären sie in der Regel auch den Kunden gut.' },
    { e: 'That clarity is a competitive advantage that no competitor can copy by simply lowering a price.', d: 'Diese Klarheit ist ein Wettbewerbsvorteil, den kein Konkurrent kopieren kann, indem er einfach einen Preis senkt.' },
  ],
];

const TITLES: Readonly<Record<string, string>> = {
  bizdev: 'How Partnerships Quietly Open New Markets',
  saas: 'Why Pricing Pages Quietly Decide Growth',
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
  const paras = short ? PARAS.slice(0, 1) : PARAS;
  const title = titleFor(key, recentTitles(input));
  return JSON.stringify({
    title,
    topic: key,
    kind: 'explainer',
    level: 'c1',
    asOf: 'general state as of early 2026',
    summary: 'Der Artikel zeigt an einem erfundenen Beispiel, wie Preisseiten das Wachstum leise steuern.',
    paras,
    keyWords: [
      { w: 'tiers', de: 'Stufen', i: [2, 0] },
      { w: 'forecast', de: 'vorhersagen', i: [1, 1] },
      { w: 'churn', de: 'Kundenabwanderung', i: [3, 0] },
      { w: 'onboarding', de: 'Einführung neuer Kunden', i: [3, 2] },
      { w: 'breach of trust', de: 'Vertrauensbruch', i: [4, 2] },
    ],
    check: [
      { q: 'What does the article suggest about customers who cancel early?', o: ['They always dislike the product.', 'They may have chosen a plan that did not fit their needs.', 'They are usually the largest accounts.'], a: 1, why: 'Der Text sagt, dass frühe Kündigungen oft auf den falschen Tarif zurückgehen, nicht auf das Produkt.' },
      { q: 'Why does the author recommend small experiments?', o: ['They limit the damage if an idea fails.', 'They replace the need for customer research.', 'They always raise prices faster.'], a: 0, why: 'Kleine Tests mit wenigen Besuchern halten den Schaden gering, falls die Idee scheitert.' },
    ],
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

export function registerReadReplies(): void {
  registerCannedReply('read-article', readArticleReply);
  registerCannedReply('read-topics', readTopicsReply);
}
