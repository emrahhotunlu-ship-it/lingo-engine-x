import { packExtraOf } from '../c1pack/packFields';
import type { ExplainExample, ExplainLine, ExplanationModel, ResultVerdict } from '../explain/types';
import { normalize, withoutTo } from '../answer/normalize';
import { meaningOf, shortMeaning } from './cards';
import { trapForCard, matchTrapInAnswer } from './traps';
import { chunkWhy } from './chunkCards';
import type { CheckResult, ExerciseId, Lang, TrainCard } from './types';

// Erklär-Karte einer Wörter-Übung (Lernplattform 2.0 §4.8): Rein und deterministisch. Die Warum-Zeile nennt den ECHTEN Grund des
// Fehlers: Verwechslung zweier Wörter, falsche Option, Deutsch-Falle, Partnerwort, Register – nie einen allgemeinen Satz.
// Reihenfolge der Zeilen wie überall: pattern → yours → why → mistake → contrast → note. Beispiele nur von dieser Karte.

type Bi = { de: string; en: string };
const pick = (b: Bi, lang: Lang): string => (lang === 'de' ? b.de : b.en);
const q = (s: string): string => `„${s}“`;
const qe = (s: string): string => `“${s}”`;
const quote = (s: string, lang: Lang): string => (lang === 'de' ? q(s) : qe(s));

const POS: Record<string, Bi> = {
  noun: { de: 'Nomen', en: 'noun' },
  verb: { de: 'Verb', en: 'verb' },
  adj: { de: 'Adjektiv', en: 'adjective' },
  adv: { de: 'Adverb', en: 'adverb' },
  prep: { de: 'Präposition', en: 'preposition' },
  conj: { de: 'Konjunktion', en: 'conjunction' },
  phrase: { de: 'Wendung', en: 'phrase' },
  phrasal: { de: 'Phrasal Verb', en: 'phrasal verb' },
};
const REGISTER: Record<string, Bi> = {
  formal: { de: 'formell', en: 'formal' },
  neutral: { de: 'neutral', en: 'neutral' },
  informal: { de: 'locker', en: 'informal' },
};

function posLabel(card: TrainCard, lang: Lang): string | null {
  const p = (card.pos ?? '').toLowerCase();
  const k = p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p.includes('phrasal') ? 'phrasal' : p;
  const b = POS[k];
  return b ? pick(b, lang) : null;
}

/** Register der Karte: eigene Angabe (Wendung, Karte), sonst das Paket (nur gelesen). */
export function registerOf(card: TrainCard): 'formal' | 'neutral' | 'informal' | null {
  const own = card.chunk?.register ?? (typeof card.doc.register === 'string' ? card.doc.register : null);
  if (own === 'formal' || own === 'neutral' || own === 'informal') return own;
  return packExtraOf(card)?.register ?? null;
}

const key = (s: string): string => withoutTo(normalize(s));

/** Ist die Antwort eine gleichwertige Variante aus dem Paket (`alt`), z. B. „restriction“ für „constraint“? Dann „Fast richtig“, kein Fehler. */
export function isAltAnswer(card: TrainCard, given: string): boolean {
  const g = key(given);
  if (!g) return false;
  const alt = packExtraOf(card)?.alt ?? [];
  return alt.some((a) => key(a) === g);
}

export type ExplainWordInput = {
  card: TrainCard;
  ex: ExerciseId;
  verdict: ResultVerdict;
  given: string;
  /** Prüfergebnis (inkl. `kind: 'confusable'` + `otherWord`, `variant: 'uk'`). */
  check: Pick<CheckResult, 'verdict' | 'kind' | 'otherWord' | 'variant' | 'us'>;
  /** Auswahl: das gewählte Wort bzw. die gewählte Bedeutung stammt von einer anderen Karte. */
  picked?: { label?: string; fromWord?: string; fromMeaning?: string } | null;
  lang: Lang;
  /** Bedeutung des verwechselten Worts (getippt, `confusable`), falls die Oberfläche die Karte kennt. */
  otherMeaning?: string | null;
  /** Lösung der Übung (Anzeigeform), sonst das Kartenwort. */
  solution?: string;
  /** Beispiele dieser Karte (Ursprungssatz zuerst); sonst nur der Ursprungssatz. */
  examples?: readonly ExplainExample[];
  /** Fast richtig, weil die Antwort eine Variante aus `alt` ist. */
  alt?: boolean;
};

const CHOICE_EX: ReadonlySet<ExerciseId> = new Set(['mc_en', 'mc_de', 'ctx_mc', 'listen_mc', 'match', 'colloc_gap']);

export function explainWord(i: ExplainWordInput): ExplanationModel {
  const { card, lang } = i;
  const lines: ExplainLine[] = [];
  const meaning = meaningOf(card, lang);
  const solution = i.solution ?? card.word;
  const extra = packExtraOf(card);
  const reg = registerOf(card);
  const trap = trapForCard(card);
  const wrong = i.verdict === 'wrong';
  const formula = extra?.col?.[0]?.en ?? null;

  // 1. Wort · Wortart · Register, Formel = Hauptverbindung
  const head = [card.word, posLabel(card, lang), reg ? pick(REGISTER[reg] as Bi, lang) : null].filter(Boolean).join(' · ');
  lines.push({ k: 'pattern', name: head, formula });

  // 2. Deine Antwort: der echte Grund, je Fehlerart
  const shown = (i.picked?.label ?? i.given).trim();
  let yours: string | null = null;
  if (wrong) {
    const pk = i.picked;
    if (CHOICE_EX.has(i.ex) && i.ex !== 'colloc_gap' && pk?.fromWord) {
      // Auswahl: die gewählte Option gehört zu einer anderen Karte.
      yours =
        i.ex === 'mc_en' || i.ex === 'ctx_mc' || i.ex === 'listen_mc'
          ? pick({ de: `${quote(shown, lang)} heißt ${quote(pk.fromWord, lang)} (gehört zu ${quote(pk.fromWord, lang)}). ${quote(card.word, lang)} heißt ${meaning ? quote(shortMeaning(meaning, lang), lang) : '…'}.`, en: `${quote(shown, lang)} means ${quote(pk.fromWord, lang)} (belongs to ${quote(pk.fromWord, lang)}). ${quote(card.word, lang)} means ${meaning ? quote(shortMeaning(meaning, lang), lang) : '…'}.` }, lang)
          : pick({ de: `${quote(shown, lang)} heißt ${pk.fromMeaning ? quote(shortMeaning(pk.fromMeaning, lang), lang) : '…'} (gehört zu ${quote(shown, lang)}). Gesucht war ${quote(solution, lang)}.`, en: `${quote(shown, lang)} means ${pk.fromMeaning ? quote(shortMeaning(pk.fromMeaning, lang), lang) : '…'} (belongs to ${quote(shown, lang)}). You needed ${quote(solution, lang)}.` }, lang);
    } else if (i.check.kind === 'confusable' && i.check.otherWord) {
      const o = i.check.otherWord;
      const om = i.otherMeaning ? quote(shortMeaning(i.otherMeaning, lang), lang) : null;
      yours = pick(
        { de: `${quote(o, lang)} heißt ${om ?? 'etwas anderes'} – gesucht war ${quote(solution, lang)}${meaning ? ` (${shortMeaning(meaning, lang)})` : ''}.`, en: `${quote(o, lang)} means ${om ?? 'something else'} – you needed ${quote(solution, lang)}${meaning ? ` (${shortMeaning(meaning, lang)})` : ''}.` },
        lang,
      );
    } else if (i.ex === 'find_trap') {
      if (trap) yours = pick(trap.why, lang);
    } else if (i.ex === 'colloc_gap' || i.ex === 'colloc') {
      const w = extra?.why;
      const base = pick({ de: `Mit dieser Verbindung sagt man ${quote(solution, lang)}, nicht ${quote(shown || '…', lang)}.`, en: `This phrase takes ${quote(solution, lang)}, not ${quote(shown || '…', lang)}.` }, lang);
      yours = w && lang === 'de' ? `${base} ${w}` : base;
    } else {
      const hit = i.given ? matchTrapInAnswer(i.given) : null;
      if (hit) yours = pick(hit.trap.why, lang);
    }
  }
  if (yours && yours.trim()) lines.push({ k: 'yours', given: shown, text: yours });

  // 3. Merke (auch bei richtiger Antwort, dann mindestens diese Zeile)
  const why = chunkWhy(card, lang) ?? (lang === 'de' ? extra?.why : null) ?? null;
  const merke = formula
    ? pick({ de: `Merke: ${formula}${reg ? ` · ${pick(REGISTER[reg] as Bi, 'de')}` : ''}`, en: `Remember: ${formula}${reg ? ` · ${pick(REGISTER[reg] as Bi, 'en')}` : ''}` }, lang)
    : meaning
      ? pick({ de: `Merke: ${card.word} = ${shortMeaning(meaning, lang)}`, en: `Remember: ${card.word} = ${shortMeaning(meaning, lang)}` }, lang)
      : card.word;
  lines.push({ k: 'why', text: why ? `${merke}. ${why}` : merke });

  // 4. Typischer Fehler: die Deutsch-Falle der Karte
  if (trap) lines.push({ k: 'mistake', bad: trap.wrong, good: trap.right, cause: pick(trap.why, lang) });

  // 5. Kontrast: das verwechselte Wort
  if (i.check.kind === 'confusable' && i.check.otherWord && wrong) {
    lines.push({ k: 'contrast', a: card.word, b: i.check.otherWord, diff: i.otherMeaning ? `${shortMeaning(meaning ?? '', lang)} ≠ ${shortMeaning(i.otherMeaning, lang)}` : '' });
  } else if (i.picked?.fromWord && wrong) {
    lines.push({ k: 'contrast', a: card.word, b: i.picked.fromWord, diff: i.picked.fromMeaning ? `${shortMeaning(meaning ?? '', lang)} ≠ ${shortMeaning(i.picked.fromMeaning, lang)}` : '' });
  }

  // 6. Hinweise: US-Form, „Auch möglich“, Register
  if (i.check.variant === 'uk' && i.check.us) lines.push({ k: 'note', text: pick({ de: `US-Schreibweise: ${i.check.us}`, en: `US spelling: ${i.check.us}` }, lang) });
  if (i.alt || (i.verdict === 'near' && isAltAnswer(card, i.given))) lines.push({ k: 'note', text: pick({ de: `Auch möglich: ${i.given.trim()} (gleichwertig mit ${solution}).`, en: `Also possible: ${i.given.trim()} (equivalent to ${solution}).` }, lang) });
  else if (extra?.alt?.length) lines.push({ k: 'note', text: pick({ de: `Auch möglich: ${extra.alt.join(', ')}`, en: `Also possible: ${extra.alt.join(', ')}` }, lang) });
  if (reg && reg !== 'neutral' && !formula) lines.push({ k: 'note', text: pick({ de: `Register: ${pick(REGISTER[reg] as Bi, 'de')}`, en: `Register: ${pick(REGISTER[reg] as Bi, 'en')}` }, lang) });

  // Beispiele: nur von dieser Karte
  const seen = new Set<string>();
  const examples: ExplainExample[] = [];
  const add = (e: ExplainExample) => {
    const k = e.en.toLowerCase().trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    examples.push(e);
  };
  if (card.context) add({ en: card.context.sentence, de: null, ctx: null });
  for (const e of i.examples ?? []) add(e);
  for (const c of extra?.col ?? []) if (c.ex) add({ en: c.ex, de: null, ctx: null });

  return { lines, examples, mark: [card.word, card.lemma].filter((w, k, a) => w && a.indexOf(w) === k), ai: false, source: 'card' };
}
