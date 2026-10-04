import { dayKeyNoon, isoWeek, addDays } from '../domain/date';
import { formatDate, translate, type Lang } from '../i18n';
import { viewOf } from './cardView';
import { topicById } from './grammar';
import { grammarSolid, stubborn } from './derived';
import type { CardRec, InLog, PreplyRec, ProfileDoc } from './types';

// Preply-Brücke (ohne KI): Vor der Stunde sammelt die App, was Emrah dem Lehrer zeigen kann, und baut
// daraus einen fertigen Text zum Kopieren. Nach der Stunde werden Dauer und neue Wörter eingetragen.

export const STUBBORN_WORDS = 8;
export const WEAK_TOPICS = 3;
export const READ_DAYS = 7;

export type PrepWord = { word: string; de: string; en: string };
export type PrepData = {
  today: string;
  level: string;
  words: PrepWord[];
  /** Schwächste Grammatikthemen: Namen deutsch und englisch. */
  grammar: Array<{ de: string; en: string }>;
  /** Titel der Beiträge, die Emrah in den letzten sieben Tagen gelesen oder gesehen hat. */
  read: Array<{ title: string; source: string }>;
};

/** Die Daten für den Vorbereitungstext, alles aus dem lokalen Stand. */
export function prepData(input: {
  cards: ReadonlyMap<string, CardRec>;
  profile: ProfileDoc | null;
  grammar: Readonly<Record<string, { p: number }>> | undefined;
  inlog: InLog;
  today: string;
}): PrepData {
  const { cards, profile, inlog, today } = input;
  const words: PrepWord[] = [];
  for (const id of stubborn(cards, STUBBORN_WORDS)) {
    const v = viewOf(id, cards.get(id));
    if (v) words.push({ word: v.word, de: v.de.split(', ').slice(0, 2).join(', '), en: v.en });
  }
  const grammar = grammarSolid(profile, input.grammar)
    .weakest.slice(0, WEAK_TOPICS)
    .map((id) => {
      const t = topicById(id);
      return { de: t?.name ?? id, en: t?.name_en ?? id };
    });
  const from = addDays(today, -(READ_DAYS - 1));
  const read = Object.values(inlog.it)
    .filter((e) => e.d >= from && e.d <= today)
    .sort((a, b) => b.d.localeCompare(a.d))
    .map((e) => ({ title: e.t, source: e.s ?? '' }));
  return { today, level: profile?.placement?.level ?? profile?.imported?.level ?? '–', words, grammar, read };
}

const list = (items: string[]): string => items.map((i) => `• ${i}`).join('\n');

/** Ein Brief in einer Sprache (Oberflächensprache oder Englisch für den Lehrer). */
function letter(d: PrepData, lang: Lang): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const date = formatDate(lang, dayKeyNoon(d.today));
  const parts = [t('brgTxtTitle', { date }), t('brgTxtHello'), t('brgTxtLevel', { level: d.level })];
  if (d.words.length) {
    // Dem Lehrer die englische Erklärung zeigen (er spricht vielleicht kein Deutsch), sonst die deutsche Bedeutung.
    parts.push(`${t('brgTxtWords')}\n${list(d.words.map((w) => `${w.word} – ${lang === 'en' ? w.en || w.de : w.de}`))}`);
  }
  if (d.grammar.length) parts.push(`${t('brgTxtGrammar')}\n${list(d.grammar.map((g) => (lang === 'en' ? g.en : g.de)))}`);
  if (d.read.length) parts.push(`${t('brgTxtRead')}\n${list(d.read.map((r) => (r.source ? `${r.title} (${r.source})` : r.title)))}`);
  parts.push(t('brgTxtAsk'));
  return parts.join('\n\n');
}

/**
 * Der fertige Text zum Kopieren: in der Oberflächensprache, bei Deutsch dazu der englische Teil
 * für den Lehrer. In der englischen Oberfläche genügt der englische Brief.
 */
export function prepText(d: PrepData, lang: Lang): string {
  if (lang === 'en') return letter(d, 'en');
  return `${letter(d, lang)}\n\n— ${translate(lang, 'brgTxtTeacherHead')} —\n\n${letter(d, 'en')}`;
}

// --- Stunden ---

export const LESSON_MINUTES = [30, 45, 60] as const;
export const MAX_LESSON_MINUTES = 240;

/** Eindeutiger Schlüssel einer Stunde in coach/preply. */
export const lessonKey = (day: string, nowMs: number): string => `${day}-${nowMs.toString(36)}`;

/** Gültige Dauer in Minuten (5 bis 240) oder `null`. */
export function validMinutes(v: string | number): number | null {
  const n = typeof v === 'number' ? v : Number(v.trim());
  return Number.isInteger(n) && n >= 5 && n <= MAX_LESSON_MINUTES ? n : null;
}

/** Stunden der laufenden Woche (Montag bis Sonntag): Anzahl und Minuten. */
export function weekStats(preply: Readonly<Record<string, PreplyRec>>, today: string): { count: number; min: number } {
  const week = isoWeek(today);
  let count = 0;
  let min = 0;
  for (const p of Object.values(preply)) {
    if (isoWeek(p.d) !== week) continue;
    count++;
    min += p.min;
  }
  return { count, min };
}

/** Die letzten Stunden, neueste zuerst. */
export const recentLessons = (preply: Readonly<Record<string, PreplyRec>>, n = 5): Array<[string, PreplyRec]> =>
  Object.entries(preply)
    .sort((a, b) => b[1].d.localeCompare(a[1].d) || b[0].localeCompare(a[0]))
    .slice(0, n);
