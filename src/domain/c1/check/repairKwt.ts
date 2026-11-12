import { kwtSpan } from '../../grammar/tasks';
import type { Fehlersatz } from '../../repair/fehlersaetze';
import type { C1Item } from '../../c1x/types';
import { filledSentence, rightFill } from './score';

// Emrah 12.11.2026 (Stift: „Sau schwere Aufgabe?! Wie soll ich das lösen“): Ein Fehler aus einer Umformung (kwt) des Einstufungstests kam
// als nackte Lücke zurück („No ___ the update than …“) – ohne Ausgangssatz und Schlüsselwort nicht lösbar. Hier wird die Original-Aufgabe
// zum Fehlersatz gesucht, damit die Wiederholung wieder wie im Test aussieht: Ausgangssatz, Schlüsselwort, Wortzahl. Rein.

export type RepairKwt = { from: string; key: string; frame: string; answer: string; accepted: string[]; words: [number, number] };

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Die Umformung aus dem Einstufungstest zu einem Fehlersatz (`src: 'check'`), sonst `null`. Erkennung: gleiches Muster und gleicher richtiger Satz. */
export function kwtForRepair(items: readonly C1Item[], f: Pick<Fehlersatz, 'right' | 'ctx' | 'src'>): RepairKwt | null {
  if (f.src !== 'check') return null;
  const want = norm(f.right);
  for (const it of items) {
    if (it.kind !== 'kwt' || (f.ctx && it.pat !== f.ctx)) continue;
    const fill = rightFill(it);
    const right = fill ? filledSentence(it, fill) : null;
    if (!fill || !right || norm(right) !== want) continue;
    const all = [...new Set(it.keys.flatMap((k) => k.a.flatMap((a) => k.b.map((b) => `${a} ${b}`.replace(/\s+/g, ' ').trim()))))];
    const answer = all[0] ?? fill;
    const accepted = all.slice(1);
    const frame = `${it.before} ___ ${it.after}`.replace(/\s+/g, ' ').trim();
    return { from: it.lead, key: it.key, frame, answer, accepted, words: kwtSpan({ words: [2, 5], answer, accepted, key: it.key }) };
  }
  return null;
}
