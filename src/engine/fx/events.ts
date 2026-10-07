// Lernereignisse (Lernplattform 3.0 P30, Erlebnis-Engine §2.2): die EINZIGE Schnittstelle zwischen Lernlogik und Erlebnis.
// Die Übung meldet, was geschehen ist („Antwort richtig“); der Dirigent (`director.ts`) entscheidet, was dazu passiert (Ton, Vibration, später Momente).
// Noch nicht gebaut: `stateUp`, `step`, `round`, `day`, `milestone` (Stufe 2 bis 4, spätere Pakete). Sie kommen als weitere Mitglieder der Union dazu.

export type FxArea = 'words' | 'grammar';

export type LearnEvent = VerdictEvent | MomentEvent;

/** Momente (Design-Lead, EE M6/M7): Runde geschafft, Tag geschafft. `el` = Ort des Effekts (Ring, Karte). */
export type MomentEvent = { k: 'moment'; m: 'round' | 'day'; el?: Element | null };

export type VerdictEvent = {
  k: 'verdict';
  /** Urteil einer geprüften Antwort. „Weiß ich nicht“ löst keinen Ton und keine Vibration aus. */
  v: 'ok' | 'near' | 'wrong' | 'dontKnow';
  /** Das Element der Antwort (Lücke, Option), für spätere Effekte am Ort. Darf fehlen. */
  el?: Element | null;
  area?: FxArea;
};

type Handler = (e: LearnEvent) => void;
const handlers = new Set<Handler>();

/** Meldet ein Ereignis. Ohne Dirigent passiert nichts (kein Fehler). */
export function emit(e: LearnEvent): void {
  for (const h of [...handlers]) h(e);
}

/** Für den Dirigenten und Tests: Handler anmelden; liefert die Abmeldung. */
export function subscribe(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}
