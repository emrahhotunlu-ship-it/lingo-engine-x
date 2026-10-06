import { TRAPS, trapById, type Trap } from '../../content/nb/traps';
import { TRAP_INDEX } from '../../content/nb/trapIndex';
import { packExtraOf } from '../c1pack/packFields';
import { matchTraps } from '../patterns/traps';
import type { TrainCard } from './types';

// Deutsch-Fallen und Karten (Lernplattform 2.0, §3.7/§4.8): Welche Falle berührt eine Karte, und steckt in einer Antwort eine?
// Rein lesend: nichts wird geschrieben, die Karten bleiben unverändert.

const norm = (s: string): string => s.toLowerCase().normalize('NFKC').replace(/[’‘`´]/g, "'").replace(/^to\s+/, '').replace(/\s+/g, ' ').trim();
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasPhrase = (text: string, phrase: string): boolean => new RegExp(`(?:^|[^a-z'])${escape(phrase)}(?:$|[^a-z'])`).test(text);

/** Falle zu einem englischen Wort oder einer Wendung (Index), sonst `null`. Ganze Wörter, Groß/klein egal. */
export function trapForWord(word: string): Trap | null {
  const w = norm(word);
  if (!w) return null;
  for (const [id, e] of Object.entries(TRAP_INDEX)) if (e.en.some((x) => w === x || hasPhrase(w, x))) return trapById(id);
  return null;
}

/** Falle zu einer Karte: erst die Kennung aus dem Paket (`trap`), dann der Fallen-Index über das Kartenwort. */
export function trapForCard(card: Pick<TrainCard, 'word' | 'doc'>): Trap | null {
  const own = packExtraOf(card)?.trap;
  return (own ? trapById(own) : null) ?? trapForWord(card.word);
}

export type TrapInAnswer = { trap: Trap; at: number; match: string };

/** Erste Deutsch-Falle in einer Antwort (zum Beispiel „the actual version“), sonst `null`. */
export function matchTrapInAnswer(text: string): TrapInAnswer | null {
  const hit = matchTraps(text)[0];
  const trap = hit ? trapById(hit.id) : null;
  return hit && trap ? { trap, at: hit.at, match: hit.match } : null;
}

/** Alle Fallen, für die der Index mindestens ein englisches Wort kennt (der Test prüft, dass das jede Falle ist). */
export const trapsWithoutIndex = (): string[] => TRAPS.filter((t) => !(TRAP_INDEX[t.id]?.en.length ?? 0)).map((t) => t.id);
