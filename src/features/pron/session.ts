import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { themeTexts } from '../../content/nb/load';
import { outId } from '../../domain/nbdrill/outDoc';
import { pickRotating } from '../../domain/nbdrill/pick';
import { shadowSentences, shadowSteps } from '../../domain/nbdrill/shadow';
import { currentDay, nextRound, restoreSaved, saveOut, type UnitRun } from '../nbdrill/shared';

// Nachsprechen (Plan N105): 3 Sätze × 3 Durchgänge (0,9 · 1,0 · 1,1), „Jetzt du“ so lange wie der
// Satz. Keine Wertung. Die Sitzung merkt sich nur Sätze und Schritt.

export type PronSession = {
  v: 1;
  kind: 'shadow';
  sentences: string[];
  /** Index in `shadowSteps(sentences.length)`. */
  step: number;
  day: string;
  t0: number;
  unit: UnitRun | null;
  src: string;
  done: boolean;
  /** Dauer bis zum Ende (ms), gesetzt beim Abschluss. */
  ms?: number;
};

export const usePron = create<{ s: PronSession | null }>(() => ({ s: null }));
const put = (s: PronSession) => usePron.setState({ s });
const get = () => usePron.getState().s;

/** Freies Üben: reihum die Nachsprech-Sätze eines Themen-Texts. */
function freeSentences(): { list: string[]; src: string } {
  const texts = themeTexts();
  const tx = pickRotating(texts, 1, nextRound('shadow'))[0];
  return { list: tx ? [...tx.shadow] : [], src: tx ? `text/${tx.id}` : '' };
}

export function startShadow(opts: { unit?: UnitRun | null; sentences?: readonly string[] | null; phrases?: readonly string[] | null; theme?: string | null }): boolean {
  const theme = opts.theme ?? opts.unit?.theme ?? null;
  const tx = theme ? themeTexts().find((x) => x.theme === theme) : null;
  const phrases = (opts.phrases ?? []).map((p) => p.replace(/\s*(…|\.\.\.)\s*$/, '').trim());
  let sentences = shadowSentences(opts.sentences, tx?.shadow, phrases);
  let src = opts.sentences?.length ? 'input' : tx ? `text/${tx.id}` : phrases.length ? 'phrases' : '';
  if (!sentences.length) {
    const f = freeSentences();
    sentences = shadowSentences(f.list);
    src = f.src;
  }
  if (!sentences.length) return false;
  put({ v: 1, kind: 'shadow', sentences, step: 0, day: opts.unit?.day ?? currentDay(), t0: Date.now(), unit: opts.unit ?? null, src, done: false });
  return true;
}

export function nextShadowStep(): void {
  const s = get();
  if (!s || s.done) return;
  const total = shadowSteps(s.sentences.length).length;
  if (s.step + 1 >= total) {
    const done = { ...s, step: total - 1, done: true, ms: Math.max(0, Date.now() - s.t0) };
    put(done);
    void saveOut({ id: outId('shadow', s.t0), k: 'shadow', d: s.day, t: s.t0, ...(s.unit?.theme ? { theme: s.unit.theme } : {}), ok: true, text: s.sentences.join('\n'), fb: { src: s.src, passes: 3 }, ms: Math.max(0, Date.now() - s.t0) });
    return;
  }
  put({ ...s, step: s.step + 1 });
}

/** Ohne Sprachausgabe: dreimal laut gelesen → fertig. */
export function finishShadow(): void {
  const s = get();
  if (!s || s.done) return;
  put({ ...s, step: shadowSteps(s.sentences.length).length - 1 });
  nextShadowStep();
}

export function endShadow(): void {
  usePron.setState({ s: null });
}

function isSession(x: unknown): x is PronSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<PronSession>;
  return s.v === 1 && s.kind === 'shadow' && Array.isArray(s.sentences) && s.sentences.every((v) => typeof v === 'string') && typeof s.step === 'number' && typeof s.day === 'string';
}

export const pronResume: Resumable<PronSession> = {
  id: 'pron',
  version: 1,
  origin: 'speak',
  snapshot: () => {
    const s = get();
    return s && !s.done ? s : null;
  },
  subscribe: (cb) => usePron.subscribe(cb),
  restore: (s) => {
    if (!isSession(s) || !s.sentences.length) return false;
    put({ ...s, step: Math.min(s.step, shadowSteps(s.sentences.length).length - 1), done: false });
    return true;
  },
  route: () => ({ name: 'pron', kind: 'shadow' }),
  label: (s, t) => {
    const st = shadowSteps(s.sentences.length)[s.step];
    return t('nbTrainingResumeShadow', { n: (st?.i ?? 0) + 1, total: s.sentences.length });
  },
};

export function ensurePron(route: RouteOf<'pron'>): boolean {
  if (route.kind !== 'shadow') return false;
  if (get()) return true;
  if (restoreSaved(pronResume, currentDay())) return true;
  return startShadow({});
}
