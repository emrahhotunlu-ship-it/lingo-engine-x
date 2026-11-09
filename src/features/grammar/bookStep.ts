import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { bookChapters, type BookPart, type BookStep } from '../../domain/grammar/book';
import type { MessageKey } from '../../i18n';
import { grammarModuleOn } from '../../modules/grammar/api';
import { bookNextOf, bookView } from './bookStore';
import { topicName } from './topicUi';

// Grammatik-Buch: EIN nächster Schritt für alle Stellen, die ihn nennen oder starten (Heute-Zeile, Lernen, „Weiter im Buch“, Grammatik-Schritt),
// damit Untertitel und Klickziel dasselbe sagen (Kap. 2 Nr. 2; UX-Prüfung 09.11.2026 B1).

const SHORT: Record<BookPart, MessageKey> = { A: 'bkPartShortA', B: 'bkPartShortB', C: 'bkPartShortC', T: 'bkPartShortT' };

/** Nächster Buch-Schritt als Text („Kapitel 2 · Past Simple vs. Present Perfect · Übung B“ bzw. „Kapitel 2 · Klausur“). */
export function bookStepText(step: BookStep, t: (k: MessageKey, v?: Record<string, string | number>) => string, lang: 'de' | 'en', where: 'book' | 'today' = 'book'): string {
  const ch = bookChapters().find((c) => c.id === step.chapter)?.n ?? 1;
  if (where === 'today') return step.kind === 'exam' ? t('bkTodayExam', { ch }) : t('bkTodayPage', { topic: topicName(step.topic, lang), page: t(SHORT[step.part]) });
  return step.kind === 'exam' ? t('bkNextExam', { ch }) : t('bkNextPage', { ch, topic: topicName(step.topic, lang), page: t(SHORT[step.part]) });
}

/** Der Grammatik-Schritt des Tages ist das Buch, sobald Emrah es begonnen hat (und das neue Grammatik-Modul an ist). */
export function bookDutyStep(docs: Readonly<Record<string, Record<string, unknown> | null | undefined>>, nowMs: number): BookStep | null {
  if (!grammarModuleOn(docs['app/profile'] ?? null) || !bookView(docs['app/book']).recent) return null;
  return bookNextOf(docs['app/book'], nowMs);
}

export function useBookDutyStep(): BookStep | null {
  const book = useLive((s) => s.docs['app/book']);
  const profile = useLive((s) => s.docs['app/profile']);
  const now = useClock((s) => s.now);
  return bookDutyStep({ 'app/book': book, 'app/profile': profile }, now);
}
