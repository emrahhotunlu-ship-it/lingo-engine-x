// Erzeugt seed/sample-data.json: erfundene, aber realistische Daten exakt in der Struktur
// der bestehenden Datenbank (docs/datenstruktur.json, docs/altapp-analyse.md). Nur für
// Entwicklung und Tests – keine echten persönlichen Daten (Kap. 3.3).
// Deterministisch: fester Zufallsstartwert, fester Stichtag. Aufruf: npm run seed

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const course = read('src/content/legacy/course.json');
const grammar = read('src/content/legacy/grammar.json');
const vocabLegacy = read('src/content/legacy/vocab.json');
const feedSeed = read('src/content/legacy/feed-seed.json');
const passages = read('src/content/legacy/passages.json');
const scenes = read('src/content/legacy/scenes.json');
const context = read('src/content/legacy/context.json');

// ------------------------------------------------------------------ Hilfen
let state = 20260920;
const rnd = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const DAY = 86_400_000;
const ANCHOR = '2026-09-20';
const pad = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/** Zeitpunkt (ms) an einem Tag, Ortszeit Europe/Berlin (Sommerzeit, UTC+2). */
const at = (key, hour, min = 0) => Date.parse(`${key}T${pad(hour)}:${pad(min)}:00+02:00`);
const slug = (w) =>
  String(w).toLowerCase().replace(/^to\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const docs = {};
const put = (path, doc) => {
  docs[path] = doc;
};

// ------------------------------------------------------------------ Aktivität (42 Tage)
// Laufende Serie: 12 Tage (Stichtag inklusive). Davor eine Lücke, davor 13 Tage, davor sporadisch.
const activeDays = new Set();
for (let i = 0; i <= 11; i++) activeDays.add(addDays(ANCHOR, -i));
for (let i = 13; i <= 25; i++) activeDays.add(addDays(ANCHOR, -i));
for (const i of [28, 29, 31, 34, 35, 38, 41]) activeDays.add(addDays(ANCHOR, -i));
// Randfall der alten Regel: ein Tag nur mit XP, ohne gezählte Antworten (zählt trotzdem).
const XP_ONLY_DAY = addDays(ANCHOR, -5);

const days = {};
const xpDays = {};
const minutes = {};
const act = {};
const history = [];
let answersTotal = 0;
let xpTotal = 0;
for (let i = 41; i >= 0; i--) {
  const k = addDays(ANCHOR, -i);
  if (!activeDays.has(k)) continue;
  const answers = int(24, 92);
  const xp = answers * 3 + int(0, 40);
  if (k !== XP_ONLY_DAY) days[k] = answers;
  xpDays[k] = xp;
  minutes[k] = int(14, 38);
  answersTotal += answers;
  xpTotal += xp;
  const a = { review: 1, cards: int(12, 40), gram: int(4, 16) };
  if (rnd() < 0.5) a.listen = int(1, 2);
  if (rnd() < 0.35) a.write = 1;
  if (rnd() < 0.3) a.sprint = 1;
  if (rnd() < 0.2) a['speak~'] = 1;
  act[k] = a;
  history.push({
    d: k,
    o: round(0.55 + rnd() * 0.25),
    vo: round(0.5 + rnd() * 0.3),
    gr: round(0.45 + rnd() * 0.3),
    co: round(0.4 + rnd() * 0.3),
    re: round(0.5 + rnd() * 0.3),
    li: round(0.45 + rnd() * 0.3),
    wr: round(0.4 + rnd() * 0.3),
    fl: round(0.4 + rnd() * 0.3),
    vs: int(3200, 3600),
  });
}

// ------------------------------------------------------------------ Kurs: l01–l06 abgeschlossen
const doneLessons = ['l01', 'l02', 'l03', 'l04', 'l05', 'l06'];
const courseDone = {};
doneLessons.forEach((id, i) => {
  const d = addDays(ANCHOR, -30 + i * 5);
  const n = int(14, 18);
  courseDone[id] = { d, n, ok: n - int(1, 5), t: at(d, 19, 20 + i) };
});
put('app/course', { done: courseDone, res: {} });

// ------------------------------------------------------------------ Vokabeln (~150, alle Stufen)
const BUSINESS = [
  ['procurement', 'noun', 'Beschaffung, Einkauf', 'the process of buying goods or services for a company', 'Procurement wants three quotes before they sign anything.', 'B2'],
  ['stakeholder', 'noun', 'Beteiligte(r), Interessengruppe', 'a person with an interest in a project or business', 'We need every stakeholder on board before the rollout.', 'B2'],
  ['rollout', 'noun', 'Einführung, Ausrollen', 'the introduction of a new product or system', 'The rollout to all branches will take six weeks.', 'B2'],
  ['compliance', 'noun', 'Regelkonformität', 'following rules, laws or standards', 'Compliance is the main reason they are looking at our archive.', 'B2'],
  ['audit trail', 'noun', 'Prüfpfad', 'a record that shows who did what and when', 'Every change to the invoice is visible in the audit trail.', 'C1'],
  ['retention period', 'noun', 'Aufbewahrungsfrist', 'the time documents must be kept', 'The legal retention period for invoices is ten years.', 'C1'],
  ['e-invoicing', 'noun', 'elektronische Rechnungsstellung', 'sending and receiving invoices in a structured digital format', 'E-invoicing becomes mandatory for B2B sales in Germany.', 'B2'],
  ['mandate', 'noun', 'Pflicht, Vorgabe', 'an official requirement', 'The new mandate takes effect in January.', 'C1'],
  ['bottleneck', 'noun', 'Engpass', 'a point where a process slows down', 'Manual approval is the real bottleneck in their invoice process.', 'B2'],
  ['scalable', 'adj', 'skalierbar', 'able to grow without losing performance', 'The cloud version is fully scalable.', 'B2'],
  ['onboarding', 'noun', 'Einarbeitung, Einführung', 'the process of helping new customers or staff start', 'Onboarding usually takes two workshops.', 'B2'],
  ['churn', 'noun', 'Kundenabwanderung', 'the rate at which customers stop using a service', 'Our churn dropped after we improved support.', 'C1'],
  ['upsell', 'verb', 'zusätzlich verkaufen', 'to sell a customer a more expensive or additional product', 'We can upsell the workflow module next year.', 'B2'],
  ['pain point', 'noun', 'Schwachstelle, Problem', 'a problem that bothers customers', 'Searching for contracts is their biggest pain point.', 'B2'],
  ['proof of concept', 'noun', 'Machbarkeitsnachweis', 'a small test that shows an idea works', 'They agreed to a four-week proof of concept.', 'C1'],
  ['service level agreement', 'noun', 'Dienstgütevereinbarung (SLA)', 'a contract that defines the level of service', 'The service level agreement guarantees 99.9 percent uptime.', 'C1'],
  ['deliverable', 'noun', 'Arbeitsergebnis, Liefergegenstand', 'something that must be delivered in a project', 'The first deliverable is the migration plan.', 'B2'],
  ['escalate', 'verb', 'eskalieren, weiterleiten', 'to pass a problem to a higher level', 'If the import fails again, please escalate it to me.', 'B2'],
  ['workaround', 'noun', 'Behelfslösung', 'a temporary way around a problem', 'We found a workaround until the patch is ready.', 'B2'],
  ['legacy system', 'noun', 'Altsystem', 'an old system that is still in use', 'Their legacy system cannot export metadata.', 'B2'],
  ['data sovereignty', 'noun', 'Datenhoheit', 'control over where and how data is stored', 'Data sovereignty is why they insist on a German data center.', 'C1'],
  ['interoperability', 'noun', 'Interoperabilität', 'the ability of systems to work together', 'Interoperability with their ERP is non-negotiable.', 'C1'],
  ['throughput', 'noun', 'Durchsatz', 'the amount processed in a given time', 'OCR throughput doubled with the new servers.', 'C1'],
  ['outsource', 'verb', 'auslagern', 'to pay another company to do work', 'They want to outsource scanning completely.', 'B2'],
  ['phase out', 'verb', 'auslaufen lassen', 'to stop using something gradually', 'We will phase out the on-premise version by 2028.', 'B2'],
  ['streamline', 'verb', 'straffen, vereinfachen', 'to make a process simpler and more efficient', 'The new workflow streamlines invoice approval.', 'B2'],
  ['pitch', 'verb', 'präsentieren, anpreisen', 'to present an idea or product to persuade someone', 'I will pitch the cloud offer to their board.', 'B2'],
  ['follow up on', 'verb', 'nachfassen, weiterverfolgen', 'to take further action on something', "I'll follow up on the open questions by Friday.", 'B2'],
  ['sign off on', 'verb', 'abzeichnen, freigeben', 'to give official approval', 'The CFO has to sign off on the budget.', 'B2'],
  ['push back', 'verb', 'sich widersetzen; verschieben', 'to resist a request or to delay something', 'Their IT pushed back on the tight timeline.', 'C1'],
  ['rule out', 'verb', 'ausschließen', 'to decide something is not possible', 'We can rule out a data loss.', 'B2'],
  ['iron out', 'verb', 'ausbügeln, klären', 'to solve small problems', "Let's iron out the details in a quick call.", 'C1'],
  ['touch base', 'verb', 'sich kurz abstimmen', 'to briefly contact someone', "Let's touch base again next week.", 'B2'],
  ['headcount', 'noun', 'Personalstärke', 'the number of employees', 'Their headcount has doubled since 2022.', 'B2'],
  ['revenue stream', 'noun', 'Einnahmequelle', 'a source of income for a business', 'Subscriptions are now our main revenue stream.', 'C1'],
  ['margin', 'noun', 'Marge', 'the difference between cost and price', 'The discount would eat into our margin.', 'B2'],
  ['forecast', 'noun', 'Prognose', 'a statement about what will happen', 'The sales forecast for Q4 looks solid.', 'B2'],
  ['lead time', 'noun', 'Vorlaufzeit', 'the time between ordering and delivery', 'The lead time for a new tenant is two days.', 'B2'],
  ['tender', 'noun', 'Ausschreibung', 'a formal offer to do work for a price', 'The city published a tender for a new DMS.', 'C1'],
  ['purchase order', 'noun', 'Bestellung', 'an official document that orders goods', 'The invoice must match the purchase order.', 'B2'],
  ['metadata', 'noun', 'Metadaten', 'data that describes other data', 'Good metadata makes every document easy to find.', 'B2'],
  ['access rights', 'noun', 'Zugriffsrechte', 'permissions that control who can see what', 'HR documents need strict access rights.', 'B2'],
  ['downtime', 'noun', 'Ausfallzeit', 'time when a system is not working', 'The migration will cause no downtime.', 'B2'],
  ['vendor lock-in', 'noun', 'Anbieterabhängigkeit', 'being unable to switch supplier easily', 'Open interfaces protect you from vendor lock-in.', 'C1'],
  ['total cost of ownership', 'noun', 'Gesamtbetriebskosten', 'all costs of a product over its lifetime', 'The total cost of ownership is lower in the cloud.', 'C1'],
  ['value proposition', 'noun', 'Nutzenversprechen', 'the reason a customer should buy', 'Our value proposition is compliance without complexity.', 'C1'],
  ['use case', 'noun', 'Anwendungsfall', 'a specific situation in which a product is used', 'Contract management is their first use case.', 'B2'],
  ['go-live', 'noun', 'Produktivstart', 'the moment a system starts being used for real', 'Go-live is planned for the first of March.', 'B2'],
  ['milestone', 'noun', 'Meilenstein', 'an important stage in a project', 'We reached the second milestone ahead of schedule.', 'B2'],
  ['backlog', 'noun', 'Rückstand, Auftragsbestand', 'a list of work not yet done', 'The feature is at the top of the backlog.', 'B2'],
  ['trade-off', 'noun', 'Zielkonflikt, Abwägung', 'a balance between two things you cannot have at once', 'There is a trade-off between speed and cost.', 'C1'],
  ['concession', 'noun', 'Zugeständnis', 'something you give up in a negotiation', 'We made one concession on the payment terms.', 'C1'],
  ['counteroffer', 'noun', 'Gegenangebot', 'an offer made in response to another offer', 'Their counteroffer was fifteen percent lower.', 'B2'],
  ['comply with', 'verb', 'einhalten, entsprechen', 'to act according to a rule', 'The archive complies with GoBD requirements.', 'B2'],
  ['subsidiary', 'noun', 'Tochtergesellschaft', 'a company owned by another company', 'Their Austrian subsidiary will follow in spring.', 'B2'],
  ['incumbent', 'noun', 'etablierter Anbieter', 'the company that currently holds the contract', 'The incumbent has been their supplier for twelve years.', 'C1'],
  ['reluctant', 'adj', 'zögerlich, widerwillig', 'not wanting to do something', 'Their works council is reluctant to change.', 'B2'],
  ['feasible', 'adj', 'machbar', 'possible to do', 'A go-live in January is feasible.', 'B2'],
  ['tangible', 'adj', 'greifbar, konkret', 'real and able to be shown', 'The customer wants tangible results after three months.', 'C1'],
  ['viable', 'adj', 'tragfähig, realisierbar', 'able to work successfully', 'A hybrid setup is a viable option.', 'C1'],
  ['thorough', 'adj', 'gründlich', 'careful and complete', 'Their security review was very thorough.', 'B2'],
  ['leverage', 'verb', 'nutzen, ausschöpfen', 'to use something to maximum advantage', 'We can leverage their existing Microsoft licenses.', 'C1'],
  ['roadmap', 'noun', 'Fahrplan, Roadmap', 'a plan showing future steps', 'The AI features are on next year’s roadmap.', 'B2'],
  ['consensus', 'noun', 'Einigkeit, Konsens', 'general agreement', 'There is consensus on the budget, not on the timing.', 'C1'],
];

const LESSON_EXAMPLES = {
  l01: 'Could we go through the agenda before we start?',
  l02: 'We have finished the first milestone so far.',
  l03: 'Sorry to interrupt, but could you clarify that?',
  l04: 'She said the figures would be ready on Monday.',
  l05: 'If you sign this month, the setup is free.',
  l06: 'I understand your concern about the price.',
};

const vocab = [];
const addCard = (base) => vocab.push(base);

// 30 der 40 Startvokabeln haben schon ein Dokument (die übrigen 10 bleiben Voreinstellung).
vocabLegacy.seedVocab.slice(0, 30).forEach((s, i) => {
  addCard({ id: slug(s.w), word: s.w, pos: s.p, de: s.de, def: s.def, ex: s.ex, level: s.l ?? 'B2', src: 'seed', order: i, col: vocabLegacy.colloc[slug(s.w)] ?? [] });
});
// Lektionswörter l01–l06 (je 6).
for (const id of doneLessons) {
  const l = course.lessons.find((x) => x.id === id);
  for (const [en, de] of l.words) {
    addCard({ id: slug(en), word: en, pos: '', de, def: '', ex: LESSON_EXAMPLES[id], level: l.level, src: 'lesson', lesson: id, order: 900, col: [] });
  }
}
// Berufswortschatz aus Rollenspiel, Lesen, Lehrerstunde.
BUSINESS.forEach(([word, pos, de, def, ex, level], i) => {
  addCard({ id: slug(word), word, pos, de, def, ex, level, src: pick(['job', 'read', 'preply', 'claude', 'lookup']), order: 900, col: [] });
  if (i === 5) vocab[vocab.length - 1].lesson = '';
});
// Vom Tagesauftrag geschriebene Wörter (src "coach").
[
  ['to tighten', 'verb', 'straffen, verschärfen', 'to make stricter or firmer', 'The ECB may tighten policy again.', 'B2'],
  ['headwind', 'noun', 'Gegenwind', 'a factor that makes progress harder', 'High rates are a headwind for investment.', 'C1'],
  ['turmoil', 'noun', 'Aufruhr, Unruhe', 'a state of great confusion', 'The markets stayed calm despite the turmoil.', 'C1'],
  ['sluggish', 'adj', 'schleppend, träge', 'slower than normal', 'Growth in Europe remains sluggish.', 'C1'],
  ['to rebound', 'verb', 'sich erholen', 'to recover after a fall', 'Orders rebounded in the second quarter.', 'B2'],
  ['outlook', 'noun', 'Ausblick', 'what is expected to happen', 'The outlook for cloud spending is strong.', 'B2'],
  ['to curb', 'verb', 'eindämmen', 'to control or limit something', 'The rules aim to curb invoice fraud.', 'C1'],
  ['landmark', 'adj', 'wegweisend', 'very important as a turning point', 'ViDA is a landmark reform for VAT.', 'C1'],
  ['to roll out', 'verb', 'einführen, ausrollen', 'to introduce gradually', 'Belgium will roll out e-invoicing first.', 'B2'],
  ['threshold', 'noun', 'Schwellenwert', 'the level at which something starts', 'Small invoices below the threshold are exempt.', 'C1'],
].forEach(([word, pos, de, def, ex, level]) => addCard({ id: slug(word), word, pos, de, def, ex, level, src: 'coach', order: 900, col: [] }));

// Lernstände über alle Stufen verteilen, konsistent zur alten Planung (S in Tagen, due/last in ms).
const now = at(ANCHOR, 20, 0);
const MODES = ['recog', 'cloze', 'listen', 'type', 'produce', 'colloc'];
vocab.forEach((c, i) => {
  const stage = i % 11 === 0 ? 0 : [1, 2, 3, 4, 5, 1, 2, 3, 4, 2][i % 10];
  const isNew = stage === 0;
  const reps = isNew ? 0 : stage * 2 + int(0, 3);
  const lapses = isNew ? 0 : i % 17 === 3 ? 4 + int(0, 1) : int(0, 2);
  const S = isNew ? 0 : round(Math.min(365, 0.6 * 2.1 ** stage * (0.8 + rnd() * 0.5)), 3);
  const D = isNew ? 5 : round(Math.min(10, Math.max(1, 5 + lapses * 0.8 - stage * 0.4 + (rnd() - 0.5))), 2);
  const last = isNew ? 0 : now - int(0, Math.max(1, Math.round(S))) * DAY - int(1, 8) * 3_600_000;
  // Ein Teil ist heute fällig, ein Teil überfällig, der Rest liegt in der Zukunft.
  const due = isNew ? 0 : i % 5 === 0 ? now - int(0, 3) * DAY : last + Math.round(S * DAY * (0.9 + rnd() * 0.2));
  const modes = {};
  const hist = [];
  if (!isNew) {
    for (const m of MODES.slice(0, Math.min(6, stage + 1))) modes[m] = { c: int(1, 6), w: int(0, 3) };
    for (let h = 0; h < Math.min(12, reps); h++) hist.push({ t: last - (reps - h) * DAY * 2, m: pick(MODES), g: pick([1, 3, 3, 3, 4, 2]) });
  }
  Object.assign(c, {
    added: addDays(ANCHOR, -int(3, 40)),
    intro: isNew ? '' : addDays(ANCHOR, -int(5, 40)),
    state: isNew ? 'new' : stage >= 3 ? 'review' : 'learning',
    stage,
    S,
    D,
    due,
    last,
    reps,
    lapses,
    modes,
    hist,
    pa: isNew ? 0 : round(0.4 + stage * 0.1 + rnd() * 0.05),
    ac: isNew ? 0 : round(0.2 + stage * 0.1 + rnd() * 0.05),
    co: isNew ? 0 : round(0.15 + stage * 0.08),
  });
  if (i === 42 || i === 97) c.hidden = true;
  put(`vocab/${c.id}`, Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)));
});

// ------------------------------------------------------------------ Grammatik (12 von 16 Themen mit Dokument)
const WRONG = {
  'pres-simple-cont': ['Look! It snows outside.', 'Look! It is snowing outside.'],
  'past-simple-perfect': ['I have finished the report yesterday.', 'I finished the report yesterday.'],
  'pres-perf-cont': ['We work on the migration since March.', 'We have been working on the migration since March.'],
  'past-perfect': ['When I arrived, the meeting already started.', 'When I arrived, the meeting had already started.'],
  'future-forms': ['I will meet the CFO tomorrow at ten, it is in my calendar.', "I'm meeting the CFO tomorrow at ten."],
  'future-perf-cont': ['By Friday we will finish the import.', 'By Friday we will have finished the import.'],
  'used-to': ['I am used to work late on Fridays.', 'I am used to working late on Fridays.'],
  conditionals: ['If they would sign today, we could start in May.', 'If they signed today, we could start in May.'],
  'mixed-cond': ['If we had tested earlier, we would not be in this situation now if we tested.', 'If we had tested earlier, we would not be in this situation now.'],
  passive: ['The invoices are check by the system.', 'The invoices are checked by the system.'],
  reported: ['She said that she will send the figures.', 'She said that she would send the figures.'],
  relative: ['The customer which called is from Munich.', 'The customer who called is from Munich.'],
  'modals-deduction': ['He must be in the office, his car is not here.', "He can't be in the office, his car isn't here."],
  'gerund-inf': ['We look forward to hear from you.', 'We look forward to hearing from you.'],
  prepositions: ['Revenue increased with 12 percent.', 'Revenue increased by 12 percent.'],
  articles: ['The cloud is future of our company.', 'The cloud is the future of our company.'],
};
const withDocs = grammar.topics.slice(0, 12);
withDocs.forEach((tp, i) => {
  const n = int(8, 60);
  const c = Math.round(n * (0.45 + rnd() * 0.45));
  const p = round(Math.min(0.95, Math.max(0.12, tp.p0 + (rnd() - 0.45) * 0.4)), 3);
  const [given, ans] = WRONG[tp.id];
  const q = ans.replace(/\b(is snowing|finished|have been working|had already started|'m meeting|will have finished|working late|signed|would not be|checked|would send|who|can't be|hearing|by|the future)\b/, '___');
  const errors = [];
  const errCount = int(1, 3);
  for (let e = 0; e < errCount; e++) {
    const t = now - int(1, 20) * DAY;
    const box = int(0, 2);
    errors.push({ q, given, ans, t, src: pick(['g', 'lesson', 'preply']), box, due: t + [1, 3, 9][box] * DAY, done: false, last: t });
  }
  const hist = [];
  for (let h = 0; h < int(4, 12); h++) hist.push({ d: addDays(ANCHOR, -h * 3), p: round(Math.max(0.05, p - h * 0.01 + (rnd() - 0.5) * 0.05), 3) });
  hist.reverse();
  put(`grammar/${tp.id}`, {
    id: tp.id,
    p,
    anchor: round(p - 0.01, 3),
    anchorD: ANCHOR,
    n,
    c,
    due: now + (i % 3) * DAY,
    last: now - int(0, 6) * DAY,
    recent: Array.from({ length: 10 }, () => (rnd() < p ? 1 : 0)),
    seen: grammar.seedGrammar.filter((g) => g.topic === tp.id).map((g) => `${g.type}:${g.prompt.slice(0, 24)}`),
    seenText: grammar.seedGrammar.filter((g) => g.topic === tp.id).map((g) => g.prompt).slice(0, 3),
    hist,
    errors,
  });
});

// ------------------------------------------------------------------ Lektionsinhalte l01–l06
const DIALOGUES = {
  l01: [
    ['Anna', "Good morning, everyone. Let's get started – we have a lot on the agenda.", 'Guten Morgen zusammen. Lasst uns anfangen – wir haben viel auf der Tagesordnung.'],
    ['Ben', "Sure. I've been working on the import scripts since Monday.", 'Klar. Ich arbeite seit Montag an den Import-Skripten.'],
    ['Anna', 'Great. How far have you got?', 'Super. Wie weit bist du gekommen?'],
    ['Ben', "Most of the metadata has been mapped. We're testing the rest today.", 'Die meisten Metadaten sind zugeordnet. Den Rest testen wir heute.'],
  ],
  l02: [
    ['Chris', 'Last week we finished the security review.', 'Letzte Woche haben wir die Sicherheitsprüfung abgeschlossen.'],
    ['Dana', 'And what have you done since then?', 'Und was habt ihr seitdem gemacht?'],
    ['Chris', "So far we've migrated two of five departments.", 'Bisher haben wir zwei von fünf Abteilungen migriert.'],
    ['Dana', 'That sounds like we are on track.', 'Das klingt, als wären wir im Plan.'],
  ],
  l03: [
    ['Eva', 'Sorry to interrupt, but could I ask a quick question?', 'Entschuldigung, dass ich unterbreche, aber darf ich kurz etwas fragen?'],
    ['Frank', 'Of course, go ahead.', 'Natürlich, bitte.'],
    ['Eva', 'The delay must be related to the ERP upgrade, right?', 'Die Verzögerung hängt bestimmt mit dem ERP-Upgrade zusammen, oder?'],
    ['Frank', "It might be. We can't be sure until IT confirms it.", 'Könnte sein. Sicher sind wir erst, wenn die IT es bestätigt.'],
  ],
  l04: [
    ['Gina', 'What did the client say about the proposal?', 'Was hat der Kunde zum Angebot gesagt?'],
    ['Hugo', 'She said they would need approval from the board.', 'Sie sagte, sie bräuchten die Zustimmung des Vorstands.'],
    ['Gina', 'Did she mention a date?', 'Hat sie ein Datum genannt?'],
    ['Hugo', 'She promised to let us know by Friday.', 'Sie hat versprochen, uns bis Freitag Bescheid zu geben.'],
  ],
  l05: [
    ['Ivo', 'Why is the cloud plan more expensive per user?', 'Warum ist der Cloud-Tarif pro Nutzer teurer?'],
    ['Julia', 'If you choose the cloud plan, updates and hosting are included.', 'Wenn Sie den Cloud-Tarif wählen, sind Updates und Hosting enthalten.'],
    ['Ivo', 'And if we sign a three-year contract?', 'Und wenn wir einen Dreijahresvertrag unterschreiben?'],
    ['Julia', 'Then we would reduce the price by ten percent.', 'Dann würden wir den Preis um zehn Prozent senken.'],
  ],
  l06: [
    ['Karl', "Honestly, we're worried about moving our archive to the cloud.", 'Ehrlich gesagt machen wir uns Sorgen, unser Archiv in die Cloud zu verlagern.'],
    ['Lena', 'I understand. Would it help to start with a proof of concept?', 'Verstehe. Würde es helfen, mit einem Machbarkeitsnachweis zu beginnen?'],
    ['Karl', 'Maybe. We would like to avoid risking any downtime.', 'Vielleicht. Wir möchten jede Ausfallzeit vermeiden.'],
    ['Lena', 'Then I suggest running both systems in parallel for a month.', 'Dann schlage ich vor, beide Systeme einen Monat parallel laufen zu lassen.'],
  ],
};
for (const id of doneLessons) {
  const l = course.lessons.find((x) => x.id === id);
  const items = grammar.seedGrammar.filter((g) => g.topic === l.grammar).slice(0, 3);
  put(`lesson/${id}`, {
    v: 1,
    t: courseDone[id].t - 3_600_000,
    words: l.words.map(([en, de]) => ({ en, de, def: '', ex: LESSON_EXAMPLES[id], pos: '' })),
    dialogue: { title: l.en, lines: DIALOGUES[id].map(([sp, en, de]) => ({ sp, en, de })) },
    questions: [
      { q: 'What is the main topic of the conversation?', options: [l.en, 'A holiday plan', 'A job interview'], answer: l.en, lang: 'en' },
      { q: 'How does the conversation end?', options: ['With a clear next step', 'With an argument', 'Without a result'], answer: 'With a clear next step', lang: 'en' },
    ],
    tasks: items.map((g) => ({
      type: g.type,
      topic: g.topic,
      prompt: g.prompt,
      options: g.options ?? [],
      answer: g.answer,
      accepted: [],
      hint: '',
      expl: g.expl,
      expl_en: g.expl_en,
      src: 'lesson',
    })),
    output: { de: l.cando_de, en: l.cando_en, mustUse: l.words.slice(0, 3).map(([en]) => en) },
  });
}

// ------------------------------------------------------------------ Tagesprotokolle (letzte 14 aktiven Tage)
const vocabIds = vocab.filter((c) => c.stage > 0).map((c) => c.id);
const logDays = [...activeDays].sort().slice(-14);
for (const k of logDays) {
  const entries = [];
  const count = int(18, 36);
  let t = at(k, 19, 5);
  for (let e = 0; e < count; e++) {
    t += int(8, 60) * 1000;
    const ok = rnd() < 0.78;
    if (rnd() < 0.7) {
      const id = pick(vocabIds);
      const card = docs[`vocab/${id}`];
      entries.push({ t, ok, lang: 'de', k: 'v', id, m: pick(MODES), given: ok ? card.word : card.word.slice(0, -1), ans: card.word });
    } else {
      const g = pick(grammar.seedGrammar);
      entries.push({ t, ok, lang: 'de', k: 'g', topic: g.topic, type: g.type, q: g.prompt, given: ok ? g.answer : 'is', ans: g.answer, src: 'pool' });
    }
  }
  put(`log/${k}`, { date: k, entries });
}

// ------------------------------------------------------------------ Tagesauftrag: daily/* und feed/*
for (const offset of [0, -1, -2]) {
  const k = addDays(ANCHOR, offset);
  const items = grammar.seedGrammar.slice(10 + offset * -3, 13 + offset * -3);
  put(`daily/${k}`, {
    grammarItems: items.map((g) => ({
      type: g.type === 'mc' ? 'gap' : g.type,
      topic: g.topic,
      prompt: g.prompt,
      answer: g.answer,
      accepted: [g.answer],
      hint_de: 'Achte auf den Zeitbezug.',
      explanation_de: g.expl,
      explanation_en: g.expl_en,
    })),
    newWords: vocab
      .filter((c) => c.src === 'coach')
      .slice((-offset) * 3, (-offset) * 3 + 3)
      .map((c) => ({ word: c.word, pos: c.pos, de: c.de, def: c.def, ex: c.ex, level: c.level })),
  });
}
feedSeed.slice(0, 2).forEach((f, i) => {
  const k = addDays(ANCHOR, -i);
  put(`feed/${k}`, { id: k, d: k, items: f.items });
});

// ------------------------------------------------------------------ Profil
const discItems = feedSeed.flatMap((f) => f.items).slice(0, 3);
const disc = {};
discItems.forEach((it, i) => {
  const d = addDays(ANCHOR, -i);
  disc[it.id] = i < 2 ? { prep: d, take: d, check: d, use: d } : { prep: d, take: d };
});
put('app/profile', {
  name: 'Alex Muster',
  created: addDays(ANCHOR, -270),
  ctx: context.defaultCtx,
  ctxChecked: true,
  lang: 'de',
  voice: '',
  rate: 1,
  goal: 150,
  newPerDay: 5,
  xp: xpTotal + 18_400,
  answers: answersTotal + 6_100,
  vAnswers: Math.round((answersTotal + 6_100) * 0.7),
  gAnswers: Math.round((answersTotal + 6_100) * 0.3),
  autoNext: true,
  seen15: true,
  tour11: true,
  days,
  xpDays,
  minutes,
  act,
  canDo: Object.fromEntries(doneLessons.map((id) => [id, courseDone[id].d])),
  disc,
  ema: { all: 0.71, recog: 0.82, write: 0.58, listen: 0.66, colloc: 0.61 },
  n: { recog: 912, write: 344, listen: 201, colloc: 187 },
  mix: { work: 41, life: 19 },
  gen: { lp: addDays(ANCHOR, -1), wp: addDays(ANCHOR, -2), ar: addDays(ANCHOR, -3) },
  theme: { m: 'dark', p: 'ocean' },
  plan: {
    d: ANCHOR,
    ids: ['gram', 'listen', 'write'],
    why: [[['whyWeakest']], [['agoDaysN', 3]], [['whyThin']]],
  },
  history,
  feed: Array.from({ length: 8 }, (_, i) => ({
    t: now - i * DAY,
    act: pick(['lesson', 'cards', 'gram', 'listen']),
    d: { lv: round(0.01 * i, 2), vp: int(0, 12), gr: round(0.02 * i, 2), xp: int(60, 240) },
  })),
  listen: passages.listen.slice(0, 3).map((p, i) => ({ id: p.id, level: p.level, n: 5, ok: int(3, 5), plays: int(1, 3), rate: 1, t: now - (i + 1) * 2 * DAY })),
  sprints: Array.from({ length: 4 }, (_, i) => {
    const n = int(18, 30);
    return { t: now - (i + 1) * 3 * DAY, n, ok: n - int(2, 6), score: int(900, 1800), combo: int(4, 11), avgMs: int(2100, 3400) };
  }),
  vtests: [
    {
      t: now - 21 * DAY,
      d: addDays(ANCHOR, -21),
      passive: 6_400,
      pLo: 5_900,
      pHi: 6_900,
      active: 3_900,
      aLo: 3_500,
      aHi: 4_300,
      bands: [1, 1, 0.97, 0.93, 0.86, 0.74, 0.6, 0.45, 0.31, 0.2],
      fa: 1,
      faN: 12,
      pseudoN: 12,
      mAcc: 0.81,
      aAcc: 0.64,
      dur: 540_000,
    },
  ],
});

// ------------------------------------------------------------------ Einschätzung (Hülle wie in der alten App)
put('app/assess', {
  d: addDays(ANCHOR, -2),
  t: now - 2 * DAY,
  lang: 'de',
  answers: 1_870,
  writings: 6,
  data: {
    level: 'Solides B2 mit klaren Ansätzen zu B2+: Du kommunizierst im Beruf flüssig, aber einige Zeitformen sitzen unter Druck noch nicht.',
    cefr: 'B2',
    levelWhy: 'In Meetings und E-Mails triffst du den Ton, doch bei Present Perfect Continuous und Mixed Conditionals häufen sich Fehler, sobald es schnell gehen muss.',
    trend: 'up',
    trendWhy: 'Die Trefferquote bei Grammatik ist in den letzten 14 Tagen von 62 auf 71 Prozent gestiegen.',
    today: 'Heute 10 Minuten Mixed Conditionals mit Beispielen aus deiner letzten Verhandlung.',
    c1gap: ['Hypothesen und Bedauern sicher formulieren', 'Kritik diplomatisch weitergeben', 'Präzisere Kollokationen im Vertrieb'],
    strengths: [
      { title: 'Fachwortschatz DMS/ECM', why: 'Du nutzt Begriffe wie audit trail und retention period korrekt und im passenden Zusammenhang.' },
      { title: 'Struktur in E-Mails', why: 'Deine Texte haben einen klaren Aufbau mit Anliegen, Begründung und nächstem Schritt.' },
    ],
    blockers: [
      { title: 'Mixed Conditionals', why: 'Auf C1 erwartet man, Vergangenheit und Gegenwart in einem Satz sauber zu verknüpfen.', fix: 'If we had tested earlier, we would not be in this situation now.', action: 'grammar:mixed-cond' },
      { title: 'Present Perfect Continuous', why: 'Laufende Entwicklungen klingen mit Present Simple unnatürlich.', fix: 'We have been working on the migration since March.', action: 'grammar:pres-perf-cont' },
    ],
    dims: [
      { id: 'grammar', level: 'B2', confidence: 'good', why: 'Viele Antworten in 12 Themen.' },
      { id: 'vocabulary', level: 'B2+', confidence: 'good', why: 'Breiter Berufswortschatz.' },
      { id: 'reading', level: 'B2+', confidence: 'fair', why: 'Einige Artikel mit guten Ergebnissen.' },
      { id: 'listening', level: 'B2', confidence: 'fair', why: 'Drei Hörtexte ausgewertet.' },
      { id: 'writing', level: 'B2', confidence: 'fair', why: 'Sechs bewertete Texte.' },
      { id: 'speaking', level: 'B1+', confidence: 'thin', why: 'Bisher nur zwei Rollenspiele.' },
    ],
    focus: { title: 'Mixed Conditionals', why: 'Größter Abstand zu C1 bei hoher Relevanz für Verhandlungen.', action: 'grammar:mixed-cond', days: 3 },
  },
});

// ------------------------------------------------------------------ Fehler-Radar, Pool, Chat, Lookup
put('app/radar', {
  events: Array.from({ length: 30 }, (_, i) => {
    const tp = pick(withDocs);
    const [g, a] = WRONG[tp.id];
    return { c: tp.id, s: pick(['g', 'w', 'v', 's', 'r']), t: now - i * 11 * 3_600_000, q: a.slice(0, 160), g: g.slice(0, 100), a: a.slice(0, 100) };
  }),
});
put('app/pool', {
  t: now - 3 * 3_600_000,
  items: grammar.seedGrammar.slice(20, 30).map((g) => ({
    topic: g.topic,
    type: g.type,
    prompt: g.prompt,
    options: g.type === 'mc' ? g.options : null,
    answer: g.answer,
    accepted: [],
    hint_de: '',
    explanation_de: g.expl,
    explanation_en: g.expl_en,
    src: 'seed',
  })),
});
put('app/chat', {
  msgs: [
    { role: 'user', content: 'Was ist der Unterschied zwischen "sign off" und "sign off on"?' },
    { role: 'assistant', content: '„sign off on something" heißt etwas offiziell freigeben: The CFO signed off on the budget. „sign off" allein heißt sich verabschieden oder eine Nachricht beenden.' },
    { role: 'user', content: 'Und wie sage ich höflich, dass ein Termin nicht klappt?' },
    { role: 'assistant', content: 'Zum Beispiel: "I\'m afraid Thursday doesn\'t work for me – would Friday morning suit you instead?"' },
  ],
});
put('app/lookup', {
  items: Object.fromEntries(
    BUSINESS.slice(0, 10).map(([word, pos, de, def, , level]) => [
      word.toLowerCase(),
      { lemma: word, pos, de, def, note_de: 'Häufig im Vertrieb.', level },
    ]),
  ),
});

// ------------------------------------------------------------------ Texte, Wendungen, Szenen, Preply, Lesen, Hören
const w1 = now - 6 * DAY;
put(`writing/w${w1}`, {
  date: addDays(ANCHOR, -6),
  promptId: passages.write[0].id,
  title: passages.write[0].title_en,
  task: passages.write[0].task_en,
  genre: passages.write[0].genre,
  text: 'Dear Mr Walker, unfortunately the delivery of the scanners is delayed by two weeks, because our supplier has problems with the chips. We are very sorry for this. We propose to start the training earlier so that your team is ready when the devices arrive.',
  words: 49,
  rev: 1,
  res: {
    cefr: 'B2',
    scores: { task: 4, grammar: 3, vocabulary: 4, coherence: 4, register: 3 },
    summary: 'Klar und höflich; einige Formulierungen wirken noch direkt übersetzt.',
    strengths: ['Klare Struktur', 'Lösungsvorschlag'],
    errors: [{ orig: 'has problems with the chips', fix: 'is facing chip shortages', cat: 'vocabulary', sev: 'minor', why: 'Idiomatischer im Geschäftsenglisch.' }],
    improved: 'Dear Mr Walker, I am afraid the scanners will arrive two weeks later than planned because our supplier is facing chip shortages.',
    upgrades: ['I am afraid …', 'is facing … shortages'],
    phrases: ['so that your team is ready'],
    next: 'Übe höfliche Einleitungen für schlechte Nachrichten.',
  },
});
put(`writing/lesson-l05-${now - 10 * DAY}`, {
  id: `lesson-l05-${now - 10 * DAY}`,
  lesson: 'l05',
  text: 'If you choose the cloud plan, you will save costs for servers and updates.',
  words: 14,
  t: now - 10 * DAY,
  res: {
    cefr: 'B2',
    scores: { task: 4, grammar: 4, vocabulary: 3, coherence: 4, register: 4 },
    errors: [{ wrong: 'save costs for servers', right: 'save on server costs', why: 'Feste Verbindung: save on something.', cat: 'collocation', sev: 'minor' }],
  },
});
[
  ['push back the go-live', 'den Produktivstart verschieben', 'collocation', 'neutral'],
  ['I take your point, but …', 'Ich verstehe Ihren Einwand, aber …', 'frame', 'formal'],
  ['non-negotiable', 'nicht verhandelbar', 'phrase', 'formal'],
  ['to meet a deadline', 'eine Frist einhalten', 'collocation', 'neutral'],
].forEach(([en, de, kind, register], i) => {
  const id = `c-${slug(en)}`;
  const created = now - (i + 2) * DAY;
  put(`chunk/${id}`, {
    id,
    en,
    de,
    kind,
    register,
    why: 'Klingt in Verhandlungen souveräner als die wörtliche Übersetzung.',
    src: { scene: scenes[0].id, sceneTitle: scenes[0].title, utterance: 'We must delay the start.', upgraded: `We need to ${en}.`, turn: i + 1, ts: created },
    level: 'C1',
    created,
    also: [],
    state: i === 0 ? 'new' : 'learning',
    S: i === 0 ? 0 : 1.2 + i,
    D: 5,
    due: i === 0 ? 0 : now + i * DAY,
    last: i === 0 ? 0 : created,
    reps: i === 0 ? 0 : 1,
    lapses: 0,
    stage: i === 0 ? 0 : 1,
  });
});
scenes.slice(0, 2).forEach((s, i) => put(`scene/${s.id}`, { ...s, ts: now - (i + 3) * DAY, done: i === 0, band: i === 0 ? 'B2+' : undefined }));
put(`preply/pp${now - 4 * DAY}`, {
  t: now - 4 * DAY,
  lang: 'de',
  ctx: { kind: 'lesson', title: 'Handling objections', topic: 'gerund-inf' },
  title: 'Einwände souverän behandeln',
  minutes: 50,
  goal_en: 'Handle three typical objections to a cloud DMS without hesitation.',
  goal_x: 'Drei typische Einwände gegen ein Cloud-DMS ohne Zögern entkräften.',
  warmup: ['What was the hardest question a customer asked you this month?'],
  talk: ['Describe a deal you lost and why.', 'How do you explain data sovereignty to a CFO?'],
  say: ['I understand your concern, and that is exactly why …', 'Would it help if we started with a pilot?'],
  watch: [{ mistake: 'We look forward to hear from you.', fix: 'We look forward to hearing from you.', note: 'look forward to + -ing' }],
  message: "Hi! In our next lesson I'd like to practice handling objections in sales calls. Could we do a short role-play?",
  done: true,
  doneT: now - 3 * DAY,
});
put(`preply/pi${now - 3 * DAY}`, {
  kind: 'import',
  raw: 'Teacher: "depend of" -> depend on. HW: write 5 sentences with "would rather".',
  title: 'Stunde am ' + addDays(ANCHOR, -3),
  summary: 'Präpositionen nach Verben und Vorlieben ausdrücken.',
  corrections: [{ wrong: 'It depends of the budget.', right: 'It depends on the budget.', topic: 'prepositions', why: 'depend + on' }],
  tasks: ['Write five sentences with "would rather".'],
  words: [{ en: 'would rather', de: 'lieber wollen', ex: "I'd rather start with a pilot." }],
  homework: ['Five sentences with "would rather"'],
  applied: true,
  appliedT: now - 3 * DAY + 600_000,
});
const art = passages.articles[0];
const artId = `ai${now - 5 * DAY}`;
put(`articles/${artId}`, { ...art, id: artId, src: 'ai' });
put(`reading/r${now - 5 * DAY}`, {
  t: now - 5 * DAY,
  date: addDays(ANCHOR, -5),
  articleId: artId,
  title: art.title,
  level: art.level,
  summary: 'Keeping customers is cheaper than winning new ones, so SaaS companies invest in onboarding and support.',
  words: 18,
  readSec: 312,
  res: {
    score: 4,
    covered: ['cost of acquisition', 'role of onboarding'],
    misunderstood: [],
    language: { cefr: 'B2', errors: [], tips: ['Use "retain" instead of "keep" for a more formal tone.'] },
    feedback: 'Gute Zusammenfassung, die Kernaussage ist klar getroffen.',
    model_summary: 'Retaining customers costs less than acquiring new ones, which is why SaaS firms focus on onboarding and support.',
  },
});
const lp = passages.listen[1];
put(`lpool/ai${now - 7 * DAY}`, { ...lp, src: 'ai' });
const wp = passages.write[1];
put(`wprompt/${addDays(ANCHOR, -2)}`, { p: { ...wp, src: 'seed' } });

// ------------------------------------------------------------------ Ausgabe
const sorted = Object.fromEntries(Object.keys(docs).sort().map((k) => [k, docs[k]]));
mkdirSync(new URL('../seed/', import.meta.url), { recursive: true });
writeFileSync(new URL('../seed/sample-data.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
const count = (prefix) => Object.keys(sorted).filter((k) => k.startsWith(prefix)).length;
console.log(
  `seed/sample-data.json: ${Object.keys(sorted).length} Dokumente · vocab ${count('vocab/')} · grammar ${count('grammar/')} · lesson ${count('lesson/')} · log ${count('log/')} · daily ${count('daily/')} · feed ${count('feed/')}`,
);
