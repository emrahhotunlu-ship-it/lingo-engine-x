// Erzeugt src/content/pron/us-ipa.json: amerikanische Lautschrift (IPA) als eingebettete
// Teilmenge des CMU Pronouncing Dictionary (npm-Paket cmu-pronouncing-dictionary, Daten
// © Carnegie Mellon University, BSD-Lizenz, siehe src/content/pron/LICENSE-cmudict.txt).
//
// Aufgenommen werden (Architektur-Entwurf §10.1):
//   1. alle Wörter aus src/content/legacy/dict.json (auch die Teile der Wendungen),
//      die Startvokabeln und die Grund- und Beugungsformen aus src/content/irregular.json,
//   2. britisch geschriebene Wörter ohne CMU-Eintrag über ihre US-Schreibweise
//      (Eintrag unter der britischen Form, die US-Form wird Grundwort),
//   3. die in CMU vorhandenen regelmäßigen Beugungsformen dieser Grundwörter,
//   4. alle englischen Wörter der übrigen eingebetteten Inhalte (Lektionen, Texte, Szenen …).
// Umwandlung ARPAbet → IPA nach §10.2: Betonungszeichen vor dem längsten zulässigen
// Silbenanfang, Nebenbetonung in der Schlusssilbe nach der Hauptbetonung entfällt,
// ER vor Vokal wird ə/ɜ + r. Nur die erste Variante eines Worts.
//
// Deterministisch: feste Eingaben, sortierte Ausgabe, keine Zeit- oder Zufallswerte.
// Aufruf: npm run pron            → schreibt src/content/pron/us-ipa.json
//         node scripts/build-pron.mjs --out <datei>   → schreibt dorthin (Tests)
//         node scripts/build-pron.mjs --check         → Abweichung zur eingecheckten Datei = Exit 1

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionary as CMU } from 'cmu-pronouncing-dictionary';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'src/content/pron/us-ipa.json');
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? resolve(process.cwd(), args[outIdx + 1] ?? '') : TARGET;
const CHECK = args.includes('--check');
const QUIET = args.includes('--quiet');

// ------------------------------------------------------------------ ARPAbet → IPA
const VOWELS = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ',
  EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
};
const CONSONANTS = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l',
  M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v',
  W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
// Zulässige englische Silbenanfänge aus mehreren Konsonanten (amerikanisch, ohne tj/dj/nj).
const ONSETS = new Set([
  'pl', 'pr', 'pj', 'bl', 'br', 'bj', 'tr', 'tw', 'dr', 'dw', 'kl', 'kr', 'kw', 'kj',
  'ɡl', 'ɡr', 'ɡw', 'fl', 'fr', 'fj', 'θr', 'θw', 'ʃr', 'vj', 'mj', 'hj',
  'sp', 'st', 'sk', 'sm', 'sn', 'sl', 'sw', 'sf', 'spl', 'spr', 'spj', 'str', 'skr', 'skw', 'skj', 'skl',
]);

/** Wandelt eine CMU-Aussprache (ARPAbet mit Betonungsziffern) in amerikanische IPA. */
export function arpabetToIpa(arpa) {
  const phones = arpa.trim().split(/\s+/).map((p) => {
    const m = /^([A-Z]+)([012])?$/.exec(p);
    if (!m) throw new Error(`Unbekanntes ARPAbet-Zeichen "${p}" in "${arpa}"`);
    return { base: m[1], stress: m[2] ?? null };
  });
  const seg = [];
  for (let i = 0; i < phones.length; i++) {
    const { base, stress } = phones[i];
    if (base in VOWELS) {
      if (stress === null) throw new Error(`Vokal ohne Betonung "${base}" in "${arpa}"`);
      const next = phones[i + 1];
      if (base === 'ER' && next && next.base in VOWELS) {
        // ER vor Vokal: Vokal ə bzw. ɜ, das r wird Anlaut der nächsten Silbe (interrupt → ˌɪntəˈrʌpt).
        seg.push({ sym: stress === '0' ? 'ə' : 'ɜ', vowel: true, stress });
        seg.push({ sym: 'r', vowel: false, stress: null });
        continue;
      }
      let sym = VOWELS[base];
      if (base === 'AH' && stress === '0') sym = 'ə';
      if (base === 'ER' && stress === '0') sym = 'ɚ';
      seg.push({ sym, vowel: true, stress });
    } else if (base in CONSONANTS) {
      seg.push({ sym: CONSONANTS[base], vowel: false, stress: null });
    } else {
      throw new Error(`Unbekanntes ARPAbet-Zeichen "${base}" in "${arpa}"`);
    }
  }
  const vowelIdx = [];
  seg.forEach((s, i) => s.vowel && vowelIdx.push(i));
  const marks = new Map();
  if (vowelIdx.length >= 2) {
    const firstPrimary = vowelIdx.find((i) => seg[i].stress === '1');
    const lastVowel = vowelIdx[vowelIdx.length - 1];
    vowelIdx.forEach((vi, n) => {
      const st = seg[vi].stress;
      if (st !== '1' && st !== '2') return;
      // Nebenbetonung in der Schlusssilbe nach der Hauptbetonung entfällt (tomato → təˈmeɪtoʊ).
      if (st === '2' && vi === lastVowel && firstPrimary !== undefined && firstPrimary < vi) return;
      const prev = n > 0 ? vowelIdx[n - 1] : -1;
      let pos = vi;
      if (prev === -1) {
        pos = 0;
      } else {
        let onset = '';
        for (let k = vi - 1; k > prev; k--) {
          const cand = seg[k].sym + onset;
          const single = onset === '' && seg[k].sym !== 'ŋ';
          if (!single && !ONSETS.has(cand)) break;
          onset = cand;
          pos = k;
        }
      }
      marks.set(pos, st === '1' ? 'ˈ' : 'ˌ');
    });
  }
  return seg.map((s, i) => (marks.get(i) ?? '') + s.sym).join('');
}

// ------------------------------------------------------------------ Wörter sammeln
const cmuOf = (w) => {
  if (!Object.hasOwn(CMU, w)) return null;
  const v = CMU[w].split('#')[0].trim(); // manche Einträge tragen Anmerkungen wie "# name"
  return v || null;
};

/** Englische Wörter eines Texts: Kleinschreibung, gerade Apostrophe; Bindestrich-Wörter ganz und in Teilen. */
function textWords(text) {
  const out = [];
  const m = String(text).toLowerCase().replace(/[’‘]/g, "'").match(/\p{L}+(?:['-]\p{L}+)*/gu) ?? [];
  for (const tok of m) {
    if (!/^[a-z'-]+$/.test(tok)) continue; // Wörter mit Umlauten o. Ä. sind nicht englisch
    out.push(tok);
    if (tok.includes('-')) out.push(...tok.split('-'));
  }
  return out.filter((w) => w.length > 0);
}

function walkStrings(value, fn) {
  if (typeof value === 'string') fn(value);
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, fn));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => walkStrings(v, fn));
}

/** Regelmäßige Beugungsformen; nur die in CMU vorhandenen werden übernommen. */
function inflections(w) {
  if (!/^[a-z]+$/.test(w) || w.length < 2) return [];
  const out = [`${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}ers`, `${w}est`, `${w}ly`];
  if (w.endsWith('e')) out.push(`${w.slice(0, -1)}ing`, `${w}r`, `${w}rs`, `${w}st`);
  if (/[^aeiou]y$/.test(w)) {
    const s = w.slice(0, -1);
    out.push(`${s}ies`, `${s}ied`, `${s}ier`, `${s}iest`, `${s}ily`);
  }
  if (/(^|[^aeiou])[aeiou][bdgklmnprtvz]$/.test(w)) {
    const c = w.at(-1);
    out.push(`${w}${c}ed`, `${w}${c}ing`, `${w}${c}er`, `${w}${c}est`);
  }
  if (/[^aeiou]le$/.test(w)) out.push(`${w.slice(0, -1)}y`);
  if (w.endsWith('ic')) out.push(`${w}ally`);
  return out;
}

/** US-Schreibweisen eines britisch geschriebenen Worts (nur für Wörter ohne CMU-Eintrag; CMU entscheidet). */
function usCandidates(w) {
  const special = {
    programme: 'program', programmes: 'programs', jewellery: 'jewelry', cheque: 'check', cheques: 'checks',
    grey: 'gray', tyre: 'tire', tyres: 'tires', aluminium: 'aluminum', enquiry: 'inquiry', enquiries: 'inquiries',
    judgement: 'judgment', ageing: 'aging', fulfil: 'fulfill', fulfilment: 'fulfillment', enrol: 'enroll',
    enrolment: 'enrollment', instalment: 'installment', skilful: 'skillful', practise: 'practice',
    manoeuvre: 'maneuver', plough: 'plow', draught: 'draft', mould: 'mold', sceptical: 'skeptical',
    pyjamas: 'pajamas', cosy: 'cozy', artefact: 'artifact', woollen: 'woolen', kerb: 'curb', moustache: 'mustache',
  };
  const out = [];
  if (Object.hasOwn(special, w)) out.push(special[w]);
  out.push(
    w.replace(/our/g, 'or'),
    w.replace(/is(e|es|ed|ing|er|ers|ation|ations|able)$/, 'iz$1'),
    w.replace(/ys(e|es|ed|ing)$/, 'yz$1'),
    w.replace(/tre(s|d)?$/, 'ter$1'),
    w.replace(/ogue(s)?$/, 'og$1'),
    w.replace(/ence(s)?$/, 'ense$1'),
    w.replace(/ll(ed|ing|er|ers|or|ors|ous)$/, 'l$1'),
    w.replace(/mme(s)?$/, 'm$1'),
  );
  return [...new Set(out)].filter((x) => x !== w);
}

const dict = read('src/content/legacy/dict.json');
const vocab = read('src/content/legacy/vocab.json');
const irregular = read('src/content/irregular.json');
const CONTENT_FILES = ['passages', 'course', 'grammar', 'scenes', 'feed-seed', 'rules', 'vocab', 'vtest'];

const base = new Set();
for (const key of Object.keys(dict)) textWords(key).forEach((w) => base.add(w));
for (const s of vocab.seedVocab) textWords(String(s.w).replace(/^to\s+/i, '')).forEach((w) => base.add(w));
for (const group of ['verbs', 'nouns', 'adjectives', 'adverbs']) {
  for (const [lemma, forms] of Object.entries(irregular[group])) {
    base.add(lemma);
    walkStrings(forms, (f) => base.add(f));
  }
}

const entries = new Map(); // Wort → IPA
const add = (word, arpa) => {
  if (!entries.has(word)) entries.set(word, arpabetToIpa(arpa));
};

// 1 + 2: Grundwörter, britische Formen über die US-Schreibweise
const missing = [];
for (const w of [...base].sort()) {
  // US-Formen immer mit aufnehmen: CMU kennt manche britische Form (colour), die US-Form (color)
  // steht aber nicht in dict.json. Schlüssel ist immer das Wort selbst, falsche Zuordnungen gibt es nicht.
  const usForms = usCandidates(w).filter((c) => cmuOf(c));
  for (const us of usForms) {
    add(us, cmuOf(us));
    base.add(us);
  }
  const arpa = cmuOf(w);
  if (arpa) add(w, arpa);
  else if (usForms.length) add(w, cmuOf(usForms[0])); // britische Form ohne CMU-Eintrag → Aussprache der US-Form
  else missing.push(w);
}
// 3: Beugungsformen
for (const w of [...base].sort()) {
  for (const f of inflections(w)) {
    const arpa = cmuOf(f);
    if (arpa) add(f, arpa);
  }
}
// 4: Wörter der übrigen eingebetteten Inhalte (deutsche Texte werden übersprungen)
const GERMAN = /[äöüß]|\b(der|das|und|ist|nicht|eine?|mit|für|auf|sich|den|dem|wird|oder|auch|wenn|bei|nach|zum|zur|wie|sind)\b/giu;
const looksGerman = (text) => /[äöüß]/i.test(text) || (text.match(GERMAN) ?? []).length >= 2;
for (const name of CONTENT_FILES) {
  walkStrings(read(`src/content/legacy/${name}.json`), (text) => {
    if (looksGerman(text)) return;
    for (const w of textWords(text)) {
      const arpa = cmuOf(w);
      if (!arpa) continue;
      add(w, arpa);
      for (const us of usCandidates(w)) if (cmuOf(us)) add(us, cmuOf(us)); // apologise → auch apologize
    }
  });
}

// ------------------------------------------------------------------ Ausgabe
const keys = [...entries.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const body = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(entries.get(k))}`).join(',\n');
const output = `{\n${body}\n}\n`;

const singleDictWords = Object.keys(dict).filter((k) => !k.includes(' '));
const covered = singleDictWords.filter((k) => entries.has(k) || k.split('-').every((p) => entries.has(p)));
const summary =
  `us-ipa.json: ${keys.length} Einträge, ${Buffer.byteLength(output)} Bytes · ` +
  `Einzelwörter aus dict.json mit Lautschrift: ${covered.length}/${singleDictWords.length} ` +
  `(${((100 * covered.length) / singleDictWords.length).toFixed(1)} %)`;

if (CHECK) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch (err) {
    console.error(`Eingecheckte Datei fehlt: ${TARGET} (${err instanceof Error ? err.message : String(err)})`);
    process.exit(1);
  }
  if (current !== output) {
    console.error('us-ipa.json ist veraltet: bitte `npm run pron` ausführen und die Datei einchecken.');
    process.exit(1);
  }
  if (!QUIET) console.log(`${summary} · aktuell`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, output);
  if (!QUIET) {
    console.log(summary);
    console.log(`Ohne Lautschrift (${missing.length}): ${missing.join(', ')}`);
  }
}
