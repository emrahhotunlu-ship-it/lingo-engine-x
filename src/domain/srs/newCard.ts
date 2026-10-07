import { mayCreateDoc } from '../capacity/docGuard';
import { slug } from '../content';
import { locate, lemmaOf } from './context';

// Neue Karte aus Wort-Antippen (Plan §3.4, Portierung von `cardFromAI` der alten App).
// Der Ursprungssatz ist Pflicht (Kap. 15: keine Karten ohne Ursprungssatz). Kein `fsrs`:
// `readFsrs` leitet es aus den alten Feldern ab, genau wie bei jeder Karte der alten App.

export type CardOrigin = {
  v: 1;
  // Phase 5: 'preply' (früherer Lehrer-Import), 'translate' (Übersetzer), 'companion' (Begleiter);
  // 'teacher' (Lehrer-Feedback, ab 28.09.2026)
  kind: 'trainer' | 'intro' | 'summary' | 'lookup' | 'daily' | 'lesson' | 'user' | 'ai' | 'speak' | 'business' | 'preply' | 'teacher' | 'translate' | 'companion'
    // Phase 4: Lesen, Hören, Schreiben, Entdecken (F21)
    | 'read' | 'listen' | 'write' | 'discover'
    // C1-Paket (02.10.2026)
    | 'pack';
  ref?: string;
  title?: string;
  t: number;
};

export type NewVocabInput = {
  word: string;
  de: string;
  pos?: string | null;
  def?: string | null;
  level?: string | null;
  ex?: string | null;
  surface?: string | null;
  /** Phase 2 (M2): `user` eigenes Wort, `ai` bzw. `job` von Claude vorgeschlagen. */
  src: 'lookup' | 'coach' | 'lesson' | 'user' | 'ai' | 'job' | 'preply' | 'teacher' | 'translate' | 'claude' | 'read' | 'listen' | 'write' | 'pack';
  /** Lektion, aus der die Karte stammt (`src:'lesson'`, Phase 2 D17). */
  lesson?: string | null;
  origin: CardOrigin;
  today: string;
  /**
   * Nur NEUE Karten behalten diese Felder (Lernplattform 2.0 §4.8): Register, Begründung, Merkhilfe, gleichwertige Varianten
   * und Wortfamilie. Bestehende Karten werden nie beschrieben; ihre fehlenden Felder legt `packExtraOf` beim Lesen darüber.
   */
  keep?: { register?: 'formal' | 'neutral' | 'informal'; why?: string; tip?: string; alt?: readonly string[]; fam?: Readonly<Record<string, string>> };
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
      ...keepFields(i.keep),
    },
  };
}

/** Ergänzende Felder neuer Karten, begrenzt (`alt` ≤ 4, Texte ≤ 220 Zeichen). */
function keepFields(k: NewVocabInput['keep']): Record<string, unknown> {
  if (!k) return {};
  const text = (v: string | undefined): string | undefined => (v && v.trim() ? v.trim().slice(0, 220) : undefined);
  const why = text(k.why);
  const tip = text(k.tip);
  const alt = (k.alt ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 4);
  const fam = k.fam && Object.keys(k.fam).length ? k.fam : undefined;
  return { ...(k.register ? { register: k.register } : {}), ...(why ? { why } : {}), ...(tip ? { tip } : {}), ...(alt.length ? { alt } : {}), ...(fam ? { fam } : {}) };
}

/**
 * Schreibweg „Als Karte speichern" (Plan §3.1): fehlt → anlegen; da, aber ohne Beispielsatz →
 * Satz und Ursprung ergänzen; sonst nichts. Ausgeblendete Karten bleiben unberührt.
 */
export function saveCardOp(cur: Readonly<Record<string, unknown>> | undefined, made: { doc: Record<string, unknown> }): { set: Record<string, unknown> } | { update: Record<string, unknown> } | null {
  if (!cur) return mayCreateDoc('vocab') ? { set: made.doc } : null;
  if (cur.hidden === true) return null;
  const ex = typeof cur.ex === 'string' ? cur.ex.trim() : '';
  if (!ex && cur.origin === undefined) return { update: { ex: made.doc.ex, origin: made.doc.origin } };
  if (!ex) return { update: { ex: made.doc.ex } };
  return null;
}
