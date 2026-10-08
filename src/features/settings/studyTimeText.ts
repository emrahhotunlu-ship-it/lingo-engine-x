import { formatTime, isCueId, type CueId, type Ii } from '../../domain/studytime';
import type { MessageKey } from '../../i18n';

// Texte der Lernzeit (Lernplattform 3.0 P53): Anker in der Oberflächensprache und die Zeile der Abschlusskarte.

export const CUE_LABEL: Record<CueId, MessageKey> = { coffee: 'moStCueCoffee', train: 'moStCueTrain', lunch: 'moStCueLunch', evening: 'moStCueEvening' };
/** Wenn-Dann-Satz je festem Moment (eigene Schlüssel, damit die Grammatik passt). */
const CUE_IF: Record<CueId, MessageKey> = { coffee: 'moStIfCoffee', train: 'moStIfTrain', lunch: 'moStIfLunch', evening: 'moStIfEvening' };

type Tr = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Anzeige eines Ankers: feste Kennung in der Oberflächensprache, eigener Text unverändert. */
export const cueLabel = (cue: string, t: Tr): string => (isCueId(cue) ? t(CUE_LABEL[cue]) : cue);

/** Zeile der Abschlusskarte: „Morgen um 7:30 · nach dem ersten Kaffee“ (Englisch im 12-Stunden-Format); ohne Lernzeit `null`. */
export function studyTimeLine(ii: Ii | null, lang: 'de' | 'en', t: Tr): string | null {
  if (!ii) return null;
  const time = formatTime(ii.t, lang);
  return ii.cue ? t('moStTomorrowCue', { time, cue: cueLabel(ii.cue, t) }) : t('moStTomorrow', { time });
}

/** Vorschau „Wenn/Bevor ich …, starte ich meine Englisch-Runde.“ (ganzer Satz je Moment) für den gewählten Moment; ohne Moment `null` (dann der ruhige Hinweis). */
export function ifThenLine(cue: string, t: Tr): string | null {
  const c = cue.replace(/\s+/g, ' ').trim();
  if (!c) return null;
  return isCueId(c) ? t(CUE_IF[c]) : t('moStIfOwn', { cue: c });
}
