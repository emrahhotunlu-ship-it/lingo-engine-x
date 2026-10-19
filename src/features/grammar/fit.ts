import { useCallback, useRef, useState } from 'react';
import { askJson } from '../../ai/gate';
import { useAiScope } from '../../ai/scope';
import { takeTutorCall, tutorLeft } from '../../ai/tutorBudget';
import { isAiFailure, type AiErrorKind, type AiPhase } from '../../ai/types';
import { useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { local } from '../../platform/storage';
import { grammarFit, type FitBi, type GrammarFitOut, type GrammarFitVars } from '../../prompts/grammarFit';

// „Auch richtig“ durch Claude (grammar-fit@2, Tutor-Engine v3 §6.3/§6.4) für Lücke, Umformung, Schlüsselwort und „Ersetze nur die markierte Stelle“.
// Ein Aufruf je Aufgabe und Antwort, danach aus dem Browser-Speicher (`lx:gfit`, nur dieses Gerät; die Datenbank bekommt nur das gelernte
// `fitAlt` beim Buchen). Jeder echte Aufruf zählt gegen die Tagesbremse (`tutorBudget`, 20 je Tag); ein Treffer im Speicher nicht.
// Automatisch fragt die Oberfläche nur, wenn Claude in dieser Ansicht schon einmal geantwortet hat (`sampleConfirmed`); sonst gibt es den
// Knopf „Claude fragen“. Fehlerarten (§6.4): `busy` (rate_limited) nie automatisch, Knopf bleibt · `signin` neu anmelden · `final`
// (refused/empty) kein Neuversuch mit derselben Eingabe · `retry` (invalid/failed) „Erneut versuchen“ mit frischer Anfrage · `bug`/`too_large`
// für diese Aufgabe aus · `off` (nicht verfügbar) Knopf ausblenden · `limit` Tagesbremse erreicht.

const KEY = 'lx:gfit';
const MAX = 80;

/** Gespeichertes Urteil. Einträge von @1 tragen `why` als Text und kein `fitsGoal`; sie gelten weiter (fitsGoal unbekannt = false). */
type Entry = { k: string; fits: boolean; certain: boolean; why: string | FitBi; fitsGoal?: boolean; vs?: string | null; t: number };

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const fitKey = (taskKey: string, given: string): string => `${taskKey}|${norm(given)}`;

function load(): Entry[] {
  const raw = local.getJson<unknown>(KEY);
  return Array.isArray(raw) ? raw.filter((e): e is Entry => !!e && typeof e === 'object' && typeof (e as Entry).k === 'string' && typeof (e as Entry).fits === 'boolean') : [];
}

const asBi = (w: unknown): FitBi => {
  if (typeof w === 'string') return { de: w, en: w };
  const o = w && typeof w === 'object' ? (w as Partial<FitBi>) : {};
  return { de: typeof o.de === 'string' ? o.de : '', en: typeof o.en === 'string' ? o.en : '' };
};

export function fitCached(k: string): GrammarFitOut | null {
  const e = load().find((x) => x.k === k);
  if (!e) return null;
  return { fits: e.fits, certain: e.certain === true, fitsGoal: e.fitsGoal === true, why: asBi(e.why), edits: [], vs: typeof e.vs === 'string' ? e.vs : null, retryHint: null };
}

export function fitStore(k: string, out: GrammarFitOut): void {
  const rest = load().filter((x) => x.k !== k);
  rest.push({ k, fits: out.fits, certain: out.certain, fitsGoal: out.fitsGoal, why: out.why, vs: out.vs, t: Date.now() });
  local.set(KEY, JSON.stringify(rest.slice(-MAX)));
}

/** `fits && certain`: nur dann wird aus „falsch“/„unsicher“ „Auch richtig“. */
export const fitAccepts = (o: (Pick<GrammarFitOut, 'fits' | 'certain'> & { why?: unknown }) | null | undefined): boolean => !!o && o.fits && o.certain;

/** Ergebnis eines Urteils: `out` (auch bei Nein) oder die Fehlerart für die Oberfläche (§6.4). Beides `null` = abgebrochen. */
export type FitErr = 'off' | 'limit' | 'busy' | 'signin' | 'final' | 'retry' | 'bug';
export type FitResult = { out: GrammarFitOut | null; err: FitErr | null };

/** Fehlerart des KI-Tors → Folge in der Übung. `null` = still (Abbruch). */
export function fitErrOf(kind: AiErrorKind): FitErr | null {
  switch (kind) {
    case 'cancelled':
      return null;
    case 'unavailable':
      return 'off';
    case 'busy':
      return 'busy';
    case 'signin':
      return 'signin';
    case 'refused':
    case 'empty':
      return 'final';
    case 'invalid':
    case 'failed':
      return 'retry';
    case 'bug':
    case 'too_large':
      return 'bug';
  }
}

/** Ein laufendes Urteil: `skip` = „Ohne Zweitmeinung weiter“ (lokales Urteil), `done` = bereits abgeschlossen oder verworfen. */
export type FitRun = { done: boolean; skip: () => void };

/**
 * Wertet ein Claude-Urteil genau einmal aus: `accept` bei `fits && certain`, sonst oder bei `skip` das lokale Urteil (`local`, mit dem Ergebnis,
 * falls es eins gab). Nie doppelt („Weiß ich nicht“, Überspringen und die Antwort von Claude schließen sich aus).
 */
export function runFit(ctl: { current: FitRun | null }, p: Promise<FitResult>, accept: (out: GrammarFitOut) => void, local: (r: FitResult | null) => void): void {
  const run: FitRun = {
    done: false,
    skip: () => {
      if (run.done) return;
      run.done = true;
      ctl.current = null;
      local(null);
    },
  };
  ctl.current = run;
  void p.then(
    (r) => {
      if (run.done) return;
      run.done = true;
      ctl.current = null;
      if (r.out && fitAccepts(r.out)) accept(r.out);
      else local(r);
    },
    (err: unknown) => {
      logWarn('grammar:fit', err, 'runFit');
      if (run.done) return;
      run.done = true;
      ctl.current = null;
      local(null);
    },
  );
}

/** „Weiß ich nicht“ während des Urteils: das Urteil wird verworfen. */
export function abandonFit(ctl: { current: FitRun | null }): void {
  if (ctl.current) ctl.current.done = true;
  ctl.current = null;
}

/** Darf jetzt automatisch gefragt werden? Nur mit beantwortetem Nutzeraufruf in dieser Ansicht (`sampleConfirmed`). */
export const fitAiState = (now: number = Date.now()): { available: boolean; confirmed: boolean; budgetLeft: number } => {
  const cap = useCapabilities.getState();
  return { available: cap.sample === 'ready' && !cap.sampleRevoked, confirmed: cap.sampleConfirmed, budgetLeft: tutorLeft(now) };
};

/**
 * Das eine Urteil zu einer Antwort: erst Speicher, dann (nur wenn Claude nutzbar ist und die Tagesbremse es erlaubt) genau ein Aufruf.
 * `refresh` nur nach `retry` („Erneut versuchen“): übergeht Speicher und Zwischenspeicher von `sample` einmal. Aufrufen nur aus „Prüfen“
 * (mit `sampleConfirmed`) oder aus dem Knopf „Claude fragen“.
 */
export function useFitJudge() {
  const scope = useAiScope();
  const [phase, setPhase] = useState<AiPhase | 'idle'>('idle');
  const token = useRef(0);
  const ctl = useRef<FitRun | null>(null);
  const ac = useRef<AbortController | null>(null);
  const judge = useCallback(
    async (taskKey: string, vars: GrammarFitVars, opts: { refresh?: boolean } = {}): Promise<FitResult> => {
      const k = fitKey(taskKey, vars.given);
      if (!opts.refresh) {
        const hit = fitCached(k);
        if (hit) return { out: hit, err: null };
      }
      const cap = useCapabilities.getState();
      if (cap.sample !== 'ready' || cap.sampleRevoked) return { out: null, err: 'off' };
      if (!takeTutorCall()) return { out: null, err: 'limit' };
      const mine = ++token.current;
      ac.current?.abort();
      const c = scope.controller();
      ac.current = c;
      setPhase('queued');
      try {
        const r = await askJson({
          template: grammarFit,
          vars,
          signal: c.signal,
          priority: 'user',
          refresh: opts.refresh === true,
          onPhase: (p) => {
            if (token.current === mine) setPhase(p);
          },
        });
        if (mine !== token.current) return { out: null, err: null };
        setPhase('done');
        fitStore(k, r.data);
        return { out: r.data, err: null };
      } catch (err) {
        if (mine !== token.current) return { out: null, err: null };
        setPhase('idle');
        if (!isAiFailure(err)) {
          logWarn('grammar:fit', err, taskKey);
          return { out: null, err: 'retry' };
        }
        return { out: null, err: fitErrOf(err.kind) };
      }
    },
    [scope],
  );
  const cancel = useCallback(() => {
    token.current++;
    ac.current?.abort();
    setPhase('idle');
  }, []);
  /** „Ohne Zweitmeinung weiter“: bricht ab und löst das lokale Urteil aus. */
  const skip = useCallback(() => {
    const c = ctl.current;
    token.current++;
    ac.current?.abort();
    setPhase('idle');
    c?.skip();
  }, []);
  const busy = phase === 'queued' || phase === 'thinking' || phase === 'slow' || phase === 'streaming';
  return { judge, cancel, skip, ctl, busy, phase };
}
