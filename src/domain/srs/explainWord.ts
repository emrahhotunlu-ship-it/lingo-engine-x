import { packExtraOf } from '../c1pack/packFields';
import type { ExplainExample, ExplainLine, ExplanationModel, ResultVerdict } from '../explain/types';
import { normalize, withoutTo } from '../answer/normalize';
import { meaningOf, shortMeaning } from './cards';
import { trapForCard, matchTrapInAnswer } from './traps';
import { chunkWhy } from './chunkCards';
import { locate } from './context';
import type { CheckResult, Colloc, ExerciseId, Lang, TrainCard } from './types';

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
  /** Beispiele dieser Karte (Ursprungssatz zuerst, außer die Frage zeigt ihn schon). */
  examples?: readonly ExplainExample[];
  /** Fast richtig, weil die Antwort eine Variante aus `alt` ist. */
  alt?: boolean;
  /** Die Frage (oder die Rückseite) zeigt die deutsche Bedeutung schon: „Merke“ nennt sie nicht noch einmal (Kap. 15). */
  meaningShown?: boolean;
  /** `contrast` (P52): die Begründung von Claude in der Oberflächensprache; sie ist die Warum-Zeile, auch bei richtiger Antwort. */
  contrastWhy?: string | null;
  /** `contrast` (P52): das richtige (andere) Wort mit Kurzbedeutung. Die Kopfzeile nennt es, die Kontrastzeile steht immer (auch bei richtiger Antwort). */
  contrastOther?: { word: string; meaning: string | null } | null;
  /** „Wortpartner“ (`colloc`, `colloc_gap`): die geübte Verbindung. Kopf, Merke und Beispiele nennen SIE, das Kartenwort nur als Zusatz. */
  colloc?: Pick<Colloc, 'p' | 'de' | 'gap' | 'opts'> | null;
};

/** Die Verbindung mit einem anderen Partnerwort an der Stelle der Lücke („overcome objections“ → „overcome proposals“). */
export function swapPartner(p: string, gap: string, other: string): string {
  const hit = gap ? locate(p, gap) : null;
  return hit ? `${p.slice(0, hit.start)}${other}${p.slice(hit.end)}` : other;
}

/** Steht die Verbindung (bzw. ihr Partnerwort zusammen mit dem Kartenwort) im Satz? */
function showsColloc(sentence: string, c: Pick<Colloc, 'p' | 'gap'>, lemma: string): boolean {
  if (locate(sentence, c.p)) return true;
  return !!c.gap && !!locate(sentence, c.gap) && !!locate(sentence, lemma);
}

const CHOICE_EX: ReadonlySet<ExerciseId> = new Set(['mc_en', 'mc_de', 'ctx_mc', 'listen_mc', 'match', 'colloc_gap', 'contrast']);

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
  const cOther = i.ex === 'contrast' ? (i.contrastOther ?? null) : null;
  // Rückmeldung 3 (10.10.2026): Bei „Wortpartner“ heißt der Kopf wie die geübte Verbindung; das Kartenwort steht als Zusatz daneben.
  const col = (i.ex === 'colloc' || i.ex === 'colloc_gap') && i.colloc?.p.trim() ? i.colloc : null;
  const colExtra = col && key(col.p) !== key(card.word) ? card.word : null;
  const head = cOther ? cOther.word : col ? [col.p, colExtra].filter(Boolean).join(' · ') : [card.word, posLabel(card, lang), reg ? pick(REGISTER[reg] as Bi, lang) : null].filter(Boolean).join(' · ');
  lines.push({ k: 'pattern', name: head, formula: col ? null : formula });

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
      let base = pick({ de: `Mit dieser Verbindung sagt man ${quote(solution, lang)}, nicht ${quote(shown || '…', lang)}.`, en: `This phrase takes ${quote(solution, lang)}, not ${quote(shown || '…', lang)}.` }, lang);
      if (col) {
        // Was gewählt wurde, als Verbindung ausgeschrieben – und kurz, warum die anderen Angebote auch nicht passen (soweit die Daten es hergeben:
        // sie sind keine feste Verbindung mit dem Kartenwort).
        const good = col.p;
        const mine = shown ? swapPartner(good, col.gap, shown) : '';
        const others = col.opts.filter((o) => key(o) !== key(shown) && key(o) !== key(col.gap)).map((o) => quote(swapPartner(good, col.gap, o), lang));
        const list = (xs: string[], and: string): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${and} ${xs.at(-1) ?? ''}`);
        base = pick(
          {
            de: `Man sagt ${quote(good, lang)}${mine ? `, nicht ${quote(mine, lang)}` : ''}.${others.length ? ` Auch ${list(others, 'und')} ${others.length > 1 ? 'sind' : 'ist'} keine feste Verbindung.` : ''}`,
            en: `We say ${quote(good, lang)}${mine ? `, not ${quote(mine, lang)}` : ''}.${others.length ? ` ${list(others, 'and')} ${others.length > 1 ? 'are not fixed phrases' : 'is not a fixed phrase'} either.` : ''}`,
          },
          lang,
        );
      }
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
    : meaning && !i.meaningShown
      ? pick({ de: `Merke: ${card.word} = ${shortMeaning(meaning, lang)}`, en: `Remember: ${card.word} = ${shortMeaning(meaning, lang)}` }, lang)
      : card.word;
  if (col) {
    // Merke nennt die geübte Verbindung (mit deutscher Bedeutung), dann den Grund – auch bei richtiger Antwort (Kap. 2 Nr. 4) –,
    // zuletzt das Kartenwort als Zusatz.
    const partner = col.gap || solution;
    const lemma = card.lemma || card.word;
    const colMerke = pick({ de: `Merke: ${col.p}${col.de.trim() ? ` = ${col.de.trim()}` : ''}`, en: `Remember: ${col.p}` }, lang);
    const reason = pick(
      {
        de: `${quote(partner, lang)} ist ein fester Partner von ${quote(lemma, lang)}: Im Englischen sagt man es genau so, darum lernt man die Wörter als Paar`,
        en: `${quote(partner, lang)} is a fixed partner of ${quote(lemma, lang)}: this is simply how English puts it, so learn the words as a pair`,
      },
      lang,
    );
    const word = meaning && colExtra ? `${card.word} = ${shortMeaning(meaning, lang)}` : null;
    lines.push({ k: 'why', text: [`${colMerke}. ${reason}`, why, word].filter(Boolean).join('; ') });
  } else lines.push({ k: 'why', text: i.ex === 'contrast' && i.contrastWhy ? i.contrastWhy : why ? `${merke}. ${why}` : merke });

  // 4. Typischer Fehler: die Deutsch-Falle der Karte
  if (trap) lines.push({ k: 'mistake', bad: trap.wrong, good: trap.right, cause: pick(trap.why, lang) });

  // 5. Kontrast: das verwechselte Wort. Bei „Welches Wort passt?“ (P52) immer: a = richtiges Wort, b = Kartenwort, beide mit Kurzbedeutung.
  if (cOther) {
    const am = cOther.meaning ? shortMeaning(cOther.meaning, lang) : '';
    const bm = meaning ? shortMeaning(meaning, lang) : '';
    lines.push({ k: 'contrast', a: cOther.word, b: card.word, diff: am && bm ? `${am} ≠ ${bm}` : '', ...(i.ex === 'contrast' && am && bm ? { meaningOnly: true } : {}) });
  } else if (i.check.kind === 'confusable' && i.check.otherWord && wrong) {
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
  // Der Aufrufer reicht die Beispiele dieser Karte (Ursprungssatz nur, wenn die Frage ihn nicht schon zeigt – nichts doppelt, Kap. 15).
  // Wortpartner: nur Beispiele, in denen die geübte Verbindung vorkommt (ein Beispiel ohne den Partner widerspräche der Frage).
  const fits = (en: string): boolean => !col || showsColloc(en, col, card.lemma || card.word);
  for (const e of i.examples ?? []) if (fits(e.en)) add(e);
  for (const c of extra?.col ?? []) if (c.ex && fits(c.ex)) add({ en: c.ex, de: null, ctx: null });

  const mark = col ? [col.p, col.gap, card.lemma] : [card.word, card.lemma];
  return { lines, examples, mark: mark.filter((w, k, a) => w && a.indexOf(w) === k), ai: false, source: 'card' };
}
