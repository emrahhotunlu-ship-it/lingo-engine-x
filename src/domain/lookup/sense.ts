import { isIrregularPast } from '../text/lemma';
import { normalizeWord } from '../text/tokenize';
import type { Token } from '../text/types';

// Sinn-Auswahl beim Wort-Antippen (Emrahs Meldung 25.10.2026: „declined“ im Satz „The candidate declined to commit to …“ zeigte
// „decline · Nomen · Rückgang“). Rein und testbar:
//   1. `guessPos`: Wortart aus Endung und Satzstellung (Artikel, Hilfsverb, „to“, Pronomen, Präposition, Folgewort) als Punktwerte,
//      entschieden nur zwischen den Wortarten, die die Einträge des Worts überhaupt haben.
//   2. `rankSenses`: Bedeutungen aus eigener Karte, Zwischenspeicher und Wörterbuch so ordnen, dass die zur Verwendung passende vorn
//      steht; eine andere Wortart kommt als „Auch“-Zeile darunter; bleibt es offen, sagt `fit` das ehrlich („unsure“/„mismatch“).
//   3. `targetPart`: Ist das Wort Teil der Ziel-Wendung des Satzes (Karte mit Ursprungssatz), gilt deren Bedeutung zuerst –
//      nie in einer offenen Aufgabe (Lücke oder verdeckte Lösung im Satz), sonst stünde die Lösung im Fenster.

/** Wortarten, die die Satzstellung unterscheiden kann. */
export type GuessPos = 'noun' | 'verb' | 'adj' | 'adv';
export type PosScores = Readonly<Record<GuessPos, number>>;

export type PosGuess = {
  pos: GuessPos | null;
  /** sure: klare Belege (z. B. „will …“, „the …“); weak: nur Endung oder schwache Stellung. */
  strength: 'sure' | 'weak' | null;
  /** -ed/-ing direkt vor einem Hauptwort („Adjusted earnings“, „the revised plan“): Partizip als Eigenschaftswort. */
  attributive: boolean;
  scores: PosScores;
};

const set = (s: string): ReadonlySet<string> => new Set(s.split(' '));
const DETS = set('a an the this these those my your his its our their every each another no any some such either neither much many several few whose');
const MODALS = set("can could will would shall should may might must do does did don't doesn't didn't won't can't cannot couldn't wouldn't shouldn't mustn't");
const SUBJ = set('i you we they he she who');
const BE = set("am is are was were be been being isn't aren't wasn't weren't");
const HAVE = set("has have had haven't hasn't hadn't");
const GET = set('get gets got gotten become becomes became');
const PREPS = set('of in on at for with by from about into onto over under between among against during without within through after before since until toward towards across behind beyond despite upon via per throughout amid');
const OBJ = set('me him them us it');
const SKIP = set('not never always also just often still already only even really usually sometimes rarely ever soon then now quickly simply finally actually');
const FUNC = set('and or but so if when while because although though than as that which who whom whose what where why how to not');
/** „to“ nach diesen Wörtern ist eine Präposition („key to success“), kein Infinitiv. */
const TO_PREP = set('key due according thanks next close prior compared related access commitment contribution approach solution response attention reference exposure damage threat return trip visit addition subject open similar equal opposed used devoted committed dedicated linked contrary relative');
/** Häufige Endungen auf -ly, die keine Adverbien sind. */
const LY_NOT_ADV = set('supply reply apply rely ally fly family only early daily weekly monthly yearly likely unlikely friendly costly timely lovely elderly silly holy july italy assembly anomaly monopoly multiply comply imply belly jelly rally');
/** Richtungs-/Ortsadverbien nach einem Verb („come back“, „look forward“, „live underground“). */
const ARTICLES = set('a an the my your his her its our their whose');
const RIGHT_ADV = set('now here there away after before behind at in on into next');
const PARTICLE = set('back forward ahead away home abroad upstairs downstairs underground overseas apart aside outside inside');

const zero = (): Record<GuessPos, number> => ({ noun: 0, verb: 0, adj: 0, adv: 0 });

type Ctx = { word: (i: number) => string | null };

/** Index des nächsten Worts vor/nach `i` im selben Satzstück (Satzzeichen trennt; das Genitiv-„'s“ gehört zum Wort). */
function step(tokens: readonly Token[], i: number, dir: -1 | 1): number {
  for (let k = i + dir; k >= 0 && k < tokens.length; k += dir) {
    const t = tokens[k];
    if (!t || t.kind === 'space') continue;
    if (t.kind === 'word') return k;
    return -1;
  }
  return -1;
}

const isEd = (w: string): boolean => /[a-z]{2,}(?:ed|en)$/.test(w) && !/(?:een|ien|oen)$/.test(w);
const isIng = (w: string): boolean => /[a-z]{2,}ing$/.test(w) && !/^(?:thing|nothing|something|anything|everything|king|ring|spring|string|bring|sing|swing|wing|sting|during|morning|evening|ceiling)$/.test(w);
const isPlural = (w: string): boolean => /[a-z]{2,}s$/.test(w) && !/(?:ss|us|is|ous|ics)$/.test(w);
const possessive = (w: string): boolean => /'s$|s'$/.test(w);

/**
 * Wortart des Worts an `index` aus Endung und Satzstellung. `posOf(word)` liefert die Wortarten eines Nachbarworts laut Wörterbuch
 * (für „a sharp decline“: „sharp“ ist ein Eigenschaftswort → danach ein Hauptwort). `allowed`: Wortarten, zwischen denen entschieden wird.
 */
export function guessPos(tokens: readonly Token[], index: number, posOf: (w: string) => readonly string[] = () => [], allowed?: readonly string[]): PosGuess {
  const s = zero();
  const tok = tokens[index];
  const w = tok ? normalizeWord(tok.text) : '';
  const ctx: Ctx = { word: (i) => (i >= 0 && tokens[i] ? normalizeWord(tokens[i].text) : null) };
  let pi = step(tokens, index, -1);
  // Adverbien zwischen Hilfsverb/Subjekt und Wort überspringen („will not decline“, „she also declined“).
  let skipped = 0;
  while (pi >= 0 && skipped < 2 && SKIP.has(ctx.word(pi) ?? '')) {
    pi = step(tokens, pi, -1);
    skipped += 1;
  }
  // Abkürzungen in Großbuchstaben („IT support“) sind kein Fürwort.
  const p1Raw = pi >= 0 ? (tokens[pi]?.text ?? '') : '';
  const p1 = /^[A-Z]{2,}$/.test(p1Raw) ? `${normalizeWord(p1Raw)}#acr` : ctx.word(pi);
  const p2 = ctx.word(pi >= 0 ? step(tokens, pi, -1) : -1);
  const ni = step(tokens, index, 1);
  const n1 = ctx.word(ni);
  const n2 = ctx.word(ni >= 0 ? step(tokens, ni, 1) : -1);
  const ed = isEd(w) || isIrregularPast(w);
  const ing = isIng(w);
  const plural = isPlural(w);
  const p1Pos = p1 ? posOf(p1) : [];
  const n1Pos = n1 ? posOf(n1) : [];
  const n1Content = !!n1 && !FUNC.has(n1) && !DETS.has(n1) && !PREPS.has(n1) && !OBJ.has(n1) && !BE.has(n1) && !HAVE.has(n1) && !MODALS.has(n1) && !SUBJ.has(n1);
  const n1Nounish = n1Content && (n1Pos.includes('noun') || isPlural(n1 ?? '') || n1Pos.length === 0) && !(n1 && isIrregularPast(n1));

  // Endungen
  if (ed) s.verb += 1.5;
  if (ing) {
    s.verb += 1;
    s.noun += 0.3;
  }
  if (/[a-z]{3,}ly$/.test(w) && !LY_NOT_ADV.has(w)) s.adv += 2;
  if (plural) {
    s.noun += 0.5;
    s.verb += 0.4;
  }

  // Das Wort selbst ist ein Hilfsverb („will lead“, „can help“) – außer nach Artikel/Possessiv („his will“, „a can“).
  // „this/that/some …“ können selbst Subjekt sein („this will turn out“); nur Artikel und Possessiv machen ein Hauptwort daraus.
  const ownerBefore = !!p1 && (ARTICLES.has(p1) || possessive(p1));
  if (MODALS.has(w) && !ownerBefore) s.verb += 6;
  // „right now“, „right here“, „right after the call“
  if (w === 'right' && n1 && RIGHT_ADV.has(n1)) s.adv += 4;
  // Richtungsadverb nach einem Verb oder Hilfsverb („be back“, „looking forward“).
  if (PARTICLE.has(w) && !ownerBefore && !(p1 && PREPS.has(p1))) s.adv += 3;
  // Eigenschaftswort direkt vor einem Hauptwort („chemical weapons“, „human knowledge“).
  if (n1Nounish && (n1Pos.includes('noun') || n1Pos.length === 0) && !ed && !ing && !plural) s.adj += 1;
  // Gradadverbien und Zeitadverbien („still with“, „just sent“, „well established“).
  if (SKIP.has(w) && !ownerBefore) s.adv += 2.5;
  // Hauptwort in der Mehrzahl als Objekt am Satzende oder vor einer Präposition („raise concerns about“, „cut costs but“).
  if (plural && p1Pos.includes('verb') && (!n1 || PREPS.has(n1) || n1 === 'and' || n1 === 'or' || n1 === 'but')) s.noun += 1;

  // Das Wort davor
  if (p1 === null) {
    // Satzanfang: Grundform + Artikel/Objekt danach = Aufforderung („Address the issue first.“)
    if (!ed && !ing && !plural && n1 && (DETS.has(n1) || OBJ.has(n1))) s.verb += 2;
  } else if (DETS.has(p1)) {
    s.noun += 3;
    s.adj += n1Nounish ? 2.5 : 0.5;
    s.verb -= 2;
  } else if (possessive(p1)) {
    s.noun += 3;
    s.adj += n1Nounish ? 2 : 0;
    s.verb -= 2;
  } else if (MODALS.has(p1)) {
    if (!ed && !plural && !ing) s.verb += 3.5;
    else if (ed && p1.startsWith('do')) s.adj += 0.5;
  } else if (p1 === 'to') {
    if (p2 && TO_PREP.has(p2)) {
      s.noun += 2;
      if (ing) s.verb += 1;
    } else if (!plural && !ed) s.verb += 2.5;
    else if (plural) s.noun += 1.5;
  } else if (SUBJ.has(p1) || p1 === 'it' || p1 === 'they') {
    s.verb += ing ? 0.5 : 3;
  } else if (BE.has(p1)) {
    if (ing) s.verb += 3;
    else if (ed) {
      s.verb += 2;
      s.adj += 1.5;
    } else {
      s.adj += 2.5;
      s.noun += 1;
      s.verb -= 1;
    }
  } else if (HAVE.has(p1)) {
    if (ed) s.verb += 3;
    else s.noun += 1.5;
  } else if (GET.has(p1)) {
    if (ed) s.verb += 1.5;
    else s.adj += 2;
  } else if (PREPS.has(p1)) {
    if (ing) s.verb += 2;
    else {
      s.noun += 2.5;
      s.adj += n1Nounish ? 2 : 0.5;
      s.verb -= 1;
    }
  } else if (/[a-z]{3,}ly$/.test(p1) && !LY_NOT_ADV.has(p1)) {
    // „sharply declined“, „highly reliable“
    if (ed || plural) s.verb += 1.5;
    s.adj += 1;
  } else if (p1Pos.length > 0) {
    const only = (p: string) => p1Pos.every((x) => x === p);
    if (only('adj')) {
      s.noun += 2.5;
      s.verb -= 1;
    } else if (only('verb') && !ed && !ing) {
      // Objekt nach einem Verb („need support“)
      s.noun += 2;
      s.adj += n1Nounish ? 1 : 0;
    } else if (p1Pos.includes('noun') && !p1Pos.includes('adj')) {
      // Subjekt + gebeugtes Verb („The candidate declined“, „Sales decline“) oder Zusammensetzung („market share“)
      if (ed) s.verb += 2;
      else if (plural && !isPlural(p1)) {
        // „The road leads to …“, „The client objects that …“ (Verb mit Ergänzung) gegen „railroad tracks“, „security updates.“ (zusammengesetztes Hauptwort)
        if (n1 && (DETS.has(n1) || OBJ.has(n1) || n1 === 'to' || n1 === 'that' || /[a-z]{3,}ly$/.test(n1))) s.verb += 1.5;
        else s.noun += 1;
      }
      else if (!plural && isPlural(p1) && n1 && (DETS.has(n1) || OBJ.has(n1) || PREPS.has(n1))) s.verb += 1.5;
      else s.noun += 1;
    }
  }

  // Das Wort danach
  if (n1) {
    if (DETS.has(n1) || OBJ.has(n1)) {
      // Verb mit Objekt („address the issue“, „lead them“)
      s.verb += 2;
      s.noun -= 0.5;
    } else if (n1 === 'of') {
      s.noun += 2;
    } else if ((BE.has(n1) || MODALS.has(n1) || (HAVE.has(n1) && !ed)) && !(p1 && (SUBJ.has(p1) || p1 === 'it' || p1 === 'they' || MODALS.has(p1)))) {
      // Subjekt vor „is/will/has …“ („IT support is available“, „Utility charges will go up“)
      s.noun += plural ? 2 : 1.5;
    } else if (n1 === 'to' && n2 && !DETS.has(n2)) {
      // „declined to commit“ – Verb mit Infinitiv
      s.verb += 0.5;
    }
  }
  // Partizip als Eigenschaftswort direkt vor einem Hauptwort („Adjusted earnings came …“, „the revised plan“)
  // Ausnahme: „The meeting starts at nine.“ – eigenes -ing-Hauptwort + gebeugtes Verb mit Ergänzung ist Subjekt + Verb.
  const subjectThenVerb = ing && posOf(w).includes('noun') && !!n1 && isPlural(n1) && posOf(n1).includes('verb') && !!n2 && (DETS.has(n2) || PREPS.has(n2) || OBJ.has(n2));
  if (subjectThenVerb) s.noun += 1.5;
  const attributive = !subjectThenVerb && (ed || ing) && n1Nounish && (p1 === null || DETS.has(p1) || possessive(p1) || PREPS.has(p1) || p1Pos.every((p) => p === 'adj') || (!!p1 && /ly$/.test(p1))) && !(n1 && (DETS.has(n1) || OBJ.has(n1)));
  if (attributive) {
    s.adj += 2.5;
    s.verb -= 0.5;
  }

  // Ein Partizip vor dem Hauptwort ist nie ein Hauptwort („the shared drive“); hat das Wort keine Eigenschaftswort-Bedeutung,
  // bleibt die Vermutung trotzdem „adj“ (rankSenses zeigt dann die Verb-Bedeutung als unsicher).
  if (attributive && ed) s.noun = Math.min(s.noun, 0);
  const base = (allowed ?? ['noun', 'verb', 'adj', 'adv']).filter((p): p is GuessPos => p === 'noun' || p === 'verb' || p === 'adj' || p === 'adv');
  const allow = attributive && !base.includes('adj') ? [...base, 'adj' as const] : base;
  const ranked = [...allow].sort((a, b) => s[b] - s[a]);
  const best = ranked[0];
  if (!best || s[best] <= 0) return { pos: null, strength: null, attributive, scores: s };
  const second = ranked[1] !== undefined ? s[ranked[1]] : 0;
  const margin = s[best] - Math.max(0, second);
  if (margin < 0.5) return { pos: null, strength: null, attributive, scores: s };
  return { pos: best, strength: s[best] >= 2 && margin >= 1 ? 'sure' : 'weak', attributive, scores: s };
}

// ------------------------------------------------------------------ Bedeutungen ordnen

export type SenseSource = 'card' | 'cache' | 'dict' | 'target';
export type SenseCand = { pos: string | null; de: string | null; def: string | null; from: SenseSource };

/**
 * target: Teil der Ziel-Wendung · pos: Wortart passt zur Verwendung · single: das Wort hat nur eine Wortart · unsure: mehrere Wortarten,
 * Satzstellung entscheidet nicht · mismatch: die Verwendung passt zu keiner bekannten Bedeutung · none: keine Bedeutung.
 */
export type SenseFit = 'target' | 'pos' | 'single' | 'unsure' | 'mismatch' | 'none';

export type SenseRanking = {
  /** Die zuerst gezeigte Bedeutung (bei `mismatch` null: lieber keine als eine unpassende). */
  primary: SenseCand | null;
  /** Höchstens eine weitere Bedeutung mit anderer Wortart („Auch: Nomen – Rückgang“). */
  also: SenseCand | null;
  fit: SenseFit;
  guess: PosGuess | null;
};

const ORDER: Readonly<Record<SenseSource, number>> = { target: 0, card: 1, cache: 2, dict: 3 };
const baseOf = (p: string | null): string | null => (p ? (p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p.toLowerCase()) : null);

/** Wortart einer Karte ohne Angabe: über die deutsche Bedeutung im Wörterbuch („Rückgang“ steht beim Nomen). */
export function inferCardPos(card: SenseCand, dict: readonly SenseCand[]): string | null {
  if (card.pos) return baseOf(card.pos);
  const words = (s: string | null) => new Set((s ?? '').toLowerCase().split(/[,;/()]+/).map((x) => x.trim()).filter(Boolean));
  const mine = words(card.de);
  if (!mine.size) return null;
  const hits = new Set(dict.filter((d) => [...words(d.de)].some((x) => mine.has(x))).map((d) => baseOf(d.pos)));
  return hits.size === 1 ? ([...hits][0] ?? null) : null;
}

/**
 * Bedeutungen in Anzeige-Reihenfolge. Ohne verwertbare Wortart bleibt es bei Karte → Zwischenspeicher → Wörterbuch.
 * Mit Wortart steht die passende Bedeutung vorn (innerhalb derselben Wortart weiter Karte vor Zwischenspeicher vor Wörterbuch).
 */
export function rankSenses(cands: readonly SenseCand[], guess: PosGuess | null): SenseRanking {
  const dict = cands.filter((c) => c.from === 'dict');
  const list = cands
    .filter((c) => !!(c.de || c.def))
    .map((c) => ({ ...c, pos: c.from === 'card' || c.from === 'cache' ? (inferCardPos(c, dict) ?? baseOf(c.pos)) : baseOf(c.pos) }))
    .sort((a, b) => ORDER[a.from] - ORDER[b.from]);
  if (!list.length) return { primary: null, also: null, fit: 'none', guess };
  const target = list.find((c) => c.from === 'target');
  const posSet = new Set(list.map((c) => c.pos ?? '?'));
  const alsoOf = (primary: SenseCand | null): SenseCand | null => {
    const p = primary?.pos ?? null;
    return list.find((c) => c !== primary && c.from !== 'target' && c.pos && c.pos !== p && (!primary || (c.de ?? c.def) !== (primary.de ?? primary.def))) ?? null;
  };
  if (target) return { primary: target, also: null, fit: 'target', guess };
  const single = posSet.size === 1;
  if (!guess?.pos) {
    const primary = list[0] ?? null;
    // Eine Karte oder ein Eintrag ohne Wortart lässt sich nicht prüfen: nur bei einer einzigen bekannten Wortart sicher.
    return { primary, also: alsoOf(primary), fit: single && !posSet.has('?') ? 'single' : 'unsure', guess };
  }
  const want = guess.pos;
  const match = list.find((c) => c.pos === want);
  if (match) return { primary: match, also: alsoOf(match), fit: single ? 'single' : 'pos', guess };
  // Partizip vor einem Hauptwort: ein Verb-Eintrag passt nur halb („adjusted“ = bereinigt, nicht „anpassen“) – zeigen, aber unsicher.
  if (guess.attributive) {
    const verb = list.find((c) => c.pos === 'verb');
    if (verb) return { primary: verb, also: alsoOf(verb), fit: 'unsure', guess };
  }
  // Keine Bedeutung dieser Wortart. Unbekannte Wortart (Karte ohne pos) bleibt vorn, aber unsicher.
  const unknown = list.find((c) => c.pos === null);
  if (unknown) return { primary: unknown, also: alsoOf(unknown), fit: 'unsure', guess };
  // Nur geschlossene Wortarten (prep, conj, pron …) oder schwache Belege: nichts umstellen, aber ehrlich bleiben.
  const open = list.filter((c) => c.pos === 'noun' || c.pos === 'verb' || c.pos === 'adj' || c.pos === 'adv');
  if (guess.strength !== 'sure' || open.length < list.length) {
    const primary = list[0] ?? null;
    return { primary, also: alsoOf(primary), fit: 'unsure', guess };
  }
  return { primary: null, also: list[0] ?? null, fit: 'mismatch', guess };
}

// ------------------------------------------------------------------ Ziel-Wendung des Satzes

type Span = readonly [number, number];

export type TargetPart = { phrase: string; de: string | null; def: string | null; pos: string | null; single: boolean };

/**
 * Ist das angetippte Wort (Zeichen `start`–`end`) Teil der Ziel-Wendung `target` im Satz? `locate` findet die Wendung (gebeugt).
 * In einer offenen Aufgabe (`gaps` nicht leer: Lücke oder verdeckte Lösung) nie – sonst stünde die Lösung im Fenster.
 */
export function targetPart(
  text: string,
  start: number,
  end: number,
  gaps: readonly Span[] | undefined,
  target: { word: string; de: string | null; def: string | null; pos: string | null } | null,
  locate: (sentence: string, phrase: string) => { start: number; end: number } | null,
): TargetPart | null {
  if (!target || (gaps && gaps.length > 0)) return null;
  if (!target.de && !target.def) return null;
  const phrase = target.word.trim().replace(/^to\s+/i, '').replace(/\s*(…|\.\.\.)\s*$/, '');
  if (!phrase) return null;
  const hit = locate(text, phrase);
  if (!hit || start < hit.start || end > hit.end) return null;
  return { phrase: target.word.trim(), de: target.de, def: target.def, pos: target.pos, single: !/\s/.test(phrase) };
}
