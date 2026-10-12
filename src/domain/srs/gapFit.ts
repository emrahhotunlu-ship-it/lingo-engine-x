import { typedForm } from '../chunks/situation';
import { isPlaceholder, lemmaOf, locate } from './context';
import type { ContextSpan, TrainCard } from './types';

// Passt die Lücke zur Karte? (Audit 12.10.2026, Emrahs Rückmeldungen 1 und 2: „___ ___ ___“ für „reassure the customer“, sechs Kästchen
// für „to put something in writing“.) Eine Lückenaufgabe ist nur dann fair, wenn die Lücke genau das Wort bzw. die Wendung der Karte
// verdeckt: nicht mehr Wörter (ein Platzhalter-Objekt wie „the new timeline“ kann niemand erraten) und das Kartenwort steht nicht ein
// zweites Mal sichtbar im Satz. Rein; nichts wird geschrieben.

/** Wendung bzw. Wort, wie es getippt wird (Wendungen ohne „…“, Vokabeln ohne „to “). */
export const lemmaFor = (card: Pick<TrainCard, 'word' | 'kind' | 'lemma'>): string => card.lemma || (card.kind === 'chunk' ? typedForm(card.word) : lemmaOf(card.word));

/** Feste Wörter der Karte ohne Platzhalter („something“, „sb“) und ohne Klammern. */
export function coreWords(lemma: string): string[] {
  return lemma
    .replace(/…|\.\.\./g, ' ')
    .split(/\s+/)
    .filter((w) => w && !isPlaceholder(w))
    .map((w) => w.replace(/[()]/g, ''))
    .filter(Boolean);
}

/**
 * Ist `ctx` für eine Lückenaufgabe (tippen, Bausteine, Zuordnen im Satz, Diktat) brauchbar?
 * Nein, wenn die Lücke mehr Wörter verdeckt, als die Karte feste Wörter hat, oder das Kartenwort außerhalb der Lücke noch einmal steht.
 */
export function gapUsable(ctx: Pick<ContextSpan, 'sentence' | 'start' | 'end' | 'gap'> | null | undefined, lemma: string): boolean {
  if (!ctx) return false;
  const core = coreWords(lemma);
  if (!core.length) return true;
  if (ctx.gap.split(/\s+/).filter(Boolean).length > core.length) return false;
  const phrase = core.join(' ');
  if (phrase.replace(/\s/g, '').length >= 4) {
    const rest = `${ctx.sentence.slice(0, ctx.start)} | ${ctx.sentence.slice(ctx.end)}`;
    if (locate(rest, phrase)) return false;
  }
  return true;
}
