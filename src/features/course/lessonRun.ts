import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { readDoc } from '../../data/reads';
import { baseLesson } from '../../domain/course/baseLesson';
import { lessonMeta } from '../../domain/course/catalog';
import { isExtLessonId } from '../../domain/course/extension';
import { lessonWrite, readLesson } from '../../domain/course/lessonDoc';
import { topicById } from '../../domain/content';
import { ruleOf } from '../../domain/grammar/rules';
import type { Ctx, LessonContent, LessonMeta } from '../../domain/learn/types';
import type { Lang } from '../../domain/srs/types';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';
import { lessonContent, toLessonDoc } from '../../prompts/lessonContent';
import { learnRecorder, nextT } from '../progress/persist';
import { loadLearnInputs, rememberLesson, useLearnInputs } from '../learn/inputs';
import { roundCtx } from '../today/state';

// Lauf einer Lektion (phase2-plan §5.1): Inhalt aus `lesson/<id>`; fehlt er, auf Knopfdruck
// per KI (gespeichert nach §4.8) oder als Grundfassung ohne KI (nie gespeichert). Der Abschluss
// hängt nie von der KI ab. Zähler der Runde und der Abschluss laufen über den `LearnRecorder`.

type Doc = Record<string, unknown>;
const asObj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export const STEPS = ['intro', 'words', 'dialog', 'grammar', 'output', 'summary'] as const;
export type Step = (typeof STEPS)[number];

type RunState = {
  lid: string | null;
  meta: LessonMeta | null;
  status: 'idle' | 'loading' | 'choose' | 'ready' | 'error';
  content: LessonContent | null;
  ctx: Ctx;
  day: string;
  lang: Lang;
  n: number;
  ok: number;
  lessonAi: boolean;
  activeMs: number;
  lastInteract: number;
  finished: boolean;
};

const initial = (): RunState => ({ lid: null, meta: null, status: 'idle', content: null, ctx: 'xtra', day: '', lang: 'de', n: 0, ok: 0, lessonAi: false, activeMs: 0, lastInteract: 0, finished: false });
export const useLessonRun = create<RunState>(initial);

const IDLE_CAP_MS = 60_000;
const stepKey = (lid: string) => `${KEY_PREFIX}lesson:${lid}:step`;

/** Gespeicherter Schritt für den Wiedereinstieg (K-01), nur Bequemlichkeit. */
export function savedStep(lid: string): Step | null {
  const v = local.get(stepKey(lid));
  return (STEPS as readonly string[]).includes(v ?? '') && v !== 'summary' ? (v as Step) : null;
}
export function saveStep(lid: string, step: Step): void {
  if (step === 'summary') local.remove(stepKey(lid));
  else local.set(stepKey(lid), step);
}

/** Lektion öffnen: gespeicherten Inhalt lesen (Cache, sonst `get`). */
export async function openLesson(lid: string): Promise<void> {
  let meta = lessonMeta(lid);
  // Erweiterte Lektion (l25+) vor dem ersten Lesen von `lesson/*`: erst lesen, dann erneut suchen.
  if (!meta && isExtLessonId(lid)) {
    await loadLearnInputs();
    meta = lessonMeta(lid);
  }
  const day = useClock.getState().today;
  const lang = useSettings.getState().lang;
  if (!meta) {
    useLessonRun.setState({ ...initial(), lid, status: 'error' });
    return;
  }
  useLessonRun.setState({ ...initial(), lid, meta, status: 'loading', day, lang, ctx: roundCtx('lesson', day), lastInteract: performance.now() });
  let doc: Doc | null = useLearnInputs.getState().lessons.get(lid) ?? null;
  if (!doc) {
    const db = getDb();
    try {
      const r = db ? await readDoc(db, `lesson/${lid}`) : { status: 'missing' as const };
      doc = r.status === 'valid' ? r.doc : null;
      if (r.status === 'invalid') logWarn('course:lesson', { code: 'invalid_document', message: 'Lektionsinhalt ungültig – Grundfassung' }, `lesson/${lid}`);
    } catch (err) {
      logError('course:lesson', err, `lesson/${lid}`);
    }
  }
  if (useLessonRun.getState().lid !== lid) return;
  const content = readLesson(doc, lang, meta);
  useLessonRun.setState(content ? { status: 'ready', content } : { status: 'choose' });
}

/** Grundfassung ohne KI (D11, nie gespeichert). */
export function startBaseLesson(): void {
  const s = useLessonRun.getState();
  if (!s.meta) return;
  const live = useLive.getState();
  const seenDoc = live.collections.grammar?.get(s.meta.grammar);
  const seen = new Set(Array.isArray(seenDoc?.seen) ? (seenDoc.seen as unknown[]).map(String) : []);
  const content = baseLesson(s.meta, { vocab: live.collections.vocab ?? new Map(), pool: useLearnInputs.getState().pool, seen });
  useLessonRun.setState({ status: 'ready', content });
}

/** „Lektion vorbereiten": Inhalt von Claude, gespeichert nach §4.8 (nie überschrieben). */
export async function prepareLesson(signal: AbortSignal): Promise<void> {
  const s = useLessonRun.getState();
  if (!s.meta || !s.lid) return;
  const meta = s.meta;
  const lid = s.lid;
  const tp = topicById(meta.grammar);
  const rule = ruleOf(meta.grammar, 'en');
  const ruleEn = [rule?.core ?? '', ...(rule?.forms ?? []).map((f) => `${f.name}: ${f.pattern} (${f.ex})`)].filter(Boolean).join(' · ').slice(0, 1500);
  const profile = useLive.getState().docs['app/profile'];
  const mixRaw = profile?.mix && typeof profile.mix === 'object' ? (profile.mix as Doc) : null;
  const mix = mixRaw && typeof mixRaw.work === 'number' && typeof mixRaw.life === 'number' ? { work: mixRaw.work, life: mixRaw.life } : null;
  const r = await askJson({ template: lessonContent, vars: { meta, grammarName: tp?.name_en ?? tp?.name ?? meta.grammar, ruleEn, uiLang: s.lang, mix }, signal });
  const doc = toLessonDoc(r.data, { uiLang: s.lang }, Date.now());
  const writer = getWriter();
  let stored: Doc = doc;
  let fresh = true;
  if (writer) {
    try {
      await writer.transform(`lesson/${lid}`, (cur) => {
        const op = lessonWrite(cur, doc, lid);
        // Schon ein Inhalt mit Wörtern da (anderes Fenster): der gespeicherte gilt.
        if (!op && cur && Array.isArray(cur.words) && cur.words.length) {
          stored = cur;
          fresh = false;
        }
        // Ergänzt (z. B. erweiterte Lektion mit Lehrplan `plan`): lokal wie gespeichert zusammenführen.
        if (op && 'update' in op && cur) stored = { ...cur, ...op.update, lx: { ...asObj(cur.lx), ...asObj(op.update.lx) } };
        return op;
      });
    } catch (err) {
      logError('course:lesson', err, `lesson/${lid}`);
    }
  }
  rememberLesson(lid, stored);
  const content = readLesson(stored, s.lang, meta);
  if (useLessonRun.getState().lid !== lid) return;
  useLessonRun.setState(content ? { status: 'ready', content: { ...content, source: fresh ? 'ai' : 'db' } } : { status: 'choose' });
}

export function touchLesson(): void {
  const s = useLessonRun.getState();
  if (!s.lid) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useLessonRun.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

export function countAnswer(ok: boolean): void {
  touchLesson();
  useLessonRun.setState((s) => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
}

export function markLessonAi(): void {
  useLessonRun.setState({ lessonAi: true });
}

/** Lektion abgeschlossen: `app/course.done` (erstmals bzw. `last`) und Rundenende „lesson". */
export async function finishLesson(): Promise<void> {
  touchLesson();
  const s = useLessonRun.getState();
  if (!s.lid || s.finished) return;
  useLessonRun.setState({ finished: true });
  saveStep(s.lid, 'summary');
  await learnRecorder.lessonDone({ lid: s.lid, day: s.day, t: nextT(), n: s.n, ok: s.ok });
  await learnRecorder.roundEnd({ day: s.day, act: 'lesson', ctx: s.ctx, partial: false, n: Math.max(1, s.n), right: s.ok, activeMs: s.activeMs, lessonAi: s.lessonAi });
}

/** Lektion verlassen: ein Abbruch mit ≥ 1 Antwort ergibt nur `act.lesson~` und Minuten (§4.7). */
export function leaveLesson(): void {
  const s = useLessonRun.getState();
  if (s.lid && !s.finished && s.n >= 1) {
    void learnRecorder.roundEnd({ day: s.day, act: 'lesson', ctx: s.ctx, partial: true, n: s.n, right: s.ok, activeMs: s.activeMs });
  }
  useLessonRun.setState(initial());
}
