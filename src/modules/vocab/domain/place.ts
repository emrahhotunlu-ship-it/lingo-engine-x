import { damerau, normalize } from './check';
import { headwordOf } from './dupes';
import { hash32, rng } from './rand';
import type { BandRaw } from './sources';

// Großpaket A Schritt 7c (V5, vokabeln/s7-bau.md, Bilder s3-01 bis s3-04, Emrah 01.11.2026): Einstufungstest. Rein (keine Daten, kein
// Schreiben). Je Häufigkeitsstufe 6 Wörter erkennen (Satz mit markiertem Wort, 4 deutsche Bedeutungen derselben Wortart) und 2 selbst bilden
// (deutsches Wort groß, Lücke im Satz mit dem Anfangsbuchstaben). Eine Stufe ist sicher bei ≥ 5/6 erkannt und ≥ 1/2 gebildet; nach zwei nicht
// sicheren Stufen in Folge hört der Test auf. Ergebnis: Grenze (Rang), ab der die Häufigkeitsliste neue Wörter liefert, und die im Test
// gekonnten Stichwörter (kommen nicht als neu). Der Test ändert keine Wörter und keinen Plan.

/** Häufigkeitsstufen [von, bis) als Rang im Wort-Atlas. */
export const PLACE_BANDS: readonly (readonly [number, number])[] = [
  [2500, 4000],
  [4000, 6000],
  [6000, 8000],
  [8000, 10000],
  [10000, 12000],
];
export const REC_N = 6;
export const PROD_N = 2;
export const REC_PASS = 5;
export const PROD_PASS = 1;
/** Mindestlänge der Wörter zum Selbst-Bilden. */
export const PROD_MIN = 6;
/** Längste kurze Bedeutung im Erkennen (Ziel und Ablenker). */
export const DE_MAX = 40;
/** Grenze, wenn schon die erste Stufe nicht sicher ist. */
export const PLACE_FLOOR = PLACE_BANDS[0]![0];

export type RecItem = { kind: 'rec'; w: string; pos: string; x: string; start: number; end: number; opts: string[]; right: number };
export type ProdItem = { kind: 'prod'; w: string; pos: string; de: string; x: string; start: number; end: number; answer: string; first: string };
export type PlaceItem = RecItem | ProdItem;
export type PlaceBand = { lo: number; hi: number; rec: RecItem[]; prod: ProdItem[] };
export type PlaceTest = { bands: PlaceBand[] };

/** Antwort: Erkennen = gewählte Option (−1 = „Weiß ich nicht“), Bilden = getippter Text ('' = „Weiß ich nicht“). */
export type RecAnswer = number;
export type ProdAnswer = string;
export type BandAnswers = { rec: RecAnswer[]; prod: ProdAnswer[] };

export type BandStatus = 'ok' | 'bad' | 'skip';
export type BandResult = { lo: number; hi: number; s: BandStatus; r: number; p: number };
export type PlaceResult = { edge: number; bands: BandResult[]; ok: string[] };

/** Kürzel für Ergänzungen („jdn.“, „etw.“ …): solche Teile taugen nicht als Wahl oder Vorgabe. */
const ABBR = /(^|[\s(/])(jd[nmsr]|etw|sb|sth)\./i;
/** Wortanfang statt Bedeutung („Wärme…“, „Antritts-“). */
const FRAG = /(…|\.\.\.|-)$/;

/**
 * Deutsche Bedeutung kurz für Wahl und Bilden: höchstens zwei Teile (Komma/Semikolon). Weg fallen Beispiele (Satzzeichen am Ende, mehr als drei
 * Wörter, enthält einen schon genommenen Teil: „tief, tief ergriffen sein“), Wortanfänge und Teile mit „jdn./etw.“. '' = nichts Brauchbares
 * (der Eintrag kommt dann nicht in den Test; english-teacher S7c).
 */
export function shortDe(d: string): string {
  const out: string[] = [];
  for (const raw of d.split(/[;,]/)) {
    // Artikel am Anfang verraten die Wortart nicht anders als die anderen Optionen („das Jagen“; english-teacher S7c).
    const s = raw.trim().replace(/^(?:der|die|das|ein|eine)\s+(\p{Lu}\S*)$/u, '$1');
    if (!s || /[.!?]$/.test(s) || FRAG.test(s) || ABBR.test(s) || s.split(/\s+/).length > 3) continue;
    const k = s.toLowerCase();
    if (out.some((o) => o.toLowerCase().includes(k) || k.includes(o.toLowerCase()))) continue;
    out.push(s);
    if (out.length === 2) break;
  }
  return out.join(', ');
}
const deParts = (d: string): Set<string> => new Set(d.split(/[;,]/).map((s) => s.trim().toLowerCase()).filter(Boolean));

/** Für den Bedeutungsvergleich: ohne Umlaute und ohne Endung -e/-n/-s/-en („Kanäle“ ~ „Kanal“). */
const fold = (s: string): string => loanKey(s).replace(/(en|e|n|s)$/, '');

/** Zwei Bedeutungs-Mengen berühren sich: gleicher Teil oder ein Teil steckt im anderen (ab 4 Zeichen: „Gewinn“ in „Gewinnspanne“, „Kanäle“ und „Kanal“). */
function overlaps(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  const fb = [...b].map(fold);
  for (const x0 of a) {
    const x = fold(x0);
    for (const y of fb) {
      if (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))) return true;
    }
  }
  return false;
}

/**
 * Passt die kurze deutsche Bedeutung zur Wortart? Nomen mit großgeschriebenem Wort, alles andere ohne; Verben enden auf „n“ („sich weigern“), Adjektive höchstens
 * zwei Wörter. So verrät kein Ablenker durch seine Form, dass er nicht passt („schlank“ unter Verben; english-teacher S7c).
 */
export function deFits(pos: string, de: string): boolean {
  if (!de) return false;
  for (const part of de.split(',').map((s) => s.trim())) {
    if (!part) return false;
    // Nomen: ein großgeschriebenes Wort („kleiner Fluss“); alles andere: keins („ein bezauberndes Kleid“ ist kein Adjektiv).
    const upper = /(^|\s)\p{Lu}/u.test(part);
    if (pos === 'noun') {
      if (!upper) return false;
      continue;
    }
    if (pos === 'verb' || pos === 'adjective' || pos === 'adverb') {
      if (upper) return false;
      if (pos === 'verb' && !/n$/.test(part)) return false;
      if (pos === 'adjective' && part.split(/\s+/).length > 2) return false;
    }
  }
  return true;
}

/** Für den Lehnwort-Vergleich: klein, ohne Umlaute und Satzzeichen, dsch→j, sch→sh, c→k, y→i, ph→f („Konzentration“ ~ „concentration“, „Dschungel“ ~ „jungle“). */
function loanKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/dsch/g, 'j')
    .replace(/sch/g, 'sh')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/ph/g, 'f')
    .replace(/c/g, 'k')
    .replace(/y/g, 'i')
    .replace(/[^a-z]/g, '');
}

/** Wortfamilie: ein Stichwort steckt im anderen, auch hinter un-/in-/im-/ir-/il-/dis-/non- (ab 5 Buchstaben: „finite“ und „infinite“). */
const famKey = (w: string): string => w.toLowerCase().replace(/^(un|in|im|ir|il|dis|non)(?=[a-z]{5})/, '');
export function sameFamily(a: string, b: string): boolean {
  const x = famKey(a);
  const y = famKey(b);
  return Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x));
}
const inFamily = (w: string, words: ReadonlySet<string>): boolean => [...words].some((o) => sameFamily(w, o));

/**
 * Lehnwort: das englische Wort ist am deutschen Wort zu erkennen (gemeinsamer Anfang ab min(5, kürzere Länge − 1) Buchstaben oder höchstens
 * zwei Änderungen). Solche Wörter prüfen nichts und kommen nicht in den Test (english-teacher S7c).
 */
export function isLoan(w: string, de: string): boolean {
  const a = loanKey(w);
  if (!a) return false;
  for (const word of de.split(/[\s,;/()]+/)) {
    const b = loanKey(word);
    if (b.length < 2) continue;
    const short = Math.min(a.length, b.length);
    let k = 0;
    while (k < short && a[k] === b[k]) k++;
    if (k >= Math.min(5, short - 1) || damerau(a, b) <= 2) return true;
  }
  return false;
}

/** Stelle des Worts im Satz (ganzes Wort, Groß/klein egal); `null`, wenn es nicht genau so vorkommt. */
export function findWord(x: string, w: string): [number, number] | null {
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^A-Za-z'’-])(${esc})(?![A-Za-z'’-])`, 'i').exec(x);
  if (!m) return null;
  const start = m.index + (m[1]?.length ?? 0);
  return [start, start + w.length];
}

type Usable = BandRaw & { at: [number, number]; de: string };

/**
 * Nutzbare Einträge einer Stufe: ein Wort, Satz und Bedeutung da, Wort steht genau so im Satz, nichts Ausgeblendetes/Grundwortschatz/Schwaches,
 * nicht schon in einer früheren Einstufung gekonnt (`skip`).
 */
function usable(items: readonly BandRaw[], lo: number, hi: number, skip: ReadonlySet<string>): Usable[] {
  const out: Usable[] = [];
  const seen = new Set<string>();
  for (const e of items) {
    if (e.r < lo || e.r >= hi || e.hidden || e.basic || e.exWeak || !e.x || !e.d || !e.w || /\s/.test(e.w.trim())) continue;
    const h = headwordOf(e.w);
    if (seen.has(h) || skip.has(h)) continue;
    const at = findWord(e.x, e.w);
    if (!at || e.x.length > 140) continue;
    seen.add(h);
    out.push({ ...e, at, de: shortDe(e.d) });
  }
  return out;
}

function shuffle<T>(a: readonly T[], rnd: () => number): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Drei Ablenker derselben Wortart und Stufe: Form passt zur Wortart, keine Bedeutung eines Testworts (im ganzen Test), keiner doppelt im Test.
 * `used` sammelt die kurzen Formen aller Ziele und schon vergebenen Ablenker; `blocked` die Bedeutungsteile aller Testwörter.
 */
function distractors(target: Usable, pool: readonly Usable[], rnd: () => number, words: ReadonlySet<string>, blocked: ReadonlySet<string>, used: Set<string>): string[] | null {
  const out: string[] = [];
  const mine = new Set<string>();
  for (const c of shuffle(pool, rnd)) {
    if (words.has(c.w) || c.p !== target.p) continue;
    const k = c.de.toLowerCase();
    // Lehnwörter fallen als Ablenker sofort heraus („Mayonnaise“) und machen die Frage durch Ausschließen lösbar (english-teacher S7c).
    if (!c.de || c.de.length > DE_MAX || used.has(k) || mine.has(k) || !deFits(c.p, c.de) || isLoan(c.w, c.de)) continue;
    const parts = deParts(c.d);
    if (overlaps(parts, blocked)) continue;
    mine.add(k);
    out.push(c.de);
    if (out.length === 3) {
      for (const m of mine) used.add(m);
      return out;
    }
  }
  return null;
}

/** Ersatz-Ziele je Stufe für den Fall, dass für ein Wort keine drei Ablenker zu finden sind. */
const REC_SPARE = 6;

/**
 * Test aus dem Wort-Atlas bauen, fest aus `seed` (gleicher Tag → gleiche Wörter, auch nach Neuladen). Stufen ohne genug nutzbare Wörter fallen
 * weg. Erst alle Testwörter aller Stufen (keine zwei aus einer Wortfamilie), dann die Ablenker (keiner deckt sich mit einem Testwort, kommt
 * doppelt oder ist ein Lehnwort; english-teacher S7c).
 * Bilden nimmt Wörter ab 6 Buchstaben, keine Adverbien (deutsch meist gleich dem Adjektiv: „erfolgreich“) und keine Lehnwörter; Erkennen nur
 * Bedeutungen bis 40 Zeichen in passender Form. `skip` = in einer früheren Einstufung gekonnte Stichwörter (Wiederholung bringt neue Wörter).
 */
export function buildPlaceTest(items: readonly BandRaw[], seed: string, skip: ReadonlySet<string> = new Set()): PlaceTest {
  const plans: { lo: number; hi: number; rnd: () => number; pool: Usable[]; prod: ProdItem[]; cand: Usable[] }[] = [];
  const words = new Set<string>();
  const blocked = new Set<string>();
  for (const [lo, hi] of PLACE_BANDS) {
    const rnd = rng(hash32(`${seed}|${lo}`));
    const pool = usable(items, lo, hi, skip);
    const order = shuffle(pool, rnd);
    const prod: ProdItem[] = [];
    const cand: Usable[] = [];
    const take = (e: Usable) => {
      words.add(e.w);
      for (const p of deParts(e.d)) blocked.add(p);
    };
    for (const e of order) {
      if (prod.length === PROD_N) break;
      if (e.w.length < PROD_MIN || e.p === 'adverb' || !e.de || isLoan(e.w, e.de) || inFamily(e.w, words)) continue;
      const answer = e.x.slice(e.at[0], e.at[1]);
      prod.push({ kind: 'prod', w: e.w, pos: e.p, de: e.de, x: e.x, start: e.at[0], end: e.at[1], answer, first: answer.charAt(0) });
      take(e);
    }
    for (const e of order) {
      if (cand.length === REC_N + REC_SPARE) break;
      if (words.has(e.w) || !e.de || e.de.length > DE_MAX || !deFits(e.p, e.de) || isLoan(e.w, e.de) || inFamily(e.w, words)) continue;
      cand.push(e);
      take(e);
    }
    plans.push({ lo, hi, rnd, pool, prod, cand });
  }
  const used = new Set<string>();
  for (const pl of plans) for (const e of [...pl.cand, ...pl.prod.map((p) => ({ de: p.de }))]) used.add(e.de.toLowerCase());
  const bands: PlaceBand[] = [];
  for (const { lo, hi, rnd, pool, prod, cand } of plans) {
    const rec: RecItem[] = [];
    for (const e of cand) {
      if (rec.length === REC_N) break;
      const ds = distractors(e, pool, rnd, words, blocked, used);
      if (!ds) continue;
      const opts = shuffle([e.de, ...ds], rnd);
      rec.push({ kind: 'rec', w: e.w, pos: e.p, x: e.x, start: e.at[0], end: e.at[1], opts, right: opts.indexOf(e.de) });
    }
    if (rec.length === REC_N && prod.length === PROD_N) bands.push({ lo, hi, rec, prod });
  }
  return { bands };
}

/** Der Anfangsbuchstabe steht in der Lücke: wer ihn nicht mittippt, meint ihn mit („lock“ bei „c…“ = „clock“; ux-reviewer S7c). */
export function withFirst(item: ProdItem, typed: string): string {
  const v = typed.trim();
  if (!v || !item.first || v.charAt(0).toLowerCase() === item.first.toLowerCase()) return v;
  return item.first + v;
}

/** Selbst gebildet: Groß/klein egal; ab 6 Buchstaben ist ein Tippfehler erlaubt (Vertauschung zählt einmal). */
export function prodRight(item: ProdItem, typed: string): boolean {
  const a = normalize(withFirst(item, typed));
  const b = normalize(item.answer);
  if (!a) return false;
  if (a === b) return true;
  return b.length >= PROD_MIN && damerau(a, b) <= 1;
}

/** Eine Stufe auswerten. */
export function scoreBand(band: PlaceBand, ans: BandAnswers): { r: number; p: number; ok: boolean } {
  const r = band.rec.filter((it, i) => ans.rec[i] === it.right).length;
  const p = band.prod.filter((it, i) => prodRight(it, ans.prod[i] ?? '')).length;
  return { r, p, ok: r >= REC_PASS && p >= PROD_PASS };
}

/** Nach so vielen nicht sicheren Stufen in Folge hört der Test auf (english-teacher S7c: ein Ausrutscher beendet ihn nicht). */
export const STOP_AFTER = 2;

/** Geht der Test nach diesen Stufen-Ergebnissen (in Reihenfolge, `true` = sicher) weiter? */
export function placeGoesOn(oks: readonly boolean[]): boolean {
  return !(oks.length >= STOP_AFTER && oks.slice(-STOP_AFTER).every((o) => !o));
}

/**
 * Ergebnis aus den Antworten der gelaufenen Stufen (in Reihenfolge; der Test hält nach zwei nicht sicheren Stufen in Folge). Grenze = obere
 * Rangzahl der letzten sicheren Stufe, sonst die Untergrenze der ersten. `ok` = richtig beantwortete Stichwörter aller gelaufenen Stufen.
 */
export function scorePlace(test: PlaceTest, answers: readonly BandAnswers[]): PlaceResult {
  const bands: BandResult[] = [];
  const ok: string[] = [];
  const oks: boolean[] = [];
  let edge = test.bands[0]?.lo ?? PLACE_FLOOR;
  test.bands.forEach((b, i) => {
    const a = answers[i];
    if (!placeGoesOn(oks) || !a) {
      bands.push({ lo: b.lo, hi: b.hi, s: 'skip', r: 0, p: 0 });
      return;
    }
    const sc = scoreBand(b, a);
    b.rec.forEach((it, k) => {
      if (a.rec[k] === it.right) ok.push(it.w);
    });
    b.prod.forEach((it, k) => {
      if (prodRight(it, a.prod[k] ?? '')) ok.push(it.w);
    });
    bands.push({ lo: b.lo, hi: b.hi, s: sc.ok ? 'ok' : 'bad', r: sc.r, p: sc.p });
    oks.push(sc.ok);
    if (sc.ok) edge = b.hi;
  });
  return { edge, bands, ok: [...new Set(ok)] };
}
