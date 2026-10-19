import type { CardStatus, Mind } from '../../domain/metrics';
import type { UnitState } from '../../domain/metrics/definitions';
import { FREE_DAYS_GOAL } from '../../domain/metrics/cardStatus';
import type { MessageKey } from '../../i18n';

// Wörter für den EINEN Status (Paket ST): Zustandswort und eine Zeile Beleg. Liste, Wortblatt, Übung, Hub und Atlas benutzen genau diese Texte,
// damit sie sich nie widersprechen. Rein; die Übersetzung kommt als Funktion herein.

type Tr = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const STATE_WORD: Record<UnitState, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', wobbly: 'exStateWobbly', safe: 'exStateSafe', firm: 'exStateFirm' };
export const MIND_WORD: Record<Exclude<Mind, 'none'>, MessageKey> = { good: 'stxMindGood', shaky: 'stxMindShaky', forgotten: 'stxMindForgotten', noGap: 'stxMindNoGap' };

/** Beleg ohne „zuletzt falsch“: was die Karte schon gezeigt hat. */
function proof(s: CardStatus, t: Tr, dateShort: (ms: number) => string): string {
  const days = Math.min(FREE_DAYS_GOAL, s.freeDays);
  switch (s.tier) {
    case 'new':
      return t('stxDetailNew');
    case 'firm':
      return t('stxDetailFirm');
    case 'safe':
      return t('stxDetailFree', { n: days });
    case 'wobbly':
      return s.lastWasWrong ? t('stxDetailWobblyWrong', { date: dateShort(s.lastWrong ?? 0) }) : s.unrecovered ? t('stxDetailWobblyRecover') : t('stxDetailWobblyGap');
    case 'learning':
      if (days > 0) return t('stxDetailFree', { n: days });
      if (s.noHistory) return t('stxDetailOld');
      if (s.flipOnly) return t('stxDetailFlip');
      if (s.helped) return t('stxDetailHelp');
      if (s.recognizes) return t('stxDetailRecognize');
      return t('stxDetailStart');
  }
}

/** Die Zeile hinter dem Zustandswort: „frei abgerufen an 1 von 3 Tagen · zuletzt falsch am 12. Okt.“ */
export function statusDetail(s: CardStatus, t: Tr, dateShort: (ms: number) => string): string {
  const parts = [proof(s, t, dateShort)];
  // Bei „Wackelt“ wegen der letzten Antwort steht der Fehler samt Datum schon im Beleg: nicht doppelt.
  if (s.lastWrong !== null && s.tier !== 'new' && !(s.tier === 'wobbly' && s.lastWasWrong)) parts.push(t('stxLastWrong', { date: dateShort(s.lastWrong) }));
  return parts.join(' · ');
}

/** „Jetzt im Kopf: gut“ (oder „noch kein Abstand“ / „vermutlich vergessen“); neue Karten: noch nicht gelernt. */
export function mindLine(s: CardStatus, t: Tr): string {
  return `${t('stxMindLabel')}: ${s.mind === 'none' ? t('stxMindNew') : t(MIND_WORD[s.mind])}`;
}

/** „Jetzt im Kopf“ nur, wenn es etwas ANDERES sagt als das Zustandswort: nicht bei „gut“ (der Zustand sagt es schon) und nicht bei „Wackelt“ (der Beleg nennt dort den Grund). */
export function mindAdds(s: CardStatus): boolean {
  if (s.mind === 'none' || s.mind === 'good') return false;
  return s.tier !== 'wobbly';
}
