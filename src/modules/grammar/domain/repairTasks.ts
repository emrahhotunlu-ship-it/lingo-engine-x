import { patternById } from '../../../domain/grammar/patterns';
import type { Fehlersatz } from '../../../domain/repair/fehlersaetze';
import type { GrammarTask } from '../../../domain/learn/types';

// Großpaket G4 (Entscheidung 2, 02.11.2026): Eigene Fehlersätze aus `app/repair` (Anwenden, Sprechen, Schreiben …) kommen im
// Grammatik-Schritt zurück, zusammen mit den Grammatik-Fehlersätzen und innerhalb derselben Höchstzahl. Rein, schreibt nichts.

/** Thema-Platzhalter, wenn der Satz keinem Grammatik-Muster zugeordnet ist (kein `grammar/<thema>`-Dokument, nie geschrieben). */
export const REPAIR_TOPIC = 'repair';

/** Eigene, sichtbare Fehlersätze als Korrektur-Aufgabe (`correct`; am Handy macht `forProfile` daraus „Fehler antippen“). */
export function repairTasks(list: readonly Fehlersatz[]): GrammarTask[] {
  const out: GrammarTask[] = [];
  for (const f of list) {
    if (f.store !== 'repair' || f.hidden || !f.wrong.trim() || !f.right.trim()) continue;
    const pat = f.pat ? patternById(f.pat) : null;
    out.push({
      key: `rep:${f.id}`,
      topic: pat?.topic ?? REPAIR_TOPIC,
      type: 'correct',
      prompt: f.wrong,
      answer: f.right,
      accepted: [],
      options: null,
      hint: null,
      expl: { de: f.why ?? null, en: f.why ?? null },
      src: 'review',
      ref: 'app/repair',
      errorT: f.due,
      pat: pat ? f.pat : null,
      rep: f.id,
    });
  }
  return out;
}
