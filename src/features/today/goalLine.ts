import { nextGoal, type WeekGoal } from '../../domain/metrics';
import type { MessageKey } from '../../i18n';

// Zeilen der Abschlusskarte (Lernplattform 3.0 P27, Motivation §4.1, §4.5, §4.8, §4.10). Rein: nur Zahlen und Schlüssel, die Texte setzt die Oberfläche.
// Eine Quelle je Zahl: das Ziel kommt aus dem eingefrorenen `u.nx` (Kennung) und `nextGoal` (Zahlen live), die Woche aus `weekGoal`.

export type TextRef = { key: 'moGoalFest' | 'moGoalFestWeeks' | 'moGoalCheck'; params: Record<string, number> };

/**
 * Das eine „nächste Ziel“ der Karte. Die Kennung stammt aus dem Plan von heute (`u.nx`, beim Anlegen eingefroren); `have` ist der Stand jetzt.
 * Ohne Kennung (Plan von früher), bei einem Ziel ohne Zahlen im Gerät (Kapitel) oder wenn es heute erreicht wurde (dann steht der Meilenstein da),
 * kommt `null`. Der Zeitraum steht nur, wenn das Ziel dasselbe ist wie live gerechnet und genug Verlauf da ist (`nextGoal`, ab 21 Tagen).
 */
export function goalLine(i: { nx: string | undefined; festUnits: number; vocabFest: number; history: unknown; today: string }): TextRef | null {
  if (!i.nx) return null;
  if (i.nx === 'c1check') return { key: 'moGoalCheck', params: {} };
  const m = /^fest(\d{1,5})$/.exec(i.nx);
  if (!m) return null;
  const need = Number(m[1]);
  const left = need - i.festUnits;
  if (left <= 0) return null;
  const live = nextGoal({ festUnits: i.festUnits, vocabFest: i.vocabFest, history: i.history, today: i.today });
  if (live && live.id === i.nx && live.weeks) return { key: 'moGoalFestWeeks', params: { need, left, lo: live.weeks[0], hi: live.weeks[1] } };
  return { key: 'moGoalFest', params: { need, left } };
}

export type WeekText = { key: 'moWeekProgress' | 'moWeekReached' | 'moWeekReached7' | 'moWeekOver'; params: Record<string, number> };

/**
 * Wochenzeile „Woche 4 von 6“ aus dem Wochenziel. Ohne Pflichttag in der Woche kommt `null` (nie „Woche 0 von 6“); 6 oder 7 Tage heißen
 * „Woche 6 von 6 ✓“; ist 6 nicht mehr erreichbar, steht die Zahl der Lerntage und „Montag beginnt neu“, nie ein Wort wie „verfehlt“.
 */
export function weekText(g: Pick<WeekGoal, 'done' | 'reached' | 'possible'>): WeekText | null {
  if (g.done < 1) return null;
  if (g.reached) return g.done >= 7 ? { key: 'moWeekReached7', params: {} } : { key: 'moWeekReached', params: {} };
  return g.possible ? { key: 'moWeekProgress', params: { n: g.done } } : { key: 'moWeekOver', params: { n: g.done } };
}

export type FootParts = { streak: number | null; week: WeekText | null };

/** Kartenfuß: „Serie 12 · Woche 4 von 6“. Die Serie steht nur ab 1 („Serie 0“ gibt es nie); ohne beides gibt es keine Zeile. */
export function footParts(i: { streak: number | null; goal: Pick<WeekGoal, 'done' | 'reached' | 'possible'> }): FootParts | null {
  const streak = i.streak !== null && i.streak >= 1 ? i.streak : null;
  const week = weekText(i.goal);
  return streak === null && week === null ? null : { streak, week };
}

/** Der Text des Kartenfußes aus `footParts` (`t` = Übersetzer der Oberfläche). */
export function footText(p: FootParts, t: (k: MessageKey, v?: Record<string, string | number>) => string): string {
  const week = p.week ? t(p.week.key, p.week.params) : null;
  if (p.streak !== null && week) return t('moStreakWeek', { streak: p.streak, week });
  if (p.streak !== null) return t('moStreakAlone', { streak: p.streak });
  return week ?? '';
}
