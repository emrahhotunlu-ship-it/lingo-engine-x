import type { TopicKey } from '../schemas';

// Kurskatalog des Reiters „Lesen“ (Paket L8, docs/umbau/lesen-kurse.md §1 und §6). Reine Daten, kein Code der Oberfläche.
// 8 Kurse mit zusammen 78 Lektionen; aktiv freigeschaltet sind nur K1 und K5 (Emrahs Entscheidung vom 14.10.2026), die anderen
// stehen sichtbar als „später“ da. Die Lektionen selbst schreibt die tägliche Routine (docs/umbau/lesen-routine-kurse.md); dieser
// Katalog liefert ihr die Reihenfolge und den Inhalt (`plan`) und der App die Titel für Listen, auch für Lektionen, die noch fehlen.

export const COURSE_IDS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8'] as const;
export type CourseId = (typeof COURSE_IDS)[number];

export type LessonPlan = {
  n: number;
  titleEn: string;
  titleDe: string;
  /** Inhalt der Lektion in einem bis zwei deutschen Sätzen (Auftrag an die Routine). */
  focus: string;
};

export type CourseDef = {
  id: CourseId;
  titleEn: string;
  titleDe: string;
  goalEn: string;
  goalDe: string;
  /** Zahl der Lektionen. Bei aktiven Kursen gleich `plan.length`. */
  lessons: number;
  /** Themenschlüssel der Lektionstexte (für die Prüftore und die Anzeige). */
  topic: Exclude<TopicKey, 'custom'>;
  /** Aktiv freigeschaltet: die Routine schreibt Lektionen, die App zeigt „Heute“. Alle anderen: „später“. */
  active: boolean;
  /** Lektionen nur nach Recherche in einer genauen Quelle: `sources[]` und `asOf` sind Pflicht (Claude Code). */
  officialDocs: boolean;
  /** Lektionsplan (nur aktive Kurse; die anderen bekommen ihn, wenn sie freigeschaltet werden). */
  plan: readonly LessonPlan[];
};

const L = (n: number, titleEn: string, titleDe: string, focus: string): LessonPlan => ({ n, titleEn, titleDe, focus });

const K1_PLAN: readonly LessonPlan[] = [
  L(1, 'What Claude Code Is', 'Was Claude Code ist', 'Was Claude Code ist: ein KI-Assistent für Softwarearbeit, der im Projekt arbeitet (Dateien lesen, Befehle ausführen, Änderungen vorschlagen) und nicht nur chattet. Wo man ihn startet, was er kann, was nicht. Wortschatz: Programmierarbeit beschreiben (work inside a codebase, explore a repository, run commands, stay in control).'),
  L(2, 'Briefing a Task', 'Eine Aufgabe briefen', 'Eine Aufgabe klar übergeben: Ziel, Kontext, Randbedingungen, Abnahmekriterien. Schlechtes und gutes Briefing im Vergleich. Wortschatz: Anforderungen formulieren (define the scope, name the constraints, set acceptance criteria, be specific about).'),
  L(3, 'Project Memory with CLAUDE.md', 'Projektgedächtnis mit CLAUDE.md', 'Die Datei CLAUDE.md: was hineingehört (Befehle, Regeln, Stil), was nicht, warum sie Wiederholung spart. Wortschatz: Regeln und Konventionen (follow a convention, set a guideline, agree on house rules, keep it concise).'),
  L(4, 'Permissions and Safety', 'Rechte und Sicherheit', 'Wer darf was: Rückfragen vor Änderungen, erlaubte und gesperrte Befehle, Vorsicht bei sensiblen Daten. Wortschatz: Risiko und Freigabe (grant access, flag a risk, err on the side of caution, handle sensitive data).'),
  L(5, 'Plan First, Then Build', 'Erst planen, dann bauen', 'Erst einen Plan prüfen lassen, dann umsetzen: warum das Fehler früh abfängt, wie man einen Plan bewertet. Wortschatz: Vorgehen abstimmen (walk through a plan, weigh a trade-off, sign off on, step by step).'),
  L(6, 'Delegating to Subagents', 'Aufgaben an Subagenten abgeben', 'Spezialisierte Hilfsagenten für Teilaufgaben: wann sich Delegieren lohnt, wie man Aufträge zuschneidet, wie man Ergebnisse prüft. Wortschatz: Delegieren (hand off a task, work in parallel, report back, split up the work).'),
  L(7, 'Automating with Hooks', 'Automatisieren mit Hooks', 'Hooks: Befehle, die bei bestimmten Ereignissen automatisch laufen (zum Beispiel vor oder nach einer Aktion). Wofür sie taugen, wo die Grenzen liegen. Wortschatz: Automatisierung (trigger an action, run automatically, enforce a rule, cause a side effect).'),
  L(8, 'Connecting Tools with MCP', 'Werkzeuge anbinden mit MCP', 'MCP als offener Standard, um Claude mit Werkzeugen und Datenquellen zu verbinden (zum Beispiel Tickets, Datenbanken). Nutzen und Vorsicht. Wortschatz: Anbindungen (integrate with a tool, connect to a data source, limit the access scope, plug into).'),
  L(9, 'Tests as a Safety Net', 'Tests als Sicherheitsnetz', 'Warum Tests bei KI-gestützter Arbeit noch wichtiger sind: Änderungen prüfen, Fehler früh finden, Tests zuerst schreiben lassen. Wortschatz: Qualität sichern (guard against regressions, catch bugs early, keep the build green, cover edge cases).'),
  L(10, 'Pitching It Internally', 'Intern überzeugen', 'Abschluss: Nutzen, Risiken und nächste Schritte für Claude Code im Unternehmen in einem 60-Sekunden-Pitch darstellen. Die Anwenden-Aufgabe ist der Pitch mit vier Wendungen aus dem Kurs.'),
];

const K5_PLAN: readonly LessonPlan[] = [
  L(1, 'What Language Models Can Do', 'Was Sprachmodelle können', 'Was große Sprachmodelle gut können (Texte verstehen, zusammenfassen, formulieren, Code schreiben) und wo sie unzuverlässig sind. Wortschatz: Fähigkeiten und Grenzen (play to its strengths, hit a limitation, ground in data, check the output).'),
  L(2, 'Hype Versus Value', 'Hype oder Wert', 'Wie man Versprechen von echtem Nutzen trennt: Fragen an Anbieter, realistische Erwartungen, Belege statt Schlagworte. Wortschatz: Skepsis und Beleg (cut through the hype, back it up with proof, overpromise and underdeliver, set measurable goals).'),
  L(3, 'Choosing a Use Case', 'Einen Anwendungsfall wählen', 'Wie man den ersten Einsatz wählt: häufige, klar umrissene Aufgabe, Daten vorhanden, Fehler verkraftbar, Nutzen messbar. Wortschatz: Priorisieren (low-hanging fruit, narrow scope, business case, pain point).'),
  L(4, 'Data Protection and the EU AI Act', 'Datenschutz und EU-AI-Act', 'Was bei KI und Datenschutz zu beachten ist (DSGVO, Auftragsverarbeitung) und was der EU AI Act grob regelt (Risikoklassen). NUR nach Recherche in der offiziellen Quelle, ohne Rechtsberatung, mit Quelle und Stand. Wortschatz: Daten und Regeln (sign a data processing agreement, rely on a lawful basis, classify as high-risk, comply with).'),
  L(5, 'Build, Buy or Partner', 'Selbst bauen, kaufen oder Partner', 'Die drei Wege im Vergleich: Kosten, Tempo, Kontrolle, Abhängigkeit vom Anbieter. Wortschatz: Entscheidungen (avoid vendor lock-in, build in-house, calculate the total cost of ownership, shorten the time to market).'),
  L(6, 'From Pilot to Production', 'Vom Pilot in den Betrieb', 'Warum viele Piloten stecken bleiben und was für den Betrieb nötig ist: Verantwortliche, Überwachung, Qualitätskriterien, Rollout. Wortschatz: Einführung (roll out, scale up, take ownership, define success criteria).'),
  L(7, 'Measuring ROI', 'Nutzen messen (ROI)', 'Wie man den Nutzen einer KI-Lösung belegt: Ausgangswert, Zeitersparnis, Qualität, Kosten. Ehrlich bleiben bei Zahlen. Wortschatz: Zahlen darstellen (set a baseline, reach the payback period, quantify the time saved, show tangible results).'),
  L(8, 'People and Change', 'Menschen und Wandel', 'Akzeptanz im Team: Sorgen ernst nehmen, Schulung, Rollen, früh einbinden. Wortschatz: Veränderung begleiten (win buy-in, overcome resistance, upskill the team, involve early adopters).'),
  L(9, 'AI in Document Management', 'KI im Dokumentenmanagement', 'Typische Einsatzfelder in Dokumentenmanagement und Archiv: Suche, Klassifizieren, Zusammenfassen, Extraktion. Was dabei zu beachten ist (Rechte, Nachvollziehbarkeit). Wortschatz: Dokumente und Inhalte (retrieve relevant documents, classify incoming mail, extract key data, stay audit-ready, keep a retention policy; tamper-evident statt „audit-proof“).'),
  L(10, 'Selling AI Responsibly', 'KI verantwortungsvoll verkaufen', 'Abschluss: Kunden ehrlich beraten, Grenzen benennen, Erwartungen setzen, Einwände ruhig beantworten. Die Anwenden-Aufgabe ist ein kurzer Kundentext mit vier Wendungen aus dem Kurs.'),
];

export const COURSES: readonly CourseDef[] = [
  { id: 'k1', titleEn: 'Claude Code in 10 Days', titleDe: 'Claude Code in 10 Tagen', goalEn: 'Explain what Claude Code does and how to work with it safely, in plain business English.', goalDe: 'Erklären, was Claude Code kann und wie man sicher damit arbeitet, in verständlichem Business-Englisch.', lessons: 10, topic: 'claudecode', active: true, officialDocs: true, plan: K1_PLAN },
  { id: 'k2', titleEn: 'Claude Code at Work', titleDe: 'Claude Code im Beruf', goalEn: 'Describe real work scenarios with Claude Code, from prototypes to governance.', goalDe: 'Echte Einsatzfälle mit Claude Code beschreiben, vom Prototyp bis zu Regeln und Kontrolle.', lessons: 8, topic: 'claudecode', active: false, officialDocs: true, plan: [] },
  { id: 'k3', titleEn: 'Partnerships and Business Development', titleDe: 'Partnerschaften und Business Development', goalEn: 'Find, approach and structure partnerships in English, from the first email to the quarterly review.', goalDe: 'Partner finden, ansprechen und Vereinbarungen formulieren, von der ersten Mail bis zum Quartalsgespräch.', lessons: 10, topic: 'bizdev', active: false, officialDocs: false, plan: [] },
  { id: 'k4', titleEn: 'SaaS Metrics for Sales', titleDe: 'SaaS-Kennzahlen für den Vertrieb', goalEn: 'Talk about ARR, churn, CAC and pipeline with confidence.', goalDe: 'Über ARR, Churn, CAC und Pipeline sicher sprechen.', lessons: 10, topic: 'saas', active: false, officialDocs: false, plan: [] },
  { id: 'k5', titleEn: 'AI in the Enterprise', titleDe: 'KI im Unternehmen', goalEn: 'Discuss AI projects with customers and colleagues: value, risks, data protection and rollout.', goalDe: 'KI-Projekte mit Kunden und Kollegen besprechen: Nutzen, Risiken, Datenschutz und Einführung.', lessons: 10, topic: 'ai', active: true, officialDocs: false, plan: K5_PLAN },
  { id: 'k6', titleEn: 'Software Architecture for Non-Architects', titleDe: 'Software-Architektur für Nicht-Architekten', goalEn: 'Understand and explain architecture terms, and answer architects\' objections.', goalDe: 'Architekturbegriffe verstehen und erklären und Einwände von Architekten beantworten.', lessons: 10, topic: 'architecture', active: false, officialDocs: false, plan: [] },
  { id: 'k7', titleEn: 'Leading and Negotiating', titleDe: 'Führen und Verhandeln', goalEn: 'Lead without authority and negotiate in English, from anchoring to the closing email.', goalDe: 'Ohne Weisungsrecht führen und auf Englisch verhandeln, vom Anker bis zur Abschlussmail.', lessons: 12, topic: 'management', active: false, officialDocs: false, plan: [] },
  { id: 'k8', titleEn: 'Understanding the Economy', titleDe: 'Wirtschaft verstehen', goalEn: 'Follow and discuss economic news: inflation, interest rates, currencies and quarterly reports.', goalDe: 'Wirtschaftsnachrichten verstehen und besprechen: Inflation, Zinsen, Wechselkurse, Quartalsberichte.', lessons: 8, topic: 'economy', active: false, officialDocs: false, plan: [] },
];

export const ACTIVE_COURSES: readonly CourseDef[] = COURSES.filter((c) => c.active);
export const TOTAL_LESSONS = COURSES.reduce((a, c) => a + c.lessons, 0);

export const isCourseId = (v: unknown): v is CourseId => COURSE_IDS.some((c) => c === v);

export function courseDef(id: string): CourseDef | null {
  return COURSES.find((c) => c.id === id) ?? null;
}

/** Plan einer Lektion (nur aktive Kurse). */
export function lessonPlan(course: string, n: number): LessonPlan | null {
  return courseDef(course)?.plan.find((p) => p.n === n) ?? null;
}

/** Kennung des Fortschritts-Eintrags und der Route: `k1-03`. */
export const lessonKey = (course: string, n: number): string => `${course}-${String(Math.max(1, Math.floor(n))).padStart(2, '0')}`;

/** `k1-03` → `{course:'k1', n:3}` für einen Kurs des Katalogs, sonst null. */
export function parseLessonKey(key: string): { course: CourseId; n: number } | null {
  const m = /^(k[1-9])-(\d{2})$/.exec(key);
  if (!m) return null;
  const course = m[1];
  const n = Number(m[2]);
  const def = isCourseId(course) ? courseDef(course) : null;
  return def && n >= 1 && n <= def.lessons ? { course: def.id, n } : null;
}

/** Ungefähre Dauer einer Lektion in Minuten (Aufbau: 10 bis 12 Minuten). */
export const LESSON_MINUTES = 10;
