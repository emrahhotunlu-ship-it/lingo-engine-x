import { create } from 'zustand';
import { selectAiAvailable } from '../../../ai/scope';
import { useSettings } from '../../../app/settings';
import type { RouteOf } from '../../../app/router/types';
import type { UnitBlockProvider, UnitCtx } from '../../../app/unit/types';
import { inputBlockPlan, type InputBlockPlan } from '../../../domain/input/unitInput';
import type { ChoiceResult } from '../../../domain/input/types';
import type { UnitEnv } from '../../../domain/week/types';
import { useCapabilities } from '../../../platform/capabilities';
import { useSpeech } from '../../../platform/speech';
import { chooseSource, sourceFromRef } from './source';

// Block 2 der Tageseinheit (Neubau N53): Anbieter `input.read` / `input.listen` und der Lauf-Zustand
// der Übung (für das Fortsetzen, G3). `start(ctx)` läuft SYNCHRON im Klick: Quelle wählen, die
// Nachsprech-Sätze (`ctx.sentences`, für `pron.shadow`) und die Wendungen (`ctx.phrases`, für die
// Aufgabe, M8) eintragen, Route liefern.

export type BlockStep = 'input' | 'q' | 'summary' | 'notice' | 'done';

export type BlockRun = {
  /** `<tag>|<ref>` – gehört der Lauf zu dieser Route? */
  key: string;
  step: BlockStep;
  qi: number;
  /** Beantwortete Fragen (Schlüssel übersprungen beim Fortsetzen, G3). */
  results: ChoiceResult[];
  /** Fertig gehörte Durchgänge (Tempo-Leiter). */
  passes: number;
  /** Satz- bzw. Absatz-Position. */
  pos: number;
  /** Abschluss gespeichert (kein doppelter Schreibvorgang nach dem Fortsetzen). */
  saved: boolean;
  readingId: string | null;
  title: string;
};

export const useBlockRun = create<{ run: BlockRun | null }>(() => ({ run: null }));

export const runKey = (day: string, ref: string): string => `${day}|${ref}`;

export function patchRun(key: string, patch: Partial<BlockRun>): void {
  useBlockRun.setState((s) => (s.run && s.run.key === key ? { run: { ...s.run, ...patch } } : s));
}

export function freshRun(key: string, title: string): BlockRun {
  return { key, step: 'input', qi: 0, results: [], passes: 0, pos: 0, saved: false, readingId: null, title };
}

/** Umgebung jetzt (Sprachausgabe bereit, KI nutzbar). */
export function blockEnv(): UnitEnv {
  return { ai: selectAiAvailable(useCapabilities.getState()), tts: useSpeech.getState().status === 'ready' };
}

/** Zuletzt gestarteter Block-Kontext (nur im Speicher; nach dem Neuladen genügt die Route). */
export const useBlockCtx = create<{ ctx: UnitCtx | null }>(() => ({ ctx: null }));

export type InputUnitRoute = RouteOf<'inputUnit'>;

function startBlock(kind: 'read' | 'listen'): (ctx: UnitCtx) => InputUnitRoute | false {
  return (ctx) => {
    const themeId = ctx.theme?.id;
    if (!themeId) return false;
    const env = blockEnv();
    const lang = useSettings.getState().lang;
    const planned = inputBlockPlan(ctx.day, themeId, env);
    const plan: InputBlockPlan = { ...(planned ?? { src: 'theme-text', summary: false, ladder: kind === 'listen' }), kind: kind === 'listen' && env.tts ? 'listen' : 'read' };
    const chosen = chooseSource(plan, ctx.day, themeId, lang, env.tts);
    if (!chosen) return false;
    const src = sourceFromRef(chosen.ref, lang);
    if (src) {
      ctx.sentences = src.shadow.slice(0, 3);
      ctx.phrases = src.notice.map((n) => n.en).slice(0, 3);
    }
    useBlockCtx.setState({ ctx });
    const listen = chosen.kind === 'listen' && env.tts;
    const run = useBlockRun.getState().run;
    const key = runKey(ctx.day, chosen.ref);
    if (!run || run.key !== key) useBlockRun.setState({ run: freshRun(key, src?.title ?? '') });
    return { name: 'inputUnit', day: ctx.day, kind: listen ? 'listen' : 'read', ref: chosen.ref, ...(chosen.summary ? { summary: true } : {}) };
  };
}

/** Anbieter für das Register (`defineArea({ unitBlocks })`). */
export const INPUT_BLOCKS: readonly UnitBlockProvider[] = [
  { kind: 'input.read', feasible: () => true, start: startBlock('read') },
  { kind: 'input.listen', feasible: (env) => env.tts, start: startBlock('listen') },
];
