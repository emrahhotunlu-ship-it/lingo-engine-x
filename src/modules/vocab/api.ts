import { dayKey } from './shared';
import type { Writer } from './shared';
import { lexOf } from './data/lex';
import { headwordOf } from './domain/dupes';
import { groupOf } from './domain/ladder';
import type { SessionKind } from './domain/session';
import type { DayPlan } from './domain/day';
import { DEFAULT_CFG, type Lex, type VocabCfg } from './domain/types';
import { vcfgSchema } from './data/schemas';
export type { RoundReport } from './domain/session';
export type { VocabAi } from './aiPort';

// Wörter-Modul, Tür nach außen (plan.md §2.2). Andere Bereiche nutzen NUR diese Funktionen; sie planen nie selbst.
// V1: unsichtbar, hinter dem Schalter `app/profile.vcfg.mod` (Standard 0 = aus). Der alte Wörter-Bereich bleibt bis V5 aktiv und ist der Rückweg.
// Statisch nur leichte Teile (Erlaubnisliste in tests/unit/vocab/isolation.test.ts). Schwere Teile (Planer, Runde, Umrechnung) kommen per dynamischem Import, damit `todayBlock` keinen Planer-Code in die Einstiegsdatei zieht.

type Doc = Record<string, unknown>;

/** Einstellungen aus `app/profile` (vcfg + newPerDay), tolerant: Ungültiges fällt auf den Standard zurück. */
export function vocabCfg(profile: Doc | null | undefined): VocabCfg {
  const raw = profile && typeof profile.vcfg === 'object' ? vcfgSchema.safeParse(profile.vcfg) : null;
  const npd = profile && typeof profile.newPerDay === 'number' && [0, 2, 5, 10].includes(profile.newPerDay) ? profile.newPerDay : DEFAULT_CFG.newPerDay;
  if (!raw?.success) return { ...DEFAULT_CFG, newPerDay: npd };
  return { min: raw.data.min, ret: raw.data.ret, mod: raw.data.mod, newPerDay: npd, restDow: raw.data.rd ?? null, anki: raw.data.anki === 1, pre: raw.data.pre !== 0, ...(raw.data.w ? { w: raw.data.w } : {}) };
}

/** Ist das neue Modul eingeschaltet? (Rückweg-Schalter in der Datenbank, gilt auf allen Geräten.) */
export function vocabModuleOn(profile: Doc | null | undefined): boolean {
  return vocabCfg(profile).mod === 1;
}

export type TodayBlock = { min: number; due: number; fresh: number; why: string; done: boolean };

/**
 * Wörter-Block für Heute aus dem eingefrorenen `vmod/day` (kein Planer-Code). `doneOf(path)` sagt, ob ein Eintrag heute erledigt ist.
 * `null`, wenn es für heute noch keinen Plan gibt.
 */
export function todayBlock(dayDoc: Doc | null | undefined, nowMs: number, doneOf: (path: string, track: string) => boolean): TodayBlock | null {
  if (!dayDoc || dayDoc.d !== dayKey(nowMs) || !Array.isArray(dayDoc.plan)) return null;
  const plan = dayDoc.plan as [string, string, string][];
  const open = plan.filter(([p, tr]) => !doneOf(p, tr));
  const total = Math.max(1, plan.length);
  const min = typeof dayDoc.min === 'number' ? Math.round((dayDoc.min * open.length) / total) : 0;
  return { min, due: plan.filter((e) => e[1] !== 'n').length, fresh: plan.filter((e) => e[1] === 'n').length, why: typeof dayDoc.why === 'string' ? dayDoc.why : '', done: open.length === 0 };
}

/** Stand eines Lexems (nur lesen): Stufe, Gruppe und beide Termine. */
export function lexemeState(doc: Doc | null | undefined): { lv: number; group: 'recognize' | 'onway' | 'produce'; u: number | null; b: number | null; isNew: boolean } | null {
  const lex = lexOf(doc);
  if (!lex) return null;
  return { lv: lex.lv, group: groupOf(lex.lv), u: lex.intro ? lex.u.due : null, b: lex.b?.due ?? null, isNew: lex.intro === null };
}

export type LexemeRef = { path: string; head: string };

/** Lexem zu einem Wort oder einer Wendung (Stichwort-Vergleich; Doppel führen zum führenden Lexem). */
export function findLexeme(text: string, docs: Iterable<readonly [string, Doc]>): LexemeRef | null {
  const want = headwordOf(text);
  if (!want) return null;
  for (const [path, doc] of docs) {
    if (!/^(vocab|chunk)\//.test(path)) continue;
    const head = path.startsWith('chunk/') ? doc.en : doc.word;
    if (typeof head !== 'string' || headwordOf(head) !== want) continue;
    const lex = lexOf(doc);
    return { path: lex?.of ?? path, head };
  }
  return null;
}

export type AddLexemeInput = { word: string; de: string; ex: string; pos?: string; src: string; kind?: 'vocab' | 'chunk'; core?: boolean; nowMs: number };
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Neues Lexem mit Ursprungssatz (Pflicht, Kap. 15). Legt das Dokument nur an, wenn es fehlt (nie überschreiben); die Einführung plant das Modul.
 * Liefert den Pfad oder `null` (kein Satz, Wort fehlt im Satz nicht geprüft – das macht die Oberfläche in V3/V5).
 */
export async function addLexeme(writer: Writer, i: AddLexemeInput): Promise<string | null> {
  const word = i.word.trim();
  const ex = i.ex.trim();
  if (!word || !ex) return null;
  const kind = i.kind ?? 'vocab';
  const id = slug(word) || `w-${i.nowMs.toString(36)}`;
  const path = `${kind}/${id}`;
  const k: Lex['k'] = kind === 'chunk' ? 'ch' : word.includes(' ') ? 'col' : 'w';
  const { emptyLex } = await import('./domain/planner');
  const lex = emptyLex(k, i.core ? 'core' : 'edge', i.nowMs);
  const doc: Doc =
    kind === 'chunk'
      ? { id, en: word, de: i.de, src: i.src, created: i.nowMs, ex, lex }
      : { id, word, de: i.de, ex, pos: i.pos ?? '', src: i.src, added: dayKey(i.nowMs), order: i.nowMs, state: 'new', col: [], lex };
  const r = await writer.createIfMissing(path, doc);
  return r === 'created' || r === 'exists' ? path : null;
}

/** Arten der Runde (`startSession`): Pflicht, „Noch 5“, freies Üben, Abend-Check, Wochen-Check, „Dieses Wort üben“, Fehlwörter. */
export type { SessionKind };

/** Runde starten: lädt Planer und Runde nach (eigenes Stück im Build). */
export async function startSession(kind: SessionKind, o: { docs: Iterable<readonly [string, Doc]>; dayDoc: Doc | null; profile: Doc | null; nowMs: number; paths?: string[] }) {
  const [{ Catalog }, { SessionRun }] = await Promise.all([import('./domain/catalog'), import('./domain/session')]);
  const items = [];
  let i = 0;
  for (const [path, doc] of o.docs) {
    const lex = lexOf(doc);
    if (lex && doc.hidden !== true) items.push({ path, lex, order: typeof doc.order === 'number' ? doc.order : i++ });
  }
  const cat = new Catalog(items);
  const plan = o.dayDoc && o.dayDoc.d === dayKey(o.nowMs) ? (o.dayDoc as unknown as DayPlan) : null;
  return { cat, run: new SessionRun(kind, cat, plan, o.nowMs, { cfg: vocabCfg(o.profile), ...(o.paths ? { paths: o.paths } : {}) }) };
}

export type Evidence = { lexeme: string; kind: 'seen' | 'recalled' | 'used'; src: string; ok: boolean; typed: boolean; cued: boolean; text?: string; t: number };

/**
 * Die eine Meldefunktion für andere Bereiche (plan.md §2.2). Planwirkung nur, wenn: abgerufen oder benutzt, getippt, das Lexem war NICHT
 * sichtbar, an diesem Lerntag noch keine Planwirkung, Abrufwahrscheinlichkeit < 0,95. Dann richtig → Good, falsch → Again. Sonst nur ein Beleg
 * im Verlauf (N6). Liefert, ob der Plan verändert wurde.
 */
export async function reportEvidence(e: Evidence, o: { writer: Writer; device: string; docs: Iterable<readonly [string, Doc]>; profile: Doc | null }): Promise<boolean> {
  const [{ evidencePlans, FLAG }, { Catalog }, { writeAnswer, writeVlog }, { tuple }] = await Promise.all([import('./domain/planner'), import('./domain/catalog'), import('./data/store'), import('./domain/vlog')]);
  const items = [];
  let i = 0;
  for (const [path, doc] of o.docs) {
    const lex = lexOf(doc);
    if (lex) items.push({ path, lex, order: i++ });
  }
  const cat = new Catalog(items);
  const lex = cat.get(e.lexeme)?.lex ?? null;
  const deps = { writer: o.writer, device: o.device };
  const answer = { t: e.t, form: 'gap' as const, outcome: e.ok ? ('ok' as const) : ('wrong' as const), hint: 0, ms: 0, fk: 0, sentence: null, flags: FLAG.ext };
  if (lex && evidencePlans(lex, e)) {
    const r = await writeAnswer(deps, e.lexeme, answer, { cfg: vocabCfg(o.profile), cat, med: {}, planned: true });
    return !!r && r.booked.length > 0;
  }
  if (lex) await writeVlog(deps, [tuple({ t: e.t, path: e.lexeme, track: 0, form: e.typed ? 'gap' : 'choice', note: 0, outcome: e.ok ? 'ok' : 'wrong', ms: 0, fk: 0, hint: 0, sentence: null, lv: lex.lv, flags: FLAG.ext })], o.device);
  return false;
}

/**
 * Heute legt einen neuen Tagesplan an: Wörter-Tagesplan gleich mit einfrieren und seine Minuten liefern (Befund ux 4b Nr. 1), damit Block 1
 * dieselbe Zahl nennt wie der Start der Runde. Nachgeladen wie die Bildschirme. `null` = nicht möglich, dann gilt die gewählte Wörter-Zeit.
 */
export async function prepareDay(aiReady?: () => boolean): Promise<number | null> {
  const { prepareDay: run } = await import('./ui/LearnScreen');
  return run(aiReady);
}

/** V3: Bildschirme der neuen Lernrunde, nur nachgeladen (nie statisch, Ladezeit-Test). Der Bereich Wörter hängt sie hinter `vcfg.mod = 1` ein. */
export function loadScreens() {
  return import('./ui/LearnScreen');
}

/** Wort-Seite (Großpaket A S6): eigene Teil-Datei, erst beim Öffnen geladen. */
export function loadWordPage() {
  return import('./ui/WordPage');
}

/** Übersicht und Einstellungen Wörter (Großpaket A S6): eigene Teil-Datei, erst beim Öffnen geladen. */
export function loadOverview() {
  return import('./ui/Overview');
}

/** Einstufungstest (Großpaket A S7c): eigene Teil-Datei, erst beim Öffnen geladen. */
export function loadPlace() {
  return import('./ui/PlaceScreen');
}
