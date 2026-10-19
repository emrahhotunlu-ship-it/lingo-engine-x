import { dayKey } from '../date';
import { patternOf } from '../grammar/patterns';
import type { GrammarTask, GrammarTaskType } from '../learn/types';
import { DONT_KNOW } from '../progress/logPatch';
import { diagnoseAnswer } from './diagnose';
import { l1ById } from './l1';
import type { HypState, RefId } from './tutorTypes';

// Fehlerannahmen (Tutor-Engine v3 §3.3). Rein, abgeleitet, deterministisch; nichts davon wird gespeichert.
//
//   Beleg     getippte Antwort (keine Auswahl, kein Bedeutungspaar), Urteil „falsch“, Ursache confuse | prep | colloc mit Gegenmuster `vs`.
//             Quellen: Log-Felder `v`/`h`/`vs` (sobald geschrieben), sonst die Diagnose der gespeicherten Antwort – aber nur eine sichere
//             (`known`: Übertragungstabelle, Begründungsregel, Signalwort), damit kein heute „unsicher“ bewerteter Satz eine Annahme nährt;
//             dazu `grammar/<thema>.errors[]` mit `vs`/`cf`, deren Zeitpunkt nicht schon im Log steht.
//             Eine Antwort mit Hilfe wäre ein halber Beleg; das Log speichert die Hilfe (noch) nicht, deshalb wiegt jeder Beleg 1.
//   open      ≥ 3 Belege derselben Richtung A→B an ≥ 2 Tagen innerhalb von 28 Tagen (bis zum letzten Beleg).
//   quiet     14 Tage ohne neuen Beleg („keine neuen Belege“, nicht „gelernt“).
//   resolved  28 Tage ohne Beleg und richtiger freier Gebrauch des Musters an ≥ 2 Tagen nach dem letzten Beleg.
//   confirmed/refuted gibt es erst mit den Prüfaufgaben (S5); sie entstehen hier nie.

export type Hypothesis = {
  id: string;
  from: RefId;
  to: RefId;
  l1: string | null;
  n: number;
  days: number;
  lastT: number;
  state: HypState;
  ev: readonly string[];
};

export type Evidence = { id: string; from: string; to: string; t: number; day: string; w: number; l1: string | null };

export const HYP_MIN_N = 3;
export const HYP_MIN_DAYS = 2;
export const HYP_SPAN_DAYS = 28;
export const QUIET_DAYS = 14;
export const RESOLVED_DAYS = 28;
export const RESOLVED_FREE_DAYS = 2;
export const EV_MAX = 5;

const DAY_MS = 86_400_000;
type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const HYP_CAUSES = new Set(['confuse', 'prep', 'colloc']);
const TYPED: ReadonlySet<string> = new Set(['gap', 'transform', 'correct', 'kwt']);
const bare = (id: string): string => (id.includes(':') && !id.startsWith('use:') ? id.slice(id.indexOf(':') + 1) : id);

/** Rekonstruierte Aufgabe aus einem Log- oder Fehlereintrag (nur was die Diagnose braucht). */
function taskOf(e: Doc): GrammarTask | null {
  const type = str(e.type) as GrammarTaskType;
  if (!TYPED.has(type)) return null;
  const prompt = str(e.q);
  const answer = str(e.ans);
  if (!prompt || !answer) return null;
  const pat = str(e.pat);
  return { key: '', topic: str(e.topic), type, prompt, answer, accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null, ...(pat ? { pat } : {}) };
}

/** Beleg aus einem getippten, falschen Eintrag (Log oder Fehlersatz) oder `null`. */
export function evidenceFrom(e: Doc, idPrefix: string): Evidence | null {
  const t = num(e.t);
  if (!t || e.ai === true) return null;
  const type = str(e.type);
  if (type && !TYPED.has(type)) return null;
  // Neue Log-Felder (S1): Urteil `v`, Ursache `h`, Gegenmuster `vs`.
  const vs = str(e.vs);
  if (str(e.v)) {
    if (str(e.v) !== 'w' || !vs) return null;
    if (str(e.h) && !HYP_CAUSES.has(str(e.h))) return null;
    const from = str(e.pat) || (taskOf(e) ? (patternOf(taskOf(e) as GrammarTask)?.id ?? '') : '');
    return from && from !== vs ? { id: `${idPrefix}:${t}`, from: bare(from), to: bare(vs), t, day: dayKey(t), w: 1, l1: str(e.l1) || null } : null;
  }
  if (e.ok === true) return null;
  const task = taskOf(e);
  const given = str(e.given);
  if (!task || !given.trim() || given === DONT_KNOW) return null;
  // Fehlersatz mit Kontrastmuster aus „Erklär mir meine Antwort“ (`cf`).
  const cf = str(e.cf);
  const own = task.pat || patternOf(task)?.id || '';
  if (cf && own && bare(cf) !== bare(own)) return { id: `${idPrefix}:${t}`, from: bare(own), to: bare(cf), t, day: dayKey(t), w: 1, l1: null };
  const dx = diagnoseAnswer(task, given, null);
  if (!dx.known || !dx.vs || !HYP_CAUSES.has(dx.cause)) return null;
  const entry = dx.l1 ? l1ById(dx.l1) : null;
  const from = own || entry?.pat || entry?.use || '';
  if (!from || bare(from) === bare(dx.vs)) return null;
  return { id: `${idPrefix}:${t}`, from: bare(from), to: bare(dx.vs), t, day: dayKey(t), w: 1, l1: dx.l1 };
}

// Zwischenspeicher je Log-Dokument (Pfad + Signatur): die Diagnose ist der teure Teil. Die Signatur deckt Zahl, Zeitpunkte, Ergebnis,
// Übersteuerung und Antwort aller Einträge ab (ein nachträglich geänderter Eintrag, z. B. „Ich hatte recht“, fällt so auch auf), billig im Vergleich zur Diagnose.
const LOG_CACHE = new Map<string, { sig: string; ev: Evidence[] }>();
const CACHE_MAX = 400;
/** Signatur eines Protokolls oder einer Fehlerliste (FNV-1a über t, ok, override, void, Urteil, Gegenmuster, Antwort und Muster jedes Eintrags). */
export function logSig(entries: readonly Doc[]): string {
  let h = 0x811c9dc5;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  };
  for (const e of entries) mix(`${num(e.t)}|${e.ok === true ? 1 : 0}|${e.override === true ? 1 : 0}|${e.void ? 1 : 0}|${str(e.v)}|${str(e.vs)}|${str(e.cf)}|${str(e.given)}|${str(e.pat)};`);
  return `${entries.length}:${(h >>> 0).toString(36)}`;
}
const sigOf = logSig;

/** Belege eines Tagesprotokolls (`log/<tag>`), zwischengespeichert. */
export function logEvidence(path: string, doc: Doc | undefined, knownSig?: string): Evidence[] {
  const entries = arr(doc?.entries);
  const sig = knownSig ?? sigOf(entries);
  const hit = LOG_CACHE.get(path);
  if (hit && hit.sig === sig) return hit.ev;
  const ev: Evidence[] = [];
  for (const e of entries) {
    if (str(e.k) !== 'g') continue;
    const x = evidenceFrom(e, 'log');
    if (x) ev.push(x);
  }
  if (LOG_CACHE.size >= CACHE_MAX) LOG_CACHE.delete(LOG_CACHE.keys().next().value as string);
  LOG_CACHE.set(path, { sig, ev });
  return ev;
}

/** Belege aus `grammar/<thema>.errors[]` (nur mit `vs`/`cf` oder sicherer Diagnose), ohne Zeitpunkte, die schon im Log stehen. */
export function errorEvidence(topic: string, doc: Doc | undefined, seenT: ReadonlySet<number>): Evidence[] {
  const out: Evidence[] = [];
  for (const e of arr(doc?.errors)) {
    if (seenT.has(num(e.t)) || e.void) continue;
    const x = evidenceFrom({ type: 'gap', ...e, topic, ok: false }, 'err');
    if (x) out.push(x);
  }
  return out;
}

/**
 * Annahmen aus Belegen. `freeDaysAfter(muster, t)` liefert die Zahl der Tage mit richtigem freiem Gebrauch des Musters nach `t`.
 * Ergebnis sortiert: offen vor still vor erledigt, dann nach Belegzahl, dann nach Kennung.
 */
export function hypothesesOf(evidence: readonly Evidence[], nowMs: number, freeDaysAfter: (id: string, t: number) => number): Hypothesis[] {
  const groups = new Map<string, Evidence[]>();
  for (const e of evidence) {
    if (e.t > nowMs) continue;
    const k = `${e.from}>${e.to}`;
    const g = groups.get(k);
    if (g) g.push(e);
    else groups.set(k, [e]);
  }
  const out: Hypothesis[] = [];
  for (const [k, all] of groups) {
    const list = [...all].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
    const last = list[list.length - 1] as Evidence;
    const recent = list.filter((e) => e.t >= last.t - HYP_SPAN_DAYS * DAY_MS);
    const n = recent.reduce((s, e) => s + e.w, 0);
    const days = new Set(recent.map((e) => e.day)).size;
    if (n < HYP_MIN_N || days < HYP_MIN_DAYS) continue;
    const since = (nowMs - last.t) / DAY_MS;
    let state: HypState = 'open';
    if (since >= RESOLVED_DAYS && freeDaysAfter(last.from, last.t) >= RESOLVED_FREE_DAYS) state = 'resolved';
    else if (since >= QUIET_DAYS) state = 'quiet';
    const l1s = recent.map((e) => e.l1).filter((x): x is string => !!x);
    const l1 = l1s.length ? ([...new Set(l1s)].sort((a, b) => l1s.filter((x) => x === b).length - l1s.filter((x) => x === a).length || a.localeCompare(b))[0] ?? null) : null;
    out.push({
      id: `h:${k}`,
      from: last.from,
      to: last.to,
      l1,
      n,
      days,
      lastT: last.t,
      state,
      ev: recent
        .slice(-EV_MAX)
        .map((e) => e.id)
        .sort(),
    });
  }
  const rank: Record<HypState, number> = { open: 0, confirmed: 0, quiet: 1, refuted: 2, resolved: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || b.n - a.n || a.id.localeCompare(b.id));
}
