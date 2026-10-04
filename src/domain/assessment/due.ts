import { daysBetween } from '../date';
import type { AssessRead } from './types';

// Wann wird neu eingeschätzt (Plan §4.4)? Rein; die Auslöser sind Handlungen (Reiter „Dein Stand"
// öffnen, Pflicht erledigt), nie ein Timer (contract/sample.d.ts, Plan W1).

export type DueReason = 'none' | 'lang' | 'age' | 'answers' | 'first';

export const FIRST_MIN_ANSWERS = 100;
export const AGE_DAYS = 3;
export const NEW_ANSWERS = 300;

export function assessDue(i: {
  assess: AssessRead | null;
  uiLang: 'de' | 'en';
  today: string;
  profileAnswers: number;
  lastAutoDay: string | null;
}): DueReason {
  if (i.lastAutoDay === i.today) return 'none';
  const a = i.assess;
  if (!a) return i.profileAnswers >= FIRST_MIN_ANSWERS ? 'first' : 'none';
  if (a.lang !== i.uiLang) return 'lang';
  if (a.d === i.today) return 'none';
  if (!a.d || daysBetween(a.d, i.today) >= AGE_DAYS) return 'age';
  if (i.profileAnswers - a.answers >= NEW_ANSWERS) return 'answers';
  return 'none';
}
