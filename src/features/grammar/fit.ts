import { useCallback, useRef } from 'react';
import { useAsk } from '../../ai/useAsk';
import { useCapabilities } from '../../platform/capabilities';
import { local } from '../../platform/storage';
import { grammarFit, type GrammarFitOut, type GrammarFitVars } from '../../prompts/grammarFit';

// „Auch richtig“ durch Claude (grammar-fit@1) für Lücke und „Ersetze nur die markierte Stelle“. Ein Aufruf je Aufgabe und Antwort, danach
// aus dem Browser-Speicher (`lx:gfit`, nur dieses Gerät, nie in die Datenbank). Ohne Claude oder bei Fehler bleibt es beim lokalen Urteil.

const KEY = 'lx:gfit';
const MAX = 80;

type Entry = { k: string; fits: boolean; certain: boolean; why: string; t: number };

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const fitKey = (taskKey: string, given: string): string => `${taskKey}|${norm(given)}`;

function load(): Entry[] {
  const raw = local.getJson<unknown>(KEY);
  return Array.isArray(raw) ? raw.filter((e): e is Entry => !!e && typeof e === 'object' && typeof (e as Entry).k === 'string' && typeof (e as Entry).fits === 'boolean') : [];
}

export function fitCached(k: string): GrammarFitOut | null {
  const e = load().find((x) => x.k === k);
  return e ? { fits: e.fits, certain: e.certain, why: e.why } : null;
}

export function fitStore(k: string, out: GrammarFitOut): void {
  const rest = load().filter((x) => x.k !== k);
  rest.push({ k, ...out, t: Date.now() });
  local.set(KEY, JSON.stringify(rest.slice(-MAX)));
}

/** `fits && certain`: nur dann wird aus „falsch“ „Auch richtig“. */
export const fitAccepts = (o: GrammarFitOut | null): o is GrammarFitOut => !!o && o.fits && o.certain;

/** Ein laufendes Urteil: `skip` = „Ohne Zweitmeinung weiter“ (lokales Urteil), `done` = bereits abgeschlossen oder verworfen. */
export type FitRun = { done: boolean; skip: () => void };

/**
 * Wertet ein Claude-Urteil genau einmal aus: `accept` bei `fits && certain`, sonst oder bei `skip` das lokale Urteil (`local`).
 * Nie doppelt („Weiß ich nicht“, Überspringen und die Antwort von Claude schließen sich aus).
 */
export function runFit(ctl: { current: FitRun | null }, p: Promise<GrammarFitOut | null>, accept: (out: GrammarFitOut) => void, local: () => void): void {
  const run: FitRun = {
    done: false,
    skip: () => {
      if (run.done) return;
      run.done = true;
      ctl.current = null;
      local();
    },
  };
  ctl.current = run;
  void p.then((out) => {
    if (run.done) return;
    run.done = true;
    ctl.current = null;
    if (fitAccepts(out)) accept(out);
    else local();
  });
}

/** „Weiß ich nicht“ während des Urteils: das Urteil wird verworfen. */
export function abandonFit(ctl: { current: FitRun | null }): void {
  if (ctl.current) ctl.current.done = true;
  ctl.current = null;
}

/**
 * Das eine Urteil zu einer Antwort: erst Speicher, dann (nur wenn Claude nutzbar ist) genau ein Aufruf. `null` = kein Urteil (kein Claude,
 * Fehler, Abbruch): der Aufrufer bleibt beim lokalen Ergebnis. Aufrufen nur aus „Prüfen“ (ausdrückliche Handlung).
 */
export function useFitJudge() {
  const ask = useAsk(grammarFit);
  const token = useRef(0);
  const ctl = useRef<FitRun | null>(null);
  const judge = useCallback(
    async (taskKey: string, vars: GrammarFitVars): Promise<GrammarFitOut | null> => {
      const k = fitKey(taskKey, vars.given);
      const hit = fitCached(k);
      if (hit) return hit;
      const cap = useCapabilities.getState();
      if (cap.sample === 'absent' || cap.sampleRevoked) return null;
      const mine = ++token.current;
      const out = await ask.run(vars);
      if (mine !== token.current) return null;
      if (out) fitStore(k, out);
      return out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ask.run],
  );
  const cancel = useCallback(() => {
    token.current++;
    ask.stop();
  }, [ask]);
  /** „Ohne Zweitmeinung weiter“: bricht ab und löst das lokale Urteil aus. */
  const skip = useCallback(() => {
    const c = ctl.current;
    token.current++;
    ask.stop();
    c?.skip();
  }, [ask.stop]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';
  return { judge, cancel, skip, ctl, busy, phase: ask.phase };
}
