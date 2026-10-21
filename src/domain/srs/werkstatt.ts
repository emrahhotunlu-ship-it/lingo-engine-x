import { addDays, dayKey, isDayKey } from '../date';
import { normalize, withoutTo } from '../answer/normalize';
import type { Trap } from '../../content/nb/traps';
import { chunkParts, type ChunkPart } from './chunkCards';
import { lapsesOf } from './lapses';
import { introDayOf, isFreeForm } from './spacing';
import { trapForCard } from './traps';
import type { Lang, TrainCard } from './types';

// Wort-Lernen 2, Teil 2: Wort-Werkstatt (docs/umbau/wort-fest-plan.md). Rein und ohne Seiteneffekte.
//
// Ein Wort, das nicht hängen bleibt, wird nicht einfach öfter abgefragt, sondern neu verankert:
//  - Auslöser: seit der letzten Werkstatt 3 freie Fehlversuche (je Lerntag höchstens 2 gezählt; ein einzelner Ein-Buchstaben-Tippfehler zählt nicht)
//    ODER Fehler an 2 verschiedenen Lerntagen innerhalb von 14 Tagen
//    (ersetzt „Dauerfehler ab 5 Vergessen“ und „Merkhilfe ab 4 Vergessen“). Der Einführungstag zählt nie (dort ist Fehlen normal).
//  - Diagnose aus vorhandenen Daten: falsche Eingaben (`hist[].v`), Verwechslung mit einem anderen eigenen Wort, Deutsch-Falle,
//    Partnerwort, Schreibung (Tippabstand ≤ 2), Klang (Hörübungen) – sonst Bedeutung.
//  - Danach 2–3 Tage Ruhe (Fälligkeit auf den übernächsten Lerntag), höchstens 2 Werkstatt-Wörter je Lerntag.
//  - Ab 6 Vergessen das Angebot „pausieren“ (ausblenden, nichts gelöscht); nach 3 Werkstatt-Runden die Frage „Brauchst du dieses Wort wirklich?“.
// Die Werkstatt ersetzt die Wiederholung der Karte in der Runde (gleiches Zählen für die Pflicht, keine zusätzliche Aufgabe).

type Doc = Readonly<Record<string, unknown>>;

/** Höchstens so viele Werkstatt-Wörter je Lerntag. */
export const WERKSTATT_PER_DAY = 2;
/** Freie Fehlversuche seit der letzten Werkstatt, die sie auslösen. */
export const WK_FREE_FAILS = 3;
/** Verschiedene Lerntage mit einem Fehler (innerhalb des Fensters), die sie auslösen. */
export const WK_LAPSE_DAYS = 2;
export const WK_WINDOW_DAYS = 14;
/** Ruhe nach der Werkstatt: die Karte kommt frühestens am übernächsten Lerntag (2 Tage), spätestens nach 3. */
export const WK_REST_MIN = 2;
export const WK_REST_MAX = 3;
/** Ab so vielen Vergessen bietet die Werkstatt „pausieren“ an. */
export const PAUSE_FROM_LAPSES = 6;
/** Nach so vielen Werkstatt-Runden fragt sie „Brauchst du dieses Wort wirklich?“. */
export const ASK_NEED_AFTER = 3;
/** Längste gespeicherte falsche Eingabe (`hist[].v`). */
export const WRONG_MAX = 40;

/** Werkstatt-Stand an der Karte: Runden, Zeitpunkt und Lerntag der letzten Runde, pausiert. */
export type Wk = { n: number; t: number; d: string; p?: 1 };

/** Tolerant gelesen; unlesbar = keine Werkstatt bisher. */
export function readWk(doc: Doc): Wk | null {
  const w = doc.wk;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const o = w as Record<string, unknown>;
  const n = typeof o.n === 'number' && Number.isFinite(o.n) && o.n > 0 ? Math.round(o.n) : 0;
  const t = typeof o.t === 'number' && Number.isFinite(o.t) && o.t > 0 ? o.t : 0;
  const d = isDayKey(o.d) ? o.d : t ? dayKey(t) : '';
  if (!n || !t || !d) return null;
  return { n, t, d, ...(o.p === 1 ? { p: 1 as const } : {}) };
}

type WRow = { t: number; day: string; g: number | null; x: string | null; ci: boolean; u: boolean; v: string | null };

function wrows(doc: Doc): WRow[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const out: WRow[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    if (typeof o.t !== 'number' || !Number.isFinite(o.t)) continue;
    if (o.m === 'known' || o.x === 'known') continue;
    out.push({
      t: o.t,
      day: dayKey(o.t),
      g: typeof o.g === 'number' && Number.isFinite(o.g) ? o.g : null,
      x: typeof o.x === 'string' ? o.x : null,
      ci: typeof o.ci === 'number' && o.ci >= 0,
      u: o.u === 1,
      v: typeof o.v === 'string' && o.v.trim() ? o.v.trim().slice(0, WRONG_MAX) : null,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Je Lerntag zählen höchstens so viele freie Fehlversuche (Lehrer-Prüfung 21.10.2026: 3 Fehlversuche an mindestens 2 Tagen). */
export const WK_FAILS_PER_DAY = 2;

/** Zielform der Karte (Vokabel `word`, Wendung `en`), normalisiert; leer, wenn keine. */
const targetOf = (doc: Doc): string => {
  const w = typeof doc.word === 'string' ? doc.word : typeof doc.en === 'string' ? doc.en : '';
  return withoutTo(normalize(w));
};

/** Ein einzelner Tippfehler: genau ein Buchstabe Abstand zum Wort (ab 3 Buchstaben). */
const oneLetterOff = (v: string | null, target: string): boolean => !!v && target.length >= 3 && editDistance(withoutTo(normalize(v)), target) === 1;

/**
 * Fehler seit der letzten Werkstatt, ohne Einführungstag, ohne Partnerwort und ohne „Welches Wort passt?“. Ein einzelner Ein-Buchstaben-Tippfehler zählt nicht mit;
 * kommt so ein Tippfehler wiederholt vor, zählen alle (die Diagnose heißt dann „Schreibung“).
 */
function failsSince(doc: Doc): WRow[] {
  const intro = introDayOf(doc);
  const since = readWk(doc)?.t ?? 0;
  const fails = wrows(doc).filter((r) => r.t > since && r.g === 1 && !r.ci && r.x !== 'contrast' && (intro === null || r.day > intro));
  const target = targetOf(doc);
  const typos = fails.filter((r) => oneLetterOff(r.v, target));
  return typos.length >= 2 ? fails : fails.filter((r) => !typos.includes(r));
}

/**
 * Hakt das Wort (unabhängig von Ruhe und Tageshöchstzahl)? 3 freie Fehlversuche seit der letzten Werkstatt (je Lerntag höchstens 2 gezählt, also an mindestens 2 Tagen)
 * oder Fehler an 2 Lerntagen innerhalb von 14 Tagen bis `day`. Neue, ausgeblendete und pausierte Karten nie.
 */
export function struggling(doc: Doc, day: string): boolean {
  // `p` (pausiert) wirkt über `hidden`: Blendet Emrah das Wort in der Liste wieder ein, darf die Werkstatt es wieder aufnehmen.
  if (doc.state === 'new' || doc.hidden === true) return false;
  const fails = failsSince(doc);
  const perDay = new Map<string, number>();
  for (const r of fails) if (!r.u && isFreeForm(r.x)) perDay.set(r.day, Math.min(WK_FAILS_PER_DAY, (perDay.get(r.day) ?? 0) + 1));
  if ([...perDay.values()].reduce((a, b) => a + b, 0) >= WK_FREE_FAILS) return true;
  const from = addDays(day, -(WK_WINDOW_DAYS - 1));
  return new Set(fails.filter((r) => r.day >= from && r.day <= day).map((r) => r.day)).size >= WK_LAPSE_DAYS;
}

/** Gehört die Karte heute in die Werkstatt? Wie `struggling`, aber nicht am Tag einer Werkstatt-Runde und nicht in der Ruhe danach. */
export function werkstattDue(doc: Doc, day: string): boolean {
  const wk = readWk(doc);
  if (wk && day < addDays(wk.d, WK_REST_MIN)) return false;
  return struggling(doc, day);
}

/** Wie viele Werkstatt-Wörter gehen heute noch (je Lerntag höchstens `WERKSTATT_PER_DAY`)? */
export function werkstattRoom(docs: readonly Doc[], day: string): number {
  const done = docs.filter((d) => readWk(d)?.d === day).length;
  return Math.max(0, WERKSTATT_PER_DAY - done);
}

/** Lerntag, an dem die Karte nach der Werkstatt wiederkommt: frühestens `day + 2`, höchstens `day + 3`. Die FSRS-Fälligkeit gilt, wenn sie dazwischen liegt. */
export function restDay(fsrsDueDay: string, day: string): string {
  const min = addDays(day, WK_REST_MIN);
  const max = addDays(day, WK_REST_MAX);
  return fsrsDueDay < min ? min : fsrsDueDay > max ? max : fsrsDueDay;
}

/** Angebot „pausieren“ ab 6 Vergessen. */
export const canPause = (doc: Doc): boolean => lapsesOf(doc) >= PAUSE_FROM_LAPSES;
/** Frage „Brauchst du dieses Wort wirklich?“ ab der 3. Runde (vor der vierten). */
export const askNeed = (doc: Doc): boolean => (readWk(doc)?.n ?? 0) >= ASK_NEED_AFTER;

// ------------------------------------------------------------------ Diagnose

export type DiagKind = 'confusion' | 'false_friend' | 'partner' | 'form' | 'sound' | 'meaning';
export type Diagnosis = {
  kind: DiagKind;
  /** Verwechseltes eigenes Wort (Kontrast „Deutsch denkt … → Englisch sagt …“). */
  other?: { word: string; de: string | null; def: string | null };
  /** Zuletzt falsch Getipptes (nur Anzeige). */
  wrong?: string;
  trap?: Trap;
};

type DiagCard = Pick<TrainCard, 'key' | 'kind' | 'word' | 'lemma' | 'de' | 'def' | 'doc'>;

const same = (a: string, b: string): boolean => {
  const x = withoutTo(normalize(a));
  const y = withoutTo(normalize(b));
  return !!x && x === y;
};

/** Levenshtein-Abstand (kurze Wörter, höchstens 40 Zeichen). */
export function editDistance(a: string, b: string): number {
  const s = a.slice(0, WRONG_MAX);
  const t = b.slice(0, WRONG_MAX);
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    for (let j = 1; j <= t.length; j++) cur[j] = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + (s[i - 1] === t[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[t.length] as number;
}

const SOUND_EX = new Set(['listen_mc', 'dictation']);

/**
 * Was geht schief? Reihenfolge: Verwechslung mit einem anderen eigenen Wort (getippte Eingabe bzw. die in dieser Sitzung gemerkte Verwechslung),
 * Partnerwort, Schreibung (Tippabstand ≤ 2 zum Wort), Klang (Fehler vor allem beim Hören), Deutsch-Falle, sonst Bedeutung.
 */
export function diagnose(card: DiagCard, pool: readonly DiagCard[], opts: { confusedKey?: string | undefined } = {}): Diagnosis {
  const all = wrows(card.doc).filter((r) => r.g === 1);
  const wrongs = all.map((r) => r.v).filter((v): v is string => !!v);
  const wrong = wrongs.at(-1);
  const base = wrong ? { wrong } : {};
  const pick = (o: DiagCard) => ({ word: o.word, de: o.de, def: o.def });
  const conf = opts.confusedKey ? pool.find((p) => p.key === opts.confusedKey && p.key !== card.key) : undefined;
  if (conf) return { kind: 'confusion', other: pick(conf), ...base };
  for (const v of [...wrongs].reverse()) {
    if (same(v, card.word) || same(v, card.lemma)) continue;
    const o = pool.find((p) => p.key !== card.key && (same(v, p.word) || same(v, p.lemma)));
    if (o) return { kind: 'confusion', other: pick(o), wrong: v };
  }
  const recent = all.slice(-4);
  const partner = wrows(card.doc).filter((r) => r.g === 1 && r.ci).length;
  if (partner >= 2 && partner >= recent.length / 2) return { kind: 'partner', ...base };
  const target = withoutTo(normalize(card.word));
  if (target.length >= 3 && wrongs.some((v) => { const d = editDistance(withoutTo(normalize(v)), target); return d > 0 && d <= 2; })) return { kind: 'form', ...base };
  if (recent.length && recent.filter((r) => r.x !== null && SOUND_EX.has(r.x)).length * 2 > recent.length) return { kind: 'sound', ...base };
  const trap = trapForCard(card);
  if (trap) return { kind: 'false_friend', trap, ...base };
  return { kind: 'meaning', ...base };
}

/** Eine Zeile „Deutsch denkt … → Englisch sagt …“. `mine` = die Zeile des Werkstatt-Worts. */
export type ContrastLine = { think: string; say: string; mine: boolean };

const meaningIn = (c: { de: string | null; def: string | null }, lang: Lang): string | null => (lang === 'de' ? (c.de ?? c.def) : (c.def ?? c.de));

/**
 * Gegenüberstellung zur Diagnose. Verwechslung: beide Wörter mit ihrer Bedeutung; Deutsch-Falle: falscher und richtiger Satz;
 * Schreibung: Getipptes gegen das Wort. Sonst nur die eigene Zeile (Bedeutung → Wort). Leer, wenn nichts Belastbares da ist.
 */
export function contrastLines(diag: Diagnosis, card: Pick<TrainCard, 'word' | 'de' | 'def'>, lang: Lang): ContrastLine[] {
  const mine = meaningIn(card, lang);
  const own: ContrastLine[] = mine ? [{ think: mine, say: card.word, mine: true }] : [];
  if (diag.kind === 'confusion' && diag.other) {
    const o = meaningIn(diag.other, lang);
    return o ? [...own, { think: o, say: diag.other.word, mine: false }] : own;
  }
  if (diag.kind === 'false_friend' && diag.trap) return [{ think: diag.trap.wrong, say: diag.trap.right, mine: true }];
  return own;
}

/** Wendung in Teile, Kern zuerst (dann Rahmen und feste Teile, Platzhalter zuletzt). Wörter: leer. */
export function partsCoreFirst(card: Pick<TrainCard, 'kind' | 'word'>): ChunkPart[] {
  if (card.kind !== 'chunk') return [];
  const order: Record<ChunkPart['kind'], number> = { core: 0, fixed: 1, frame: 2, slot: 3 };
  const parts = chunkParts(card.word);
  if (parts.length < 2) return [];
  return parts.map((p, i) => ({ p, i })).sort((a, b) => order[a.p.kind] - order[b.p.kind] || a.i - b.i).map((x) => x.p);
}

/** Höchste gespeicherte Zahl der Werkstatt-Runden (Schreib-Schema). */
export const WK_N_MAX = 99;

/** Werkstatt-Stand nach einer Runde (Abruf am Ende der Werkstatt). Vorhandene Felder (`p`) bleiben stehen; `n` höchstens 99. */
export function nextWk(doc: Doc, t: number, day: string): Wk {
  const prev = readWk(doc);
  return { ...(prev ?? {}), n: Math.min(WK_N_MAX, (prev?.n ?? 0) + 1), t, d: day };
}
