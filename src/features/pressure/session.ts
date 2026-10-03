import { create } from 'zustand';
import { selectAiAvailable } from '../../ai/scope';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import type { UnitTaskResult } from '../../app/unit/types';
import { buyTime, hotSeat, objections } from '../../content/nb/load';
import type { Objection } from '../../content/nb/schemas';
import { outId, outRef } from '../../domain/nbdrill/outDoc';
import { pickRotating, preferFirst } from '../../domain/nbdrill/pick';
import { bestAnswer, modelText, MOVES, movesScore, noMoves, PRESSURE_N, PRESSURE_TEXT_MAX, starterOf, structuredPart, type Move, type Moves, type PressureAnswer } from '../../domain/nbdrill/pressure';
import { attemptScore, roundLevel, type Level } from '../../domain/levels/levels';
import { currentLevel, nextLevel, recordLevel } from '../levels/store';
import type { MessageKey } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { useCapabilities } from '../../platform/capabilities';
import { pressureCheck, type PressureFix } from '../../prompts/nb/p7/pressureCheck';
import type { Fix } from '../../ui/feedback/types';
import { currentDay, logAnswers, nextRound, restoreSaved, saveOut, type UnitRun } from '../nbdrill/shared';

// Einwand-Training (Plan N103) mit Lernpfad (docs/lernpfad-plan.md, 03.10.2026): Stufe 1–2 ordnen bzw. wählen
// (ohne KI, sofort bewertet), Stufe 3–5 eigene Antwort; Bedenkzeit und Zeitziel nur auf Stufe 5, die Uhr gibt nie
// selbst ab. Die KI (`pressure-check@2`) prüft im Hintergrund, „Weiter“ wartet nie. Ohne KI (oder bei Fehler) hakt
// Emrah das Muster selbst ab – das zählt für die Stufe nur nach unten (keine Selbstbewertung für den Aufstieg).

export type PressurePhase = 'think' | 'answer' | 'review';
export type AiSlot = { phase: AiPhase | 'idle'; error: AiMessageKey | null; fixes: PressureFix[]; effect: string };

export type PressureSet = 'objection' | 'hotseat' | 'buytime';

/** Eine Druck-Aufgabe in gemeinsamer Form (Einwand, Heißer Stuhl, Zeit gewinnen). */
export type PressureItem = {
  id: string;
  set: PressureSet;
  line: string;
  de: string;
  /** Musterantwort bzw. erster passender Einstieg. */
  model: string;
  obj?: Objection;
  tip?: { de: string; en: string };
  starters?: string[];
  theme?: string;
};

/** Zeiten je Art (Lehrer I3, I9, I13): Zeit gewinnen ohne Bedenkzeit, nur der Einstieg. */
export const TIMES: Record<PressureSet, { think: number; answer: number }> = {
  objection: { think: 10_000, answer: 30_000 },
  hotseat: { think: 10_000, answer: 30_000 },
  buytime: { think: 0, answer: 20_000 },
};

export type PressureSession = {
  v: 1;
  /** Art der Serie (fehlt in alten Momentaufnahmen = Einwände). */
  set?: PressureSet;
  ids: string[];
  pos: number;
  phase: PressurePhase;
  draft: string;
  answers: PressureAnswer[];
  /** KI-Stand je Einwand (Anzeige; `fixes` fließen in das Ergebnis der Einheit). */
  ai: Record<string, AiSlot>;
  day: string;
  t0: number;
  lang: 'de' | 'en';
  unit: UnitRun | null;
  /** Beginn der aktuellen Antwortphase (ms). */
  answerAt: number;
  done: boolean;
  saved: boolean;
  /** Lernpfad (nur Einwände): Grundstufe der Runde und Stufe je Eintrag. Fehlt bei alten Momentaufnahmen (= 5). */
  lv?: Level;
  lvs?: Level[];
  /** Genutzte Hilfe beim aktuellen Eintrag (Satzanfänge auf Stufe 4). */
  hint?: 0 | 1 | 2;
  /** Stufe für die nächste Runde nach dieser (am Ende berechnet, nur Anzeige). */
  lvAfter?: Level;
  /** Stufen-Ergebnis dieser Runde gespeichert (einmal je Runde, ggf. nach den letzten KI-Prüfungen). */
  recorded?: boolean;
};

export const usePressure = create<{ s: PressureSession | null }>(() => ({ s: null }));
const put = (s: PressureSession) => usePressure.setState({ s });
const get = () => usePressure.getState().s;

let ctl: AbortController | null = null;

const itemCache = new Map<PressureSet, readonly PressureItem[]>();
export function pressureItems(set: PressureSet): readonly PressureItem[] {
  let list = itemCache.get(set);
  if (!list) {
    list =
      set === 'objection'
        ? objections().map((o) => ({ id: o.id, set, line: o.line, de: o.de, model: modelText(o), obj: o, tip: o.tip, theme: o.theme }))
        : set === 'hotseat'
          ? hotSeat().map((h) => ({ id: h.id, set, line: h.q, de: h.de, model: h.model, tip: h.tip, theme: h.theme }))
          : buyTime().map((g) => ({ id: g.id, set, line: g.q, de: g.de, model: g.starters[0] ?? '', starters: [...g.starters] }));
    itemCache.set(set, list);
  }
  return list;
}

export const setOf = (s: PressureSession): PressureSet => s.set ?? 'objection';
export const itemOf = (s: PressureSession, pos = s.pos): PressureItem | null => pressureItems(setOf(s)).find((o) => o.id === s.ids[pos]) ?? null;
export const objectionOf = (s: PressureSession, pos = s.pos): Objection | null => itemOf(s, pos)?.obj ?? null;
const firstPhase = (set: PressureSet): PressurePhase => (TIMES[set].think > 0 ? 'think' : 'answer');
/** Bedenkzeit nur auf Stufe 5 (Einwände) bzw. wie bisher (Heißer Stuhl, Zeit gewinnen). */
const phaseFor = (set: PressureSet, lv: Level | undefined): PressurePhase => (lv !== undefined && lv < 5 ? 'answer' : firstPhase(set));

/** Stufe des aktuellen Eintrags (Einwände); alte Momentaufnahmen und andere Arten: 5 (wie bisher). */
export const levelAt = (s: PressureSession, pos = s.pos): Level => s.lvs?.[pos] ?? s.lv ?? 5;

/**
 * Wert einer Antwort für die Stufen-Steuerung (0..1) oder `null`, wenn sie nicht gewertet ist (übersprungen, KI prüft
 * noch oder Fehler ohne Selbstcheck). Stufe 1–2: Anteil richtig; sonst Schritte/4 laut KI. Hilfe und Erleichterung
 * deckeln; ein Selbstcheck zählt höchstens 0,6 (nur für den Abstieg, A7 „keine Selbstbewertung“).
 */
export function answerScore(a: PressureAnswer | undefined): number | null {
  if (!a) return null;
  if (a.part !== undefined) return attemptScore(a.part, a.hint ?? 0);
  if (a.by === 'ai') return attemptScore(movesScore(a.moves) / 4, a.hint ?? 0);
  if (a.by === 'self') return Math.min(0.6, attemptScore(movesScore(a.moves) / 4, a.hint ?? 0));
  return null;
}

const scoresOf = (s: PressureSession, upto = s.ids.length): number[] =>
  s.ids.slice(0, upto).flatMap((id) => {
    const v = answerScore(s.answers.find((x) => x.id === id));
    return v === null ? [] : [v];
  });

/** Hilfe des aktuellen Eintrags: Satzanfänge (Stufe 4) oder leichter als die Grundstufe gelöst (Knopf/Runde) = Hilfe 1. */
const hintNow = (s: PressureSession, extra: 0 | 1 = 0): 0 | 1 | 2 => Math.max(s.hint ?? 0, extra, s.lv && levelAt(s) < s.lv ? 1 : 0) as 0 | 1 | 2;

export function startPressure(opts: { unit?: UnitRun | null; lang: 'de' | 'en'; n?: number; theme?: string | null; set?: PressureSet }): boolean {
  const set = opts.set ?? 'objection';
  const theme = opts.theme ?? opts.unit?.theme ?? null;
  const list = preferFirst(pressureItems(set), (o) => !!theme && o.theme === theme);
  // Mit Thema: zuerst dessen Einwände, der Rest reihum; ohne Thema reihum.
  const n = opts.n ?? PRESSURE_N;
  const own = theme ? list.filter((o) => o.theme === theme) : [];
  const rest = pickRotating(list.filter((o) => !own.includes(o)), n - Math.min(n, own.length), nextRound(`pressure-${set}`));
  const picked = [...own.slice(0, n), ...rest].slice(0, n);
  if (!picked.length) return false;
  ctl?.abort();
  ctl = null;
  const lv = set === 'objection' ? currentLevel('nb-objection') : undefined;
  const phase = phaseFor(set, lv);
  put({ v: 1, set, ids: picked.map((o) => o.id), pos: 0, phase, draft: '', answers: [], ai: {}, day: opts.unit?.day ?? currentDay(), t0: Date.now(), lang: opts.lang, unit: opts.unit ?? null, answerAt: phase === 'answer' ? Date.now() : 0, done: false, saved: false, ...(lv ? { lv, lvs: [lv], hint: 0 as const } : {}) });
  return true;
}

export function beginAnswer(): void {
  const s = get();
  if (!s || s.phase !== 'think') return;
  put({ ...s, phase: 'answer', answerAt: Date.now() });
}

export function setDraft(text: string): void {
  const s = get();
  if (!s || s.phase !== 'answer') return;
  put({ ...s, draft: text.slice(0, PRESSURE_TEXT_MAX) });
}

const aiOn = () => selectAiAvailable(useCapabilities.getState());

/** Antwort abschließen (Knopf). Die KI prüft im Hintergrund. */
export function submitAnswer(): void {
  finishAnswer(0);
}

/** Stufe 3: Satzanfänge waren vorgegeben. Voll gewertet nur, wenn alle vier Sätze eigenständig ergänzt sind. */
export function submitStarters(own: boolean): void {
  finishAnswer(own ? 0 : 1);
}

function finishAnswer(extra: 0 | 1): void {
  const s = get();
  const o = s ? itemOf(s) : null;
  if (!s || !o || s.phase !== 'answer') return;
  const text = s.draft.trim();
  const ms = s.answerAt ? Math.max(0, Date.now() - s.answerAt) : 0;
  // Die KI prüft nur das Einwand-Muster; Heißer Stuhl und Zeit gewinnen vergleichen mit dem Muster.
  const ai = aiOn() && !!text && !!o.obj;
  const ans: PressureAnswer = { id: o.id, text, ms, moves: null, by: null, ...(s.lv ? { lv: levelAt(s), hint: hintNow(s, extra) } : {}) };
  const next: PressureSession = {
    ...s,
    phase: 'review',
    answers: [...s.answers.filter((a) => a.id !== o.id), ans],
    ai: ai ? { ...s.ai, [o.id]: { phase: 'queued', error: null, fixes: [], effect: '' } } : s.ai,
  };
  put(next);
  if (ai && o.obj) void runCheck(o.obj, text, s.lang, false, s.lv ? levelAt(s) : undefined);
}

/** Stufe 1–2: Zuordnung prüfen (ohne KI, sofort). `picked[i]` = gewählter Schritt für Platz i, `texts[i]` der gewählte Satz. */
export function submitStructured(picked: readonly (Move | null)[], texts: readonly string[] = []): void {
  const s = get();
  const o = s ? itemOf(s) : null;
  if (!s || !o || s.phase !== 'answer') return;
  const part = structuredPart(picked);
  const ms = s.answerAt ? Math.max(0, Date.now() - s.answerAt) : 0;
  const ans: PressureAnswer = { id: o.id, text: '', ms, moves: null, by: null, lv: levelAt(s), part, hint: hintNow(s), pick: [...picked], pickText: [...texts] };
  put({ ...s, phase: 'review', answers: [...s.answers.filter((a) => a.id !== o.id), ans] });
}

/** Satzanfänge auf Stufe 4 einblenden (zählt als Hilfe). */
export function showHint(): void {
  const s = get();
  if (!s || s.phase !== 'answer') return;
  put({ ...s, hint: 1 });
}

/** Knopf „Leichter“: dieser Eintrag eine Stufe leichter (nur in dieser Runde, vor dem Prüfen). */
export function easierNow(): void {
  const s = get();
  if (!s?.lv || s.phase === 'review') return;
  const cur = levelAt(s);
  if (cur <= 1) return;
  const lvs = [...(s.lvs ?? [])];
  lvs[s.pos] = (cur - 1) as Level;
  put({ ...s, lvs, phase: 'answer', draft: '', hint: 0, answerAt: Date.now() });
}

function patchAi(id: string, slot: Partial<AiSlot>): void {
  const s = get();
  if (!s) return;
  const cur = s.ai[id] ?? { phase: 'idle', error: null, fixes: [], effect: '' };
  put({ ...s, ai: { ...s.ai, [id]: { ...cur, ...slot } } });
}

async function runCheck(o: Objection, text: string, lang: 'de' | 'en', refresh = false, level?: number): Promise<void> {
  ctl ??= new AbortController();
  // Stufe 3: Claude erfährt die vorgegebenen Satzanfänge, damit sie nicht als eigener Beleg zählen.
  const starters = level === 3 ? MOVES.map((k) => starterOf(o.model[k])) : undefined;
  try {
    const vars = { objection: o.line, answer: text, model: modelText(o), uiLang: lang, ...(level ? { level } : {}), ...(starters ? { starters } : {}) };
    const r = await askJson({ template: pressureCheck, vars, signal: ctl.signal, refresh, onPhase: (p) => patchAi(o.id, { phase: p }) });
    const d = r.data;
    const moves: Moves = { acknowledge: d.acknowledge, ask: d.ask, answer: d.answer, secure: d.secure };
    const s = get();
    if (!s) return;
    put({
      ...s,
      answers: s.answers.map((a) => (a.id === o.id && a.by !== 'self' ? { ...a, moves, better: d.better, by: 'ai' } : a.id === o.id ? { ...a, better: d.better } : a)),
      ai: { ...s.ai, [o.id]: { phase: 'done', error: null, fixes: d.fixes, effect: d.effect } },
    });
    settleLevels();
  } catch (err) {
    if (isAiFailure(err) && err.kind === 'cancelled') return;
    if (!isAiFailure(err)) logWarn('pressure:check', err, o.id);
    patchAi(o.id, { phase: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
    settleLevels();
  }
}

const BUSY: ReadonlySet<string> = new Set(['queued', 'thinking', 'streaming', 'slow']);

/**
 * Stufen-Ergebnis der Runde speichern – genau einmal, sobald die Runde fertig ist und keine KI-Prüfung mehr läuft
 * (`force`: beim Verlassen mit dem, was gewertet ist). Nicht gewertete Antworten zählen nicht.
 */
function settleLevels(force = false): void {
  const s = get();
  if (!s?.done || !s.lv || s.recorded) return;
  if (!force && Object.values(s.ai).some((a) => BUSY.has(a.phase))) return;
  const scores = scoresOf(s);
  put({ ...s, recorded: true, lvAfter: nextLevel('nb-objection', scores, s.day) });
  if (scores.length) void recordLevel('nb-objection', scores, s.day);
}

/** „Erneut versuchen“ nach einem KI-Fehler (nur auf Knopfdruck, A6.3). */
export function retryCheck(id: string): void {
  const s = get();
  const o = objections().find((x) => x.id === id);
  const a = s?.answers.find((x) => x.id === id);
  if (!s || !o || !a?.text) return;
  patchAi(id, { phase: 'queued', error: null });
  void runCheck(o, a.text, s.lang, true, a.lv);
}

/** Selbstcheck ohne KI: einen Schritt an- oder abhaken. */
export function toggleMove(id: string, move: Move): void {
  const s = get();
  if (!s) return;
  put({ ...s, answers: s.answers.map((a) => (a.id === id ? { ...a, moves: { ...(a.moves ?? noMoves()), [move]: !(a.moves ?? noMoves())[move] }, by: 'self' } : a)) });
}

/** Weiter zum nächsten Einwand; nach dem letzten Ende der Serie. */
export function nextObjection(): void {
  const s = get();
  const o = s ? itemOf(s) : null;
  if (!s || !o || s.done || s.phase !== 'review') return;
  const a = s.answers.find((x) => x.id === o.id);
  const set = setOf(s);
  logAnswers([
    { type: `nb-${set}`, ref: outRef({ id: outId(set, s.t0), d: s.day }), q: o.line, given: a?.text ?? '', ans: o.model, ok: answerOk(set, a), ms: a?.ms ?? 0, day: s.day, lang: s.lang, duty: !!s.unit, t: Date.now() },
  ]);
  if (s.pos + 1 >= s.ids.length) {
    const done: PressureSession = { ...s, done: true };
    put(done);
    void saveSeries(done);
    settleLevels();
    return;
  }
  // Nach zwei schwachen Antworten in Folge kommt der nächste Einwand eine Stufe leichter (nur in dieser Runde).
  const lvNext = s.lv ? roundLevel(s.lv, scoresOf(s, s.pos + 1)) : undefined;
  const phase = phaseFor(set, lvNext);
  put({ ...s, pos: s.pos + 1, phase, draft: '', answerAt: phase === 'answer' ? Date.now() : 0, ...(lvNext ? { lvs: [...(s.lvs ?? []), lvNext], hint: 0 as const } : {}) });
}

/** Fehlergrenze: Einwand ohne Bewertung überspringen. */
export function skipObjection(): void {
  const s = get();
  if (!s) return;
  if (s.pos + 1 >= s.ids.length) put({ ...s, done: true });
  else {
    const lvNext = s.lv;
    const phase = phaseFor(setOf(s), lvNext);
    put({ ...s, pos: s.pos + 1, phase, draft: '', answerAt: phase === 'answer' ? Date.now() : 0, ...(lvNext ? { lvs: [...(s.lvs ?? []), lvNext], hint: 0 as const } : {}) });
  }
}

export function markSaved(): void {
  const s = get();
  if (s) put({ ...s, saved: true });
}

export const pressureMs = (s: PressureSession): number => s.answers.reduce((n, a) => n + a.ms, 0);
/** Richtig: Einwand mit ≥ 3 Schritten des Musters; Heißer Stuhl und Zeit gewinnen: überhaupt geantwortet. */
export function answerOk(set: PressureSet, a: PressureAnswer | undefined): boolean {
  if (!a) return false;
  if (set !== 'objection') return a.text.trim().length > 0;
  return a.part !== undefined ? a.part >= 0.75 : movesScore(a.moves) >= 3;
}
export const pressureRight = (s: PressureSession): number => s.answers.filter((a) => answerOk(setOf(s), a)).length;
/** Beste Antwort; auf Stufe 1–2 (ohne eigenen Text) die beste Zuordnung – gemerkt wird dann die Musterantwort. */
export const bestOf = (s: PressureSession): PressureAnswer | null =>
  bestAnswer(s.answers) ?? [...s.answers].filter((a) => (a.part ?? 0) > 0).sort((a, b) => (b.part ?? 0) - (a.part ?? 0))[0] ?? null;

function saveSeries(s: PressureSession): Promise<boolean> {
  const text = s.answers.map((a) => `${a.id}: ${a.text || '–'}`).join('\n');
  const set = setOf(s);
  return saveOut({
    id: outId(set, s.t0),
    k: set,
    d: s.day,
    t: s.t0,
    ...(s.unit?.theme ? { theme: s.unit.theme } : {}),
    ok: pressureRight(s) * 2 >= Math.max(1, s.answers.length),
    text,
    fb: { moves: s.answers.map((a) => ({ id: a.id, n: movesScore(a.moves), by: a.by })) },
    ms: pressureMs(s),
  });
}

/** Ergebnis für Block 4/5: alle Antworten, bessere Fassung der besten, ≤ 3 KI-Korrekturen. */
export function pressureResult(s: PressureSession): UnitTaskResult {
  const best = bestOf(s);
  const o = best ? objections().find((x) => x.id === best.id) : null;
  const fixes: Fix[] = Object.values(s.ai)
    .flatMap((a) => a.fixes)
    .slice(0, 3)
    .map((f) => ({ kind: 'form', mine: f.mine, right: f.right, why: f.why }));
  const better = best?.better ?? (o ? modelText(o) : undefined);
  return {
    kind: 'task.objection',
    ref: outRef({ id: outId('objection', s.t0), d: s.day }),
    text: s.answers.map((a) => a.text).filter(Boolean).join('\n'),
    ...(better ? { better } : {}),
    fixes,
  };
}

export function endPressure(): void {
  settleLevels(true);
  ctl?.abort();
  ctl = null;
  usePressure.setState({ s: null });
}

// ------------------------------------------------------------------ Fortsetzen

function isSession(x: unknown): x is PressureSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<PressureSession>;
  return s.v === 1 && Array.isArray(s.ids) && typeof s.pos === 'number' && Array.isArray(s.answers) && typeof s.day === 'string' && (s.phase === 'think' || s.phase === 'answer' || s.phase === 'review');
}

const RESUME_KEY: Record<PressureSet, MessageKey> = { objection: 'nbTrainingResumeObjection', hotseat: 'nbTrainingResumeHotseat', buytime: 'nbTrainingResumeBuytime' };

export const pressureResume: Resumable<PressureSession> = {
  id: 'pressure',
  version: 1,
  origin: 'speak',
  snapshot: () => {
    const s = get();
    return s && !s.done ? s : null;
  },
  subscribe: (cb) => usePressure.subscribe(cb),
  restore: (s) => {
    if (!isSession(s)) return false;
    const known = new Set(pressureItems(s.set ?? 'objection').map((o) => o.id));
    if (!s.ids.every((id) => known.has(id)) || s.pos >= s.ids.length) return false;
    // Laufende KI-Prüfungen werden nicht nachgeholt: ohne Ergebnis gilt der Selbstcheck.
    const ai: Record<string, AiSlot> = {};
    for (const [k, v] of Object.entries(s.ai ?? {})) ai[k] = v.phase === 'done' ? v : { ...v, phase: 'error', error: 'aiFailed' };
    // Eine unterbrochene Antwortphase beginnt neu (Entwurf bleibt).
    put({ ...s, ai, answerAt: s.phase === 'answer' ? Date.now() : s.answerAt, done: false });
    return true;
  },
  route: (s) => ({ name: 'pressure', set: setOf(s) }),
  label: (s, t) => t(RESUME_KEY[setOf(s)], { n: s.pos + 1, total: s.ids.length }),
};

export function ensurePressure(route: RouteOf<'pressure'>, lang: 'de' | 'en'): boolean {
  const want = route.set ?? 'objection';
  const cur = get();
  if (cur && setOf(cur) === want) return true;
  if (restoreSaved(pressureResume, currentDay())) {
    const r = get();
    if (r && setOf(r) === want) return true;
  }
  return startPressure({ lang, set: want });
}
