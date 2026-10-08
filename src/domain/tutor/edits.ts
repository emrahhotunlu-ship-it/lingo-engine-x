import { clip } from '../../prompts/common';
import { repairNorm, type NewRepair, type RepairSrc } from '../repair/repair';
import { repairsFromText } from '../repair/sources';
import { wordCount } from '../text/textStats';

// Korrekturstellen von Claude prüfen und verwerten (Lernplattform 3.0 P46/P47, KI-Tutor T-R3/T-R12). Rein.
// - `keepEdits`: nur Stellen, deren Ausschnitt WÖRTLICH im Text steht (Leerraum und typografische Anführungszeichen normalisiert); erfundene Stellen,
//   Stellen ohne Änderung, Stellen ohne Begründung und Überlappungen fallen still weg. Fehler (`sev: 'error'`) und Verbesserungen (`'upgrade'`) sind
//   getrennt; Ton/Register ist nie ein Fehler (die K7-Zahl misst Genauigkeit, nicht Stil).
// - `repairsFromEdits`: aus den Fehlern Fehlersätze (der Satz um die Stelle, einmal mit allen Korrekturen darin), geordnet nach Art, mit Deckel.
// - `errorCount`/`ownWords`: die zwei Zahlen für K7 (`addProd`).

export const EDIT_KINDS = ['grammar', 'word', 'collocation', 'register', 'spelling', 'punctuation'] as const;
export type EditKind = (typeof EDIT_KINDS)[number];
export type EditSev = 'error' | 'upgrade';
export type Edit = { from: string; to: string; kind: EditKind; sev: EditSev; pat: string | null; why: string };

export const EDIT_FROM_MAX = 120;
export const EDIT_WHY_MAX = 160;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Leerraum zusammengefasst, typografische Anführungszeichen und Apostrophe vereinheitlicht. */
export const normWs = (s: string): string =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const KIND_ALIASES: ReadonlyArray<[RegExp, EditKind]> = [
  [/^(word[\s_-]?choice|vocab(ulary)?|lexis|lexical|wrong[\s_-]?word|false[\s_-]?friend|word[\s_-]?form)$/, 'word'],
  [/^(collocations?|idioms?|phrasal[\s_-]?verbs?|fixed[\s_-]?phrases?)$/, 'collocation'],
  [/^(register|style|tone|formality|politeness)$/, 'register'],
  [/^(spelling|typo|capitali[sz]ation)$/, 'spelling'],
  [/^(punctuation|commas?)$/, 'punctuation'],
  [/^(grammar|tenses?|prepositions?|articles?|agreement|word[\s_-]?order|syntax|plurals?|pronouns?|modals?)$/, 'grammar'],
];

/** Art tolerant: „preposition“ → grammar, „word choice“ → word; Unbekanntes bleibt stehen (das Schema lehnt es ab). */
export function editKind(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if ((EDIT_KINDS as readonly string[]).includes(s)) return s;
  for (const [re, kind] of KIND_ALIASES) if (re.test(s)) return kind;
  return 'grammar';
}

/** Schweregrad tolerant. Fehlt er, gilt `fallback`; Unbekanntes zählt vorsichtig als Verbesserung (nie als Fehler hochgezählt). */
export function editSev(v: unknown, fallback: EditSev = 'upgrade'): EditSev {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().toLowerCase();
  if (/^(error|mistake|wrong|incorrect|major|serious)$/.test(s)) return 'error';
  if (/^(upgrade|style|improvement|suggestion|better|polish|minor|tip)$/.test(s)) return 'upgrade';
  return fallback;
}

const isLetter = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c);

/** Erste Fundstelle von `needle` in `hay` als ganze Wörter (an den Rändern kein Buchstabe), die keine schon vergebene Stelle überlappt. */
function findSpan(hay: string, needle: string, taken: ReadonlyArray<readonly [number, number]>): [number, number] | null {
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return null;
    const end = at + needle.length;
    const okLeft = !isLetter(needle[0]) || !isLetter(hay[at - 1]);
    const okRight = !isLetter(needle[needle.length - 1]) || !isLetter(hay[end]);
    if (okLeft && okRight && !taken.some(([a, b]) => at < b && a < end)) return [at, end];
    from = at + 1;
  }
}

export type KeepOpts = {
  /** Fehlt `sev`, gilt dieser Wert (Satz-Klinik: `error`, denn dort gibt es nur Korrekturen). */
  sevDefault?: EditSev;
};

/**
 * Nur belegte Stellen: `from` steht wörtlich im Text, `to` ist anders, die Begründung ist nicht leer, keine Überlappung. Höchstens `max`
 * (Fehler vor Verbesserungen, sonst in Claudes Reihenfolge), danach in Textreihenfolge. `patIds` = erlaubte Muster-Kennungen, sonst `pat: null`.
 */
export function keepEdits(xs: readonly unknown[], text: string, patIds: ReadonlySet<string> | readonly string[], max = 3, opts: KeepOpts = {}): Edit[] {
  const ids = patIds instanceof Set ? patIds : new Set(patIds);
  const hay = normWs(text);
  const taken: Array<readonly [number, number]> = [];
  const found: Array<{ e: Edit; at: number }> = [];
  for (const x of xs) {
    if (!isObj(x)) continue;
    const from = typeof x.from === 'string' ? normWs(x.from) : '';
    const to = typeof x.to === 'string' ? normWs(x.to) : '';
    if (!from || Array.from(from).length > EDIT_FROM_MAX || from === to) continue;
    const why = typeof x.why === 'string' ? clip(x.why, EDIT_WHY_MAX) : '';
    if (!why) continue;
    const span = findSpan(hay, from, taken);
    if (!span) continue;
    const kind = editKind(x.kind) as EditKind;
    const sev = kind === 'register' ? 'upgrade' : editSev(x.sev, opts.sevDefault ?? 'upgrade');
    const pat = typeof x.pat === 'string' && ids.has(x.pat.trim()) ? x.pat.trim() : null;
    taken.push(span);
    found.push({ e: { from, to: clip(to, EDIT_FROM_MAX), kind, sev, pat, why }, at: span[0] });
  }
  const ranked = [...found].sort((a, b) => Number(b.e.sev === 'error') - Number(a.e.sev === 'error')).slice(0, Math.max(0, max));
  ranked.sort((a, b) => a.at - b.at);
  return ranked.map(({ e }) => e);
}

export type Located = { edit: Edit; start: number; end: number };

/**
 * Lage der Stellen im NORMALISIERTEN Text (`normWs(text)`), in Textreihenfolge, für die Unterstreichung. Stellen, die nicht (mehr) zu finden sind,
 * fehlen. Der Aufrufer zeigt `normWs(text)`, nicht den Rohtext (Zeilenumbrüche werden Leerzeichen).
 */
export function locateEdits(text: string, edits: readonly Edit[]): Located[] {
  const hay = normWs(text);
  const taken: Array<readonly [number, number]> = [];
  const out: Located[] = [];
  for (const edit of edits) {
    const span = findSpan(hay, edit.from, taken);
    if (!span) continue;
    taken.push(span);
    out.push({ edit, start: span[0], end: span[1] });
  }
  return out.sort((a, b) => a.start - b.start);
}

export type Used = { pat: string; ok: boolean; quote: string };

/** Belegte Musterverwendungen (`used`): nur mit Zitat, das wörtlich im Text steht; sonst fällt der Eintrag weg. */
export function keepUsed(xs: readonly unknown[], text: string, patIds: ReadonlySet<string> | readonly string[]): Used[] {
  const ids = patIds instanceof Set ? patIds : new Set(patIds);
  const hay = normWs(text);
  const out: Used[] = [];
  for (const x of xs) {
    if (!isObj(x)) continue;
    const pat = typeof x.pat === 'string' ? x.pat.trim() : '';
    const quote = typeof x.quote === 'string' ? normWs(x.quote) : '';
    const ok = typeof x.ok === 'boolean' ? x.ok : x.ok === 'true';
    if (!pat || !ids.has(pat) || !quote || !hay.includes(quote) || out.some((o) => o.pat === pat)) continue;
    out.push({ pat, ok, quote: clip(quote, 160) });
  }
  return out.slice(0, 6);
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lage der Stellen im ROHEN Text (Zeilenumbrüche, Leerzeichen und typografische Anführungszeichen bleiben), in Textreihenfolge, für die Unterstreichung
 * in einer Mail mit Absätzen. Gleiche Regeln wie `keepEdits`: ganze Wörter, keine Überlappung. Nicht (mehr) zu findende Stellen fehlen.
 */
export function locateRaw(text: string, edits: readonly Edit[]): Located[] {
  const taken: Array<readonly [number, number]> = [];
  const out: Located[] = [];
  for (const edit of edits) {
    const source = edit.from
      .split(' ')
      .map((w) => escRe(w).replace(/'/g, "['\u2018\u2019]").replace(/"/g, '["\u201c\u201d]'))
      .join('\\s+');
    let re: RegExp;
    try {
      re = new RegExp(source, 'g');
    } catch {
      continue;
    }
    for (const m of text.matchAll(re)) {
      const at = m.index;
      const end = at + m[0].length;
      const okLeft = !isLetter(edit.from[0]) || !isLetter(text[at - 1]);
      const okRight = !isLetter(edit.from[edit.from.length - 1]) || !isLetter(text[end]);
      if (!okLeft || !okRight || taken.some(([a, b]) => at < b && a < end)) continue;
      taken.push([at, end]);
      out.push({ edit, start: at, end });
      break;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Zahl der Fehler (Verbesserungen und Ton zählen nie). */
export const errorEdits = (edits: readonly Edit[]): Edit[] => edits.filter((e) => e.sev === 'error' && e.kind !== 'register');
export const errorCount = (edits: readonly Edit[]): number => errorEdits(edits).length;

/** Wörter des EIGENEN Textes (nicht Claudes Korrektur). */
export const ownWords = (text: string): number => wordCount(text);

const KIND_RANK: Record<EditKind, number> = { grammar: 0, word: 1, collocation: 2, spelling: 3, punctuation: 4, register: 5 };
/** Höchstzahl Fehlersätze je Wochen-Mail (KT T6) und je Satz-Klinik-Eingabe (KT T4). */
export const MAIL_REPAIR_CAP = 5;
export const CLINIC_REPAIR_CAP = 2;
/** Ab so vielen Fehlern je 100 Wörter wird der Text nur noch gezeigt und kurz gehalten: weiterhin höchstens `MAIL_REPAIR_CAP` Sätze. */
export const DENSE_ERRORS_PER_100 = 8;

/**
 * Fehlersätze aus den Fehlern: je betroffenem Satz ein Eintrag (Originalsatz → derselbe Satz mit allen Korrekturen), geordnet nach Art
 * (grammar > word > collocation > spelling > punctuation), höchstens `cap`. Stil-Verbesserungen und Ton werden nie Fehlersätze. Reine Löschungen
 * (`to` leer) ergeben keinen Satz, zählen aber als Fehler.
 */
export function repairsFromEdits(text: string, edits: readonly Edit[], src: RepairSrc, cap: number, ctx?: string | null): NewRepair[] {
  const errs = errorEdits(edits).filter((e) => e.to);
  if (!errs.length || cap < 1) return [];
  const made = repairsFromText(
    text,
    errs.map((e) => ({ wrong: e.from, right: e.to, why: e.why })),
    src,
    ctx ?? null,
  );
  const ranked = made.map((r, i) => {
    const hit = errs.filter((e) => repairNorm(r.wrong).includes(repairNorm(e.from)));
    const rank = hit.length ? Math.min(...hit.map((e) => KIND_RANK[e.kind])) : 9;
    const pat = hit.find((e) => e.pat)?.pat ?? null;
    return { r: pat ? { ...r, pat } : r, rank, i };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return ranked.slice(0, cap).map((x) => x.r);
}

/** Fehler je 100 Wörter (eine Stelle), `null` ohne Wörter. */
export function errorsPer100(errors: number, words: number): number | null {
  return words > 0 ? Math.round((errors / words) * 1000) / 10 : null;
}
