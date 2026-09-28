import { create } from 'zustand';
import { askJson } from '../../../ai/gate';
import { selectAiAvailable } from '../../../ai/scope';
import { isAiFailure } from '../../../ai/types';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { useSettings } from '../../../app/settings';
import { themeById } from '../../../content/nb/themes';
import { useLive } from '../../../data/live';
import { targetLevel } from '../../../domain/input/level';
import { inputBlockPlan } from '../../../domain/input/unitInput';
import { readWeekDoc, themeFor } from '../../../domain/week';
import type { ThemeId } from '../../../domain/week/types';
import { getDb, useCapabilities } from '../../../platform/capabilities';
import { logError, logWarn } from '../../../platform/diagnostics';
import { useSpeech } from '../../../platform/speech';
import { unitListen } from '../../../prompts/nb/p4/unitListen';
import contextJson from '../../../content/legacy/context.json';
import { loadFeedOnce } from '../../discover/feedStore';
import { saveUnitListen } from '../complete';
import { ensureLibrary } from '../library';
import { unitListenFor } from './source';

// Vorab-Erzeugung des Block-2-Hörtexts (Neubau N53, Prüfung M7): nur nach einer ausdrücklichen
// Handlung – dem Start der Tageseinheit („Los“ → Block 1 im Player) – und nur an Tagen, deren
// Block 2 ein Hörtext zum Thema (Di) oder ein Dialog (Do) ist. Läuft im Hintergrund während
// Block 1; Block 2 wartet nie darauf (fertig → Hörtext, sonst Rückfall wie ohne KI).
// Kein Timer, keine Wiederholung aus dem Code (sample.d.ts, A6.3): ein Fehler bleibt ein Fehler.

type PrefetchState = { key: string | null; status: 'idle' | 'running' | 'done' | 'error' };

export const useUnitPrefetch = create<PrefetchState>(() => ({ key: null, status: 'idle' }));

let ctl: AbortController | null = null;

async function weekTheme(day: string): Promise<ThemeId | null> {
  const db = getDb();
  let raw: unknown = null;
  if (db) {
    try {
      const snap = await db.doc('app/week').get();
      raw = snap.exists ? snap.data() : null;
    } catch (err) {
      logWarn('input:prefetch', err, 'app/week');
    }
  }
  return themeFor(day, readWeekDoc(raw)).theme?.id ?? null;
}

/** Startet (höchstens einmal je Lerntag und Art) die Erzeugung; lädt dazu Bibliothek und Feed vor. */
export async function prefetchUnitInput(): Promise<void> {
  const day = useClock.getState().today;
  void loadFeedOnce();
  await ensureLibrary();
  const ai = selectAiAvailable(useCapabilities.getState());
  const tts = useSpeech.getState().status === 'ready';
  if (!ai) return;
  const themeId = await weekTheme(day);
  const theme = themeById(themeId);
  if (!theme) return;
  const plan = inputBlockPlan(day, theme.id, { ai, tts: tts || useSpeech.getState().status === 'loading' });
  if (!plan || (plan.src !== 'theme-listen' && plan.src !== 'dialog')) return;
  const src = plan.src;
  const key = `${day}|${src}`;
  const cur = useUnitPrefetch.getState();
  // Ein Fehler ist für diesen Lerntag endgültig (A6.3): kein neuer Aufruf beim nächsten Block.
  if (cur.key === key && cur.status !== 'idle') return;
  if (unitListenFor(day, src)) {
    useUnitPrefetch.setState({ key, status: 'done' });
    return;
  }
  ctl?.abort();
  const mine = new AbortController();
  ctl = mine;
  useUnitPrefetch.setState({ key, status: 'running' });
  const profile = useLive.getState().docs['app/profile'];
  const context = typeof profile?.ctx === 'string' && profile.ctx.trim() ? profile.ctx.trim() : contextJson.defaultCtx;
  const lang = useSettings.getState().lang;
  try {
    const r = await askJson({
      template: unitListen,
      vars: {
        level: targetLevel(useLive.getState().docs['app/assess']),
        kind: src === 'dialog' ? 'dialog' : 'theme',
        domain: theme.kind === 'life' ? 'life' : 'work',
        themeTitle: theme.title.en,
        themeTask: theme.task.en,
        phrases: theme.phrases.map((p) => p.en),
        context,
      },
      signal: mine.signal,
    });
    if (ctl !== mine) return;
    await saveUnitListen(r.data, { day, theme: theme.id, src, domain: theme.kind === 'life' ? 'life' : 'work', level: targetLevel(useLive.getState().docs['app/assess']), lang });
    useUnitPrefetch.setState({ key, status: 'done' });
  } catch (err) {
    if (ctl !== mine) return;
    if (isAiFailure(err) && err.kind === 'cancelled') {
      useUnitPrefetch.setState({ key: null, status: 'idle' });
      return;
    }
    if (isAiFailure(err)) logWarn('input:prefetch', { code: err.code, message: err.message }, key);
    else logError('input:prefetch', err, key);
    useUnitPrefetch.setState({ key, status: 'error' });
  } finally {
    if (ctl === mine) ctl = null;
  }
}

/** Start der Tageseinheit erkennen (Block 1 im Player oder die Zwischenkarte der Einheit). */
function isUnitStart(r: { name: string } & Record<string, unknown>): boolean {
  return r.name === 'unitCard' || (r.name === 'trainer' && r.round === 'pflicht');
}

let installed = false;

/** Einmal beim Start (Bereich `lesen`, `boot`): hört auf den Start der Tageseinheit. */
export function installUnitPrefetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  let last = '';
  useNav.subscribe((s) => {
    const r = s.route as { name: string } & Record<string, unknown>;
    const k = `${r.name}|${typeof r.round === 'string' ? r.round : ''}`;
    if (k === last) return;
    last = k;
    if (isUnitStart(r)) void prefetchUnitInput();
  });
  window.addEventListener('pagehide', () => ctl?.abort());
}
