import { addDays, isoWeek } from '../shared';
import type { IndexItem } from '../schemas';
import { RECENT_TITLES_MAX } from '../prompt';

// Aufbereitung des Monatsindex für den Bildschirm „Lesen“ (docs/umbau/lesen-plan.md §2.1). Rein, nichts davon liest oder schreibt.

export type EntryState = 'open' | 'started' | 'done';

/** Zustand eines Artikels: gelesen = Zustand, kein Knopf (Kap. 2 Nr. 2). */
export function entryState(e: IndexItem): EntryState {
  const st = e.st;
  if (st?.done === true) return 'done';
  if ((st?.sec ?? 0) > 0 || (st?.pos ?? 0) > 0 || (st?.open ?? 0) > 0) return 'started';
  return 'open';
}

/** Artikel eines Lerntags in der Reihenfolge des Index (= Reihenfolge des Erzeugens). */
export const entriesOfDay = (items: readonly IndexItem[], day: string): IndexItem[] => items.filter((e) => e.day === day);

/** Der Artikel, den der Hauptknopf öffnet: zuerst ein angefangener, sonst der erste offene; `null`, wenn alles gelesen ist. */
export function nextToRead(entries: readonly IndexItem[]): IndexItem | null {
  return entries.find((e) => entryState(e) === 'started') ?? entries.find((e) => entryState(e) === 'open') ?? null;
}

/** Wie viele Artikel der Knopf „holen“ erzeugt: die fehlenden bis `perDay`, danach einer mehr; 0, wenn der Tag voll ist. */
export function fetchCount(todayCount: number, perDay: number, dayMax: number): number {
  if (todayCount >= dayMax) return 0;
  const missing = perDay - todayCount;
  return Math.min(missing > 0 ? missing : 1, dayMax - todayCount);
}

export type WeekStats = { articles: number; minutes: number };

/** Woche (Montag bis Sonntag) des Lerntags `today`: gelesene Artikel und gelesene Minuten (Sekunden / 60, gerundet). */
export function weekStats(items: readonly IndexItem[], today: string): WeekStats {
  const week = isoWeek(today);
  let articles = 0;
  let sec = 0;
  for (const e of items) {
    if (!e.day || isoWeek(e.day) !== week) continue;
    if (e.st?.done === true) articles++;
    sec += Math.max(0, e.st?.sec ?? 0);
  }
  return { articles, minutes: Math.round(sec / 60) };
}

/** Titel der letzten Artikel, neueste zuerst (für Neuheits-Bias und Dublettentor), höchstens `RECENT_TITLES_MAX`. */
export function recentTitles(items: readonly IndexItem[]): Array<{ title: string; topic: string | null }> {
  return items
    .filter((e) => typeof e.title === 'string' && e.title.length > 0)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.day ?? '').localeCompare(a.e.day ?? '') || b.i - a.i)
    .slice(0, RECENT_TITLES_MAX)
    .map(({ e }) => ({ title: e.title ?? '', topic: e.topic ?? null }));
}

/** Frühere Artikel (nicht heute), neueste Tage zuerst, innerhalb eines Tages in Leseordnung. */
export function earlierEntries(items: readonly IndexItem[], today: string, max = 20): IndexItem[] {
  return items
    .filter((e) => (e.day ?? '') < today && (e.day ?? '') !== '')
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.day ?? '').localeCompare(a.e.day ?? '') || a.i - b.i)
    .slice(0, max)
    .map(({ e }) => e);
}

/** Nummer des nächsten Artikels an `day` (1 + bereits im Index). */
export const nextNumber = (items: readonly IndexItem[], day: string): number => entriesOfDay(items, day).length + 1;

/** Die zwei Monate, deren Index die Ansicht lädt (aktueller und Vormonat; die Woche kann den Monatswechsel überspannen). */
export function monthsToLoad(today: string): string[] {
  const cur = today.slice(0, 7);
  const prev = addDays(`${cur}-01`, -1).slice(0, 7);
  return [cur, prev];
}
