import { dayMoment } from '../../domain/moments/detect';
import { KEY_PREFIX, local } from '../../platform/storage';

// Tagesmoment nur beim Übergang „offen → fertig“ in dieser Sitzung (Lernplattform 3.0 P55, Erlebnis-Engine M7): Heute merkt sich, an welchem Lerntag
// es die offene Tageskarte gezeigt hat. Wer am Abend die App schon fertig öffnet, sieht den stillen Ring. Zusätzlich einmal je Lerntag und Browser
// (nur Bequemlichkeit, kein Lernstand).

let openDay: string | null = null;

/** Heute meldet die offene Tageskarte. */
export function noteDayOpen(today: string): void {
  openDay = today;
}

const playedKey = (today: string): string => `${KEY_PREFIX}daymoment:${today}`;

/** Soll der Tagesmoment jetzt spielen? Merkt ihn zugleich als gespielt (einmal). */
export function takeDayMoment(today: string): boolean {
  const play = dayMoment(openDay === today ? 'open' : null, 'done', local.get(playedKey(today)) === '1');
  if (play) {
    local.set(playedKey(today), '1');
    openDay = null;
  }
  return play;
}

/** Nur für Tests. */
export function resetDayMoment(): void {
  openDay = null;
}
