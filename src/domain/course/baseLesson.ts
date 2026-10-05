import type { GrammarTask } from '../learn/types';

// Zwei kleine Helfer, die nach dem Entfernen des Kurs-Bereichs übrig bleiben (Umbau „Fokus Wörter und
// Grammatik“): das Kernwort eines Zielworts und der gelöste Satz einer Aufgabe.

/** Zielwort ohne führendes „to " und ohne Platzhalter wie „something". */
export function coreWord(en: string): string {
  return en
    .replace(/^to\s+/i, '')
    .replace(/\b(something|someone|somebody|sth|sb)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aufgabe als gelöster Satz (Lücke gefüllt, Hinweis in Klammern entfernt); `null`, wenn das nicht geht. */
export function solvedSentence(t: Pick<GrammarTask, 'type' | 'prompt' | 'answer'>): string | null {
  if (t.type === 'correct') return t.answer.trim();
  const target = t.type === 'transform' ? (t.prompt.split('→')[1] ?? '') : t.prompt;
  if (!/_{3,}/.test(target)) return null;
  return target
    .replace(/_{3,}/, t.answer.trim())
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
