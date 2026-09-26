import { askJson } from '../../ai/gate';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { learnerBrief, openGrammarErrors, stubbornWords } from '../../domain/companion/brief';
import { TOPICS } from '../../domain/content';
import { dayKey } from '../../domain/date';
import { mergedVocab } from '../../domain/overview';
import { defaultGrammarDoc, grammarErrorsOp, planApply, poolOp, type ApplyPlan, type ApplySel } from '../../domain/preply/apply';
import { lastImport, preplyList, readImport, type ImportView } from '../../domain/preply/docs';
import { heldOp, heldWithoutPlanDoc, HELD_MIN_MAX } from '../../domain/preply/held';
import { saveCardOp } from '../../domain/srs/newCard';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { readOnce } from '../../data/snapshot';
import { preplyImport, type ImportOut } from '../../prompts/preplyImport';
import { preplyPrep, type PrepCtx, type PrepOut } from '../../prompts/preplyPrep';
import { workContext } from '../../prompts/work';
import { flush, learnRecorder, recordRoundEnd } from '../progress/persist';
import { usePreply } from './store';

// Schreibwege der Preply-Brücke (Phase 5 §5.1), nur über den einen Writer. Jede KI-Anfrage geht
// auf eine ausdrückliche Handlung zurück („Plan erstellen", „Analysieren"). Geschrieben wird:
// - der Plan sofort nach Erfolg (`pp<ms>`), der Import VOR jeder Übernahme (`pi<ms>`, applied:false),
// - die Übernahme erst nach Bestätigung, je Ziel genau ein Schreibvorgang, idempotent (E5-13),
// - „Stunde gehalten" einmal; das Profil nur, wenn der Plan gerade erst gehalten wurde (E5-17).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

function vocabIds(): Set<string> {
  const s = useLive.getState();
  return new Set(mergedVocab(s.collections.vocab ?? new Map<string, Doc>(), invalidIdsOf(s.invalid, 'vocab')).keys());
}

export const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

function learner(uiLang: 'de' | 'en'): string {
  const s = useLive.getState();
  return learnerBrief({ assess: s.docs['app/assess'] ?? null, grammar: s.collections.grammar, vocab: s.collections.vocab, uiLang, pflichtDone: null });
}

/**
 * Bausteine der Stundenvorbereitung aus dem Bestand: echte eigene Fehler (offene Grammatikfehler,
 * dann die neuesten Radar-Einträge) und hartnäckige Wörter. Nur daraus darf `watch` entstehen.
 */
export function prepMaterial(radar: Doc | null): { errors: Array<{ wrong: string; right: string; topic: string }>; words: string[] } {
  const s = useLive.getState();
  const out = openGrammarErrors(s.collections.grammar, 6);
  const seen = new Set(out.map((e) => e.wrong.toLowerCase()));
  // Neueste zuerst (das Radar ist nach Zeit aufsteigend gespeichert, phase2-plan §4.6).
  const tOf = (e: Doc): number => (typeof e.t === 'number' ? e.t : 0);
  const events = (Array.isArray(radar?.events) ? radar.events.map(obj) : []).sort((a, b) => tOf(b) - tOf(a));
  for (const e of events) {
    if (out.length >= 8) break;
    const wrong = typeof e.g === 'string' ? e.g.trim() : '';
    const right = typeof e.a === 'string' ? e.a.trim() : '';
    if (!wrong || !right || wrong === right || seen.has(wrong.toLowerCase())) continue;
    seen.add(wrong.toLowerCase());
    out.push({ wrong, right, topic: typeof e.c === 'string' ? e.c : 'other' });
  }
  return { errors: out.slice(0, 8), words: stubbornWords(s.collections.vocab, 10) };
}

/** `app/radar` einmal lesen (nur auf die Handlung „Plan erstellen", kein Abo). */
async function readRadar(): Promise<Doc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await readOnce('app/radar', () => db.doc('app/radar').get());
    return snap.exists ? (snap.data() ?? null) : null;
  } catch (err) {
    logWarn('preply:radar', err);
    return null;
  }
}

// ------------------------------------------------------------------ Stunde vorbereiten

export async function createPlan(o: { ctx: PrepCtx; minutes: 25 | 50 | 60; signal: AbortSignal; onPhase?: Parameters<typeof askJson>[0]['onPhase']; refresh?: boolean }): Promise<string> {
  const uiLang = useSettings.getState().lang;
  const mat = prepMaterial(await readRadar());
  const imp = lastImport(preplyList(usePreply.getState().docs));
  const profile = useLive.getState().docs['app/profile'];
  const r = await askJson({
    template: preplyPrep,
    vars: {
      uiLang,
      minutes: o.minutes,
      ctx: o.ctx,
      learner: learner(uiLang),
      errors: mat.errors,
      words: mat.words,
      lastImport: imp ? { title: imp.title, homework: imp.homework } : null,
      work: workContext(profile?.ctx),
    },
    signal: o.signal,
    ...(o.onPhase ? { onPhase: o.onPhase } : {}),
  });
  return savePlan(r.data, { ctx: o.ctx, minutes: o.minutes, uiLang });
}

export async function savePlan(out: PrepOut, meta: { ctx: PrepCtx; minutes: number; uiLang: string }): Promise<string> {
  const writer = getWriter();
  const ms = Date.now();
  const ctx: Doc = { kind: meta.ctx.kind };
  if (meta.ctx.title) ctx.title = meta.ctx.title;
  if (meta.ctx.topic) ctx.topic = meta.ctx.topic;
  const doc: Doc = { t: ms, lang: meta.uiLang, pv: `${preplyPrep.id}@${preplyPrep.version}`, ctx, minutes: meta.minutes, ...out, done: false, doneT: 0 };
  const id = `pp${ms}`;
  if (!writer) throw new Error('db unavailable');
  let r = await writer.createIfMissing(`preply/${id}`, doc);
  if (r === 'exists') {
    r = await writer.createIfMissing(`preply/pp${ms + 1}`, { ...doc, t: ms + 1 });
    if (r === 'exists') throw new Error('plan id taken');
    return `pp${ms + 1}`;
  }
  return id;
}

// ------------------------------------------------------------------ Stunde gehalten

export type HeldResult = 'ok' | 'already' | 'failed' | 'profile_failed';

/**
 * Profil-Zähler nach „gehalten" (`act[tag].preply + 1`, Minuten 1–120, keine XP und keine Serie)
 * über die EINE Sammel-Warteschlange (phase2-plan D5). Ein gescheiterter Stapel behält dort seine
 * Folgenummer und wird beim nächsten Speichern zuerst gesendet – nie doppelt.
 */
function writeActivity(a: { day: string; minutes: number }): Promise<boolean> {
  const min = Math.min(HELD_MIN_MAX, Math.max(1, Math.round(a.minutes)));
  return recordRoundEnd({ day: a.day, act: 'preply', partial: false, n: 1, right: 1, activeMs: min * 60_000 });
}

export async function markHeld(ppId: string | null, h: { day: string; minutes: number }): Promise<HeldResult> {
  const writer = getWriter();
  if (!writer) return 'failed';
  const now = Date.now();
  try {
    let fresh = false;
    if (ppId) {
      const r = await writer.transform(`preply/${ppId}`, (cur) => heldOp(cur, { ...h, now }));
      fresh = r === 'updated';
    } else {
      const lang = useSettings.getState().lang;
      const title = lang === 'de' ? 'Preply-Stunde' : 'Preply lesson';
      const r = await writer.createIfMissing(`preply/pp${now}`, heldWithoutPlanDoc({ ...h, now, lang, title }));
      fresh = r === 'created';
    }
    if (!fresh) return 'already';
  } catch (err) {
    logError('preply:held', err, ppId ?? 'new');
    return 'failed';
  }
  return (await writeActivity(h)) ? 'ok' : 'profile_failed';
}

/** „Erneut speichern" für den Profil-Zähler (derselbe Stapel mit derselben Folgenummer). */
export function retryActivity(): Promise<boolean> {
  return flush();
}

// ------------------------------------------------------------------ Lehrer-Import

export async function analyzeImport(o: { raw: string; signal: AbortSignal; onPhase?: Parameters<typeof askJson>[0]['onPhase'] }): Promise<ImportView> {
  const uiLang = useSettings.getState().lang;
  const r = await askJson({
    template: preplyImport,
    vars: { uiLang, raw: o.raw, topics: TOPICS.map((t) => ({ id: t.id, name: t.name_en ?? t.name })), today: dayKey(Date.now()) },
    signal: o.signal,
    ...(o.onPhase ? { onPhase: o.onPhase } : {}),
  });
  return saveImport(r.data, o.raw, uiLang);
}

export async function saveImport(out: ImportOut, raw: string, uiLang: string): Promise<ImportView> {
  const writer = getWriter();
  if (!writer) throw new Error('db unavailable');
  const ms = Date.now();
  const doc: Doc = {
    kind: 'import',
    t: ms,
    lang: uiLang,
    pv: `${preplyImport.id}@${preplyImport.version}`,
    raw: raw.slice(0, 12_000),
    title: out.title,
    summary: out.summary,
    corrections: out.corrections,
    // Altformat: `tasks` bleibt eine Liste lesbarer Aufgaben (E5-16); die Übungen stehen in `items`.
    tasks: out.tasks.map((t) => t.prompt),
    items: out.tasks.map((t) => ({ ...t, hint_de: '' })),
    words: out.words,
    homework: out.homework,
    applied: false,
    appliedT: 0,
  };
  let id = `pi${ms}`;
  let r = await writer.createIfMissing(`preply/${id}`, doc);
  if (r === 'exists') {
    id = `pi${ms + 1}`;
    r = await writer.createIfMissing(`preply/${id}`, { ...doc, t: ms + 1 });
    if (r === 'exists') throw new Error('import id taken');
  }
  return readImport(id, { ...doc, t: id === `pi${ms}` ? ms : ms + 1 });
}

export type ApplyTarget = 'vocab' | 'grammar' | 'radar' | 'pool' | 'import';
export type ApplyRes = { c: number; t: number; w: number; skipped: number; poolFull: number; replaced: number };
export type ApplyOutcome = { ok: boolean; failed: ApplyTarget[]; res: ApplyRes; plan: ApplyPlan };

/** Plan der Übernahme aus Import und Auswahl (rein, mit dem aktuellen Bestand). */
export function applyPlanFor(pi: ImportView, sel: ApplySel): ApplyPlan {
  return planApply(pi, sel, { now: Date.now(), today: dayKey(Date.now()), vocabIds: vocabIds(), topicIds: TOPIC_IDS });
}

/**
 * Übernahme ausführen: vocab → grammar → radar → pool → pi. Jeder Schritt ist idempotent (feste
 * Kennungen), deshalb darf „Erneut übernehmen" denselben Plan noch einmal ganz ausführen.
 */
export async function runApply(pi: ImportView, sel: ApplySel, plan: ApplyPlan): Promise<ApplyOutcome> {
  const writer = getWriter();
  const res: ApplyRes = { c: 0, t: 0, w: 0, skipped: plan.skipped.length, poolFull: 0, replaced: 0 };
  const failed = new Set<ApplyTarget>();
  if (!writer) return { ok: false, failed: ['import'], res, plan };
  const now = Date.now();
  const today = dayKey(now);

  for (const v of plan.vocab) {
    try {
      await writer.transform(v.path, (cur) => saveCardOp(cur, v.made));
      res.w += 1;
    } catch (err) {
      logError('preply:apply', err, v.path);
      failed.add('vocab');
    }
  }
  for (const g of plan.grammar) {
    try {
      let added = 0;
      await writer.transform(g.path, (cur) => {
        const r = grammarErrorsOp(cur, g.add, defaultGrammarDoc(g.topic, today));
        added = r.added || (cur ? countPresent(cur, g.add) : 0);
        res.replaced += r.replaced;
        return r.op;
      });
      res.c += added;
    } catch (err) {
      logError('preply:apply', err, g.path);
      failed.add('grammar');
    }
  }
  if (plan.radar.length) {
    // Fehler-Radar über die EINE Sammel-Warteschlange (phase2-plan D5); doppelte (t|c|q) fallen dort weg.
    learnRecorder.radar(plan.radar);
    if (await flush()) {
      // Korrekturen ohne eigenes Grammatikthema zählen über das Radar.
      const inGrammar = plan.grammar.reduce((n, g) => n + g.add.length, 0);
      res.c += Math.max(0, plan.radar.length - inGrammar);
    } else {
      logWarn('preply:apply', { code: 'radar_pending', message: 'Radar nicht gespeichert – bleibt in der Warteschlange' }, 'app/radar');
      failed.add('radar');
    }
  }
  if (plan.pool.length) {
    try {
      await writer.transform('app/pool', (cur) => {
        const r = poolOp(cur, plan.pool, now);
        const present = cur ? countPoolPresent(cur, plan.pool) : 0;
        res.t = r.added + present;
        res.poolFull = r.refused;
        return r.op;
      });
    } catch (err) {
      logError('preply:apply', err, 'app/pool');
      failed.add('pool');
    }
  }
  if (failed.size) return { ok: false, failed: [...failed], res, plan };
  try {
    await writer.transform(`preply/${pi.id}`, (cur) => {
      if (!cur || cur.applied === true) return null;
      return { update: { applied: true, appliedT: now, sel, res } };
    });
  } catch (err) {
    logError('preply:apply', err, `preply/${pi.id}`);
    return { ok: false, failed: ['import'], res, plan };
  }
  return { ok: true, failed: [], res, plan };
}

/** Bei einem Neuversuch schon vorhandene Fehler als übernommen zählen. */
function countPresent(cur: Doc, add: readonly { t: number }[]): number {
  const ts = new Set((Array.isArray(cur.errors) ? cur.errors : []).map((e) => obj(e).t));
  return add.filter((a) => ts.has(a.t)).length;
}

function countPoolPresent(cur: Doc, add: readonly { id: string }[]): number {
  const ids = new Set((Array.isArray(cur.items) ? cur.items : []).map((e) => obj(e).id));
  return add.filter((a) => ids.has(a.id)).length;
}

/** Hausaufgabe abhaken (Zustand, kein Rückgängig): `hwDone[i] = Lerntag`, nur ergänzen. */
export async function markHomework(piId: string, i: number): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(`preply/${piId}`, (cur) => {
      if (!cur) return null;
      const done = obj(cur.hwDone);
      if (typeof done[String(i)] === 'string') return null;
      return { update: { hwDone: { [String(i)]: dayKey(Date.now()) } } };
    });
    return true;
  } catch (err) {
    logError('preply:homework', err, piId);
    return false;
  }
}
