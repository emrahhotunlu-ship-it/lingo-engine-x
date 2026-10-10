import { TRAP_INDEX } from '../../content/nb/trapIndex';
import { trapForCard } from './traps';
import { packExtraOf } from '../c1pack/packFields';
import { locate } from './context';
import type { Colloc, TrainCard } from './types';

// Partnerwort-Lücke (Lernplattform 2.0 §5.6): Die Lücke steht NUR am Partnerwort („___ concerns about data security“), nie an der
// ganzen Wendung. Quellen: die Wortpartner der Karte (`col`, wie bisher) und die Paket-Felder `gap` (nur gelesen, nie geschrieben:
// `packExtraOf` legt sie beim Lesen über die Karte). Rein.

const norm = (s: string): string => s.toLowerCase().trim();

/**
 * Verben, nach denen „to + Verb“ ein SATZMUSTER ist, kein fester Wortpartner (Rückmeldung 3, 10.10.2026: „We can't afford to ___ this
 * customer.“ – hinter „afford to“ passt jedes Verb). Solche Lücken sind keine Wortpartner-Aufgabe.
 */
const TO_INF_VERBS: ReadonlySet<string> = new Set([
  'afford', 'aim', 'appear', 'arrange', 'attempt', 'begin', 'choose', 'continue', 'decide', 'decline', 'deserve', 'expect', 'fail',
  'hesitate', 'hope', 'intend', 'learn', 'manage', 'mean', 'need', 'offer', 'opt', 'plan', 'prefer', 'prepare', 'pretend', 'proceed',
  'promise', 'refuse', 'seek', 'seem', 'start', 'strive', 'struggle', 'tend', 'threaten', 'try', 'undertake', 'volunteer', 'want', 'wish',
]);

// „agree“ fehlt bewusst: „agree to the terms“ ist eine echte Verbindung mit Nomen (Gegenlesung 10.10.2026).
/** Unregelmäßige Formen der Musterverben. */
const IRREGULAR: Readonly<Record<string, readonly string[]>> = {
  seek: ['sought'], choose: ['chose', 'chosen'], mean: ['meant'], learn: ['learnt'], begin: ['began', 'begun'],
  strive: ['strove', 'striven'], undertake: ['undertook', 'undertaken'],
};

const verbForm = (w: string, lemma: string): boolean => {
  const x = w.toLowerCase();
  const l = lemma.toLowerCase();
  if (IRREGULAR[l]?.includes(x)) return true;
  if (x === l || x === `${l}s` || x === `${l}es` || x === `${l}ed` || x === `${l}d` || x === `${l}ing`) return true;
  // try → tries/tried, plan → planned/planning, hope → hoping
  if (l.endsWith('y') && (x === `${l.slice(0, -1)}ies` || x === `${l.slice(0, -1)}ied`)) return true;
  if (l.endsWith('e') && x === `${l.slice(0, -1)}ing`) return true;
  const last = l.at(-1) ?? '';
  return x === `${l}${last}ed` || x === `${l}${last}ing`;
};

/**
 * Ist die Lücke ein „Verb + to + ___“-Satzmuster statt einer festen Verbindung? Wahr, wenn das Kartenwort ein solches Verb ist und
 * direkt vor der Lücke „<Form des Verbs> to“ steht oder die Verbindung selbst „<Verb> to …“ lautet. Rein.
 */
export function isPatternGap(lemma: string, p: string, ctx: { sentence: string; start: number } | null): boolean {
  const l = lemma.toLowerCase().replace(/^to\s+/, '').trim();
  if (!TO_INF_VERBS.has(l)) return false;
  const pw = p.toLowerCase().replace(/^to\s+/, '').trim().split(/\s+/);
  if (pw.length >= 2 && pw[0] && verbForm(pw[0], l) && pw[1] === 'to') return true;
  if (!ctx) return false;
  const m = /(\S+)\s+(?:not\s+)?to\s+$/i.exec(ctx.sentence.slice(0, ctx.start));
  return !!m?.[1] && verbForm(m[1].replace(/[^a-z]/gi, ''), l);
}

/** Eine Partnerwort-Lücke der Karte (mit Satz und Auswahl), sonst `null`. `pickIndex` wählt unter mehreren (z. B. per Zufall). */
export function partnerOf(card: TrainCard, pickIndex = 0): Colloc | null {
  // Rückmeldung 3: nur echte Verbindungen; ein Satzmuster („afford to + Verb“) ist keine Wortpartner-Aufgabe (dann eine andere Abfrageart).
  const own = card.col.filter((c) => c.ctx && c.opts.length >= 2 && !isPatternGap(card.lemma, c.p, c.ctx));
  if (own.length) return own[Math.abs(pickIndex) % own.length] ?? own[0] ?? null;
  const ctx = card.context;
  const gap = packExtraOf(card)?.gap;
  if (!ctx || !gap) return null;
  // Das Partnerwort steht in der Wendung (bzw. im Satz): nur diese Stelle wird zur Lücke.
  const inChunk = ctx.sentence.slice(ctx.start, ctx.end);
  const hit = locate(inChunk, gap.at);
  if (!hit) return null;
  const start = ctx.start + hit.start;
  const end = ctx.start + hit.end;
  const word = ctx.sentence.slice(start, end);
  const opts = [...new Set(gap.wrong.filter((w) => norm(w) !== norm(word) && norm(w) !== norm(gap.at)))];
  if (!opts.length) return null;
  if (isPatternGap(card.lemma, card.word, { sentence: ctx.sentence, start })) return null;
  return { index: -1, p: card.word, de: card.de ?? '', gap: word, opts, ctx: { sentence: ctx.sentence, start, end, gap: word } };
}

export const hasPartner = (card: TrainCard): boolean => partnerOf(card) !== null;

/** Familienmitglied für „Wortfamilie“: ein anderes Glied als das Kartenwort, das Kartenwort selbst steht im Satz. */
export function familyFrom(card: TrainCard): { pos: 'noun' | 'verb' | 'adj' | 'adv'; word: string } | null {
  const fam = packExtraOf(card)?.fam;
  if (!fam || !card.context) return null;
  const own = norm(card.lemma);
  for (const pos of ['noun', 'adj', 'verb', 'adv'] as const) {
    const w = fam[pos];
    if (w && norm(w) !== own && !locate(card.context.sentence, w)) return { pos, word: w };
  }
  return null;
}

/** Übungssatz der Deutsch-Falle zur Karte und die falsch benutzte Stelle darin („Falle finden“), sonst `null`. */
export function trapTask(card: TrainCard): { id: string; sentence: string; start: number; end: number } | null {
  const trap = trapForCard(card);
  if (!trap) return null;
  const words = [card.lemma, card.word, ...(TRAP_INDEX[trap.id]?.en ?? [])];
  for (const w of words) {
    const hit = w ? locate(trap.wrong, w) : null;
    if (hit) return { id: trap.id, sentence: trap.wrong, start: hit.start, end: hit.end };
  }
  return null;
}
