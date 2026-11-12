import { patternById } from '../../../domain/grammar/patterns';
import type { Fehlersatz } from '../../../domain/repair/fehlersaetze';
import type { GrammarTask } from '../../../domain/learn/types';
import type { RepairKwt } from '../../../domain/c1/check/repairKwt';

// Großpaket G4 (Entscheidung 2, 02.11.2026): Eigene Fehlersätze aus `app/repair` (Anwenden, Sprechen, Schreiben …) kommen im
// Grammatik-Schritt zurück, zusammen mit den Grammatik-Fehlersätzen und innerhalb derselben Höchstzahl. Rein, schreibt nichts.

/** Thema-Platzhalter, wenn der Satz keinem Grammatik-Muster zugeordnet ist (kein `grammar/<thema>`-Dokument, nie geschrieben). */
export const REPAIR_TOPIC = 'repair';

/** Wortschatz-Muster (`lx.*`, z. B. „conduct a survey“) sind keine Grammatik (Emrah 10.11.2026: „das ist doch keine Grammatik-Übung?“). */
const isLexical = (f: Pick<Fehlersatz, 'ctx' | 'pat'>): boolean => /^lx\./.test(f.ctx ?? '') || /^lx\./.test(f.pat ?? '');

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fehlersatz aus dem Einstufungstest (`src: 'check'`) als Lücke an genau der geprüften Stelle. Als „Fehler finden“ war der aus der
 * gewählten Antwort gebaute Satz oft mehrdeutig (Emrah 09.11.2026: „If the shipment arrive damaged“ lässt sich auch mit „arrives“
 * reparieren, gezählt hat nur „Should“). `null`, wenn die Korrektur nicht genau einmal im richtigen Satz steht.
 */
export function checkGap(f: Pick<Fehlersatz, 'right' | 'fix'>): { prompt: string; answer: string; accepted: string[] } | null {
  const fix = f.fix?.map((x) => x.trim()).filter(Boolean) ?? [];
  const first = fix[0];
  if (!first) return null;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}'’])(${escapeRe(first)})(?=$|[^\\p{L}\\p{N}'’])`, 'giu');
  const hits = [...f.right.matchAll(re)];
  const hit = hits[0];
  if (hits.length !== 1 || !hit || hit.index === undefined) return null;
  const start = hit.index + (hit[1]?.length ?? 0);
  const word = hit[2] ?? first;
  const prompt = `${f.right.slice(0, start)}___${f.right.slice(start + word.length)}`;
  const accepted = fix.slice(1).filter((x) => x.toLowerCase() !== word.toLowerCase());
  return { prompt, answer: word, accepted };
}

/**
 * Eigene, sichtbare Fehlersätze als Korrektur-Aufgabe (`correct`; am Handy macht `forProfile` daraus „Fehler antippen“).
 * Ausnahmen: Wortschatz-Sätze kommen nicht in die Grammatik; Sätze aus dem Einstufungstest kommen als eindeutige Lücke, Umformungen (kwt)
 * wieder als Umformung mit Ausgangssatz und Schlüsselwort (`kwtOf`, Emrah 12.11.2026). Eine Lücke aus mehreren Wörtern ohne Ausgangssatz
 * wäre nicht lösbar und bleibt weg, bis die Original-Aufgabe geladen ist.
 */
export function repairTasks(list: readonly Fehlersatz[], kwtOf?: (f: Fehlersatz) => RepairKwt | null): GrammarTask[] {
  const out: GrammarTask[] = [];
  for (const f of list) {
    if (f.store !== 'repair' || f.hidden || !f.wrong.trim() || !f.right.trim() || isLexical(f)) continue;
    const pat = f.pat ? patternById(f.pat) : null;
    const kwt = f.src === 'check' ? (kwtOf?.(f) ?? null) : null;
    const gap = f.src === 'check' && !kwt ? checkGap(f) : null;
    if (gap && gap.answer.trim().split(/\s+/).length > 1) continue;
    out.push({
      key: `rep:${f.id}`,
      topic: pat?.topic ?? REPAIR_TOPIC,
      ...(kwt
        ? { type: 'kwt' as const, prompt: kwt.frame, answer: kwt.answer, accepted: kwt.accepted, x: { kind: 'kwt' as const, from: kwt.from, key: kwt.key, words: kwt.words } }
        : gap
          ? { type: 'gap' as const, prompt: gap.prompt, answer: gap.answer, accepted: gap.accepted }
          : { type: 'correct' as const, prompt: f.wrong, answer: f.right, accepted: [] }),
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
