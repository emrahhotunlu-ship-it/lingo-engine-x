import { slug } from '../content';
import { locate, lemmaOf } from './context';

// Neue Karte aus Wort-Antippen (Plan §3.4, Portierung von `cardFromAI` der alten App).
// Der Ursprungssatz ist Pflicht (Kap. 15: keine Karten ohne Ursprungssatz). Kein `fsrs`:
// `readFsrs` leitet es aus den alten Feldern ab, genau wie bei jeder Karte der alten App.

export type CardOrigin = { v: 1; kind: 'trainer' | 'intro' | 'summary' | 'lookup' | 'daily' | 'lesson' | 'user' | 'ai'; ref?: string; title?: string; t: number };

export type NewVocabInput = {
  word: string;
  de: string;
  pos?: string | null;
  def?: string | null;
  level?: string | null;
  ex?: string | null;
  surface?: string | null;
  /** Phase 2 (M2): `user` eigenes Wort, `ai` bzw. `job` von Claude vorgeschlagen. */
  src: 'lookup' | 'coach' | 'lesson' | 'user' | 'ai' | 'job';
  /** Lektion, aus der die Karte stammt (`src:'lesson'`, Phase 2 D17). */
  lesson?: string | null;
  origin: CardOrigin;
  today: string;
};

const VALID_EX = /^[^[\]]*\[[^[\]]+\][^[\]]*$/;

/** Satz mit eingeklammerter Fundstelle oder `''` (Klammerregel der alten App). */
export function bracketExample(sentence: string, surface: string | null | undefined, word: string): string {
  let s = sentence.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const core = lemmaOf(word).replace(/^be\s+/i, '');
  const hit = (surface ? locate(s, surface) : null) ?? locate(s, core);
  if (!hit) return '';
  let start = hit.start;
  let end = hit.end;
  if (s.length > 200) {
    const from = Math.max(0, s.lastIndexOf(' ', Math.max(0, start - 80)) + 1);
    const to = s.indexOf(' ', Math.min(s.length, end + 80));
    const cut = s.slice(from, to < 0 ? s.length : to);
    s = `${from > 0 ? '…' : ''}${cut}${to >= 0 ? '…' : ''}`;
    const shift = from - (from > 0 ? 1 : 0);
    start -= shift;
    end -= shift;
  }
  const out = `${s.slice(0, start)}[${s.slice(start, end)}]${s.slice(end)}`;
  return VALID_EX.test(out) ? out : '';
}

/** Anzeigeform: Verben mit „to " (Regel der alten App), Wendungen und phrasal verbs ohne. */
export function displayWord(word: string, pos: string | null | undefined): string {
  const w = word.trim();
  const p = pos ?? '';
  return /verb/i.test(p) && !/adverb|phrasal/i.test(p) && !/^to /i.test(w) && !/\s/.test(w) ? `to ${w}` : w;
}

/** `null`, wenn Wort oder Bedeutung fehlt oder der Satz keine gültige Klammer bekommt. */
export function newVocabDoc(i: NewVocabInput): { id: string; doc: Record<string, unknown> } | null {
  const word = displayWord(i.word, i.pos);
  const de = i.de.trim();
  const id = slug(word);
  if (!word || !de || !id) return null;
  const ex = i.ex ? bracketExample(i.ex, i.surface, word) : '';
  if (!ex) return null;
  const origin: CardOrigin = { v: 1, kind: i.origin.kind, t: i.origin.t };
  if (i.origin.ref) origin.ref = i.origin.ref.slice(0, 120);
  if (i.origin.title) origin.title = i.origin.title.slice(0, 120);
  return {
    id,
    doc: {
      id,
      word,
      pos: i.pos ?? '',
      de,
      def: i.def ?? '',
      ex,
      col: [],
      level: i.level || 'B2',
      state: 'new',
      S: 0,
      D: 5,
      last: 0,
      due: 0,
      reps: 0,
      lapses: 0,
      modes: {},
      order: 900,
      src: i.src,
      added: i.today,
      origin,
      ...(i.lesson ? { lesson: i.lesson } : {}),
    },
  };
}

/**
 * Schreibweg „Als Karte speichern" (Plan §3.1): fehlt → anlegen; da, aber ohne Beispielsatz →
 * Satz und Ursprung ergänzen; sonst nichts. Ausgeblendete Karten bleiben unberührt.
 */
export function saveCardOp(cur: Readonly<Record<string, unknown>> | undefined, made: { doc: Record<string, unknown> }): { set: Record<string, unknown> } | { update: Record<string, unknown> } | null {
  if (!cur) return { set: made.doc };
  if (cur.hidden === true) return null;
  const ex = typeof cur.ex === 'string' ? cur.ex.trim() : '';
  if (!ex && cur.origin === undefined) return { update: { ex: made.doc.ex, origin: made.doc.origin } };
  if (!ex) return { update: { ex: made.doc.ex } };
  return null;
}
