import { usSpelling } from '../text/lemma';

// Britisch → amerikanisch für die Antwortprüfung (A7.3: britisch gilt immer als richtig,
// die Rückmeldung nennt die US-Form als Hinweis). Die Schreibweise (colour → color,
// organise → organize, travelled → traveled …) kommt aus derselben Funktion wie der
// Wörterbuch-Index (`usSpelling`, text/lemma.ts). Hier kommen nur britische WÖRTER dazu,
// deren US-Entsprechung ein anderes Wort ist (lorry → truck) – das Wörterbuch führt sie
// als eigene Einträge, die Antwortprüfung soll sie aber als gleichwertig anerkennen.

const WORDS: Record<string, string> = {
  lorry: 'truck', flat: 'apartment', lift: 'elevator', rubbish: 'trash', autumn: 'fall', petrol: 'gas', queue: 'line',
  film: 'movie', timetable: 'schedule', motorway: 'highway', postcode: 'zip code', 'mobile phone': 'cell phone',
  'city centre': 'downtown', pavement: 'sidewalk', holiday: 'vacation', holidays: 'vacation', cv: 'résumé',
};

/** US-Form eines (normalisierten) Worts oder einer Wendung. */
export function toUS(s: string): string {
  const whole = WORDS[s];
  if (whole) return whole;
  return s
    .split(' ')
    .map((w) => WORDS[w] ?? usSpelling(w))
    .join(' ');
}
