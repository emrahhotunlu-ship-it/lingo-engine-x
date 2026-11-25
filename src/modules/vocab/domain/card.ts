import { isDrillSentence, lemmaCandidates } from '../shared';
import { inflections, normalize, PARTICLES, PREPOSITIONS, type Target } from './check';
import { CUE_MAX_LV, leaks, pickSentence } from './forms';
import { hash32 } from './rand';
import type { Lex } from './types';
import { type Fam, famAsked, famOf, type FamPos } from './care';

// Wörter-Modul V3: die Lernkarte, rein gerechnet (docs/umbau/vokabeln/v3-bau.md §1). Welche Sätze ein Lexem hat, welcher heute gezeigt wird,
// wo die Lücke steht, was als Antwort gilt und welche Stützen die Karte zeigt. Keine Uhr, kein Schreiben, keine Inhalte (die Lehrer-Angaben
// kommen als `Teach` von außen, nachgeladen).

// ---------------------------------------------------------------- Satzschlüssel (gleich wie src/domain/srs/exDeKey, Test vergleicht beide)

/** Normalisierter Satz: klein, typografische Apostrophe vereinheitlicht, nur Buchstaben, Ziffern, Apostroph und einfache Leerzeichen. */
export const exampleKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Schlüssel der gespeicherten Übersetzung (`exDe`) eines Beispielsatzes. */
export const exDeKey = (en: string): string => `s${hash32(exampleKey(en)).toString(36)}`;

/** Schlüssel eines Satzes in `lex.sn`: `a` = Ankersatz, sonst `h` + Hash (≤ 8 Zeichen). */
export const sentenceKey = (en: string): string => `h${hash32(exampleKey(en)).toString(36)}`;

// ---------------------------------------------------------------- Sätze je Lexem

export type Sent = {
  key: string;
  en: string;
  de: string | null;
  /** `xex` = gespeicherte, beim Speichern geprüfte Claude-Beispiele der Karte (`xEx`, Live-Kommentar 23.11.2026). */
  src: 'ex' | 'wx' | 'xex' | 'sb' | 'fam';
  /** Vom Inhalt markierte Stelle (`[…]` im Rohsatz), Zeichenbereich im gezeigten Satz `en`; Rückfall für die Lücke (Inhalts-Audit 04.11.2026). */
  mark?: readonly [number, number];
};

const DAY_MS = 86_400_000;
/** Satzbank: 4 Wochen Sammelzeit je Satz und für die Freigabe (gleiche Regel wie src/domain/tutor/sentenceBank). */
export const SB_QUARANTINE_DAYS = 28;
const SB_MAX_HARD = 1;
const SB_MAX_UNCLEAR = 2;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const cnt = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/** Wirksame Freigabe der Claude-Sätze der Satzbank (`app/profile.sbGate`): an, Stichprobe bestanden, frühestens 4 Wochen nach Beginn geprüft. */
export function sbGateOn(raw: unknown): boolean {
  if (!isObj(raw) || raw.on !== true) return false;
  const start = num(raw.start);
  const checked = num(raw.checkedAt);
  const r = isObj(raw.review) ? raw.review : null;
  const hard = r ? cnt(r.hard) : null;
  const unclear = r ? cnt(r.unclear) : null;
  return start > 0 && checked > 0 && hard !== null && unclear !== null && hard <= SB_MAX_HARD && unclear <= SB_MAX_UNCLEAR && checked - start >= SB_QUARANTINE_DAYS * DAY_MS;
}

/**
 * Alle Sätze eines Wort-Dokuments in fester Reihenfolge (= Schlüsselliste für `pickSentence`): Ankersatz `ex` → Claude-Sätze `wx` ohne `bad`
 * → gespeicherte Claude-Beispiele `xEx` → Satzbank `sb` (aus Lesen/C1 sofort; von Claude nur bei wirksamer Freigabe und 4 Wochen nach Erzeugung). Doppelte Sätze einmal.
 */
export function sentencesOf(doc: Record<string, unknown>, nowMs: number, sbGate: unknown, o: { read?: boolean } = {}): Sent[] {
  const exDe = isObj(doc.exDe) ? doc.exDe : {};
  const deOf = (en: string, own: unknown): string | null => str(own) || str(exDe[exDeKey(en)]) || null;
  const out: Sent[] = [];
  const seen = new Set<string>();
  const push = (raw: string, own: unknown, src: Sent['src'], anchor = false) => {
    // Inhalte markieren das Gesuchte mit eckigen Klammern („She [achieved] her goal“): gezeigt wird der Satz ohne sie (UX-Prüfung V3 Nr. 2).
    // Die Schlüssel ändern sich dadurch nicht (`exampleKey` entfernt Klammern ohnehin).
    const norm = raw.replace(/\s+/g, ' ').trim();
    const en = norm.replace(/\[([^\]]*)\]/g, '$1');
    // Großpaket T (Emrah 07.11.2026, „He ? (feel) tired lately.“): Übungssatz mit Lücke oder Verb-Hinweis – nie ein Abfrage- oder Lesesatz.
    if (isDrillSentence(en)) return;
    const k = exampleKey(en);
    if (!k || seen.has(k)) return;
    seen.add(k);
    // Die erste markierte Stelle merken (vor ihr steht keine Klammer mehr, die Lage stimmt also im gezeigten Satz).
    const m = /\[([^\]]*)\]/.exec(norm);
    const mark: [number, number] | null = m && m[1]!.trim() ? [m.index, m.index + m[1]!.length] : null;
    out.push({ key: anchor ? 'a' : sentenceKey(en), en, de: deOf(en, own), src, ...(mark ? { mark } : {}) });
  };
  const ex = str(doc.ex);
  if (ex) push(ex, null, 'ex', true);
  // Inhalts-Audit 04.11.2026: Wendungen aus Rollenspiel und Mail (`chunk/*`) tragen ihren Satz in `src.upgraded` (die bessere Fassung von
  // Emrahs eigenem Satz) – vorher nicht gelesen, die Karte kam ohne Satz. Ohne `ex` wird er der Ankersatz.
  const up = isObj(doc.src) ? str(doc.src.upgraded) : '';
  if (up) push(up, null, ex ? 'wx' : 'ex', !ex);
  if (Array.isArray(doc.wx)) for (const x of doc.wx) if (isObj(x) && x.bad !== 1 && x.bad !== true && str(x.en)) push(str(x.en), x.de, 'wx');
  // Live-Kommentar 23.11.2026 („viel Text für ein Wort“): die kurzen, beim Speichern geprüften Beispiele der Karte (`xEx`: Wort enthalten,
  // sinnvolle Länge, `src/domain/srs/examples.ts`) wurden hier nie gelesen – ein Wort mit Lese-Ausschnitt als `ex` hatte keinen anderen Satz.
  if (Array.isArray(doc.xEx)) for (const x of doc.xEx) if (isObj(x) && x.bad !== 1 && x.bad !== true && str(x.en)) push(str(x.en), x.de, 'xex');
  const gate = sbGateOn(sbGate);
  if (Array.isArray(doc.sb))
    for (const x of doc.sb) {
      if (!isObj(x) || x.bad === 1 || !str(x.en)) continue;
      const src = x.src;
      // Emrahs Wahl „A“ (05.11.2026, Großpaket W): Claude-Sätze sind sofort zum LESEN da (`o.read`: Wortkarte, Wortseite). Emrahs Wahl „1A“
      // (05.11.2026, „ich lerne den Satz, nicht das Wort“): Sätze aus `word-know` (vor dem Speichern geprüft: Wort, Länge, Sinn, keine Abschrift)
      // gehen sofort auch in die Abfragen; ein gemeldeter Satz (`bad`) nie. Andere Claude-Sätze weiter erst nach Freigabe und 4 Wochen.
      const know = typeof x.pv === 'string' && x.pv.startsWith('word-know@');
      const ok = src === 'read' || src === 'c1' || (src === 'ai' && (o.read === true || know || (gate && num(x.t) > 0 && nowMs - num(x.t) >= SB_QUARANTINE_DAYS * DAY_MS)));
      if (ok) push(str(x.en), x.de, 'sb');
    }
  return out;
}

// ---------------------------------------------------------------- Lücke

/** Teil eines Satzes mit Lücke(n): fester Text oder Lücke (`s` = Wortlaut im Satz). */
export type Seg = { t: 'text' | 'gap'; s: string };
export type Gap = {
  segs: Seg[];
  /** gesuchte Antwort so, wie sie im Satz steht (bei getrennten Teilen mit Leerzeichen verbunden). */
  answer: string;
  /** Wort direkt vor der ersten bzw. nach der letzten Lücke (mitgetippt kein Fehler). */
  before?: string;
  after?: string;
  /** getrenntes Phrasal Verb: zwei Lücken, Objekt dazwischen. */
  split: boolean;
};

const PLACEHOLDER = new Set(['sth', 'sb', 'smth', 'sth.', 'sb.', 'someone', 'something', 'somebody', "one's", "someone's", 'oneself']);
/** Höchstens so viele Wörter zwischen Verb und Partikel (*bring the meeting forward*). */
export const SPLIT_MAX_BETWEEN = 2;

/** Wörter des Stichworts (ohne „to“, ohne Platzhalter wie *sth*). */
export function headWords(head: string): string[] {
  const n = normalize(head);
  return (verbTo(n) ? n.replace(/^to /, '') : n).split(' ').filter((w) => w && !PLACEHOLDER.has(w));
}

/**
 * Ist „to“ am Anfang das Infinitiv-Zeichen (Verb: „to adjust“) und nicht Teil einer festen Wendung („to a certain extent“, „to the best of my
 * knowledge“, „to date“, „to begin with“)? Inhalts-Audit 04.11.2026: vorher wurde „to“ immer abgeschnitten, die Lücke zeigte „To ___“.
 */
const KEEP_TO = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'his', 'her', 'their', 'some', 'this', 'that', 'what', 'date', 'no', 'and', 'be']);
function verbTo(normalized: string): boolean {
  const m = /^to (\S+)(?: (\S+))?/.exec(normalized);
  if (!m) return false;
  if (KEEP_TO.has(m[1]!)) return false;
  return !(m[1] === 'begin' && m[2] === 'with');
}

/**
 * Satzadverbiale mit „to be“: hier gehört das „to“ fest zur Wendung (*to be honest*, *to be fair to them*), es ist kein Infinitiv-Zeichen.
 */
const TO_BE_FIXED = /^to be (honest|fair|frank|clear|exact|blunt|sure|precise|brief|more precise|perfectly honest|on the safe side)( to (them|him|her|you|me|us))?$/;

/**
 * Beginnt das Stichwort mit dem Infinitiv-„to“ (*to adjust*, *to be aware of*)? Live-Kommentar 23.11.2026: dieses „to“ ist beim Tippen nie
 * Pflicht. Anders als `verbTo` zählt hier auch „to be …“ (dort bleibt „to be“ stehen, damit *To be honest* nicht als „To ___“ erscheint).
 */
export function infinitiveTo(head: string): boolean {
  const n = normalize(head);
  if (verbTo(n)) return true;
  return /^to be \S/.test(n) && !TO_BE_FIXED.test(n);
}

/** Nach „to be“ ohne „be“ eine andere Bedeutung (*due to* = wegen, *used to* = pflegte) oder kein Adjektiv/Partizip (*on the fence*). */
const BE_KEEP = new Set([...PREPOSITIONS, ...PARTICLES, 'a', 'an', 'the', 'due', 'used', 'use', 'not', 'no']);

/**
 * „to be + Adjektiv/Partizip (+ Präposition)“ (*to be aware of*, *to be keen on*, *to be liable for*): ohne Satz zählt auch die Form ohne
 * „be“ (*aware of*), Live-Kommentar 23.11.2026. Nicht bei Satzadverbialen und nicht, wenn ohne „be“ etwas anderes entstünde (`BE_KEEP`).
 */
export function beAdjHead(head: string): boolean {
  const n = normalize(head);
  const m = /^to be (\S+)/.exec(n);
  return !!m && infinitiveTo(head) && !BE_KEEP.has(m[1]!);
}

/**
 * Was beim Tippen locker gilt (Live-Kommentar 23.11.2026): ohne Satz das Infinitiv-„to“ (beidseitig) und bei „to be + Adjektiv“ auch „be“.
 * In der Lücke nur das „to“ vor einer Grundform, wenn die Lücke selbst kein „to“ enthält (*We need to [adjust]*): dort muss die getippte
 * Form in den Satz passen, mehr wird nicht aufgeweicht.
 */
export function looseOf(head: string, gap: Gap | null): Pick<Target, 'toFree' | 'beFree'> {
  if (!infinitiveTo(head)) return {};
  if (!gap) return { toFree: true, ...(beAdjHead(head) ? { beFree: true } : {}) };
  const a = normalize(gap.answer);
  const base = normalize(head).split(' ')[1];
  return !/^to /.test(a) && a.split(' ')[0] === base ? { toFree: true } : {};
}

/**
 * Stichwort zum Zeigen (Lösung, Nachtippen): wie geschrieben, nur ohne „to“ und Platzhalter. Nur wenn das Ergebnis genau dieselben
 * Wörter ergibt wie `headWords`, sonst die geprüfte Grundform – so bleibt Groß-/Kleinschreibung und „I'd“ erhalten.
 */
export function headShown(head: string): string {
  const words = headWords(head).join(' ');
  const toks = head.trim().split(/\s+/);
  if (toks[0]?.toLowerCase() === 'to' && verbTo(normalize(head))) toks.shift();
  const shown = toks.filter((w) => !PLACEHOLDER.has(w.toLowerCase().replace(/^[([]|[)\],;:]$/g, ''))).join(' ');
  return shown && normalize(shown) === words ? shown : words;
}

type Tok = { w: string; s: number; e: number };
function tokenize(en: string): Tok[] {
  const out: Tok[] = [];
  for (const m of en.matchAll(/[A-Za-z0-9][A-Za-z0-9'’-]*/g)) out.push({ w: m[0].toLowerCase().replace(/’/g, "'"), s: m.index, e: m.index + m[0].length });
  return out;
}

/** Passt das Satzwort `w` zum Stichwort-Wort `h` (gleich, Beugung, unregelmäßige Form)? */
export function matchesWord(w: string, h: string): boolean {
  if (w === h) return true;
  if (h.length <= 2) return false; // Funktionswörter nur genau
  return inflections(h).has(w) || lemmaCandidates(w).includes(h);
}

function build(en: string, toks: Tok[], spans: [number, number][]): Gap {
  const segs: Seg[] = [];
  let pos = 0;
  const parts: string[] = [];
  for (const [a, b] of spans) {
    const s = toks[a]!.s;
    const e = toks[b]!.e;
    if (s > pos) segs.push({ t: 'text', s: en.slice(pos, s) });
    const part = en.slice(s, e);
    segs.push({ t: 'gap', s: part });
    parts.push(part);
    pos = e;
  }
  if (pos < en.length) segs.push({ t: 'text', s: en.slice(pos) });
  const first = spans[0]![0];
  const last = spans.at(-1)![1];
  const before = toks[first - 1]?.w;
  const after = toks[last + 1]?.w;
  return { segs, answer: parts.join(' '), ...(before ? { before } : {}), ...(after ? { after } : {}), split: spans.length > 1 };
}

/**
 * Lücke für das Stichwort im Satz finden. Treffer: die Wörter des Stichworts stehen zusammenhängend im Satz (jedes darf gebeugt sein); bei einem
 * zweiteiligen Phrasal Verb auch getrennt (Objekt dazwischen, höchstens 2 Wörter). Nichts gefunden → `null` (nie eine Lücke raten).
 */
export function locateGap(en: string, head: string, opts: { pv?: boolean } = {}): Gap | null {
  const hw = headWords(head);
  if (!hw.length) return null;
  const toks = tokenize(en);
  const n = hw.length;
  for (let i = 0; i + n <= toks.length; i++) if (hw.every((h, j) => matchesWord(toks[i + j]!.w, h))) return build(en, toks, [[i, i + n - 1]]);
  if (opts.pv && n === 2) {
    const [verb, part] = hw as [string, string];
    for (let i = 0; i < toks.length; i++) {
      if (!matchesWord(toks[i]!.w, verb)) continue;
      for (let j = i + 2; j <= Math.min(toks.length - 1, i + 1 + SPLIT_MAX_BETWEEN); j++)
        if (toks[j]!.w === part)
          return build(en, toks, [
            [i, i],
            [j, j],
          ]);
    }
  }
  return null;
}

/**
 * Rückfall, wenn `locateGap` nichts findet (Inhalts-Audit 04.11.2026: „meet sb halfway“ ↔ „[meet you halfway]“ – der Platzhalter steht im Satz
 * als echtes Wort): die vom Inhalt markierte Stelle wird die Lücke. Sicherung: mindestens ein Wort des Stichworts steht (gebeugt) in der
 * markierten Stelle, sonst `null`.
 */
export function gapFromMark(en: string, mark: readonly [number, number], head: string): Gap | null {
  const hw = headWords(head);
  if (!hw.length) return null;
  const toks = tokenize(en);
  const inside = toks.map((t, i) => ({ t, i })).filter(({ t }) => t.s >= mark[0] && t.e <= mark[1]);
  if (!inside.length) return null;
  if (!inside.some(({ t }) => hw.some((h) => matchesWord(t.w, h)))) return null;
  return build(en, toks, [[inside[0]!.i, inside.at(-1)!.i]]);
}

/** Lücke genau an der markierten Stelle, ohne Abgleich mit dem Stichwort (Wortfamilie: *implementation* zu *implement*). */
export function gapAt(en: string, mark: readonly [number, number]): Gap | null {
  const toks = tokenize(en);
  const inside = toks.map((t, i) => ({ t, i })).filter(({ t }) => t.s >= mark[0] && t.e <= mark[1]);
  return inside.length ? build(en, toks, [[inside[0]!.i, inside.at(-1)!.i]]) : null;
}

// ---------------------------------------------------------------- Wortfamilie (Emrah 25.11.2026)

export type FamilyCard = { sent: CardSentence; fam: Fam & { pos: FamPos }; stem: string };

/**
 * Karte „Wortfamilie“: eine geprüfte Form aus `famx` mit ihrem Satz, die Lücke an der markierten Stelle, das Stichwort als Stammwort in
 * Klammern (*The ___ (implement) took three months.*). Reihum je Abfrage (`fq.h.family`); ein Satz, der Form oder Stammwort außerhalb der
 * Lücke verrät, fällt weg. `null` = keine nutzbare Form.
 */
export function familyCard(doc: Record<string, unknown>, head: string, lex: Lex): FamilyCard | null {
  const fams = famOf(doc, head).filter(famAsked);
  if (!fams.length) return null;
  const stem = headShown(head) || head.trim();
  const start = (lex.fq?.h.family?.[0] ?? 0) % fams.length;
  for (let i = 0; i < fams.length; i++) {
    const fam = fams[(start + i) % fams.length]!;
    const m = /\[([^\]]+)\]/.exec(fam.ex);
    if (!m) continue;
    const en = fam.ex.replace(/\[([^\]]*)\]/g, '$1').replace(/\s+/g, ' ').trim();
    const lead = fam.ex.slice(0, m.index).replace(/\s+/g, ' ').replace(/^\s+/, '').length;
    const mark: [number, number] = [lead, lead + m[1]!.length];
    if (isDrillSentence(en)) continue;
    const gap = gapAt(en, mark);
    if (!gap) continue;
    const b = bracketed(gap);
    if (leaks(b, gap.answer) || leaks(b, stem)) continue;
    return { sent: { sent: { key: `f${hash32(exampleKey(en)).toString(36)}`, en, de: null, src: 'fam', mark }, gap }, fam, stem };
  }
  return null;
}

/** Satz mit dem Gesuchten in eckigen Klammern (Format der Inhalte, für `leaks`). */
export const bracketed = (g: Gap): string => g.segs.map((s) => (s.t === 'gap' ? `[${s.s}]` : s.s)).join('');

// ---------------------------------------------------------------- Satzwahl für eine Karte

export type CardSentence = { sent: Sent; gap: Gap };

/** Längster Satz, der in einer Abfrage noch ruhig lesbar ist (Wörter). Emrah 05.11.2026: „ein ganzer Roman“. */
export const SENT_MAX_WORDS = 22;
const ELLIPSIS = /^\s*(…|\.\.\.)|(…|\.\.\.)\s*$/;
/** Satzanfang: Großbuchstabe oder Ziffer (davor höchstens Anführung oder Klammer). */
const START_OK = /^["'“‘(]?[A-Z0-9]/;
/** Satzende: . ! ? (danach höchstens Anführung oder Klammer). */
const END_OK = /[.!?]["'”’)]*$/;
/**
 * Kurzer, vollständiger Satz: höchstens `SENT_MAX_WORDS` Wörter, kein Ausschnitt mit „…“ am Anfang oder Ende (Emrah 05.11.2026), beginnt groß
 * und endet mit Satzzeichen (Live-Kommentar 23.11.2026: „…real production file … went undetected. We take …“ war ein Leseausschnitt).
 */
export const tidySentence = (en: string): boolean => {
  const t = en.trim();
  return !ELLIPSIS.test(t) && START_OK.test(t) && END_OK.test(t) && t.split(/\s+/).length <= SENT_MAX_WORDS;
};

/** Abkürzungen, nach deren Punkt kein neuer Satz beginnt (*Mr. Smith*, *e.g. The*). */
const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'inc', 'ltd', 'co', 'corp', 'jr', 'sr', 'no', 'nos', 'approx', 'dept', 'e.g', 'i.e', 'u.s', 'u.k', 'a.m', 'p.m', 'fig', 'ca']);

/**
 * Satzgrenzen im Text: nach . ! ? (auch mehreren, danach Anführung/Klammer), Leerzeichen, dann ein Großbuchstabe oder eine Ziffer. Kein Schnitt
 * nach Abkürzungen und Initialen („J. Smith“) und nicht an „…“ (Auslassung, kein Satzende). Ergebnis: Zeichenbereiche ohne Rand-Leerzeichen.
 */
export function sentenceSpans(en: string): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  for (const m of en.matchAll(/[.!?]+["'”’)\]]*(\s+)(?=["'“‘([]?[A-Z0-9])/g)) {
    const end = m.index + m[0].length - m[1]!.length;
    const before = /(\S+)$/.exec(en.slice(start, m.index + 1))?.[1] ?? '';
    const word = before.replace(/^["'“‘([]+/, '').replace(/[.!?]+$/, '').toLowerCase();
    if (m[0][0] === '.' && (ABBR.has(word) || /^[a-z]$/.test(word))) continue;
    out.push([start, end]);
    start = m.index + m[0].length;
  }
  out.push([start, en.length]);
  return out
    .map(([a, b]): [number, number] => {
      const seg = en.slice(a, b);
      const lead = seg.length - seg.trimStart().length;
      return [a + lead, a + seg.trimEnd().length];
    })
    .filter(([a, b]) => b > a);
}

/**
 * Nur der EINE Satz mit der Fundstelle (Live-Kommentar 23.11.2026): Ein Lese-Ausschnitt mit mehreren Sätzen wird auf den Satz gekürzt, der die
 * markierte Stelle enthält bzw. (ohne Markierung) das Stichwort. Schlüssel bleibt gleich (Verlauf `sn`, „nie derselbe Satz“); die gespeicherte
 * Übersetzung gilt dem ganzen Text und fällt bei einer Kürzung weg. Gespeichert wird nichts.
 */
export function oneSentence(s: Sent, head: string, pv: boolean): Sent {
  const spans = sentenceSpans(s.en);
  if (spans.length < 2) return s;
  const mark = s.mark;
  const hit = mark ? spans.find(([a, b]) => a <= mark[0] && mark[1] <= b) : spans.find(([a, b]) => locateGap(s.en.slice(a, b), head, { pv }));
  if (!hit) return s;
  const [a, b] = hit;
  return { key: s.key, en: s.en.slice(a, b), de: null, src: s.src, ...(mark ? { mark: [mark[0] - a, mark[1] - a] as const } : {}) };
}

/**
 * Nutzbare Sätze: Lücke gefunden und der Satz verrät das Ziel nicht. `skipped` = Sätze ohne gefundene Lücke (Meldung an die Inhaltsprüfung).
 * Jeder Satz wird vorher auf den einen Satz mit der Fundstelle gekürzt (`oneSentence`). Lange Sätze und Ausschnitte („… gilt das …“, klein
 * begonnen, ohne Satzende) kommen nur, wenn das Wort sonst keinen nutzbaren Satz hat (`tidySentence`).
 */
export function usableSentences(sents: readonly Sent[], head: string, pv: boolean): { ok: CardSentence[]; skipped: Sent[] } {
  const ok: CardSentence[] = [];
  const rough: CardSentence[] = [];
  const skipped: Sent[] = [];
  for (const s0 of sents) {
    const s = oneSentence(s0, head, pv);
    const gap = locateGap(s.en, head, { pv }) ?? (s.mark ? gapFromMark(s.en, s.mark, head) : null);
    if (!gap) skipped.push(s0);
    else if (!leaks(bracketed(gap), gap.answer)) (tidySentence(s.en) ? ok : rough).push({ sent: s, gap });
  }
  return { ok: ok.length ? ok : rough, skipped };
}

/**
 * Satz für diese Karte (learning-scientist V3 Befund 7): Einführung und Schritt A im Ankersatz; danach `pickSentence` (am längsten nicht
 * gezeigt). `avoid` = gerade gezeigter Satz (Wiederkehr nach Fehler oder Einspruch: nie derselbe, wenn es einen anderen gibt).
 */
export function chooseSentence(lex: Lex, usable: readonly CardSentence[], day: string, o: { anchorOnly?: boolean; fresh?: boolean; avoid?: string | null; unseen?: boolean } = {}): CardSentence | null {
  if (!usable.length) return null;
  const anchor = usable.find((u) => u.sent.key === 'a');
  if (o.anchorOnly && anchor) return anchor;
  const pool0 = o.avoid && usable.length > 1 ? usable.filter((u) => u.sent.key !== o.avoid) : usable;
  // Politur P2 (Problemwort ab dem 3. Vergessen): ein Satz, der noch nie gezeigt wurde, wenn es einen gibt – der alte Satz trägt die Verwechslung mit.
  const shown = new Set(lex.sn.map((x) => x[0]));
  const never = o.unseen ? pool0.filter((u) => !shown.has(u.sent.key)) : [];
  const pool = never.length ? never : pool0;
  const key = pickSentence(
    lex,
    pool.map((u) => u.sent.key),
    day,
    { fresh: !!o.fresh },
  );
  return pool.find((u) => u.sent.key === key) ?? pool[0] ?? null;
}

// ---------------------------------------------------------------- Ziel und Stützen

/** Lehrer-Angaben zu einem Stichwort (aus den geprüften Chargen, nachgeladen; `teach.ts`). */
export type Teach = {
  /** Lehrer-Zeile „Warum“ (Deutsch). */
  why?: string;
  syn?: readonly string[];
  uk?: readonly string[];
  evade?: readonly string[];
  colloc?: readonly string[];
  prep?: readonly string[];
  uncount?: boolean;
  /** Falscher Freund: das deutsche Fallenwort (für „Gesucht: …“). */
  ff?: string;
  /** Verwechslungspartner (Kontrastkarte). */
  pair?: string;
  family?: readonly string[];
};

export type Pos = NonNullable<Target['pos']>;

/** Wortart aus dem Feld `pos` des Wort-Dokuments (frei geschrieben: „noun“, „Nomen“, „v.“ …). */
export function posOf(raw: unknown): Pos | null {
  const p = str(raw).toLowerCase();
  if (!p) return null;
  if (/^(n\b|noun|nomen|substantiv)/.test(p)) return 'noun';
  if (/^(v\b|verb|phrasal)/.test(p)) return 'verb';
  if (/^(adj|adjektiv)/.test(p)) return 'adj';
  if (/^(adv)/.test(p)) return 'adv';
  return null;
}

/** Ziel für die Auswertung (`checkAnswer`). `answer` = Gesuchtes, wie es in der Lücke steht; ohne Satz die Grundform. */
export function targetOf(lex: Lex, answer: string, pos: Pos | null, teach: Teach, gap: Gap | null, head?: string): Target {
  const syn = [...(lex.gr?.var ?? []), ...(teach.syn ?? [])];
  return {
    answer,
    ...(head ? looseOf(head, gap) : {}),
    k: lex.k,
    pos,
    ...(syn.length ? { syn } : {}),
    ...(teach.uk?.length ? { uk: teach.uk } : {}),
    ...(teach.evade?.length ? { evade: teach.evade } : {}),
    ...(teach.colloc?.length ? { colloc: teach.colloc } : {}),
    ...(teach.prep?.length ? { prep: teach.prep } : {}),
    ...(lex.gr?.cnt === 'u' || teach.uncount ? { uncount: true } : {}),
    ...(teach.family?.length ? { family: teach.family } : {}),
    ...(gap?.before ? { before: gap.before } : {}),
    ...(gap?.after ? { after: gap.after } : {}),
    ...(teach.ff ? { ff: true } : {}),
  };
}

/** „Gesucht: …“ an der Lücke (bis Stufe 4): deutsche Bedeutung, bei falschen Freunden mit Fallen-Hinweis. */
export function cueOf(lex: Lex, de: string, teach: Teach): { de: string; ff: boolean } | null {
  if (!de.trim() || lex.lv > CUE_MAX_LV) return null;
  return { de: de.trim(), ff: !!teach.ff };
}

/** Tipp: Anfangsbuchstabe je Teil und Wortzahl (*b… f…*, 2 Wörter). Zählt als Hilfe (`hint = 1`). */
export function tipOf(answer: string): { first: string; words: number } {
  const parts = answer.trim().split(/\s+/).filter(Boolean);
  return { first: parts.map((p) => `${p[0] ?? ''}…`).join(' '), words: parts.length };
}
