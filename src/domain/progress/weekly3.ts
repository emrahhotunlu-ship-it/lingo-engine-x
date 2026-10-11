import { effectiveChapter } from '../c1/effective';
import { programChapters } from '../c1/chapters';
import { chapterState } from '../c1/state';
import { addDays, daysBetween, dayKey, isDayKey, isoWeek } from '../date';
import { patternById } from '../grammar/patterns';
import { patInfos } from '../grammar/slotInput';
import { currentChapter } from '../grammar/slotPlan';
import { isWrongLang, langScores } from '../lang/detect';
import { patternState, patternStateNo, patsOf } from '../metrics/pattern';
import type { Confusion } from '../tutor/confusion';
import { lastWeekOf, newFestWords, patternsNewSafe } from './weekly';

// Wochenrückblick 3.0 (Lernplattform 3.0 P50, Motivation §4.9 mit K-15). Rein, nichts wird gelesen oder gespeichert.
//   - Die eine große Zahl „+31 fest“ (Wörter und Wendungen, `history[].vu`, Wochenende gegen Wochenende), die Namen der neu Festen (`ff`),
//     die Muster, die neu Sicher wurden (`pats[*].s`).
//   - EINE Karte „Für deinen Lehrer“: erste Zeile die Kapitel-Notiz („This month I'm working on …“), darunter der Wochentext aus einer festen Vorlage,
//     ohne Claude, reiner Englischtext (Kopieren).
//   - Fokus für die Woche (zwei Vorschläge, `app/profile.wf`): wirkt erst ab dem nächsten Plan (`focusFor`), nie auf den gespeicherten Plan von heute.
//   - Einsatz-Satz der Woche aus `program.json` (`use`).

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ------------------------------------------------------------------ große Zahl

/** Wie weit der Wert vor der Woche höchstens zurückliegen darf (Tage), damit er als Vergleichswert gilt (sonst „+n“ aus ff statt eines Vergleichs über Wochen). */
const START_MAX_AGE = 3;

export type Big = { n: number; src: 'vu' | 'ff' };

/**
 * „+n fest“: Fest-Zahl der Wörter und Wendungen (`history[].vu`) am letzten Tag der Woche gegen den letzten Wert vor der Woche. Negativ ist möglich
 * (nach einer Pause). Fehlt einer der beiden Werte, gilt die Zahl der in der Woche neu Festen (`ff`), sonst `null`.
 */
export function bigNumber(history: unknown, days: readonly string[], newFest: number): Big | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (first && last) {
    const rows = arr(history)
      .filter((h) => isDayKey(h.d) && typeof h.vu === 'number' && Number.isFinite(h.vu))
      .map((h) => ({ d: str(h.d), v: num(h.vu) }))
      .sort((a, b) => (a.d < b.d ? -1 : 1));
    const end = [...rows].reverse().find((r) => r.d <= last && r.d >= first);
    const start = [...rows].reverse().find((r) => r.d < first && daysBetween(r.d, first) <= START_MAX_AGE);
    if (end && start) return { n: end.v - start.v, src: 'vu' };
  }
  return newFest > 0 ? { n: newFest, src: 'ff' } : null;
}

// ------------------------------------------------------------------ Text für den Lehrer

export type TeacherInput = {
  /** Kapitel-Notiz (Englisch, `program.json`), erste Zeile. */
  note: string | null;
  /** Muster, die diese Woche geübt wurden (englische Namen), höchstens 3. */
  practiced: readonly string[];
  /** Neu feste Wörter und Wendungen (Englisch), alle; gezeigt werden höchstens 5. */
  fest: readonly string[];
  /** Was noch schwerfällt: englische Namen und optional ein Beispiel aus den eigenen Antworten. */
  tricky: { names: readonly string[]; example: { q: string; given: string; ans: string } | null; /** Aus eigenen Fehlern belegt (`cf`)? Sonst ist das zweite Muster nur das Kontrastpaar des Kurses. */ confirmed?: boolean } | null;
};

/** Aufzählung mit Oxford-Komma: „a“, „a and b“, „a, b, and c“. */
const list = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`);
const FEST_SHOWN = 5;

/** Ein Beispiel nur, wenn es als Englisch durchgeht (die Antworten des Lernenden können Unsinn oder Deutsch enthalten). */
function exampleLine(e: { q: string; given: string; ans: string }): string | null {
  const q = e.q.replace(/\s+/g, ' ').trim();
  const g = e.given.replace(/\s+/g, ' ').trim();
  const a = e.ans.replace(/\s+/g, ' ').trim();
  if (!q || !g || !a || q.length > 140 || /["“”„]/.test(q + g + a)) return null;
  // Jeder Teil einzeln prüfen (die Erkennung braucht mehrere Wörter und schweigt bei Mischungen); Umlaute und ß sind immer ein Zeichen für Deutsch.
  const german = (x: string): boolean => {
    const { de, en } = langScores(x);
    return /[äöüÄÖÜß]/.test(x) || (de >= 1 && de >= en) || isWrongLang(x, 'en');
  };
  if ([q, g, a].some(german)) return null;
  return `For example, in "${q}" I wrote "${g}" instead of "${a}".`;
}

/**
 * Der Wochentext in der festen Vorlage (ohne Claude, nur Englisch). Fehlt ein Teil, entfällt seine Zeile; ohne jeden Inhalt bleibt nur die Notiz.
 * Verboten sind Selbstkritik-Wörter und Ausrufezeichen (Textwächter); der Text bleibt sachlich.
 */
export function teacherText(i: TeacherInput): string {
  const lines: string[] = [];
  if (i.note) lines.push(i.note.trim());
  const body: string[] = [];
  if (i.practiced.length) body.push(`This week I worked on ${list(i.practiced.slice(0, 3))}.`);
  if (i.fest.length) {
    const shown = i.fest.slice(0, FEST_SHOWN);
    const more = i.fest.length - shown.length;
    body.push(`Words and phrases I can now recall reliably: ${more > 0 ? `${shown.join(', ')}, and ${more} more` : list(shown)}.`);
  }
  if (i.tricky && i.tricky.names.length) {
    const ex = i.tricky.example ? exampleLine(i.tricky.example) : null;
    const [a, b] = i.tricky.names;
    // „versus“ behauptet eine Verwechslung: nur, wenn sie belegt ist; sonst geht es um das eine Muster und den Unterschied zum Kontrastpaar.
    const what = b ? (i.tricky.confirmed === false ? `${a}, especially how it differs from ${b}` : `${a} versus ${b}`) : a;
    body.push(`Still tricky: ${what}.`);
    if (ex) body.push(ex);
    body.push('Could we practice this in our next lesson, maybe in a short role-play?');
  }
  if (body.length) lines.push(body.join(' '));
  return lines.join('\n\n');
}

// ------------------------------------------------------------------ Fokus

export type WfEntry = { w: string; a: string; t: number };
const WEEK_RE = /^\d{4}-W\d{2}$/;

/** `app/profile.wf` tolerant lesen (neueste zuletzt, je Woche höchstens ein Eintrag, ohne Obergrenze). */
export function readWf(raw: unknown): WfEntry[] {
  const byWeek = new Map<string, WfEntry>();
  for (const e of arr(raw)) {
    const w = str(e.w);
    const t = num(e.t);
    if (!WEEK_RE.test(w) || t <= 0) continue;
    const prev = byWeek.get(w);
    if (!prev || t >= prev.t) byWeek.set(w, { w, a: str(e.a).slice(0, 40), t });
  }
  return [...byWeek.values()].sort((a, b) => a.t - b.t);
}

/** Die Woche, für die eine Wahl zählt: ab Sonntag die kommende (der Sonntag trägt nichts mehr). */
export function focusWeekOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return isoWeek(dow === 0 ? addDays(day, 1) : day);
}

/**
 * Wahl eintragen: `a` = Musterkennung, `''` = „Die App entscheidet“. Rein, für `recordProfileFields`: liefert den Patch `{wf}` oder `null`, wenn sich nichts
 * ändert. Die Roh-Liste bleibt unverändert (auch unbekannte Felder und unlesbare Einträge); nur der Eintrag DIESER Woche wird ersetzt (Spread) oder angehängt.
 * Es gibt keine Obergrenze: höchstens ein Eintrag je Woche, ≈ 50 Byte, also unter 3 KB im Jahr (Ausnahme von „höchstens 12“, docs/datenmodell.md).
 */
export function wfOp(cur: Doc | undefined, i: { w: string; a: string; t: number }): { wf: unknown[] } | null {
  const raw = Array.isArray(obj(cur).wf) ? [...(obj(cur).wf as unknown[])] : [];
  let at = -1;
  raw.forEach((r, k) => {
    const e = obj(r);
    if (str(e.w) === i.w && num(e.t) > 0 && (at < 0 || num(e.t) >= num(obj(raw[at]).t))) at = k;
  });
  const now = at >= 0 ? obj(raw[at]) : null;
  if (now && str(now.a) === i.a) return null;
  if (!now && i.a === '') return null;
  if (at >= 0) raw[at] = { ...obj(raw[at]), w: i.w, a: i.a, t: i.t };
  else raw.push({ w: i.w, a: i.a, t: i.t });
  return { wf: raw };
}

/**
 * Fokus-Muster für die Runden DIESER Woche, aber erst für Pläne, die nach der Wahl angelegt wurden (`planAt` = Zeitpunkt des gespeicherten Plans,
 * `StoredPlan.at`). Der Plan von heute bleibt so eingefroren: eine Wahl heute ändert nichts an ihm. `null` ohne Wahl, bei „Die App entscheidet“,
 * für eine andere Woche, für ein unbekanntes Muster oder ohne gespeicherten Plan.
 */
export function focusFor(wfRaw: unknown, o: { planAt: number | null | undefined; day: string }): string | null {
  const e = readWf(wfRaw).find((x) => x.w === isoWeek(o.day));
  if (!e || !e.a || !patternById(e.a)) return null;
  return typeof o.planAt === 'number' && o.planAt > e.t ? e.a : null;
}

/** Thema des Fokus-Musters (für den Weg ohne `slotPlan`: `focusTopic`). */
export const focusTopicOf = (pat: string | null): string | null => (pat ? (patternById(pat)?.topic ?? null) : null);

export type FocusOption = { id: 'confusion' | 'weak'; pat: string; /** Das Paar ist aus eigenen Fehlern belegt (`cf`), nicht nur ein Kontrastpaar des Kurses. */ confirmed: boolean; /** Gegenmuster (nur `confusion`). */ other: string | null; /** Kapitel (1–7, nur `weak`). */ chapter: number | null };

/**
 * Bis zu zwei Vorschläge: A = das häufigste Verwechslungspaar (sein erstes Muster), sonst das schwächste Muster des aktuellen Kapitels;
 * B = das schwächste noch nicht sichere Muster des aktuellen Kapitels (nicht dasselbe wie A). Nur Muster, die schon eingeführt sind.
 */
export function focusOptions(i: { grammar: ReadonlyMap<string, Doc>; today: string; confusion: Pick<Confusion, 'pairs'> | null; chosen?: number | null }): FocusOption[] {
  const infos = patInfos(i.grammar).filter((p) => !!p.entry && (p.entry.i !== undefined || (p.entry.n ?? 0) > 0));
  // Kapitel-Arbeit (K1): ein gewähltes Kapitel gilt vor der Ableitung.
  const cur = effectiveChapter(i.chosen, currentChapter(infos, i.today));
  const stateNo = (p: (typeof infos)[number]): number => patternStateNo(patternState(p.entry, i.today));
  const rate = (p: (typeof infos)[number]): number => {
    const n = p.entry?.n ?? 0;
    return n >= 3 ? 1 - (p.entry?.c ?? 0) / n : 0;
  };
  // Schwach = Lernt, mit den meisten falschen Antworten im Anteil; Gleichstand: zuletzt geübt zuerst, dann Kennung.
  const weak = infos
    .filter((p) => stateNo(p) <= 1)
    .sort((a, b) => Number(b.chapter === cur) - Number(a.chapter === cur) || rate(b) - rate(a) || (b.entry?.last ?? 0) - (a.entry?.last ?? 0) || a.id.localeCompare(b.id));
  const known = new Set(infos.map((p) => p.id));
  const out: FocusOption[] = [];
  const pair = i.confusion?.pairs[0];
  if (pair && known.has(pair.a)) out.push({ id: 'confusion', pat: pair.a, confirmed: pair.confirmed, other: pair.b, chapter: null });
  for (const p of weak) {
    if (out.length >= 2) break;
    if (out.some((o) => o.pat === p.id)) continue;
    out.push({ id: 'weak', pat: p.id, confirmed: false, other: null, chapter: p.chapter + 1 });
  }
  return out.slice(0, 2);
}

// ------------------------------------------------------------------ Einsatz-Satz

export type UseOfWeek = { situation: { de: string; en: string }; sentence: string };

/** Einsatz-Satz der Woche aus `program.json.use`: ein Satz je Kalenderwoche, im Wechsel. */
export function weeklyUse(chapterIndex: number, week: string): UseOfWeek | null {
  const ch = programChapters()[chapterIndex];
  const use = ch?.use;
  if (!use) return null;
  const n = Number(week.slice(-2));
  const sentence = use.ex[(Number.isFinite(n) ? n : 0) % use.ex.length];
  return sentence ? { situation: { de: use.de, en: use.en }, sentence } : null;
}

// ------------------------------------------------------------------ alles zusammen

export type Weekly3 = {
  /** `JJJJ-Www` der letzten abgeschlossenen Woche und ihre sieben Tage. */
  w: string;
  days: string[];
  big: Big | null;
  /** Alle neu Festen (Namen), die ersten 12 werden gezeigt. */
  fest: Array<{ id: string; label: string; unit: 'vocab' | 'chunk' }>;
  patternsSafe: string[];
  /** Fehlersätze, die in der Woche erledigt wurden (Zahl). */
  fixed: number;
  teacher: string;
  options: FocusOption[];
  use: UseOfWeek | null;
  chapter: { index: number; n: number } | null;
};

export const FEST_NAMES_MAX = 12;

/** Muster, die in der Woche geübt wurden (`pats[*].last` im Wochenfenster), nach Zahl der Antworten dieser Woche nicht bekannt, deshalb: zuletzt geübt zuerst. */
export function practicedPatterns(grammar: ReadonlyMap<string, Doc>, days: readonly string[]): string[] {
  const set = new Set(days);
  const hit: Array<{ id: string; last: number }> = [];
  for (const d of grammar.values()) {
    for (const [pat, e] of Object.entries(patsOf(d))) {
      const last = num(e.last);
      if (last > 0 && set.has(dayKey(last)) && patternById(pat)) hit.push({ id: pat, last });
    }
  }
  return hit.sort((a, b) => b.last - a.last || a.id.localeCompare(b.id)).map((h) => h.id);
}

/**
 * Name eines Musters für den Lehrer: „Form (Verwendung)“ aus den englischen Teilen des Namens („the · unique things“ → „the (unique things)“). Nur das Abschneiden
 * am ersten „ · “ gäbe gleiche oder sinnlose Namen („the versus the“).
 */
export const teacherName = (id: string): string => {
  const parts = (patternById(id)?.name.en ?? id)
    .split(' · ')
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) return parts[0] ?? id;
  return `${parts.slice(0, -1).join(' / ')} (${parts[parts.length - 1]})`;
};

export function weekly3(i: {
  today: string;
  nowMs: number;
  vocab: ReadonlyMap<string, Doc>;
  chunk: ReadonlyMap<string, Doc>;
  grammar: ReadonlyMap<string, Doc>;
  profile: Doc;
  confusion: Confusion | null;
  fixed: number;
  /** Kapitel-Arbeit (K1): gewähltes Kapitel (1 bis 7), sonst die Ableitung. */
  chosen?: number | null;
}): Weekly3 {
  const week = lastWeekOf(i.today);
  const fest = newFestWords({ days: week.days, vocab: i.vocab, chunk: i.chunk });
  const state = chapterState({ docs: i.grammar, today: i.today, nowMs: i.nowMs, chosen: i.chosen ?? null });
  const cur = state.current;
  const chapter = cur >= 0 ? (programChapters()[cur] ?? null) : null;
  const practiced = practicedPatterns(i.grammar, week.days);
  const pair = i.confusion?.pairs[0] ?? null;
  const worst = i.confusion?.pats.find((p) => p.w >= 3) ?? null;
  const tricky = pair
    ? { names: [teacherName(pair.a), teacherName(pair.b)], example: pair.ex[0] ?? null, confirmed: pair.confirmed }
    : worst
      ? { names: [teacherName(worst.pat)], example: null }
      : null;
  return {
    w: week.w,
    days: week.days,
    big: bigNumber(i.profile.history, week.days, fest.length),
    fest: fest.map((f) => ({ id: f.id, label: f.word, unit: f.unit })),
    patternsSafe: patternsNewSafe(i.grammar, week.days),
    fixed: i.fixed,
    teacher: teacherText({
      note: chapter?.note ?? null,
      practiced: practiced.slice(0, 3).map(teacherName),
      fest: fest.map((f) => f.word),
      tricky,
    }),
    options: focusOptions({ grammar: i.grammar, today: i.today, confusion: i.confusion, chosen: i.chosen ?? null }),
    use: chapter ? weeklyUse(cur, isoWeek(i.today)) : null,
    chapter: chapter ? { index: cur, n: chapter.n } : null,
  };
}
