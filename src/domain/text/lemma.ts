import irregularJson from '../../content/irregular.json';
import { normalizeWord } from './tokenize';

// Grundformen und US-Schreibweise (Entwurf §8 Schritt 2, Lerndesign §6).
// lemmaCandidates liefert Kandidaten in Vorzugsreihenfolge; wer sie nutzt, nimmt den ersten,
// der als Karte, im Zwischenspeicher oder im Wörterbuch existiert. Unsinnige Kandidaten
// („relie") schaden deshalb nicht, sie existieren nirgends.

type FormLists = Readonly<Record<string, readonly string[]>>;
type IrregularData = {
  verbs: Readonly<Record<string, FormLists>>;
  nouns: FormLists;
  adjectives: Readonly<Record<string, FormLists>>;
  adverbs: Readonly<Record<string, FormLists>>;
};

const IRREGULAR: IrregularData = irregularJson;

let irregularIndex: Map<string, string[]> | null = null;

/** Form → Grundformen aus content/irregular.json (verzögert aufgebaut). */
function irregularLemmas(form: string): readonly string[] {
  if (!irregularIndex) {
    const idx = new Map<string, string[]>();
    const add = (f: string, lemma: string) => {
      if (f === lemma) return;
      const list = idx.get(f);
      if (!list) idx.set(f, [lemma]);
      else if (!list.includes(lemma)) list.push(lemma);
    };
    for (const group of [IRREGULAR.verbs, IRREGULAR.adjectives, IRREGULAR.adverbs]) {
      for (const [lemma, forms] of Object.entries(group)) {
        for (const list of Object.values(forms)) list.forEach((f) => add(f, lemma));
      }
    }
    for (const [lemma, forms] of Object.entries(IRREGULAR.nouns)) forms.forEach((f) => add(f, lemma));
    irregularIndex = idx;
  }
  return irregularIndex.get(form) ?? [];
}

/** Alle unregelmäßigen Formen (für „ist ein echtes Wort"). */
export function isIrregularForm(word: string): boolean {
  return irregularLemmas(normalizeWord(word)).length > 0;
}

// Verneinungen, deren Stamm nicht einfach vor „n't" steht.
const NEGATIONS: Readonly<Record<string, string>> = { "can't": 'can', "won't": 'will', "shan't": 'shall', "ain't": 'be' };
// Klitika und ihre Grundform („'s" bleibt ohne, meist ist es der Genitiv).
const CLITIC_LEMMA: Readonly<Record<string, readonly string[]>> = {
  "'re": ['be'],
  "'m": ['be'],
  "'ve": ['have'],
  "'ll": ['will'],
  "'d": ['would', 'had'],
  "'s": [],
};

const CONSONANT_DOUBLE = /([bcdfgklmnprstvz])\1$/;
const undouble = (stem: string): string | null => (stem.length >= 3 && CONSONANT_DOUBLE.test(stem) ? stem.slice(0, -1) : null);

/** Regelmäßige Endungen zurückbauen, in Vorzugsreihenfolge. */
function ruleLemmas(w: string): string[] {
  const out: string[] = [];
  const n = w.length;
  const push = (...c: Array<string | null>) => c.forEach((x) => x && out.push(x));

  // Konsonant + y: companies, relied, easier, easiest, easily
  if (n > 4 && /[^aeiou]ies$/.test(w)) push(`${w.slice(0, -3)}y`);
  if (n > 4 && /[^aeiou]ied$/.test(w)) push(`${w.slice(0, -3)}y`);
  if (n > 5 && w.endsWith('iest')) push(`${w.slice(0, -4)}y`);
  if (n > 4 && w.endsWith('ier')) push(`${w.slice(0, -3)}y`);
  if (n > 4 && w.endsWith('ily')) push(`${w.slice(0, -3)}y`);

  if (n > 4 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    // e-Wegfall zuerst (hoping → hope vor hop), außer nach Vokal + ng (singing → sing vor singe)
    const pair = /[aeiou]ng$/.test(stem) ? [stem, `${stem}e`] : [`${stem}e`, stem];
    push(...pair, undouble(stem));
    if (/^[a-z]y$/.test(stem)) push(`${stem.slice(0, -1)}ie`); // lying → lie, dying → die
  }
  if (n > 3 && w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    push(w.slice(0, -1), stem, undouble(stem)); // used → use, wanted → want, stopped → stop
  }
  if (n > 4 && w.endsWith('est')) {
    const stem = w.slice(0, -3);
    push(w.slice(0, -2), stem, undouble(stem)); // largest → large, fastest → fast, biggest → big
  }
  if (n > 4 && w.endsWith('er')) {
    const stem = w.slice(0, -2);
    push(w.slice(0, -1), stem, undouble(stem)); // larger → large, faster → fast, bigger → big
  }
  if (n > 3 && w.endsWith('s') && !w.endsWith('ss')) {
    push(w.slice(0, -1)); // uses → use (vor „us")
    if (w.endsWith('es')) push(w.slice(0, -2)); // boxes → box, goes → go
  }
  if (n > 4 && w.endsWith('ly')) {
    if (w.endsWith('ically')) push(w.slice(0, -4)); // basically → basic
    if (/[bcdfgkptz]ly$/.test(w)) push(`${w.slice(0, -1)}e`); // simply → simple, gently → gentle
    if (w.endsWith('lly')) push(w.slice(0, -1)); // fully → full
    if (w.endsWith('uly')) push(`${w.slice(0, -2)}e`); // truly → true
    push(w.slice(0, -2)); // quickly → quick, gradually → gradual
  }
  return out;
}

/**
 * Mögliche Grundformen einer Wortform, die Form selbst zuerst.
 * relied → rely · companies → company · went → go · better → good · company's → company · don't → do.
 * Bei Bindestrich-Wörtern wird nur der letzte Teil gebeugt: e-invoicing → e-invoice.
 */
export function lemmaCandidates(surface: string): readonly string[] {
  const w = normalizeWord(surface).replace(/^'+|'+$/g, ''); // companies' → companies
  if (!w) return [];
  const out: string[] = [];
  const push = (c: string) => {
    if (c.length > 0 && !out.includes(c)) out.push(c);
  };
  push(w);
  if (w.includes(' ')) return out;

  const clitic = /^(.+?)(n't|'re|'m|'ve|'ll|'d|'s)$/.exec(w);
  if (clitic) {
    const stem = clitic[1] ?? '';
    const tail = clitic[2] ?? '';
    if (tail === "n't") {
      lemmaCandidates(NEGATIONS[w] ?? stem).forEach(push);
    } else {
      lemmaCandidates(stem).forEach(push);
      (CLITIC_LEMMA[tail] ?? []).forEach(push);
    }
    return out;
  }

  const dash = w.lastIndexOf('-');
  const prefix = dash >= 0 ? w.slice(0, dash + 1) : '';
  const last = w.slice(dash + 1);
  if (!last) return out;
  irregularLemmas(last).forEach((c) => push(prefix + c));
  ruleLemmas(last).forEach((c) => push(prefix + c));
  return out;
}

// ------------------------------------------------------------------ US-Schreibweise
// Nur als Such- und Indexschlüssel: britische und amerikanische Schreibweise desselben Worts
// ergeben denselben Schlüssel (colour und color → color). Regeln wie in Entwurf §5.6 und
// Lerndesign §2.2, mit Ausnahmelisten, damit hour, four, advertise, exercise, genre … bleiben.

const US_SPECIAL: Readonly<Record<string, string>> = {
  programme: 'program', programmes: 'programs', cheque: 'check', cheques: 'checks', grey: 'gray',
  tyre: 'tire', tyres: 'tires', aluminium: 'aluminum', enquiry: 'inquiry', enquiries: 'inquiries',
  enquire: 'inquire', enquires: 'inquires', enquired: 'inquired', enquiring: 'inquiring',
  judgement: 'judgment', judgements: 'judgments', acknowledgement: 'acknowledgment', acknowledgements: 'acknowledgments',
  ageing: 'aging', fulfil: 'fulfill', fulfils: 'fulfills', fulfilment: 'fulfillment', enrol: 'enroll', enrols: 'enrolls',
  enrolment: 'enrollment', enrolments: 'enrollments', instalment: 'installment', instalments: 'installments',
  skilful: 'skillful', skilfully: 'skillfully', wilful: 'willful', wilfully: 'willfully',
  practise: 'practice', practises: 'practices', practised: 'practiced', practising: 'practicing',
  manoeuvre: 'maneuver', manoeuvres: 'maneuvers', manoeuvred: 'maneuvered', jewellery: 'jewelry',
  plough: 'plow', ploughs: 'plows', ploughed: 'plowed', draught: 'draft', draughts: 'drafts',
  mould: 'mold', moulds: 'molds', mouldy: 'moldy', sceptic: 'skeptic', sceptics: 'skeptics', sceptical: 'skeptical',
  scepticism: 'skepticism', pyjamas: 'pajamas', cosy: 'cozy', artefact: 'artifact', artefacts: 'artifacts',
  woollen: 'woolen', kerb: 'curb', moustache: 'mustache',
};

const OUR_RE =
  /^((?:dis|un|mis|re|over|under)?(?:arb|arm|behavi|cand|clam|col|demean|endeav|fav|flav|harb|hon|hum|lab|neighb|od|parl|rig|rum|sav|savi|splend|tum|val|vap|vig))our/;
const ISE_RE = /^([a-z]*[^aeiouy])is(e|es|ed|ing|er|ers|ation|ations|able)$/;
const ISE_KEEP = new Set([
  'advertise', 'advise', 'anise', 'apprise', 'arise', 'chastise', 'chemise', 'circumcise', 'comprise', 'compromise',
  'concise', 'demise', 'despise', 'devise', 'enterprise', 'excise', 'exercise', 'expertise', 'franchise', 'improvise',
  'incise', 'merchandise', 'mortise', 'paradise', 'precise', 'premise', 'promise', 'reprise', 'revise', 'rise',
  'sunrise', 'supervise', 'surmise', 'surprise', 'televise', 'treatise', 'valise', 'vise',
]);
const YSE_RE = /^([a-z]*l)ys(e|es|ed|ing|er|ers)$/;
const TRE_RE = /^([a-z]*(?:cent|met|lit|theat|fib|calib|somb|spect|lust|meag|sab|mit|scept))re(s|d)?$/;
const OGUE_RE = /^(catalog|dialog|analog)ue(s|d)?$/;
const ENCE_RE = /^(defen|offen|licen|preten)ce(s)?$/;
const LL_RE =
  /^([a-z]*(?:travel|cancel|label|model|fuel|level|signal|total|counsel|marvel|channel|tunnel|equal|dial|duel|quarrel|jewel|rival|panel|pencil|shovel|funnel|grovel|snorkel|yodel|libel|pedal|revel|shrivel|swivel|towel|ravel))l(ed|ing|er|ers|or|ors|ous)$/;

function usWord(w: string): string {
  const special = US_SPECIAL[w];
  if (special) return special;
  let s = w.replace(OUR_RE, '$1or');
  const ise = ISE_RE.exec(s);
  if (ise) {
    const stem = ise[1] ?? '';
    const base = `${stem}ise`;
    if (stem.length >= 3 && !ISE_KEEP.has(base) && !base.endsWith('wise')) s = `${stem}iz${ise[2] ?? ''}`;
  }
  s = s
    .replace(YSE_RE, '$1yz$2')
    .replace(TRE_RE, (_m, stem: string, suf: string | undefined) => `${stem}${suf === 'd' ? 'ered' : suf === 's' ? 'ers' : 'er'}`)
    .replace(OGUE_RE, (_m, stem: string, suf: string | undefined) => `${stem}${suf === 'd' ? 'ed' : (suf ?? '')}`)
    .replace(ENCE_RE, '$1se$2')
    .replace(LL_RE, '$1$2');
  return s;
}

/**
 * US-Schreibweise als Schlüssel: colour → color, organised → organized, centre → center,
 * travelled → traveled, licence → license, programme → program. Wörter mit Leerzeichen oder
 * Bindestrich werden teilweise umgeschrieben. hour, four, advertise, exercise, genre bleiben.
 */
export function usSpelling(word: string): string {
  const n = normalizeWord(word);
  return n.replace(/[a-z]+/g, (part) => usWord(part));
}
