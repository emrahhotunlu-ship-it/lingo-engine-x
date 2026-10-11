import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { askJson } from '../../ai/gate';
import { useAiScope } from '../../ai/scope';
import { askStream } from '../../ai/stream';
import { isAiFailure, type AiMessageKey } from '../../ai/types';
import { buildRun, runId } from '../../domain/speak/transcript';
import type { AnalysisSlot, SceneView, StoredReport, Turn } from '../../domain/speak/types';
import { logWarn } from '../../platform/diagnostics';
import { speak, stopSpeech } from '../../platform/speech';
import { speakRepliesOn, takeOpening } from '../../app/voice/autoplay';
import { roleplayReport, type ReportTurnInfo } from '../../prompts/roleplayReport';
import { FIGURE_TIER, roleplayTurn } from '../../prompts/roleplayTurn';
import { turnAnalysis } from '../../prompts/turnAnalysis';
import { turnAnalysisV3 } from '../../prompts/turnAnalysisV3';
import { repairCheck } from '../../prompts/repairCheck';
import { flags } from '../../app/flags';
import { useLive } from '../../data/live';
import { chosenNow, useChosenChapter } from '../c1/chosen';
import { addProd } from '../../domain/c1/prod';
import { chapterTalk, retryTarget, talkProd, type ChapterTalk } from '../../domain/speak/chapterTalk';
import { repairNorm } from '../../domain/repair/repair';
import { wordCountOf } from '../../domain/chunks/newChunk';
import { AnalysisLane } from './analysisLane';
import { saveReport, saveRun } from './persist';
import { clearResume, writeResume, type ResumeCopy } from './resume';
import { roleplayMachine, stateName, type RoleplayContext } from './roleplayMachine';
import { runMarkerFor, workContext } from './useSceneLibrary';
import { repairsFromTalk } from '../../domain/repair/sources';
import { sceneCriteria, sceneGoals } from '../../domain/speak/bizScenes';
import { mergeGoalMarks, type GoalMark } from '../../domain/speak/goals';
import { goalCheck, type CriterionMark } from '../../prompts/nb/p5/goalCheck';
import { saveRepairs } from '../repair/store';
import { patternHints } from '../patterns/store';

// Steuerung eines Rollenspiels: verbindet die reine Maschine mit KI-Tor, Analysespur,
// Speichern und Sprachausgabe. Jeder KI-Aufruf entsteht aus einer Handlung (Senden, Beenden,
// „Analyse erneut“, „Erneut versuchen“), nie aus Render oder Timer. Bildschirmwechsel bricht
// alles ab (useAiScope, Spur schließen, Sprachausgabe stoppen); die Kopie zum Fortsetzen bleibt.


const EMPTY_DOCS = new Map<string, Readonly<Record<string, unknown>>>();

/** Kapitel, Musterliste und Kapitelziel (LP3 P51) aus den Live-Daten; `null` bei ausgeschaltetem Schalter oder ohne Kapitel. Szenenstart und Gespräch rechnen gleich. */
export function readChapterTalk(sceneId: string, docs: ReadonlyMap<string, Readonly<Record<string, unknown>>> | undefined, today: string, nowMs: number, chosen: number | null = chosenNow()): ChapterTalk | null {
  // Ohne Kapitelprogramm (R3 „Dein Weg“ aus) gibt es kein aktuelles Kapitel, also weder Musterliste noch Ziel.
  if (!flags.tutor.talk || !flags.program) return null;
  return chapterTalk({ docs: docs ?? EMPTY_DOCS, today, nowMs, sceneId, chosen });
}

/** Dasselbe als Hook für den Szenenstart (rechnet nur bei geänderten Daten neu). */
export function useChapterTalk(sceneId: string | null): ChapterTalk | null {
  const docs = useLive((s) => s.collections.grammar);
  const today = useClock((s) => s.today);
  const nowMs = useClock((s) => s.now);
  const chosen = useChosenChapter();
  return useMemo(() => (sceneId ? readChapterTalk(sceneId, docs, today, nowMs, chosen) : null), [sceneId, docs, today, nowMs, chosen]);
}

/** „Sag's nochmal“ (LP3 P51) je Zug: Versuche, Ergebnis von repair-check@1, Notiz. `ok` schließt die Stelle (keine weitere Buchung). */
export type SayAgainState = { phase: 'busy' | 'ok' | 'no' | 'error'; given: string; tries: number; note: string; error: AiMessageKey | null };
/** Höchstens so viele Prüfungen je Stelle (je eine `quick`-Anfrage). */
export const SAY_AGAIN_TRIES = 2;

const errKey = (err: unknown): AiMessageKey => (isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed');

/** Die Zeile der Figur vor Zug `i` und bis zu 2 frühere Wechsel. */
function contextOf(turns: readonly Turn[], i: number): { personaLine: string; history: Array<{ persona: string; me: string }> } {
  let personaLine = '';
  for (let k = i - 1; k >= 0; k--) {
    const t = turns[k] as Turn;
    if (t.role === 'persona') {
      personaLine = t.text;
      break;
    }
  }
  const history: Array<{ persona: string; me: string }> = [];
  for (let k = 0; k < i; k++) {
    const t = turns[k] as Turn;
    const prev = turns[k - 1];
    if (t.role === 'me' && prev?.role === 'persona') history.push({ persona: prev.text, me: t.text });
  }
  return { personaLine, history: history.slice(-2) };
}

export function reportTurns(turns: readonly Turn[], analyses: Readonly<Record<number, AnalysisSlot>>): ReportTurnInfo[] {
  const out: ReportTurnInfo[] = [];
  turns.forEach((t, i) => {
    if (t.role !== 'me') return;
    const a = analyses[i];
    const d = a?.state === 'done' ? a.data : undefined;
    out.push({ me: t.text, persona: contextOf(turns, i).personaLine, v: d ? d.verdict : 'na', c: d ? [...new Set(d.errors.map((e) => e.cat))] : [] });
  });
  return out;
}

export type RoleplayApi = ReturnType<typeof useRoleplay>;

/** Kriterien-Raster am Gesprächsende (N72). */
export type CriteriaState = { state: 'idle' | 'pending' | 'done' | 'failed'; data: CriterionMark[] };

export function useRoleplay(scene: SceneView, resume: ResumeCopy | null) {
  const scope = useAiScope();
  const lang = useSettings((s) => s.lang);
  const [startedAt] = useState(() => resume?.startedAt ?? Date.now());
  const [day] = useState(() => resume?.day ?? useClock.getState().today);
  const [snap, send, actor] = useMachine(roleplayMachine, {
    input: { opening: scene.opening, startedAt, resume: resume ? { turns: resume.turns, analyses: resume.analyses, taken: resume.taken } : null },
  });
  const lane = useRef<AnalysisLane | null>(null);
  lane.current ??= new AnalysisLane();
  const figureCtl = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const runRef = useRef<ReturnType<typeof buildRun> | null>(null);
  const alive = useRef(true);
  // Ziel-Checkliste (N72): Haken nach jeder Antwort der Figur, nie zurückgenommen.
  // Die Szene ändert sich innerhalb eines Gesprächs nicht (neue Szene = neuer Schlüssel).
  const [goalsEn] = useState(() => sceneGoals(scene).map((g) => g.en));
  const [critEn] = useState(() => sceneCriteria(scene).map((c) => c.en));
  const [goals, setGoalsState] = useState<GoalMark[]>(() => mergeGoalMarks(resume?.goals ?? [], [], goalsEn.length));
  const goalsRef = useRef(goals);
  const [criteria, setCriteria] = useState<CriteriaState>({ state: 'idle', data: [] });
  // LP3 P51: Kapitel und Kapitelziel stehen für das ganze Gespräch fest (wie im Szenenstart gerechnet).
  const [talk] = useState<ChapterTalk | null>(() => readChapterTalk(scene.id, useLive.getState().collections.grammar, useClock.getState().today, useClock.getState().now));
  const pastedTexts = useRef(new Set<string>());
  const [said, setSaid] = useState<Record<number, SayAgainState>>({});
  const saidRef = useRef(said);

  useEffect(() => {
    alive.current = true;
    lane.current?.open();
    const opening = takeOpening();
    if (opening) void speak(opening);
    return () => {
      alive.current = false;
      lane.current?.close();
      figureCtl.current?.abort();
      stopSpeech();
    };
  }, []);

  const ctx = (): RoleplayContext => actor.getSnapshot().context;

  const persistCopy = useCallback(() => {
    const c = actor.getSnapshot().context;
    if (!c.turns.some((t) => t.role === 'me')) return;
    writeResume(scene.id, { v: 1, turns: c.turns, analyses: c.analyses, startedAt: startedAt, day: day, taken: c.taken, goals: goalsRef.current });
  }, [actor, scene.id, startedAt, day]);

  // ------------------------------------------------------------ Ziel-Checkliste (goal-check@1)

  /** Nach jeder Antwort der Figur (Handlung „Senden“) bzw. am Ende mit Kriterien. Ohne KI: nichts. */
  const checkGoals = useCallback(
    async (final: boolean) => {
      const n = goalsEn.length;
      const turns = actor.getSnapshot().context.turns.map((t) => ({ role: t.role, text: t.text }));
      if (!n || !turns.some((t) => t.role === 'me')) return;
      const withCrit = final && critEn.length > 0;
      if (withCrit) setCriteria({ state: 'pending', data: [] });
      const ctl = scope.controller();
      try {
        const r = await askJson({
          template: goalCheck,
          vars: { goals: goalsEn, criteria: critEn, turns, final: withCrit, uiLang: useSettings.getState().lang },
          signal: ctl.signal,
          priority: 'background',
        });
        if (!alive.current) return;
        const merged = mergeGoalMarks(goalsRef.current, r.data.goals, n);
        goalsRef.current = merged;
        setGoalsState(merged);
        if (withCrit) setCriteria({ state: 'done', data: r.data.criteria });
        if (!final) persistCopy();
      } catch (err) {
        if (!alive.current || (isAiFailure(err) && err.kind === 'cancelled')) return;
        logWarn('speak:goal-check', err, scene.id);
        if (withCrit) setCriteria({ state: 'failed', data: [] });
      }
    },
    [actor, scope, scene.id, persistCopy, goalsEn, critEn],
  );

  // ------------------------------------------------------------ Bericht

  // `refresh`: Neuversuch nach einem Fehler – den Zwischenspeicher von `sample` einmal übergehen.
  const requestReport = useCallback(async (opts: { refresh?: boolean } = {}) => {
    const run = runRef.current;
    if (!run) return;
    const c = ctx();
    const uiLang = useSettings.getState().lang;
    send({ type: 'REPORT_PHASE', state: 'thinking' });
    try {
      const r = await askJson({
        template: roleplayReport,
        vars: { title: scene.titleEn, goal: scene.goalEn, role: `${scene.persona?.name ?? ''}, ${scene.persona?.role ?? ''}`, turns: reportTurns(c.turns, c.analyses), taken: c.taken, uiLang },
        signal: scope.signal,
        refresh: opts.refresh === true,
        onPhase: (p) => {
          if (p === 'slow' && alive.current) send({ type: 'REPORT_PHASE', state: 'slow' });
        },
      });
      const report: StoredReport = { ...r.data, lang: uiLang, t: Date.now() };
      if (!alive.current) return;
      send({ type: 'REPORT_DONE', data: report });
      const saved = await saveReport(run, report);
      if (saved) runRef.current = { ...run, report, goal: report.goal.state };
    } catch (err) {
      if (!alive.current || (isAiFailure(err) && err.kind === 'cancelled')) return;
      send({ type: 'REPORT_FAIL', error: errKey(err) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx liest nur den aktuellen Stand der Maschine
  }, [scene, scope, send]);

  // ------------------------------------------------------------ Speichern am Gesprächsende

  const maybeFinish = useCallback(async () => {
    if (stateName(actor.getSnapshot().value) !== 'finishing' || saving.current) return;
    saving.current = true;
    const c = ctx();
    const run = buildRun({ id: runId(startedAt), startedAt: startedAt, endedAt: c.endedAt ?? Date.now(), day: day, scene, turns: c.turns, analyses: c.analyses, taken: c.taken, lang: useSettings.getState().lang, tier: FIGURE_TIER });
    runRef.current = run;
    const errors = c.turns.flatMap((t, i) => {
      const a = c.analyses[i];
      return a?.state === 'done' && a.data ? a.data.errors.map((e) => ({ cat: e.cat, wrong: e.wrong, right: e.right, sentence: t.text })) : [];
    });
    // Lernberatung V2: eigene Sätze mit echten Fehlern werden Reparatur-Sätze (parallel, blockiert nichts).
    const repairs = repairsFromTalk(c.turns, c.analyses, scene.titleEn);
    const [ok] = await Promise.all([saveRun({ run, lang: useSettings.getState().lang, legacyScene: runMarkerFor(scene.id), errors, nowMs: Date.now() }), repairs.length ? saveRepairs(repairs) : Promise.resolve(true)]);
    if (ok) clearResume(scene.id);
    // LP3 P51: K7-Eintrag `s: 'talk'` aus den eigenen Zügen (nur bei Änderung, Doppelschutz nach `id`; Einfügen zählt nie). Blockiert nichts.
    if (ok && flags.tutor.talk) {
      const prod = talkProd({ turns: c.turns, analyses: c.analyses, day, runId: run.id, pastedTexts: pastedTexts.current });
      if (prod) void addProd(prod);
    }
    if (!alive.current) return;
    send({ type: ok ? 'SAVED' : 'SAVE_FAILED' });
    if (run.turns >= 1) {
      void requestReport();
      void checkGoals(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx liest nur den aktuellen Stand der Maschine
  }, [actor, scene, send, requestReport, checkGoals]);

  // ------------------------------------------------------------ Analyse

  const analyze = useCallback(
    (i: number, refresh = false) => {
      const c = ctx();
      const t = c.turns[i];
      if (!t || t.role !== 'me') return;
      if (wordCountOf(t.text) < 2) {
        send({ type: 'ANALYSIS', idx: i, slot: { state: 'skipped' } });
        return;
      }
      send({ type: 'ANALYSIS', idx: i, slot: { state: 'pending' } });
      const { personaLine, history } = contextOf(c.turns, i);
      const uiLang = useSettings.getState().lang;
      lane.current?.enqueue(i, async (laneSignal) => {
        const ctl = scope.controller();
        const unlink = () => ctl.abort();
        laneSignal.addEventListener('abort', unlink, { once: true });
        try {
          // Lernberatung V3: die Top-3-Deutsch-Fallen als Hinweis („achte besonders auf …“).
          const watch = await patternHints();
          const vars = { goal: scene.goalEn, role: `${scene.persona?.name ?? ''}, ${scene.persona?.role ?? ''} (${scene.persona?.org ?? ''})`, personaLine, history, sentence: t.text, focusWords: scene.words, uiLang, watch };
          // LP3 P51: turn-analysis@3 mit der Musterliste des Kapitels (`pat`, `used`, `count`); Schalter aus → @2 wie bisher.
          const r = flags.tutor.talk
            ? await askJson({ template: turnAnalysisV3, vars: { ...vars, pats: (talk?.pats ?? []).map((p) => ({ id: p.id, en: p.en })) }, signal: ctl.signal, priority: 'background', refresh })
            : await askJson({ template: turnAnalysis, vars, signal: ctl.signal, priority: 'background', refresh });
          if (!alive.current) return;
          send({ type: 'ANALYSIS', idx: i, slot: { state: 'done', data: r.data, lang: uiLang } });
          persistCopy();
        } catch (err) {
          if (!alive.current) return;
          const cur = ctx().analyses[i];
          if (isAiFailure(err) && err.kind === 'cancelled') {
            if (cur?.state === 'pending') send({ type: 'ANALYSIS', idx: i, slot: { state: 'skipped' } });
          } else {
            logWarn('speak:analysis', err, String(i));
            send({ type: 'ANALYSIS', idx: i, slot: { state: 'failed' } });
          }
        } finally {
          laneSignal.removeEventListener('abort', unlink);
          void maybeFinish();
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx liest nur den aktuellen Stand der Maschine
    [scene, scope, send, persistCopy, maybeFinish, talk],
  );

  // ------------------------------------------------------------ Senden

  const sendTurn = useCallback(
    async (text: string, usedChip: boolean, pasted = false) => {
      if (stateName(actor.getSnapshot().value) !== 'composing' || !text.trim()) return;
      stopSpeech();
      // Eingefügt bleibt eingefügt, auch wenn der Satz nach einem Fehler zurück ins Feld kommt und erneut gesendet wird.
      if (pasted) pastedTexts.current.add(text.trim());
      send({ type: 'SEND', text, usedChip, t: Date.now(), pasted: pasted || pastedTexts.current.has(text.trim()) });
      const ctl = scope.controller();
      figureCtl.current = ctl;
      const turns = ctx().turns;
      const p = scene.persona ?? { name: 'Jordan Lee', role: 'Manager', org: 'a client', traits: 'direct' };
      try {
        const r = await askStream({
          template: roleplayTurn,
          vars: { title: scene.titleEn, situation: scene.situationEn, goal: scene.goalEn, persona: p, stake: scene.stake, objection: scene.objection, ctx: workContext(), focusWords: scene.words, turns },
          signal: ctl.signal,
          onPhase: (ph) => {
            if (ph === 'slow' && alive.current) send({ type: 'SLOW' });
          },
          onText: (t) => {
            if (alive.current) send({ type: 'TEXT', text: t });
          },
        });
        if (!alive.current) return;
        send({ type: 'REPLY', text: r.text, truncated: r.truncated, t: Date.now() });
        const all = ctx().turns;
        analyze(all.length - 2);
        persistCopy();
        void checkGoals(false);
        if (speakRepliesOn()) void speak(r.text);
      } catch (err) {
        if (!alive.current) return;
        if (isAiFailure(err) && err.kind === 'cancelled') send({ type: 'CANCELLED' });
        else send({ type: 'FAIL', error: errKey(err), partial: isAiFailure(err) ? (err.partial ?? '') : '', unavailable: isAiFailure(err) && err.kind === 'unavailable' });
      } finally {
        if (figureCtl.current === ctl) figureCtl.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx liest nur den aktuellen Stand der Maschine
    [actor, scene, scope, send, analyze, persistCopy, checkGoals],
  );

  const stop = useCallback(() => figureCtl.current?.abort(), []);

  const end = useCallback(() => {
    stopSpeech();
    send({ type: 'END', t: Date.now() });
    void maybeFinish();
  }, [send, maybeFinish]);

  const reportNow = useCallback(() => {
    lane.current?.cancelAll();
    send({ type: 'REPORT_NOW' });
    void maybeFinish();
  }, [send, maybeFinish]);

  const retryAnalysis = useCallback((i: number) => analyze(i, true), [analyze]);

  // ------------------------------------------------------------ „Sag's nochmal“ (LP3 P51)

  const putSaid = useCallback((i: number, st: SayAgainState | null) => {
    const next = { ...saidRef.current };
    if (st) next[i] = st;
    else delete next[i];
    saidRef.current = next;
    setSaid(next);
  }, []);

  /**
   * Emrah sagt bzw. tippt den Satz von Zug `i` neu, ohne die Korrektur zu sehen. Genau EIN Aufruf `repair-check@1` je Prüfung (der eine Neuversuch nach
   * A6.3 macht das KI-Tor nur bei Schemaverstoß). Ein unveränderter Satz fragt nicht (`'same'`). Ergebnis nur im Gespräch: kein Schreiben, keine Buchung.
   */
  const sayAgain = useCallback(
    async (i: number, given: string): Promise<'same' | 'limit' | 'done'> => {
      const t = ctx().turns[i];
      const a = ctx().analyses[i];
      const cur = saidRef.current[i];
      if (!t || t.role !== 'me' || a?.state !== 'done' || !a.data?.english) return 'limit';
      // Nur echte Fehler mit auffindbarer Reparatur (nie Stil/Ton, nie `upgraded` als Lösung).
      const target = retryTarget(t.text, a.data.errors);
      if (!target) return 'limit';
      if (cur?.phase === 'busy' || cur?.phase === 'ok' || (cur?.tries ?? 0) >= SAY_AGAIN_TRIES) return 'limit';
      const text = given.trim();
      if (!text || repairNorm(text) === repairNorm(t.text)) return 'same';
      const { right, why } = target;
      const tries = (cur?.tries ?? 0) + 1;
      putSaid(i, { phase: 'busy', given: text, tries, note: '', error: null });
      try {
        const r = await askJson({ template: repairCheck, vars: { wrong: t.text, right, why, given: text, uiLang: useSettings.getState().lang, mode: 'retry' }, signal: scope.signal, refresh: cur?.phase === 'error' });
        if (!alive.current) return 'done';
        putSaid(i, { phase: r.data.ok ? 'ok' : 'no', given: text, tries, note: r.data.note, error: null });
      } catch (err) {
        if (!alive.current) return 'done';
        if (isAiFailure(err) && err.kind === 'cancelled') putSaid(i, cur ?? null);
        else {
          logWarn('speak:say-again', err, String(i));
          // Ein Fehler kostet keinen Versuch (die Anfrage hat kein Urteil gebracht).
          putSaid(i, { phase: 'error', given: text, tries: tries - 1, note: '', error: errKey(err) });
        }
      }
      return 'done';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx liest nur den aktuellen Stand der Maschine
    [scope, putSaid],
  );
  const setDraft = useCallback((text: string) => send({ type: 'DRAFT', text }), [send]);
  const markTaken = useCallback(
    (en: string) => {
      send({ type: 'TAKEN', en });
      if (stateName(actor.getSnapshot().value) !== 'report') persistCopy();
    },
    [actor, send, persistCopy],
  );

  return {
    snap,
    state: stateName(snap.value),
    lang,
    sendTurn,
    stop,
    end,
    reportNow,
    retryAnalysis,
    requestReport,
    setDraft,
    markTaken,
    startedAt,
    day,
    goals,
    goalTexts: goalsEn,
    criteria,
    retryCriteria: () => void checkGoals(true),
    talk,
    said,
    sayAgain,
  };
}
